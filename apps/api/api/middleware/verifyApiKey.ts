import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Middleware to verify API key for inter-service communication
 * Used to authenticate requests from Laravel and other internal services
 */
export const verifyApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.INTERNAL_API_KEY;

  logger.info('API Key verification attempt', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    allHeaders: Object.keys(req.headers),
    path: req.path,
    method: req.method,
  });

  if (!expectedApiKey) {
    logger.error('INTERNAL_API_KEY not configured in environment variables');
    res.status(500).json({
      success: false,
      message: 'Server configuration error',
    });
    return;
  }

  if (!apiKey) {
    logger.warn('API key verification failed: No API key provided', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({
      success: false,
      message: 'API key required',
    });
    return;
  }

  if (apiKey !== expectedApiKey) {
    logger.warn('API key verification failed: Invalid API key', {
      path: req.path,
      ip: req.ip,
    });
    res.status(403).json({
      success: false,
      message: 'Invalid API key',
    });
    return;
  }

  logger.info('API key verified successfully', {
    path: req.path,
  });

  next();
};
