import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse';

export const notFoundMiddleware = (req: Request, res: Response, _next: NextFunction) => {
  return sendError(res, `Resource not found: ${req.method} ${req.originalUrl}`, 404);
};
