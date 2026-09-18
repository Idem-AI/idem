import { CorsOptions } from 'cors';
import logger from './logger';

/**
 * Build a strict CORS configuration:
 *   - In production: ONLY origins from CORS_ALLOWED_ORIGINS are accepted.
 *     localhost is rejected.
 *   - Requests with no origin (server-to-server, e.g. Guzzle/curl) are always
 *     allowed — CORS is a browser mechanism; server-to-server calls are
 *     authenticated via X-Ideploy-Secret or Bearer token instead.
 *   - In development: localhost is auto-allowed for DX.
 */
export function buildCorsOptions(): CorsOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    origin: (origin, callback) => {
      // No origin = server-to-server request (Guzzle, curl, internal services).
      // Always allow — authentication is handled by X-Ideploy-Secret / Bearer token.
      if (!origin) return callback(null, true);

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
      // Sans cet en-tête au préflight, le navigateur bloque tout `POST
      // /billing/checkout` : c'est la clé d'idempotence qui empêche un double
      // clic de débiter deux fois. Elle voyage donc sur chaque paiement.
      'Idempotency-Key',
      // AppGen identifie le projet à débloquer par un en-tête plutôt que par
      // l'URL, parce que la route de déploiement est commune à tous.
      'X-Appgen-Project-Id',
    ],
    exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection', 'X-Accel-Buffering'],
    maxAge: 600,
    optionsSuccessStatus: 200,
  };
}

