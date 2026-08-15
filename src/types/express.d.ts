import { AuthContext } from '../middlewares/auth.middleware';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
