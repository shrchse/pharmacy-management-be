import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { sendError } from '../utils/apiResponse';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}, Math.max(env.RATE_LIMIT_WINDOW_MS, 1000));

cleanup.unref();

export const rateLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (env.NODE_ENV === 'test' || env.RATE_LIMIT_MAX <= 0) {
    return next();
  }

  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now
    ? current
    : { count: 0, resetAt: now + env.RATE_LIMIT_WINDOW_MS };

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, env.RATE_LIMIT_MAX - bucket.count);
  res.setHeader('X-RateLimit-Limit', String(env.RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > env.RATE_LIMIT_MAX) {
    return sendError(res, 'Too many requests', 429, { retryAfterMs: Math.max(0, bucket.resetAt - now) }, 'RATE_LIMITED');
  }

  return next();
};
