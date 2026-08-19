import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { env } from './config/env';
import { notFoundMiddleware } from './middlewares/notFound.middleware';
import { errorMiddleware } from './middlewares/error.middleware';
import { rateLimitMiddleware } from './middlewares/rateLimit.middleware';

const app: Application = express();

// Security & Utility Middlewares
app.set('trust proxy', env.TRUST_PROXY);
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN.includes('*') ? true : env.CORS_ORIGIN,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: () => env.NODE_ENV === 'test',
}));
app.use(rateLimitMiddleware);
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.JSON_BODY_LIMIT }));

// Root Welcome Endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'pharmacy-management-be',
    version: '1.0.0',
    status: 'online',
    message: 'Welcome to Pharmacy Management Backend System API',
  });
});

// API Routes Router
app.use('/api/v1', routes);

// 404 & Global Error Handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
