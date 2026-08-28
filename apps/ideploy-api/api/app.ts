/**
 * Express application assembly.
 *
 * Deliberately separate from `index.ts`: this module only *builds* the app
 * (middleware, routes, error handling) and starts nothing. `index.ts` owns the
 * side effects — binding the port and registering the background workers.
 *
 * That split is what lets contract tests exercise the real routing stack with
 * supertest without opening a socket, connecting to Redis or spawning workers.
 */
import express, { Express } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { stream } from './config/logger';
import { buildCorsOptions } from './config/cors.config';
import { notFound, errorHandler } from './middleware/error.middleware';
import { CustomRequest } from './interfaces/express.interface';

import healthRoutes from './routes/health.routes';
import serverRoutes from './routes/server.routes';
import workspaceRoutes from './routes/workspace.routes';
import applicationRoutes from './routes/application.routes';
import deployRoutes from './routes/deploy.routes';
import privateKeyRoutes from './routes/private-key.routes';
import destinationRoutes from './routes/destination.routes';
import proxyRoutes from './routes/proxy.routes';
import cloudRoutes from './routes/cloud.routes';
import databaseRoutes from './routes/database.routes';
import serviceRoutes from './routes/service.routes';
import tagRoutes from './routes/tag.routes';
import sharedEnvRoutes from './routes/shared-env.routes';
import securityRoutes from './routes/security.routes';
import pipelineRoutes from './routes/pipeline.routes';
import notificationRoutes from './routes/notification.routes';
import teamRoutes from './routes/team.routes';
import subscriptionRoutes from './routes/subscription.routes';
import settingsRoutes from './routes/settings.routes';
import resourcesRoutes from './routes/resources.routes';
import githubRoutes from './routes/github.routes';
import webhookRoutes, { managementRouter as webhookManagementRoutes } from './routes/webhook.routes';

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'iDeploy API', version: '1.0.0' },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./api/routes/*.ts'],
});

/** Build a fully wired Express app. Starts nothing. */
export function createApp(): Express {
  const app: Express = express();

  // ── Hardening ────────────────────────────────────────
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(hpp());
  app.use(cors(buildCorsOptions()));
  app.use(cookieParser());
  app.use(
    express.json({
      limit: '10mb',
      // Keep the transmitted bytes: webhook signatures are computed over them,
      // and a re-serialised body would never reproduce the same HMAC.
      verify: (req, _res, buf) => {
        (req as CustomRequest).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Request logging is noise in tests; keep it everywhere else.
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', { stream }));
  }

  // ── Docs ─────────────────────────────────────────────
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ── Routes ───────────────────────────────────────────
  app.use('/', healthRoutes);

  // Push-to-deploy, mounted FIRST and deliberately so.
  //
  // Several routers below are mounted on the bare `/api/v1` prefix and apply
  // `authenticate` to everything under it, so whichever is registered first
  // wins. Registered later, this endpoint answers 401 to every git host and
  // push-to-deploy silently never fires. A contract test pins this ordering.
  app.use('/api/v1/webhooks', webhookRoutes);
  app.use('/api/v1/servers', serverRoutes);
  app.use('/api/v1/workspaces', workspaceRoutes);
  app.use('/api/v1/applications', applicationRoutes);
  app.use('/api/v1/deploy', deployRoutes);
  app.use('/api/v1/security/keys', privateKeyRoutes);
  app.use('/api/v1', destinationRoutes); // /servers/:uuid/destinations, /destinations/:uuid
  app.use('/api/v1', proxyRoutes); // /servers/:uuid/proxy/*
  app.use('/api/v1/cloud', cloudRoutes);
  app.use('/api/v1/databases', databaseRoutes);
  app.use('/api/v1/services', serviceRoutes);
  app.use('/api/v1/tags', tagRoutes);
  app.use('/api/v1/shared-variables', sharedEnvRoutes);
  app.use('/api/v1', securityRoutes); // /applications/:uuid/firewall/*, /servers/:uuid/crowdsec|certificates
  app.use('/api/v1', pipelineRoutes); // /applications/:uuid/pipeline/*, /pipeline/executions/:uuid
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/team', teamRoutes);
  app.use('/api/v1/subscription', subscriptionRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1', resourcesRoutes); // /version, /resources
  app.use('/api/v1/github', githubRoutes);
  app.use('/api/v1', webhookManagementRoutes); // /applications/:uuid/webhooks/*

  // ── Error handling ───────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
