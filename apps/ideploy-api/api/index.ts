/**
 * Process entry point: start the background workers, then serve.
 *
 * The app itself is assembled in `app.ts` — keep this file limited to side
 * effects (port binding, worker registration, fatal-error handling) so the
 * routing stack stays testable in isolation.
 */
import dotenv from 'dotenv';
dotenv.config();

import logger from './config/logger';
import { createApp } from './app';

import { registerDeploymentWorker } from './jobs/deployment.worker';
import { registerPipelineWorker } from './jobs/pipeline.worker';
import { registerBackupWorker, registerBackupScheduler } from './jobs/backup.worker';
import {
  registerScheduledTaskWorker,
  registerScheduledTaskScheduler,
} from './jobs/scheduled-task.worker';
import {
  registerServerHealthWorker,
  registerServerHealthScheduler,
} from './jobs/server-health.worker';
import {
  registerFirewallObservabilityWorker,
  registerFirewallObservabilityScheduler,
} from './jobs/firewall-observability.worker';

const app = createApp();
const port = parseInt(process.env.PORT || '3002', 10);

async function bootstrap(): Promise<void> {
  registerDeploymentWorker();
  registerBackupWorker();
  await registerBackupScheduler();
  registerScheduledTaskWorker();
  await registerScheduledTaskScheduler();
  registerPipelineWorker();
  registerServerHealthWorker();
  await registerServerHealthScheduler();
  registerFirewallObservabilityWorker();
  await registerFirewallObservabilityScheduler();
  app.listen(port, () => {
    logger.info(`iDeploy API listening on port ${port}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { message: (err as Error).message });
  process.exit(1);
});

export default app;
