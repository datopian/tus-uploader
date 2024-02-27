import JWT from 'jsonwebtoken'
import http from 'node:http'
import fs from 'fs'
import { promisify } from 'util'

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
  entityType: string
  entityId: string = '*'
  subscope: string = '*'
  actions: string[] = []

  constructor(entity: string) {
    this.entityType = entity
  }

  static fromString(scopeStr: string): Scope {
    const parts = scopeStr.split(':')
    if (parts.length !== 4) {
      throw new Error("Scope string should have exactly 4 parts")
    }
    const scope = new Scope(parts[0])

    if (parts[1] !== '*') {
      scope.entityId = parts[1]
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

const authorization = (scopeStr: string, objectId: string, user: string): boolean => {
  const scope: Scope = Scope.fromString(scopeStr);
  const allowedActions = ['create', 'patch', 'update', 'write'];
  let isEntityIdValid: (scope: Scope, objectId: string) => boolean;
  if (process.env.SCOPE_TYPE === 'CKAN') {
    if (scope.entityId === 'ignore-object-check') {
      isEntityIdValid = (scope: Scope, objectId: string): boolean => true;
    } else {
      isEntityIdValid = (scope: Scope, objectId: string): boolean => scope.entityId === objectId;
    }
    const isSubscopeValid = (scope: Scope): boolean => scope.subscope === 'data';
    const isEntityTypeValid = (scope: Scope): boolean => scope.entityType === 'ds';
    const areActionsValid = (scope: Scope, allowedActions: string[]): boolean => scope.actions.some(item => allowedActions.includes(item));

    return isEntityIdValid(scope, objectId) &&
      isSubscopeValid(scope) &&
      isEntityTypeValid(scope) &&
      areActionsValid(scope, allowedActions);
  } else {
    return allowedActions.some(action => scopeStr.includes(action));
  }
}


export const authenticate = async (request: http.IncomingMessage, meta: Record<string, any>): Promise<any> => {
  let objectId;
  if (Object.keys(meta).length == 0 && request.method === 'HEAD') {    
    // HEAD requests don't have metadata and only used of checking offset
    // so we can ignore the object check
    objectId = 'ignore-object-check'
  } else {
    objectId = meta.metadata.datasetID || meta.metadata.objectId
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




