import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error('http.unhandled_error', {
    event: 'http.unhandled_error',
    method: req.method,
    path: req.originalUrl?.split('?')[0],
    error: err,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
}
