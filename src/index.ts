import http from 'node:http'
import path from 'path'

import cors from "cors"
import express, { Response, NextFunction } from 'express'
import session from 'express-session'
import bodyParser from 'body-parser'
import { createClient } from '@redis/client'
import { Server, Metadata, MemoryKvStore, RedisKvStore, FileKvStore } from '@tus/server'
import { ExtendedFileStore } from './store/Filestore'
import { S3Store } from '@tus/s3-store'

import { authenticate } from './auth'
import { config } from "./config"
import companion from './companion'

import { Request } from './types'


const app = express()
const uploadApp = express()

const port = config.serverPort
const enableFolderUpload = config.enableFolderUpload

const corsOptions = {
  origin: (config.corsOrigin || '*').split(' '),
  credentials: true,
}

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    name: 'up-session',
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.sessionExpiry, // Default 24 hours,
    }
  })
)

app.use(bodyParser.json())
app.use(cors(corsOptions))

const createRedisClient = () => {
  const redisClient = createClient({
    url: config.redisUrl
  })
  redisClient.on("error", (error: Error) => console.error(`Error : ${error}`))
  redisClient.connect()
  return redisClient
}

const configStore = () => {
  switch (config.storeType) {
    case 'memory':
      return new MemoryKvStore()
    case 'redis':
      const redisClient = createRedisClient()
      if (!redisClient) {
        throw new Error('Redis client is not initialized')
      }
      return new RedisKvStore(redisClient as any, '')
    default:
      return new FileKvStore(path.resolve(config.fileStorePath))
  }
}

const s3StoreDatastore = new S3Store({
  partSize: 8 * 1024 * 1024, // each uploaded part will have ~8MiB,
  useTags: config.s3UseTags,
  s3ClientConfig: {
    bucket: config.s3Bucket,
    endpoint: config.s3Endpoint,
    credentials: {
      accessKeyId: config.s3AccessKey,
      secretAccessKey: config.s3AccessSecret
    },
    region: config.s3Region
  },
  //@ts-ignore
  cache: configStore()
})

const fileStoreDatastore = new ExtendedFileStore({
  directory: path.resolve(config.fileStorePath),
  expirationPeriodInMilliseconds: config.fileStoreExpiry,
  configstore: configStore()
})

const store = {
  "s3_store": s3StoreDatastore,
  "file_store": fileStoreDatastore
}

const getFileIdFromRequest = (req: Request) => {
  return decodeURIComponent(req.url.replace(config.serverUploadPath + '/', ''))
}

const server = new Server({
  path: config.serverUploadPath,
  datastore: store[config.storeType as keyof typeof store],
  relativeLocation: true,
  generateUrl(req: http.IncomingMessage, { proto, host, path, id }) {
    let serverUrl: string = (config.serverUrl ?? host).replace(/\/$/, '')
    let url = `${serverUrl}${path}/${id}`
    return decodeURIComponent(url)
  },

  onResponseError: (req, res, err: any) => {
    // if error type is aborted, then it means the request was aborted by the client
    if (err.message === 'aborted') {
      console.log('Request aborted by the client')
    } else {
      console.error('Request failed:', err)
    }
  },

  namingFunction: (req: http.IncomingMessage) => {
    let name = ""
    let meta: any = Metadata.parse(req.headers['upload-metadata'] as string)
    const prefix = meta.resourceID + '/'
    if (meta.relativePath !== 'null' && enableFolderUpload) {
      name = meta.relativePath
    } else {
      name = meta.name
    }
    return decodeURIComponent(prefix + name)
  },

  getFileIdFromRequest: (req: Request) => {
    return getFileIdFromRequest(req)
  }
})

const getMetadataFromConfig = async (req: Request) => {
  const key = getFileIdFromRequest(req)
  if (config.storeType === 'file_store') {
    const meta = fileStoreDatastore.configstore
    return await meta.get(decodeURIComponent(key))
  }

  if (config.storeType === 's3_store') {
    const meta: any = await s3StoreDatastore
    let data = await meta.getMetadata(decodeURIComponent(key))
    return data.file
  }
}

const getMeatadatFromHeader = (req: Request) => {
  let meta: Record<string, any> = {}
  meta.size = req.headers['content-length']
  meta.id = getFileIdFromRequest(req)
  meta.metadata = Metadata.parse(req.headers['upload-metadata'] as string)
  return meta
}

const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  let metadata: Record<string, any> = {}

  if (req.method === 'POST') {
    metadata = getMeatadatFromHeader(req)
  } else if (req.method !== 'HEAD') {
    metadata = await getMetadataFromConfig(req) || {}
  }

  const token = await authenticate(req, metadata)
  const user = req.session.userId

  if (user || (token && token.authorized)) {
    req.session.userId = token.userId
    next()
  } else {
    res.status(401).send("Unauthorized user")
  }
}

uploadApp.all('*', server.handle.bind(server))

// Uppy companion server
if (config.companionUppyUpload) {
  console.log(`Running with Uppy Companion at ${config.companionDomain}`)
  app.use('/', companion.app)
  companion.socket(app.listen(3020))
}

companion.emitter.on('upload-start', ({ token }: any) => {
  console.log('Upload started', token)
  function onUploadEvent({ action, payload }: any) {
    if (action === 'success') {
      companion.emitter.off(token, onUploadEvent) // avoid listener leak
      console.log('Upload finished', token, payload.url)
    } else if (action === 'error') {
      companion.emitter.off(token, onUploadEvent) // avoid listener leak
      console.error('Upload failed', payload)
    }
  }
  companion.emitter.on(token, onUploadEvent)
})

app.post('/folder_delete', (req, res, next) => {
  if (!req.body.folder) {
    res.status(400).json({ error: "folder path is required" })
  }
  const folderPath = path.resolve(config.fileStorePath) + '/' + req.body.folder
  try {
    fileStoreDatastore.removeFolder(folderPath)
    res.status(200).json({ message: "folder removed successfully" })
  } catch (error) {
    res.status(404).json({ error: "folder not found, or error occured" })
  }
   // TODO: Add S3 folder remove
})

app.post('/folder_detail', async (req, res, next) => {
  if (!req.body.folder) {
    res.status(400).json({ error: "folder path is required" })
  }
  const folderPath = path.resolve(config.fileStorePath) + '/' + req.body.folder

  try {
    const folderInfo = await fileStoreDatastore.getFolderInfo(folderPath)
    res.status(200).json(folderInfo)
  } catch (error) {
    res.status(404).json({ error: "folder not found, or error occured" })
  }
  // TODO: Add S3 folder details
})

// Tus upload server 
app.use('/', (req, res, next) => {
  authenticateUser(req, res, next)
}, uploadApp)

app.listen(port, () => {
  console.log(`Server running at http://127.0.0.1:${port}`)
  console.log(`Running server with : "${config.storeType}" and "${config.configStore}" config store`)
})