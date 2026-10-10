/**
 * L'application Express d'iVision (sans effet de bord : `index.ts` charge les secrets, la base
 * et le moteur avant de l'écouter).
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { databaseReady } from './config/db';
import { env } from './config/env';
import logger from './config/logger';
import { errorHandler, notFound } from './middleware/error';
import { requestTraceMiddleware } from './middleware/request-trace.middleware';
import { v1 } from './routes/v1';

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(requestTraceMiddleware);
  // Une API JSON : pas de page, donc pas de politique de contenu à négocier ici.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.allowedOrigins.includes(origin)) return callback(null, true);
        if (env.nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
        logger.warn('cors.blocked', { event: 'cors.blocked', origin });
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'Accept-Language', 'X-Requested-With', 'Cache-Control'],
      // Content-Disposition : le nom du fichier téléchargé, lu par `saveFile` côté web.
      exposedHeaders: ['X-Request-Id', 'X-Accel-Buffering', 'Content-Disposition'],
      maxAge: 600,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));
  app.use(hpp());

  app.get('/health', (_req, res) => {
    const db = databaseReady();
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', service: 'ivision-api', db });
  });
  app.use('/v1', v1);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
