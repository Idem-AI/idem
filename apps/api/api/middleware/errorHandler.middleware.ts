import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Custom application error class
 * Distinguishes operational errors from programming errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    code?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Factory methods for common error types
   */
  static badRequest(message: string, code?: string): AppError {
    return new AppError(400, message, true, code);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, message, true, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, message, true, 'FORBIDDEN');
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, message, true, 'NOT_FOUND');
  }

  static conflict(message: string): AppError {
    return new AppError(409, message, true, 'CONFLICT');
  }

  static tooManyRequests(message = 'Too many requests'): AppError {
    return new AppError(429, message, true, 'RATE_LIMIT_EXCEEDED');
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, message, false, 'INTERNAL_ERROR');
  }
}

/**
 * Global error handler middleware
 * Must be registered last in the middleware chain
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default values
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;
  let code: string | undefined = 'INTERNAL_ERROR';

  // Handle AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
    code = err.code;
  }

  // Log the error
  if (isOperational) {
    logger.warn('Operational error', {
      statusCode,
      message,
      code,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.error('Unexpected error', {
      statusCode,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    message: isOperational ? message : 'Something went wrong',
    code,
    ...(process.env.NODE_ENV === 'development' && !isOperational
      ? { stack: err.stack }
      : {}),
  });
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
