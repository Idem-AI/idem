import { CorsOptions } from 'cors';
import logger from './logger';

/**
 * Build a strict CORS configuration:
 *   - In production: ONLY origins from CORS_ALLOWED_ORIGINS are accepted.
 *     localhost is rejected. Requests with no origin (server-to-server) are
 *     accepted only when ALLOW_NO_ORIGIN_REQUESTS=true.
 *   - In development: localhost is auto-allowed for DX.
 */
export function buildCorsOptions(): CorsOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowNoOrigin =
    process.env.ALLOW_NO_ORIGIN_REQUESTS === 'true' || !isProd;

  return {
    origin: (origin, callback) => {
      if (!origin) {
        if (allowNoOrigin) return callback(null, true);
        logger.warn('CORS: blocked request with no origin');
        return callback(new Error('Not allowed by CORS'));
      }

      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.)/.test(origin)) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

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
      'Accept-Language',
      'Accept-Encoding',
      'Connection',
      'User-Agent',
      'Referer',
      'Origin',
      'X-Requested-With',
      'X-API-Key',
    ],
    exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection', 'X-Accel-Buffering'],
    maxAge: 600,
  };
}
