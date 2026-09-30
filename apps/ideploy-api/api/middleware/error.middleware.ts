import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/** 404 handler. */
export function notFound(req: Request, res: Response): void {
  logger.debug('http.not_found', { event: 'http.not_found', method: req.method, path: req.path });
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

/** Central error handler. */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  logger.error('http.unhandled_error', {
    event: 'http.unhandled_error',
    method: req.method,
    path: req.originalUrl?.split('?')[0],
    error: err,
  });
  if (res.headersSent) return;
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
}
