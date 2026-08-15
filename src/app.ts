import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { notFoundMiddleware } from './middlewares/notFound.middleware';
import { errorMiddleware } from './middlewares/error.middleware';

const app: Application = express();

// Security & Utility Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
