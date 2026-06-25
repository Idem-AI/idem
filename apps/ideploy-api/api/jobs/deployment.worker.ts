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
    const srcDir = `${workdir}/src`;
    const imageTag = `${app.name}-${deploymentUuid.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
    let image = 'nginx:alpine';

    await streamStep(deploymentUuid, 'Preparing workdir', async () => {
      const r = await executeRemoteCommand(server, key, `rm -rf ${workdir} && mkdir -p ${workdir}`, {
        onData: (c) => log(c),
      });
      if (r.exitCode !== 0) throw new Error(`Failed to prepare workdir: ${r.stderr.slice(0, 300)}`);
    });

    if (app.git_repository) {
      await streamStep(deploymentUuid, 'Cloning repository', async () => {
        const r = await executeRemoteCommand(
          server,
          key,
          `git clone --depth 1 -b ${app.git_branch || 'main'} ${app.git_repository} ${srcDir} && ls -la ${srcDir}`,
          { onData: (c) => log(c) }
        );
        if (r.exitCode !== 0) throw new Error(`git clone failed: ${r.stderr.slice(0, 300)}`);
      });

      await streamStep(deploymentUuid, 'Building image', async () => {
        // Dockerfile → docker build; otherwise try nixpacks (if installed).
        const script =
          `cd ${srcDir} && ` +
          `if [ -f Dockerfile ]; then ` +
          `  docker build -t ${imageTag} . ; ` +
          `elif command -v nixpacks >/dev/null 2>&1; then ` +
          `  nixpacks build . --name ${imageTag} ; ` +
          `else ` +
          `  echo "NO_BUILDER" ; exit 42 ; ` +
          `fi`;
        const r = await executeRemoteCommand(server, key, script, { onData: (c) => log(c) });
        if (r.exitCode === 42 || r.stdout.includes('NO_BUILDER')) {
          throw new Error(
            'No Dockerfile found and nixpacks is not installed. Add a Dockerfile to the repo, ' +
              'install nixpacks (https://nixpacks.com), or deploy a Template instead.'
          );
        }
        if (r.exitCode !== 0) throw new Error(`Build failed: ${r.stderr.slice(0, 300)}`);
        image = imageTag;
      });
    }

    // Ensure the app publishes a host port so it gets an openable URL.
    if (!app.ports_mappings) {
      const exposed = (app.ports_exposes || '3000').split(',')[0].trim();
      app.ports_mappings = `${exposed}:${exposed}`;
      await appService.updateApplication(teamId, app.uuid, { ports_mappings: app.ports_mappings });
    }

    const compose = generateComposeFile(app, image);

    await streamStep(deploymentUuid, 'Writing docker-compose.yml', async () => {
      const b64 = Buffer.from(compose, 'utf8').toString('base64');
      const r = await executeRemoteCommand(
        server,
        key,
        `echo '${b64}' | base64 -d > ${workdir}/docker-compose.yml && cat ${workdir}/docker-compose.yml`,
        { onData: (c) => log(c) }
      );
      if (r.exitCode !== 0) throw new Error(`Failed to write compose file: ${r.stderr.slice(0, 300)}`);
    });

    await streamStep(deploymentUuid, 'Deploying (docker compose up)', async () => {
      const r = await executeRemoteCommand(
        server,
        key,
        `cd ${workdir} && docker compose pull --quiet 2>/dev/null; docker compose up -d --remove-orphans`,
        { onData: (c) => log(c) }
      );
      if (r.exitCode !== 0) throw new Error(`docker compose up failed: ${r.stderr.slice(0, 300)}`);
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
