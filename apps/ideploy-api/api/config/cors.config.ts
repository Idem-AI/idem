import { CorsOptions } from 'cors';
import logger from './logger';

/**
 * Strict CORS, identical policy to apps/api: prod accepts only the configured
 * origins; dev auto-allows localhost; origin-less (server-to-server) requests
 * are allowed and authenticated by Bearer token instead.
 */
export function buildCorsOptions(): CorsOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.)/.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn(`CORS: blocked origin ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Accept',
      'X-Requested-With',
      'X-API-Key',
    ],
    exposedHeaders: ['Content-Type', 'Cache-Control', 'X-Accel-Buffering'],
    maxAge: 600,
  };
}
