import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';

export const checkHealth = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const healthStatus = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };

    return sendSuccess(res, healthStatus, 'System health operational');
  } catch (error) {
    return next(error);
  }
};
