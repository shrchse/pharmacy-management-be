import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { HttpError, sendError } from '../utils/apiResponse';
import { env } from '../config/env';

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (env.NODE_ENV !== 'test') {
    console.error('Error caught in global middleware:', err);
  }

  if (err instanceof ZodError) {
    return sendError(
      res,
      'Validation error',
      400,
      err.issues.map((issue) => ({
        path: issue.path.join('.') || 'request',
        message: issue.message,
      })),
      'VALIDATION_ERROR'
    );
  }

  if (err instanceof HttpError) {
    return sendError(res, err.message, err.statusCode, err.details, err.code);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return sendError(res, 'A record with this unique constraint already exists.', 409, err.meta, 'UNIQUE_CONSTRAINT');
      case 'P2025':
        return sendError(res, 'Record not found.', 404, undefined, 'NOT_FOUND');
      default:
        return sendError(res, `Database error: ${err.message}`, 400, err.meta, 'DATABASE_ERROR');
    }
  }

  const statusCode = (err as unknown as { statusCode?: number }).statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return sendError(
    res,
    message,
    statusCode,
    env.NODE_ENV === 'development' ? err.stack : undefined
  );
};
