import http from 'node:http'
import path from 'path'

import cors from "cors"
import dotenv from 'dotenv'
import express, { Response, NextFunction } from 'express'
import session from 'express-session'
import { createClient } from '@redis/client'
import { Server, Metadata, MemoryKvStore, RedisKvStore, FileKvStore } from '@tus/server'
import { FileStore } from '@tus/file-store'
import { S3Store } from '@tus/s3-store'

import { authenticate } from './auth'

import { Request } from './types'

dotenv.config()

const app = express()
const uploadApp = express()

const port = process.env.SERVER_PORT || 4000
const enableFolderUpload = process.env.ENABLE_FOLDER_UPLOAD === 'true' || false

const corsOptions = {
  origin: (process.env.CORS_ORIGIN || '*').split(' '),
  credentials: true,
}

app.use(
  session({
    secret: process.env.SESSION_SECRET as string || 'secret',
    resave: false,
    saveUninitialized: true,
    name: 'uploader-session',
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: parseInt(process.env.SESSION_EXPIRY || '86400'), // Default 24 hours,
    }
  })
)

app.use(cors(corsOptions))


const createRedisClient = () => {
  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379/3'
  })
  redisClient.on("error", (error: Error) => console.error(`Error : ${error}`))
  redisClient.connect()
  return redisClient
}

const configStore = () => {
  switch (process.env.CONFIG_STORE) {
    case 'memory':
      return new MemoryKvStore()
    case 'redis':
      const redisClient = createRedisClient()
      if (!redisClient) {
        throw new Error('Redis client is not initialized')
      }
      return new RedisKvStore(redisClient as any, '')
    default:
      return new FileKvStore(path.resolve(process.env.CONFIG_STORE_PATH as string || './uploads'))
  }
}

const s3StoreDatastore = new S3Store({
  partSize: 8 * 1024 * 1024, // each uploaded part will have ~8MiB,
  useTags: process.env.S3_USE_TAGS === 'true' || false,
  s3ClientConfig: {
    bucket: process.env.S3_BUCKET as string,
    endpoint: process.env.S3_ENDPOINT as string,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_ACCESS_SECRET as string,
    },
    region: process.env.S3_REGION || 'auto' as string,
  },
  cache: configStore() as any
})

const fileStoreDatastore = new FileStore({
  directory: path.resolve(process.env.FILE_STORE_PATH as string || './uploads'),
  expirationPeriodInMilliseconds: parseInt(process.env.FILE_STORE_EXPIRY || '86400000'), // Default 24 hours
  configstore: configStore() as any
})

const store = {
  "s3_store": s3StoreDatastore,
  "file_store": fileStoreDatastore
}

const getFileIdFromRequest = (req: Request) => {
  return decodeURIComponent(req.url.replace('/uploads/', ''))
}

const server = new Server({
  path: process.env.SERVER_UPLOAD_PATH || '/uploads',
  datastore: store[process.env.STORE_TYPE as keyof typeof store || 'file_store'],
  relativeLocation: true,
  generateUrl(req: http.IncomingMessage, { proto, host, path, id }) {
    let serverUrl: string = (process.env.SERVER_URL ?? host).replace(/\/$/, '')
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
  if (process.env.STORE_TYPE === 'file_store') {
    const meta = fileStoreDatastore.configstore
    return await meta.get(decodeURIComponent(key))
  }

  if (process.env.STORE_TYPE === 's3_store') {
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
  let metadata: Record<string, any> = {};

  if (req.method === 'POST') {
    metadata = getMeatadatFromHeader(req);
  } else if (req.method !== 'HEAD') {
    metadata = await getMetadataFromConfig(req) || {};
  }

  const token = await authenticate(req, metadata);
  const user = req.session.userId;

  if (user || (token && token.authorized)) {
    req.session.userId = token.userId;
    next();
  } else {
    res.status(401).send("Unauthorized user");
  }
}

uploadApp.all('*', server.handle.bind(server))

app.use('/', (req, res, next) => {
  authenticateUser(req, res, next)
}, uploadApp)


app.listen(port, () => {
  console.log(`Server running at http://127.0.0.1:${port}`)
  console.log(`Running with store: "${process.env.STORE_TYPE}" and "${process.env.CONFIG_STORE}" config store`)
})