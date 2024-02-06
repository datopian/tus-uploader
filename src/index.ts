import http from 'node:http'
import path from 'path'
import dotenv from 'dotenv'
import express, { Response, NextFunction } from 'express'
import { Server, Metadata } from '@tus/server'
import cors from "cors"

import { S3Store } from './store/s3store/index'
import session from 'express-session'
import { authenticate } from './auth'

import { Request } from './types'

dotenv.config()
const app = express();
const uploadApp = express()

const port = process.env.SERVER_PORT || 4000
const enableFolderUpload = process.env.ENABLE_FOLDER_UPLOAD === 'true' || false

const corsOptions = {
  origin: (process.env.CORS_ORIGIN || '*').split(' '),
  credentials: true,
  optionSuccessStatus: 200,
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
uploadApp.use(cors(corsOptions))

const s3StoreDatastore = new S3Store({
  partSize: 8 * 1024 * 1024, // each uploaded part will have ~8MiB,
  s3ClientConfig: {
    bucket: process.env.S3_BUCKET as string,
    endpoint: process.env.S3_ENDPOINT as string,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY as string,
      secretAccessKey: process.env.S3_ACCESS_SECRET as string,
    },
    region: process.env.S3_REGION || 'auto' as string,
  }
})

const server = new Server({
  path: '/uploads',
  datastore: s3StoreDatastore,
  relativeLocation: true,
  generateUrl(req: http.IncomingMessage, { proto, host, path, id }) {
    let url = `${proto}://${host}${path}/${id}`
    return decodeURIComponent(url)
  },
  onResponseError: (req, res, err) => {
    console.error(err)
  },
  namingFunction: (req: http.IncomingMessage) => {
    let name = ""
    let meta: any = Metadata.parse(req.headers['upload-metadata'] as string)
    const prefix = meta.prefix || ''
    if (meta.relativePath !== 'null' && enableFolderUpload) {
      name = meta.relativePath
    } else {
      name = meta.name
    }
    return decodeURIComponent(prefix + name)
  },

  getFileIdFromRequest: (req: Request) => {
    const newPath = path.join(path.sep, ...(req.url?.split(path.sep).slice(2) ?? []));
    return decodeURIComponent(newPath)
  }
})

const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const token = await authenticate(req)
  const user = req.session.userId
  if (user) {
    next()
  } else if (token && token.authorized) {
    req.session.userId = token.userId
    next()
  } else {
    res.status(401).send("Unauthorized user")
  }
}

uploadApp.use('/object-count', authenticateUser, async (req: Request, res: Response) => {
  const params = req.query
  params.prefix = params.prefix || ''
  if (!params.prefix && params.prefix !== '') {
    res.status(400).json({ message: 'Prefix is required' })
  }
  const count = await s3StoreDatastore.getObjectsCount()
  res.json({ count })
})

uploadApp.use('/object-clear', authenticateUser, async (req: Request, res: Response) => {
  const params = req.query
  params.prefix = params.prefix || ''
  if (!params.prefix && params.prefix !== '') {
    res.status(400).json({ message: 'Prefix is required' })
  }
  await s3StoreDatastore.clearObjects(params.prefix)
  res.json({ message: 'Objects cleared' })
})

uploadApp.all('*', authenticateUser, server.handle.bind(server))

app.use('/', uploadApp)

app.listen(port, () => {
  console.log(`Server running at http://127.0.0.1:${port}`);
})