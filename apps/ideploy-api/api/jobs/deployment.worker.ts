/**
 * Deployment worker (BullMQ) — port of the core ApplicationDeploymentJob flow.
 *
 * Flow (vertical slice): resolve app + server → stream live logs to Soketi →
 * prepare remote workdir → write docker-compose → pull/build → `docker compose
 * up -d` → verify container → update status. Git clone + nixpacks build land in
 * a later phase; this proves the end-to-end pipeline (queue → SSH → Docker →
 * realtime logs).
 */
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queues';
import { registerWorker } from '../queue/worker';
import logger from '../config/logger';
import { realtime } from '../services/realtime.service';
import { executeRemoteCommand } from '../ssh/ssh';
import { generateComposeFile, appWorkdir } from '../docker/compose';
import * as appService from '../services/application.service';
import * as serverService from '../services/server.service';
import * as deploymentService from '../services/deployment.service';
import { DeploymentJobData } from '../services/deployment.service';
import { ApplicationRow } from '../models/ideploy.types';

async function streamStep(
  deploymentUuid: string,
  label: string,
  fn: () => Promise<void>
): Promise<void> {
  await realtime.deploymentLog(deploymentUuid, `\n──► ${label}`);
  await fn();
}

async function processDeployment(job: Job<DeploymentJobData>): Promise<void> {
  const { deploymentUuid, applicationUuid, teamId } = job.data;
  const log = (line: string): Promise<void> => realtime.deploymentLog(deploymentUuid, line);

  await deploymentService.setDeploymentStatus(deploymentUuid, 'in_progress');
  await log(`Deployment ${deploymentUuid} started for application ${applicationUuid}`);

  try {
    const app = await appService.getApplication(teamId, applicationUuid);
    if (!app) throw new Error('Application not found');

    const serverRef = await appService.getApplicationServer(app.id);
    if (!serverRef) throw new Error('No server/destination resolved for this application');

    const server = await serverService.getServerById(teamId, serverRef.serverId);
    if (!server) throw new Error('Server not found');
    const key = await serverService.getPrivateKey(teamId, server.private_key_id);
    if (!key) throw new Error('Private key not found');

    const workdir = appWorkdir(app);
    const imageTag = `${app.name}:${deploymentUuid.slice(0, 8)}`.toLowerCase();
    const compose = generateComposeFile(app, app.git_repository ? imageTag : 'nginx:alpine');

    await streamStep(deploymentUuid, 'Preparing workdir', async () => {
      const r = await executeRemoteCommand(server, key, `mkdir -p ${workdir}`, {
        onData: (c) => log(c),
      });
      if (r.exitCode !== 0) throw new Error('Failed to prepare workdir');
    });

    await streamStep(deploymentUuid, 'Writing docker-compose.yml', async () => {
      // base64-encode to avoid quoting issues over SSH heredoc.
      const b64 = Buffer.from(compose, 'utf8').toString('base64');
      const r = await executeRemoteCommand(
        server,
        key,
        `echo '${b64}' | base64 -d > ${workdir}/docker-compose.yml && cat ${workdir}/docker-compose.yml`,
        { onData: (c) => log(c) }
      );
      if (r.exitCode !== 0) throw new Error('Failed to write compose file');
    });

    await streamStep(deploymentUuid, 'Deploying (docker compose up)', async () => {
      const r = await executeRemoteCommand(
        server,
        key,
        `cd ${workdir} && docker compose pull --quiet 2>/dev/null; docker compose up -d --remove-orphans`,
        { onData: (c) => log(c) }
      );
      if (r.exitCode !== 0) throw new Error('docker compose up failed');
    });

    await streamStep(deploymentUuid, 'Verifying container', async () => {
      await executeRemoteCommand(
        server,
        key,
        `cd ${workdir} && docker compose ps`,
        { onData: (c) => log(c), noRetry: true }
      );
    });

    await finalize(app, deploymentUuid, teamId, true);
    await log('✅ Deployment finished successfully');
  } catch (err) {
    const message = (err as Error).message;
    logger.error('Deployment failed', { deploymentUuid, message });
    await log(`❌ Deployment failed: ${message}`);
    const app = await appService.getApplication(teamId, applicationUuid);
    if (app) await finalize(app, deploymentUuid, teamId, false);
    throw err;
  }
}

async function finalize(
  app: ApplicationRow,
  deploymentUuid: string,
  teamId: number,
  success: boolean
): Promise<void> {
  await deploymentService.setDeploymentStatus(deploymentUuid, success ? 'finished' : 'failed');
  await appService.setStatus(app.id, success ? 'running' : 'exited');
  await realtime.statusChanged(teamId, {
    type: 'application',
    uuid: app.uuid,
    status: success ? 'running' : 'exited',
    deploymentUuid,
  });
}

export function registerDeploymentWorker(): void {
  registerWorker<DeploymentJobData>(QUEUE_NAMES.deployments, processDeployment, 3);
  logger.info('Deployment worker registered');
}
