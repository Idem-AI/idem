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
import * as envVarService from '../services/env-var.service';
import * as serverService from '../services/server.service';
import * as deploymentService from '../services/deployment.service';
import { DeploymentJobData } from '../services/deployment.service';
import { ApplicationRow } from '../models/ideploy.types';

/**
 * How long a container must stay up, un-crashed, before "no recognised log
 * line yet" stops being ambiguous and starts counting as a pass. Long enough
 * that a genuine crash-loop (bad start command, missing env var) has time to
 * show itself — most crash within a few seconds of starting — short enough
 * that a quiet, healthy app is not held hostage by the 45s ceiling on every
 * single deployment.
 */
const SETTLE_MS = 12000;

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

    // The container's own listening port — needed to build the app
    // (nixpacks/static start commands) and to verify it comes up, regardless
    // of whether it ever reaches the host directly. This used to force-write
    // a 1:1 ports_mappings ("gets an openable URL") into the database on
    // every deployment; now that every application gets a real domain
    // (domain.service.ts's generateFqdn, resolved at creation) reachable
    // through Traefik on the shared network, that forced mapping did nothing
    // but guarantee two applications using the same port — the near-universal
    // default, 3000 — collide the instant both landed on one server. Publishing
    // a host port is still available, just never forced: generateComposeFile
    // honours an operator's own explicit ports_mappings, and only falls back
    // to auto-publishing when there is no Traefik routing to use instead.
    const port =
      parseInt((app.ports_mappings || app.ports_exposes || '3000').split(',')[0].split(':')[0], 10) || 3000;

    // The operator's own Variables — stored, shown back to them on the
    // Variables tab, and never once reaching the container: nothing here
    // ever read them before. Runtime ones go on the running container;
    // build-time ones (is_buildtime) go to nixpacks below, so a build step
    // needing e.g. an API key to compile has it without it also being an
    // unnecessary runtime var on the final container.
    const envVars = await envVarService.listForApplication(teamId, app.uuid);
    const runtimeEnv = envVars
      .filter((v) => v.is_runtime && v.value !== null)
      .map((v) => `${v.key}=${v.value}`);
    const buildEnv = envVars
      .filter((v) => v.is_buildtime && v.value !== null)
      .map((v) => `${v.key}=${v.value}`);

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
      compose = generateComposeFile(app, 'nginx:alpine', labels, network, runtimeEnv, port);
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
        buildEnv,
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
        compose = generateComposeFile(app, imageTag, labels, network, runtimeEnv, port);
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
      // `pull` only makes sense when the compose file can name a real registry
      // image to fetch — the repository's own compose file (runtime
      // 'compose-file') might. The compose file *we* generated never does:
      // its image is always the tag `docker build` just produced locally, and
      // `docker compose pull` on a bare local tag doesn't skip it as
      // "already have it" — it tries Docker Hub and fails hard with "pull
      // access denied … repository does not exist", which then made every
      // nixpacks/Dockerfile deployment fail at the very last step, after a
      // successful build, for a pull nothing needed.
      const pullStep = compose === null ? 'docker compose pull --quiet 2>/dev/null; ' : '';
      const r = await executeRemoteCommand(
        server,
        key,
        // `down` first, not just `up --remove-orphans`: a retry (this job's own
        // BullMQ attempts, or a re-deploy) can find a container this same
        // compose file half-created on the previous attempt — still starting,
        // holding the port or the name — which made `up` fail with an error
        // that had nothing to do with the actual deployment, on every retry,
        // indistinguishable from a real failure. Tearing it down first makes
        // every attempt start from the same clean state the first one did.
        `cd ${composeDir} && docker compose down --remove-orphans 2>/dev/null; ` +
          `${pullStep}docker compose up -d --remove-orphans`,
        { onData: (c) => log(c) }
      );
      if (r.exitCode !== 0) {
        // Compose's own errors land on stderr; a connection-level failure
        // (the SSH command itself never completing) leaves both empty — that
        // used to surface as "docker compose up failed: " with nothing after
        // the colon, impossible to act on from the log alone.
        const detail =
          r.stderr.trim().slice(0, 300) ||
          r.stdout.trim().slice(0, 300) ||
          `no output (exit code ${r.exitCode}) — the connection to the server may have dropped mid-command`;
        throw new Error(`docker compose up failed: ${detail}`);
      }
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

        // No crash and no recognised log line yet — those seven phrases are a
        // best-effort shortcut, not a requirement: plenty of real
        // applications (structured/JSON loggers, or ones that print nothing
        // at all once up) will never match any of them, and previously that
        // meant paying the full 45s wait on *every* deployment of one for no
        // reason. A container still running this far past startup without
        // having crashed is itself the thing worth verifying.
        if (isUp && Date.now() - startTime > SETTLE_MS) {
          await log('\n✓ Container is running and has not crashed.');
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
