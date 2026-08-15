import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  data?: T;
  meta?: {
    message?: string;
    [key: string]: unknown;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class HttpError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Operation successful',
  statusCode: number = 200,
  meta: Record<string, unknown> = {}
): Response => {
  return res.status(statusCode).json({
    data,
    meta: {
      message,
      ...meta,
    },
  });
};

export const sendError = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  details?: unknown,
  code?: string
): Response => {
  return res.status(statusCode).json({
    error: {
      code: code ?? statusCodeToCode(statusCode),
      message,
      details: details || undefined,
    },
  });
};

const statusCodeToCode = (statusCode: number) => {
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHENTICATED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  return 'INTERNAL_ERROR';
};
