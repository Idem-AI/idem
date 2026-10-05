/**
 * Deployment worker (BullMQ) — port of the core ApplicationDeploymentJob flow.
 *
 * Flow: resolve app + server → stream live logs to Soketi → fetch the code into
 * a fresh release directory → build → switch the live stack over → verify the
 * container → update status.
 *
 * The running version is not touched until the new one is built. Each
 * deployment works in its own `releases/<id>` directory; only once the build
 * has succeeded is the compose file written and `docker compose up` run. A
 * failed build therefore leaves the previous version serving, still manageable
 * (start/stop/restart find its compose file), and the application's status
 * unchanged — it used to wipe the application's directory first, then mark the
 * application stopped while its old container kept running.
 */
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/queues';
import { registerWorker } from '../queue/worker';
import logger from '../config/logger';
import redis from '../config/redis.config';
import { realtime } from '../services/realtime.service';
import { executeRemoteCommand, shellQuote, uploadRemoteFile } from '../ssh/ssh';
import { writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { getSourceArchive } from '../services/application-source.service';
import { assertComposeIsSafe } from '../docker/compose-policy';
import { assertSafeGitBranch, assertSafeGitUrl, isSafeCommitSha } from '../validation/git-input';
import { generateComposeFile, appWorkdir, composeDirFile, composeProject } from '../docker/compose';
import { choosePort, parseExposedPorts, parseListeningPorts, PortChoice } from '../docker/listening-ports';
import { planBuild, toBuildPack, buildDirectory } from '../docker/build-packs';
import { loadLabelContext, buildApplicationLabels } from '../services/application-labels.service';
import { writeFirewallFile } from '../services/firewall-file.service';
import * as appService from '../services/application.service';
import * as envVarService from '../services/env-var.service';
import * as serverService from '../services/server.service';
import * as deploymentService from '../services/deployment.service';
import { explainGitFailure, resolveGitCredential } from '../services/git-credentials.service';
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

/**
 * How long to wait, after the container first looked healthy, before
 * trusting that signal — verified live against a real failure mode this
 * exact gap let through: a Spring Boot app whose JVM startup alone runs past
 * `SETTLE_MS`, so the "still running, hasn't crashed" check fired while the
 * app was merely mid-boot, and the real crash (Hibernate rejecting a
 * malformed JDBC URL) only threw a few seconds later — after verification
 * had already declared success and moved on. A single re-check after this
 * grace period catches exactly that class of "looked fine, wasn't" failure
 * without paying it on every deployment of an app that starts cleanly.
 */
const CONFIRM_GRACE_MS = 15000;

/** Releases and images kept on the server: the live one and the one before it. */
const RELEASES_KEPT = 2;

/**
 * How much of a deployment's log is kept once it is over. It used to exist
 * only as it streamed: opening a finished deployment showed nothing.
 */
const KEPT_LOG_CHARS = 200_000;

/**
 * One deployment of an application at a time. Two at once used to share a
 * directory, each deleting what the other was building.
 *
 * The lock lives a minute and is renewed while the deployment runs, so a
 * worker that dies (an API redeploy mid-build) frees it within a minute. It
 * used to last an hour: the deployment BullMQ re-ran after the restart then
 * waited, as "in progress", for a lock held by a process that no longer
 * existed — and every later deployment of that application with it.
 */
export const LOCK_TTL_MS = 60 * 1000;
const LOCK_RENEW_MS = 20 * 1000;
const LOCK_WAIT_MS = 30 * 60 * 1000;
const LOCK_POLL_MS = 5000;

async function streamStep(
  deploymentUuid: string,
  label: string,
  fn: () => Promise<void>
): Promise<void> {
  await realtime.deploymentLog(deploymentUuid, `\n──► ${label}`);
  await fn();
}

/**
 * Run `work` holding the application's deployment lock, waiting for a running
 * deployment to end.
 *
 * The lock holds the deployment's uuid: the same deployment run again by
 * BullMQ after a worker died takes its own lock back instead of waiting on it.
 */
export async function withApplicationLock<T>(
  applicationId: number,
  deploymentUuid: string,
  log: (line: string) => Promise<void>,
  work: () => Promise<T>
): Promise<T> {
  const key = `ideploy:deploy-lock:${applicationId}`;
  const started = Date.now();
  let announced = false;
  for (;;) {
    if (await redis.set(key, deploymentUuid, 'PX', LOCK_TTL_MS, 'NX')) break;
    if ((await redis.get(key)) === deploymentUuid) {
      await redis.pexpire(key, LOCK_TTL_MS);
      break;
    }
    if (Date.now() - started > LOCK_WAIT_MS) {
      throw new Error('Another deployment of this application is still running; try again once it has finished.');
    }
    if (!announced) {
      await log('Waiting for the previous deployment of this application to finish…');
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }

  // Renewed while this deployment is alive; dies with it.
  const renew = setInterval(() => {
    redis
      .get(key)
      .then((owner) => (owner === deploymentUuid ? redis.pexpire(key, LOCK_TTL_MS) : undefined))
      .catch(() => undefined);
  }, LOCK_RENEW_MS);
  renew.unref?.();
  try {
    return await work();
  } finally {
    clearInterval(renew);
    if ((await redis.get(key)) === deploymentUuid) await redis.del(key);
  }
}

export interface ContainerState {
  service: string;
  state: string;
  exitCode: number;
  health: string;
}

/**
 * Parse `docker compose ps --format json`: a JSON array on older Compose, one
 * object per line on newer ones. Returns null when the output is neither.
 */
export function parseComposePs(stdout: string): ContainerState[] | null {
  const text = stdout.trim();
  if (!text) return [];
  const toState = (raw: Record<string, unknown>): ContainerState => ({
    service: String(raw.Service ?? raw.Name ?? ''),
    state: String(raw.State ?? '').toLowerCase(),
    exitCode: Number(raw.ExitCode ?? 0),
    health: String(raw.Health ?? '').toLowerCase(),
  });
  try {
    if (text.startsWith('[')) return (JSON.parse(text) as Record<string, unknown>[]).map(toState);
    return text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => toState(JSON.parse(line) as Record<string, unknown>));
  } catch {
    return null;
  }
}

/**
 * Whether the stack is up, and whether something in it crashed.
 *
 * A container that ran to completion (exit 0 — a migration, an init step) is
 * not a crash; one that exited with an error, died or keeps restarting is.
 */
export function judgeContainers(states: ContainerState[]): { isUp: boolean; crashed: boolean } {
  const crashed = states.some(
    (c) =>
      c.state === 'dead' ||
      c.state === 'restarting' ||
      (c.state === 'exited' && c.exitCode !== 0) ||
      c.health === 'unhealthy'
  );
  const isUp = states.some((c) => c.state === 'running');
  return { isUp, crashed };
}

export async function processDeployment(job: Job<DeploymentJobData>): Promise<void> {
  const { deploymentUuid, applicationUuid, applicationId, teamId } = job.data;
  const kept: string[] = [];
  let keptChars = 0;
  const log = (line: string): Promise<void> => {
    kept.push(line);
    keptChars += line.length;
    while (keptChars > KEPT_LOG_CHARS && kept.length > 1) keptChars -= kept.shift()!.length;
    return realtime.deploymentLog(deploymentUuid, line);
  };
  const saveLog = (): Promise<void> =>
    deploymentService.saveLogs(deploymentUuid, kept.join('\n')).catch(() => undefined);

  await deploymentService.setDeploymentStatus(deploymentUuid, 'in_progress');
  await log(`Deployment ${deploymentUuid} started for application ${applicationUuid}`);

  // Whether the live stack has been touched. Before that point a failure
  // leaves the previous version running, and the application's status alone.
  let switched = false;

  try {
    await withApplicationLock(applicationId, deploymentUuid, log, () => deploy(job.data, log, () => (switched = true)));
    const app = await appService.getApplication(teamId, applicationUuid);
    if (app) await finalize(app, deploymentUuid, teamId, true);
    await log('✅ Deployment finished successfully');
    await saveLog();
  } catch (err) {
    const message = (err as Error).message;
    logger.error('Deployment failed', { deploymentUuid, message });
    await log(`❌ Deployment failed: ${message}`);
    if (!switched) await log('The previous version, if any, is still the one serving.');
    // Kept with the deployment, ending with the cause (iCode shows its tail).
    await saveLog();
    const app = await appService.getApplication(teamId, applicationUuid);
    if (app) await finalize(app, deploymentUuid, teamId, false, switched);
    throw err;
  }
}

async function deploy(
  data: DeploymentJobData,
  log: (line: string) => Promise<void>,
  markSwitched: () => void
): Promise<void> {
  const { deploymentUuid, applicationUuid, teamId } = data;

  const app = await appService.getApplication(teamId, applicationUuid);
  if (!app) throw new Error('Application not found');

  const serverRef = await appService.getApplicationServer(app.id);
  if (!serverRef) throw new Error('No server/destination resolved for this application');

  const server = await serverService.getExecutionServer(teamId, serverRef.serverId);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getExecutionKey(server);
  if (!key) throw new Error('Private key not found');

  // Proxy + ownership labels. Without these the container runs but is not
  // reachable on its domain, and the platform cannot recognise it later.
  const labelContext = await loadLabelContext(app);
  const labels = labelContext ? buildApplicationLabels(app, labelContext) : undefined;
  const network = labelContext?.network;

  const workdir = appWorkdir(app);
  const project = composeProject(app);
  const releasesDir = `${workdir}/releases`;
  const releaseDir = `${releasesDir}/${deploymentUuid.slice(0, 8)}`;
  const srcDir = `${releaseDir}/src`;
  // One image repository per application, one tag per deployment: old images
  // can then be removed without touching another application's, even one that
  // shares its name.
  const imageRepository = `ideploy-${app.uuid.toLowerCase()}`;
  const imageTag = `${imageRepository}:${deploymentUuid.slice(0, 8)}`;

  // The port the application listens on inside its container — the one
  // Traefik routes to (`ports_exposes`), and the one it is told through PORT.
  // `ports_mappings` ("host:container") only decides what is also published on
  // the host; taking its host side here told an app mapped 8080:3000 to listen
  // on 8080 while Traefik kept sending traffic to 3000.
  const port = applicationPort(app);

  // The operator's own Variables. Runtime ones go on the running container;
  // build-time ones (is_buildtime) go to the build below, so a build step
  // needing e.g. an API key has it without it also being an unnecessary
  // runtime var on the final container.
  const envVars = await envVarService.listForApplication(teamId, app.uuid);
  const runtimeEnv = envVars
    .filter((v) => v.is_runtime && v.value !== null)
    .map((v) => `${v.key}=${v.value}`);
  const buildEnv = envVars
    .filter((v) => v.is_buildtime && v.value !== null)
    .map((v) => `${v.key}=${v.value}`);

  // What `docker compose up` runs, and from where: the file we generate lives
  // in the application's directory; a repository's own compose file runs from
  // its release.
  let compose: string | null;
  let composeDir = workdir;
  // The image our generated compose file runs — null for a repository's own stack.
  let composeImage: string | null = null;

  await streamStep(deploymentUuid, 'Preparing the release', async () => {
    const r = await executeRemoteCommand(
      server,
      key,
      `mkdir -p ${shellQuote(workdir)} && rm -rf ${shellQuote(releaseDir)} && mkdir -p ${shellQuote(srcDir)}`,
      { onData: (c) => log(c) }
    );
    if (r.exitCode !== 0) throw new Error(`Failed to prepare the release directory: ${r.stderr.slice(0, 300)}`);
  });

  // The code comes from a Git repository, or — for what iCode publishes — from
  // the archive it sent (`application_sources`). Neither: placeholder.
  const sourceArchive = app.git_repository ? null : await getSourceArchive(app.id);

  if (!app.git_repository && !sourceArchive) {
    // Nothing to fetch — placeholder static container.
    composeImage = 'nginx:alpine';
    compose = generateComposeFile(app, composeImage, labels, network, runtimeEnv, port);
  } else {
    if (sourceArchive) {
      // One archive, one upload, one `tar` — then the build below runs on it
      // exactly as it would on a fresh clone.
      await streamStep(deploymentUuid, 'Uploading the code', async () => {
        const localArchive = join(tmpdir(), `ideploy-source-${deploymentUuid}.tgz`);
        const remoteArchive = `${releaseDir}/source.tgz`;
        await writeFile(localArchive, sourceArchive);
        try {
          await uploadRemoteFile(server, key, localArchive, remoteArchive);
        } finally {
          await rm(localArchive, { force: true });
        }
        const r = await executeRemoteCommand(
          server,
          key,
          `tar xzf ${shellQuote(remoteArchive)} -C ${shellQuote(srcDir)} && rm -f ${shellQuote(remoteArchive)} && ls -la ${shellQuote(srcDir)}`,
          { onData: (c) => log(c) }
        );
        if (r.exitCode !== 0) throw new Error(`Unpacking the code failed: ${r.stderr.slice(0, 300)}`);
      });
    } else {
      // A private repository needs something to authenticate the clone with:
      // a non-interactive `git` cannot prompt. When the team has GitHub/GitLab
      // connected, credentials.service resolves a URL carrying that token; a
      // public repo gets its plain URL back.
      const repository = app.git_repository as string;
      const credential = await resolveGitCredential(teamId, repository);
      const cloneUrl = credential?.authenticatedUrl ?? repository;

      // Branche, commit et dépôt viennent de l'utilisateur et partent dans un
      // shell sur l'hôte : format vérifié, puis chaque argument entre apostrophes.
      const branch = assertSafeGitBranch(app.git_branch || 'main');
      assertSafeGitUrl(repository);
      const requested = data.commit && data.commit !== 'HEAD' ? data.commit : null;
      if (requested && !isSafeCommitSha(requested)) throw new Error(`"${requested}" is not a commit id.`);
      // A specific commit (rollback, pipeline) is fetched by its id; it used to
      // be ignored, and every "rollback" deployed the branch's latest commit.
      const ref = requested ?? branch;

      await streamStep(deploymentUuid, requested ? `Fetching commit ${requested}` : 'Cloning repository', async () => {
        const r = await executeRemoteCommand(
          server,
          key,
          // Retry-safe: a connection hiccup re-runs this whole command, and a
          // second `remote add` on the already-initialised checkout failed
          // with "remote origin already exists", hiding the real cause.
          `cd ${shellQuote(srcDir)} && rm -rf .git && git init -q && git remote add origin ${shellQuote(cloneUrl)} && ` +
            `git fetch -q --depth 1 origin ${shellQuote(ref)} && git checkout -q FETCH_HEAD && ` +
            // The remote URL may carry the team's token: not left in .git/config.
            `git remote remove origin && ` +
            `echo "COMMIT=$(git rev-parse HEAD)" && ls -la`,
          { onData: (c) => log(c), redact: credential ? [credential.token] : undefined }
        );
        if (r.exitCode !== 0) throw new Error(`Fetching the code failed: ${explainGitFailure(r.stderr)}`);
        const sha = /COMMIT=([0-9a-f]{40})/.exec(r.stdout)?.[1];
        if (sha) await deploymentService.recordCommit(deploymentUuid, app.id, sha);
      });
    }

    const baseDirectory = await resolveBaseDirectory(server, key, srcDir, app.base_directory, log);
    const pack = toBuildPack(app.build_pack);
    const buildContext = {
      srcDir,
      workdir: releaseDir,
      imageTag,
      baseDirectory,
      installCommand: app.install_command,
      buildCommand: app.build_command,
      startCommand: app.start_command,
      publishDirectory: app.publish_directory,
      port,
      buildEnv,
      composeProject: project,
      dockerfileLocation: app.dockerfile_location,
      dockerfileTarget: app.dockerfile_target_build,
    };
    const plan = planBuild(pack, buildContext);

    await log(`\n──► Build strategy: ${plan.pack}`);

    // Le compose d'un dépôt est du contenu utilisateur : il est contrôlé AVANT
    // `docker compose build` (un contexte de build hors du dépôt lit déjà
    // l'hôte) et avant tout `up`.
    if (plan.runtime === 'compose-file') {
      await streamStep(deploymentUuid, 'Checking the compose file', async () => {
        const dir = buildDirectory(buildContext);
        const r = await executeRemoteCommand(
          server,
          key,
          `cd ${shellQuote(dir)} && (cat docker-compose.yml 2>/dev/null || cat docker-compose.yaml)`,
          { noRetry: true }
        );
        if (r.exitCode !== 0) throw new Error('No docker-compose.yml found in the repository.');
        assertComposeIsSafe(r.stdout);
      });
    }

    for (const step of plan.steps) {
      await streamStep(deploymentUuid, step.label, async () => {
        const r = await executeRemoteCommand(server, key, step.command, {
          onData: (c) => log(c),
        });
        if (r.exitCode !== 0) throw new Error(`${step.label} failed: ${(r.stderr || r.stdout).slice(0, 400)}`);
      });
    }

    if (plan.runtime === 'compose-file') {
      // The repository ships its own stack; it runs from its own directory.
      composeDir = buildDirectory(buildContext);
      compose = null;
    } else {
      composeImage = imageTag;
      compose = generateComposeFile(app, imageTag, labels, network, runtimeEnv, port);
    }
  }

  // From here on the live stack changes.
  markSwitched();

  await streamStep(deploymentUuid, 'Switching to the new version', async () => {
    // Never printed: the file carries the application's runtime variables,
    // its secrets among them, and the log is shown to everyone on the team.
    const writeCompose =
      compose !== null
        ? `echo '${Buffer.from(compose, 'utf8').toString('base64')}' | base64 -d > ${shellQuote(`${workdir}/docker-compose.yml`)} && `
        : '';
    // The firewall chain the labels reference must exist before the
    // container starts: a router naming a missing middleware serves nothing.
    if (compose !== null && labelContext) await writeFirewallFile(server, key, app);
    // Where start/stop/restart will find the live compose file.
    const recordDir = `echo ${shellQuote(composeDir)} > ${shellQuote(composeDirFile(app))}`;
    const r = await executeRemoteCommand(server, key, `${writeCompose}${recordDir}`, { noRetry: true });
    if (r.exitCode !== 0) throw new Error(`Failed to write the compose file: ${r.stderr.slice(0, 300)}`);
    await log(compose !== null ? 'Compose file written.' : `Using the repository's compose file in ${composeDir}.`);
  });

  await streamStep(deploymentUuid, 'Deploying (docker compose up)', async () => {
    // `pull` only for a repository's compose file, which may name registry
    // images. Ours always names the tag `docker build` just produced locally,
    // and `pull` on it fails with "pull access denied".
    const cd = `cd ${shellQuote(composeDir)} && `;
    const dc = `docker compose -p ${shellQuote(project)}`;
    const pull = compose === null ? `${dc} pull --quiet 2>/dev/null; ` : '';
    // `up` replaces the containers in place. Only when it fails — a container
    // half-created by an interrupted deployment holding a name — is the stack
    // taken down and brought up again.
    let r = await executeRemoteCommand(server, key, `${cd}${pull}${dc} up -d --remove-orphans`, {
      onData: (c) => log(c),
    });
    if (r.exitCode !== 0) {
      await log('\nRetrying after taking the previous containers down…');
      r = await executeRemoteCommand(
        server,
        key,
        `${cd}${dc} down --remove-orphans 2>/dev/null; ${dc} up -d --remove-orphans`,
        { onData: (c) => log(c) }
      );
    }
    if (r.exitCode !== 0) {
      // A connection-level failure leaves both streams empty — say so rather
      // than "docker compose up failed: " with nothing after the colon.
      const detail =
        r.stderr.trim().slice(0, 300) ||
        r.stdout.trim().slice(0, 300) ||
        `no output (exit code ${r.exitCode}) — the connection to the server may have dropped mid-command`;
      throw new Error(`docker compose up failed: ${detail}`);
    }
  });

  // Tracks how much of `docker compose logs` output has already been
  // streamed, across both the polling loop and the later grace-period
  // re-check, so the confirmation never re-sends lines already shown.
  let lastLogLength = 0;

  /** One `docker compose ps` + fresh-log-tail read. Streams any new log output as a side effect. */
  const checkContainerState = async (): Promise<{ isUp: boolean; crashed: boolean; empty: boolean; allLogsLower: string }> => {
    const base = `cd ${shellQuote(composeDir)} && docker compose -p ${shellQuote(project)}`;
    const logsResult = await executeRemoteCommand(server, key, `${base} logs --no-color`, { noRetry: true });
    const currentLogs = logsResult.stdout || '';
    if (currentLogs.length > lastLogLength) {
      await log(currentLogs.slice(lastLogLength));
      lastLogLength = currentLogs.length;
    }

    const psResult = await executeRemoteCommand(server, key, `${base} ps -a --format json`, { noRetry: true });
    const states = parseComposePs(psResult.stdout);
    if (states !== null) {
      return { ...judgeContainers(states), empty: states.length === 0, allLogsLower: currentLogs.toLowerCase() };
    }
    // Not JSON (a very old Compose): read the table.
    const table = psResult.stdout.trim().toLowerCase();
    return {
      isUp: table.includes(' up ') || table.includes('running'),
      crashed: /\bexited \((?!0\))|\bdead\b|\brestarting\b/.test(table),
      empty: table.length === 0,
      allLogsLower: currentLogs.toLowerCase(),
    };
  };

  const READY_LOG_PHRASES = [
    'listening on',
    'ready in',
    'local:',
    'accepting connections',
    'compiled successfully',
    'http://localhost:',
    'ready - started server',
    'started application in', // Spring Boot's own "Started XyzApplication in 4.2 seconds" line
  ];

  await streamStep(deploymentUuid, 'Verifying container', async () => {
    await log('Monitoring container startup and logs...');
    const startTime = Date.now();
    const maxWaitMs = 45000;
    let confirmedUp = false;

    while (Date.now() - startTime < maxWaitMs) {
      const { isUp, crashed, empty, allLogsLower } = await checkContainerState();

      if (crashed || (!empty && !isUp)) {
        throw new Error('Container exited unexpectedly during startup. Check the logs above for errors.');
      }

      if (isUp && READY_LOG_PHRASES.some((p) => allLogsLower.includes(p))) {
        confirmedUp = true;
        await log('\n✓ Application started successfully and is listening for connections.');
        break;
      }

      // The phrase list is a shortcut, not a requirement: plenty of
      // applications never print any of them. A container still running this
      // far past startup without having crashed is itself the signal.
      if (isUp && Date.now() - startTime > SETTLE_MS) {
        confirmedUp = true;
        await log('\n✓ Container is running and has not crashed.');
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    if (!confirmedUp) {
      throw new Error('Timed out waiting for the container to report as running within 45s. Check the logs above for what it was doing instead.');
    }
  });

  await streamStep(deploymentUuid, 'Confirming container stays healthy', async () => {
    // The check above only proves the container had not crashed *yet*; some
    // failures surface a few seconds later, once startup actually finishes.
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_GRACE_MS));
    const { isUp, crashed } = await checkContainerState();
    if (crashed || !isUp) {
      throw new Error('Container crashed shortly after starting — it did not stay up. Check the logs above for the real error.');
    }
    await log('\n✓ Confirmed: still running after the grace period.');
  });

  // The port the proxy routes to must be the one the container listens on.
  // Only for the compose file we generate: a repository's own stack carries
  // its own routing.
  if (compose !== null && composeImage) {
    const image = composeImage;
    await streamStep(deploymentUuid, 'Detecting the port', async () => {
      const listening = await listeningPorts(server, key, composeDir, project);
      const exposed = await imageExposedPorts(server, key, image);
      const choice = choosePort(port, listening, exposed);
      await log(describePortChoice(choice, port, listening));
      if (choice.source === 'none' || choice.port === port) return;

      // Route to the real port: new labels and PORT, saved on the application.
      await appService.setExposedPort(app.id, choice.port);
      const routed = { ...app, ports_exposes: String(choice.port) };
      const routedLabels = labelContext ? buildApplicationLabels(routed, labelContext) : undefined;
      const updated = generateComposeFile(routed, image, routedLabels, network, runtimeEnv, choice.port);
      const r = await executeRemoteCommand(
        server,
        key,
        `echo '${Buffer.from(updated, 'utf8').toString('base64')}' | base64 -d > ${shellQuote(`${workdir}/docker-compose.yml`)} && ` +
          `cd ${shellQuote(composeDir)} && docker compose -p ${shellQuote(project)} up -d --remove-orphans`,
        { onData: (c) => log(c) }
      );
      if (r.exitCode !== 0) throw new Error(`Re-routing to port ${choice.port} failed: ${(r.stderr || r.stdout).slice(0, 300)}`);
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const { isUp, crashed } = await checkContainerState();
        if (crashed) throw new Error('The container crashed after being re-routed. Check the logs above.');
        if (isUp) {
          await log(`✓ Now routed to port ${choice.port}.`);
          return;
        }
      }
      throw new Error(`The container did not come back up after being re-routed to port ${choice.port}.`);
    });
  }

  // Older releases and images go; the live one and the previous one stay.
  // Every deployment used to leave its image behind until the disk filled. The
  // checkout the first deployments made in the application's directory goes too.
  await executeRemoteCommand(
    server,
    key,
    `cd ${shellQuote(releasesDir)} && ls -1t | tail -n +${RELEASES_KEPT + 1} | xargs -r rm -rf; ` +
      `rm -rf ${shellQuote(`${workdir}/src`)}; ` +
      `docker images ${shellQuote(imageRepository)} --format '{{.Repository}}:{{.Tag}}' | ` +
      `tail -n +${RELEASES_KEPT + 1} | xargs -r docker rmi >/dev/null 2>&1; true`,
    { noRetry: true }
  ).catch(() => undefined);
}

/** A root directory as the build reads it: no leading `./` or `/`, no trailing `/`. */
export function normaliseBaseDirectory(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/^\.?\/+|\/+$/g, '').replace(/^\.$/, '');
}

/**
 * Check the application's root directory in the fetched code.
 *
 * Typed by hand in a free-text field, it sometimes names a file: an
 * application saved with `./Dockerfile` failed every deployment on
 * `cd: …/Dockerfile: Not a directory`. A file stands for the folder that
 * holds it, said in the log; a path that does not exist fails with what to
 * set instead.
 */
async function resolveBaseDirectory(
  server: Parameters<typeof executeRemoteCommand>[0],
  key: Parameters<typeof executeRemoteCommand>[1],
  srcDir: string,
  raw: string | null | undefined,
  log: (line: string) => Promise<void>
): Promise<string> {
  const base = normaliseBaseDirectory(raw);
  if (!base) return '';
  const r = await executeRemoteCommand(
    server,
    key,
    `cd ${shellQuote(srcDir)} && if [ -d ${shellQuote(base)} ]; then echo KIND=dir; ` +
      `elif [ -e ${shellQuote(base)} ]; then echo KIND=file; else echo KIND=none; fi`,
    { noRetry: true }
  );
  const kind = /KIND=(dir|file|none)/.exec(r.stdout)?.[1];
  if (kind === 'file') {
    const parent = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : '';
    await log(
      `\n⚠ The root directory "${raw}" is a file, not a folder: building from ${parent ? `"${parent}"` : 'the repository root'} instead. ` +
        'Fix it in the application settings.'
    );
    return parent;
  }
  if (kind === 'none') {
    throw new Error(
      `The root directory "${raw}" does not exist in the repository. ` +
        'Set it to ./ for the repository root, or to the folder that holds the application, in the application settings.'
    );
  }
  return base;
}

/** How long to wait for an application to start listening before deciding it serves no port. */
const LISTEN_WAIT_MS = 30_000;

/**
 * Ports the stack's container listens on, read from the host in its network
 * namespace (`/proc/<pid>/net/tcp`): works for any image, even one without a
 * shell. Retried for a while — a JVM can take seconds to bind.
 */
async function listeningPorts(
  server: Parameters<typeof executeRemoteCommand>[0],
  key: Parameters<typeof executeRemoteCommand>[1],
  composeDir: string,
  project: string
): Promise<number[]> {
  const command =
    `cd ${shellQuote(composeDir)} && C=$(docker compose -p ${shellQuote(project)} ps -q | head -1) && ` +
    `P=$(docker inspect -f '{{.State.Pid}}' "$C") && cat /proc/$P/net/tcp /proc/$P/net/tcp6 2>/dev/null`;
  const started = Date.now();
  for (;;) {
    const r = await executeRemoteCommand(server, key, command, { noRetry: true }).catch(() => null);
    const ports = r ? parseListeningPorts(r.stdout) : [];
    if (ports.length > 0 || Date.now() - started > LISTEN_WAIT_MS) return ports;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/** Ports an image declares with EXPOSE; empty when it declares none or cannot be read. */
async function imageExposedPorts(
  server: Parameters<typeof executeRemoteCommand>[0],
  key: Parameters<typeof executeRemoteCommand>[1],
  image: string
): Promise<number[]> {
  const r = await executeRemoteCommand(
    server,
    key,
    `docker image inspect -f '{{json .Config.ExposedPorts}}' ${shellQuote(image)}`,
    { noRetry: true }
  ).catch(() => null);
  return r && r.exitCode === 0 ? parseExposedPorts(r.stdout) : [];
}

/** The deployment log line saying which port is routed, and why. */
export function describePortChoice(choice: PortChoice, requested: number, listening: number[]): string {
  const seen = listening.length ? ` (listening: ${listening.join(', ')})` : '';
  switch (choice.source) {
    case 'requested':
      return `Port ${choice.port}: the application listens on the port it was given${seen}.`;
    case 'measured':
      return `⚠ Port ${choice.port}: the application listens there, not on ${requested}${seen} — routing to ${choice.port}.`;
    case 'image':
      return `⚠ Port ${choice.port}: declared by the image among the ports it listens on${seen} — routing to ${choice.port}.`;
    case 'common':
      return `⚠ Port ${choice.port}: the usual HTTP port among those it listens on${seen} — routing to ${choice.port}. Set the port in the settings if another one serves HTTP.`;
    case 'none':
      return `⚠ No listening TCP port found after ${LISTEN_WAIT_MS / 1000}s: this application serves no HTTP (a worker?), or it is not listening on ${requested}. Routing stays on ${requested}.`;
  }
}

/** The port the application listens on inside its container. */
export function applicationPort(app: Pick<ApplicationRow, 'ports_exposes' | 'ports_mappings'>): number {
  const exposed = parseInt((app.ports_exposes || '').split(',')[0], 10);
  if (exposed > 0) return exposed;
  // No exposed port declared: the container side of the first mapping.
  const mapping = (app.ports_mappings || '').split(',')[0].trim();
  const containerSide = parseInt(mapping.split(':').pop() || '', 10);
  return containerSide > 0 ? containerSide : 3000;
}

async function finalize(
  app: ApplicationRow,
  deploymentUuid: string,
  teamId: number,
  success: boolean,
  switched = true
): Promise<void> {
  await deploymentService.setDeploymentStatus(deploymentUuid, success ? 'finished' : 'failed');
  // A deployment that failed before touching the live stack changes nothing
  // about what is running: the application keeps its status.
  if (!success && !switched) return;
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
