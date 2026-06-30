import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/** 404 handler. */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

/** Central error handler. */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  logger.error('Unhandled error', { message: err.message, stack: err.stack });
  if (res.headersSent) return;
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
}
