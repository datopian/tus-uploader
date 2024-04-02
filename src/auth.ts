import JWT from 'jsonwebtoken'
import http from 'node:http'
import fs from 'fs'
import { promisify } from 'util'

import { config } from './config'

const getToken = (req: any) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]
  return token
}

const getPublicKey = async (): Promise<string> => {
  const publicKey: string | undefined = config.authPublicKey
  const publicKeyFile: string | undefined = config.authPublicKeyFile

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

const authorization = (action:string, scopeStr: string, objectId: string, user: string): boolean => {
  const scope: Scope = Scope.fromString(scopeStr);
  const readAllowedScope = ['read']; // Download file etc..
  const writeAlloweScope = ['create', 'patch', 'update', 'write'];
  if (config.scopeType === 'CKAN') {
    const isEntityIdValid = (scope: Scope, objectId: string): boolean => scope.entityId === objectId;
    const isSubscopeValid = (scope: Scope): boolean => scope.subscope === 'data';
    const isEntityTypeValid = (scope: Scope): boolean => scope.entityType === 'ds';
    let areActionsValid;
    if (action === 'read') {
      areActionsValid = (scope: Scope): boolean => scope.actions.some(item => readAllowedScope.includes(item));
    } else {
      areActionsValid = (scope: Scope): boolean => scope.actions.some(item => writeAlloweScope.includes(item));
    }
    return isEntityIdValid(scope, objectId) &&
      isSubscopeValid(scope) &&
      isEntityTypeValid(scope) &&
      areActionsValid(scope);
  } else {
    return writeAlloweScope.some(action => scopeStr.includes(action));
  }
}

export const authenticate = async (request: http.IncomingMessage, objectId: string): Promise<any> => {
  const action  = request.method == 'GET' ? 'read' : 'write'
  const token = getToken(request)
  const JWT_PUBLIC_KEY: string = await getPublicKey()
  if (token) {
    try {
      const decoded: any = JWT.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] })
      return {
        userId: decoded.sub,
        authorized: authorization(action, decoded.scopes, objectId, decoded.sub)
      }
    } catch (err: any) {
      console.error(`Error verifying token: ${err.message}`)
      return
    }
  }
}




