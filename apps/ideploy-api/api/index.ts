/**
 * Process entry point: load secrets, start the background workers, then serve.
 *
 * The app itself is assembled in `app.ts` — keep this file limited to side
 * effects (secrets, port binding, worker registration, fatal-error handling) so
 * the routing stack stays testable in isolation.
 *
 * ORDER MATTERS: the Postgres pool, the Redis client and the queue connections
 * read `process.env` when their module is first imported. Everything that
 * touches them is therefore imported dynamically, AFTER the secrets have been
 * injected — a static import would be hoisted above `loadSecrets()` and
 * connect with an empty password.
 */
import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { loadSecretsFromManager } from './config/secret-loader';
import { SECRET_MANIFEST } from './config/secrets.manifest';

async function bootstrap(): Promise<void> {
  await loadSecretsFromManager(SECRET_MANIFEST);

  const { default: logger, captureConsole, installProcessHandlers } = await import('./config/logger');
  captureConsole();
  installProcessHandlers();
  const { createApp } = await import('./app');
  const { registerTerminalGateway } = await import('./ws/terminal.gateway');
  const { registerDeploymentWorker } = await import('./jobs/deployment.worker');
  const { registerPipelineWorker } = await import('./jobs/pipeline.worker');
  const { registerBackupWorker, registerBackupScheduler } = await import('./jobs/backup.worker');
  const { registerScheduledTaskWorker, registerScheduledTaskScheduler } = await import(
    './jobs/scheduled-task.worker'
  );
  const { registerServerHealthWorker, registerServerHealthScheduler } = await import(
    './jobs/server-health.worker'
  );
  const { registerFirewallObservabilityWorker, registerFirewallObservabilityScheduler } = await import(
    './jobs/firewall-observability.worker'
  );

  const app = createApp();
  const port = parseInt(process.env.PORT || '3002', 10);

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
  // An explicit http.Server so the terminal gateway can share this port: the
  // WebSocket then has the same origin as the API, and the same session cookie.
  const server = http.createServer(app);
  registerTerminalGateway(server);
  server.listen(port, () => {
    logger.info(`iDeploy API listening on port ${port}`, {
      event: 'process.start',
      port,
      node: process.version,
      logLevel: logger.level,
    });
  });
}

bootstrap().catch((err) => {
  // Le logger n'est peut-être pas encore chargé (échec des secrets) : console.
  console.error('Bootstrap failed', { message: (err as Error).message });
  process.exit(1);
});
