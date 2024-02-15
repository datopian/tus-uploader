import JWT from 'jsonwebtoken'
import http from 'node:http'
import fs from 'fs'
import { promisify } from 'util'
import { Metadata } from '@tus/server'

const getToken = (req: any) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  return token
}

const getPublicKey = async (): Promise<string> => {
  const publicKey: string | undefined = process.env.AUTH_PUBLIC_KEY
  const publicKeyFile: string | undefined = process.env.AUTH_PUBLIC_KEY_FILE

  if (!publicKey && publicKeyFile) {
    try {
      const readFileAsync = promisify(fs.readFile)
      const data = await readFileAsync(publicKeyFile, 'utf8')
      return data
    } catch (err) {
      console.error(`Error reading public key file: ${err}`)
      throw err
    }
  } else if (publicKey) {
    return publicKey.replace(/\\n/g, '\n')
  } else {
    throw new Error('Neither public key nor public key file found in environment variables')
  }
}

class Scope {
  entity_type: string
  entity_id: string = '*'
  subscope: string = '*'
  actions: string[] = []

  constructor(entity: string) {
    this.entity_type = entity
  }

  static fromString(scopeStr: string): Scope {
    const parts = scopeStr.split(':')
    if (parts.length !== 4) {
      throw new Error("Scope string should have exactly 4 parts")
    }
    const scope = new Scope(parts[0])

    if (parts[1] !== '*') {
      scope.entity_id = parts[1]
    }

    if (parts[2] !== '*') {
      scope.subscope = parts[2]
    }

    if (parts[3] !== '*') {
      scope.actions = Scope._parseActions(parts[3])
    }
    return scope
  }

  private static _parseActions(actionsStr: string): string[] {
    return actionsStr ? actionsStr.split(',') : []
  }
}

const authorization = (scopeStr: string, dataset_id: string, user: string): boolean => {
  const scope: Scope = Scope.fromString(scopeStr);
  const allowedActions = ['create', 'patch', 'update', 'write'];
  if (process.env.SCOPE_TYPE === 'CKAN') {
    const isEntityIdValid = (scope: Scope, dataset_id: string): boolean => scope.entity_id === dataset_id
    const isSubscopeValid = (scope: Scope): boolean => scope.subscope === 'data'
    const isEntityTypeValid = (scope: Scope): boolean => scope.entity_type === 'ds'
    const areActionsValid = (scope: Scope, allowedActions: string[]): boolean => scope.actions.some(item => allowedActions.includes(item))
    return isEntityIdValid(scope, dataset_id) &&
      isSubscopeValid(scope) &&
      isEntityTypeValid(scope) &&
      areActionsValid(scope, allowedActions)
  } else {
    return allowedActions.some(action => scopeStr.includes(action))
  }
  return false
}


const extractObjectIdFromUrl = (url: string): string => {
  const URLparts = url.split('/');
  return URLparts[2];
}

const extractObjectIdFromMetadata = (metadataHeader: string): string => {
  const meta: any = Metadata.parse(metadataHeader);
  return meta.resourceID
}

export const authenticate = async (request: http.IncomingMessage): Promise<any> => {
  let objectId = extractObjectIdFromUrl(request.url as string);

  if (!objectId && request.headers['upload-metadata']) {
    objectId = extractObjectIdFromMetadata(request.headers['upload-metadata'] as string);
  }

  const token = getToken(request)
  const JWT_PUBLIC_KEY: string = await getPublicKey()
  if (token) {
    try {
      const decoded: any = JWT.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] })
      return {
        userId: decoded.sub,
        authorized: authorization(decoded.scopes, objectId, decoded.sub)
      }
    } catch (err: any) {
      console.error(`Error verifying token: ${err.message}`)
      return
    }
  }
}




