import { Request, Response } from 'express';
import { Session } from 'express-session';

export interface RequestSession extends Session {
  userId?: string;
  params: any;
}
  
export type Request = express.Request & CustomSRequestSessionession;