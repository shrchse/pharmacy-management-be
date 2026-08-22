import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL environment variable is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*').transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  JSON_BODY_LIMIT: z.string().default('1mb'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform((value) => parseInt(value, 10)),
  RATE_LIMIT_MAX: z.string().default('600').transform((value) => parseInt(value, 10)),
}).superRefine((value, ctx) => {
  if (
    value.NODE_ENV === 'production' &&
    (value.JWT_SECRET.includes('change-this') || value.JWT_SECRET.includes('development-secret'))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET must be a production secret, not the example development value',
    });
  }
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    process.exit(1);
  }

  return result.data;
};

export const env = parseEnv();
