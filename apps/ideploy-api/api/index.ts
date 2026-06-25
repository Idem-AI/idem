import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import logger, { stream } from './config/logger';
import { buildCorsOptions } from './config/cors.config';
import { notFound, errorHandler } from './middleware/error.middleware';

import healthRoutes from './routes/health.routes';
import serverRoutes from './routes/server.routes';
import projectRoutes from './routes/project.routes';
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

import { registerDeploymentWorker } from './jobs/deployment.worker';
import { registerPipelineWorker } from './jobs/pipeline.worker';
import { registerBackupWorker, registerBackupScheduler } from './jobs/backup.worker';
import {
  registerScheduledTaskWorker,
  registerScheduledTaskScheduler,
} from './jobs/scheduled-task.worker';

const app: Express = express();
const port = parseInt(process.env.PORT || '3002', 10);

// ── Hardening ──────────────────────────────────────────
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(hpp());
app.use(cors(buildCorsOptions()));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream }));

// ── Swagger ────────────────────────────────────────────
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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Routes ─────────────────────────────────────────────
app.use('/', healthRoutes);
app.use('/api/v1/servers', serverRoutes);
app.use('/api/v1/projects', projectRoutes);
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

// ── Error handling ─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

async function bootstrap(): Promise<void> {
  registerDeploymentWorker();
  registerBackupWorker();
  await registerBackupScheduler();
  registerScheduledTaskWorker();
  await registerScheduledTaskScheduler();
  registerPipelineWorker();
  app.listen(port, () => {
    logger.info(`iDeploy API listening on port ${port}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { message: (err as Error).message });
  process.exit(1);
});

export default app;
