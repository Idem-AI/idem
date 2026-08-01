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
import { generateComposeFile, generateBuildlessCompose, appWorkdir } from '../docker/compose';
import { planBuild, toBuildPack, buildDirectory } from '../docker/build-packs';
import { loadLabelContext, buildApplicationLabels } from '../services/application-labels.service';
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

    // Proxy + ownership labels. Without these the container runs but is not
    // reachable on its domain, and the platform cannot recognise it later.
    const labelContext = await loadLabelContext(app);
    const labels = labelContext ? buildApplicationLabels(app, labelContext) : undefined;
    const network = labelContext?.network;

    const workdir = appWorkdir(app);
    const srcDir = `${workdir}/src`;
    const imageTag = `${app.name}-${deploymentUuid.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9._-]/g, '-');

    // Ensure the app publishes a host port so it gets an openable URL.
    if (!app.ports_mappings) {
      const exposed = (app.ports_exposes || '3000').split(',')[0].trim();
      app.ports_mappings = `${exposed}:${exposed}`;
      await appService.updateApplication(teamId, app.uuid, { ports_mappings: app.ports_mappings });
    }
    const port = parseInt((app.ports_mappings || '3000').split(',')[0].split(':')[0], 10) || 3000;

    // build_pack 'dockerfile' → build the image; otherwise run buildless
    // (base image + mounted source — no Dockerfile, no image build).
    // Where `docker compose up` runs, and what it runs. A repository that
    // ships its own compose file is deployed from its own directory.
    let compose: string | null;
    let composeDir = workdir;

    await streamStep(deploymentUuid, 'Preparing workdir', async () => {
      const r = await executeRemoteCommand(server, key, `rm -rf ${workdir} && mkdir -p ${workdir}`, {
        onData: (c) => log(c),
      });
      if (r.exitCode !== 0) throw new Error(`Failed to prepare workdir: ${r.stderr.slice(0, 300)}`);
    });

    if (!app.git_repository) {
      // Nothing to clone — placeholder static container.
      compose = generateComposeFile(app, 'nginx:alpine', labels, network);
    } else {
      await streamStep(deploymentUuid, 'Cloning repository', async () => {
        const r = await executeRemoteCommand(
          server,
          key,
          `git clone --depth 1 -b ${app.git_branch || 'main'} ${app.git_repository} ${srcDir} && ls -la ${srcDir}`,
          { onData: (c) => log(c) }
        );
        if (r.exitCode !== 0) throw new Error(`git clone failed: ${r.stderr.slice(0, 300)}`);
      });

      const pack = toBuildPack(app.build_pack);
      const plan = planBuild(pack, {
        srcDir,
        workdir,
        imageTag,
        baseDirectory: app.base_directory,
        installCommand: app.install_command,
        buildCommand: app.build_command,
        startCommand: app.start_command,
        publishDirectory: app.publish_directory,
        port,
      });

      await log(`\n──► Build strategy: ${plan.pack}`);

      let buildFailed = false;
      for (const step of plan.steps) {
        await streamStep(deploymentUuid, step.label, async () => {
          const r = await executeRemoteCommand(server, key, step.command, {
            onData: (c) => log(c),
          });
          if (r.exitCode !== 0) {
            buildFailed = true;
            throw new Error(`${step.label} failed: ${(r.stderr || r.stdout).slice(0, 400)}`);
          }
        });
      }

      if (plan.runtime === 'compose-file') {
        // The repository ships its own stack; deploy it from its own directory
        // rather than generating one over the top.
        composeDir = buildDirectory({
          srcDir,
          workdir,
          imageTag,
          baseDirectory: app.base_directory,
          port,
        });
        compose = null;
      } else if (buildFailed) {
        // Unreachable: the throw above aborts. Kept explicit so a future edit
        // cannot silently fall through to deploying a stale image.
        throw new Error('Build failed');
      } else {
        compose = generateComposeFile(app, imageTag, labels, network);
      }
    }

    if (compose !== null) await streamStep(deploymentUuid, 'Writing docker-compose.yml', async () => {
      const b64 = Buffer.from(compose as string, 'utf8').toString('base64');
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
        `cd ${composeDir} && docker compose pull --quiet 2>/dev/null; docker compose up -d --remove-orphans`,
        { onData: (c) => log(c) }
      );
      if (r.exitCode !== 0) throw new Error(`docker compose up failed: ${r.stderr.slice(0, 300)}`);
    });

    await streamStep(deploymentUuid, 'Verifying container', async () => {
      await log('Monitoring container startup and logs...');
      const startTime = Date.now();
      const maxWaitMs = 45000; // 45 seconds max wait for build and start
      let lastLogLength = 0;

      while (Date.now() - startTime < maxWaitMs) {
        const logsResult = await executeRemoteCommand(
          server,
          key,
          `cd ${composeDir} && docker compose logs --no-color`,
          { noRetry: true }
        );
        const currentLogs = logsResult.stdout || '';
        if (currentLogs.length > lastLogLength) {
          const newLogs = currentLogs.slice(lastLogLength);
          await log(newLogs);
          lastLogLength = currentLogs.length;
        }

        const psResult = await executeRemoteCommand(
          server,
          key,
          `cd ${workdir} && docker compose ps`,
          { noRetry: true }
        );
        const psOutput = psResult.stdout.trim().toLowerCase();
        
        const hasExited = psOutput.includes('exited') || psOutput.includes('dead') || psOutput.includes('exit');
        const isUp = psOutput.includes('up') || psOutput.includes('running');

        if (hasExited || (psOutput && !isUp)) {
          const finalLogs = await executeRemoteCommand(
            server,
            key,
            `cd ${workdir} && docker compose logs --no-color`,
            { noRetry: true }
          );
          const finalLogsStr = finalLogs.stdout || '';
          if (finalLogsStr.length > lastLogLength) {
            await log(finalLogsStr.slice(lastLogLength));
          }
          throw new Error('Container exited unexpectedly during build/startup. Check the logs above for errors.');
        }

        if (
          currentLogs.toLowerCase().includes('listening on') ||
          currentLogs.toLowerCase().includes('ready in') ||
          currentLogs.toLowerCase().includes('local:') ||
          currentLogs.toLowerCase().includes('accepting connections') ||
          currentLogs.toLowerCase().includes('compiled successfully') ||
          currentLogs.toLowerCase().includes('http://localhost:') ||
          currentLogs.toLowerCase().includes('ready - started server')
        ) {
          await log('\n✓ Application started successfully and is listening for connections.');
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
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
