import JWT from 'jsonwebtoken'
import http from 'node:http';
import fs from 'fs'
import { promisify } from 'util';


const getToken = (req: any) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  return token
}

const getPublicKey = async (): Promise<string> => {
  const publicKey: string | undefined = process.env.AUTH_PUBLIC_KEY;
  const publicKeyFile: string | undefined = process.env.AUTH_PUBLIC_KEY_FILE;

  if (!publicKey && publicKeyFile) {
    try {
      const readFileAsync = promisify(fs.readFile);
      const data = await readFileAsync(publicKeyFile, 'utf8');
      return data;
    } catch (err) {
      console.error(`Error reading public key file: ${err}`);
      throw err;
    }
  } else if (publicKey) {
    return publicKey.replace(/\\n/g, '\n');
  } else {
    throw new Error('Neither public key nor public key file found in environment variables');
  }
}

class Scope {
  name: string;
  entityRef: string = '*';
  subscope: string = '*';
  actions: string[] = [];

  constructor(name: string) {
    this.name = name;
  }

  static fromString(scopeStr: string): Scope {
    const parts = scopeStr.split(':');
    if (parts.length < 1) {
      throw new Error("Scope string should have at least 1 part");
    }
    const scope = new Scope(parts[0]);

    switch (parts.length) {
      case 4:
        if (parts[2] !== '*') {
          scope.subscope = parts[2];
        }
        if (parts[3] !== '*') {
          scope.actions = Scope._parseActions(parts[3]);
        }
        break;
      case 3:
        if (parts[2] !== '*') {
          scope.actions = Scope._parseActions(parts[2]);
        }
      case 2:
        if (parts[1] !== '*') {
          scope.entityRef = parts[1];
        }
        break;
    }

    return scope;
  }

  private static _parseActions(actionsStr: string): string[] {
    return actionsStr ? actionsStr.split(',') : [];
  }
}

const authorization = (scopeStr: string): boolean => {
  const scope: Scope = Scope.fromString(scopeStr);
  // TODO: implement more authorization logic provided from scope 
  // for now it just checks if the scope has write access
  const allowedActions = ['create', 'patch', 'update', 'write'];
  if (process.env.SCOPE_TYPE === 'CKAN') {
    return scope.actions.some(item => allowedActions.includes(item))
  } else {
    return allowedActions.some(action => scopeStr.includes(action));
  }
}

export const authenticate = async (request: http.IncomingMessage): Promise<any> => {
  const token = getToken(request)
  const JWT_PUBLIC_KEY: string = await getPublicKey()
  if (token) {
    try {
      const decoded: any = JWT.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] })
      return {
        userId: decoded.sub,
        authorized: authorization(decoded.scopes)
      }
    } catch (err: any) {
      console.error(`Error verifying token: ${err.message}`)
      return
    }
  }
}




