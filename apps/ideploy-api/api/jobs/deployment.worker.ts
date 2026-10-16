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
import { DelayedError, Job } from 'bullmq';
import { acquireSlots, HeldSlots, retryLater } from './deploy-slots';
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
import { assertSafeGitBranch, assertSafeGitUrl, isSafeCommitSha, isSafeImageName, isSafeImageTag } from '../validation/git-input';
import { generateComposeFile, appWorkdir, composeDirFile, composeProject, composeServiceName } from '../docker/compose';
import { choosePort, parseExposedPorts, parseListeningPorts, parseLoopbackOnlyPorts, PortChoice } from '../docker/listening-ports';
import { planBuild, recipePlan, toBuildPack, buildDirectory } from '../docker/build-packs';
import { loadLabelContext, buildApplicationLabels } from '../services/application-labels.service';
import { writeFirewallFile } from '../services/firewall-file.service';
import { applyRoutes } from '../services/routes-file.service';
import { monorepoHint, monorepoProbeCommand, parseMonorepoProbe } from '../docker/monorepo-hint';
import { analyzeRepository, describePlan, parseSnapshot, snapshotCommand, BuildPlanResult } from '../build-plan';
import { joinPath, relativeTo } from '../build-plan/repo-files';
import { explainFailure, explainRuntimeFailure, KnownFailure } from '../build-plan/failures';
import { JavaRecipe, NodeRecipe } from '../build-plan/types';
import { DOCKER_HUB_MIRROR, lenientInstall, recipeDockerfile, recipeLabel } from '../docker/recipes';
import * as appService from '../services/application.service';
import * as envVarService from '../services/env-var.service';
import * as serverService from '../services/server.service';
import * as deploymentService from '../services/deployment.service';
import { explainGitFailure, resolveGitCredential } from '../services/git-credentials.service';
import { explainPullFailure, resolveRegistryLogin } from '../services/registry-credentials.service';
import * as pipelineService from '../services/pipeline.service';
import { summariseTrivy, trivyFailThreshold, trivyFails } from '../services/pipeline-scanners.service';
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

/** Lines a server prints once it is ready: the start check stops waiting on one. */
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

/** How long the new version runs beside the live one before the switch, at most. */
const TRIAL_MAX_MS = 30000;
/** Ready, and still running this long after its start. */
const TRIAL_READY_MIN_MS = 6000;

/** Below this free space, unused images and old build cache are removed before building. */
const DISK_CLEANUP_BELOW_MB = 3072;

/**
 * A failure with its cause, as a code (OUT_OF_MEMORY, NO_BUILD_OUTPUT,
 * MONOREPO_PICK_APP…): logged with every failed deployment, so the platform
 * counts its failures by cause and fixes the most frequent first.
 */
export class DeploymentFailure extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
  }
}

/** A build step that failed, explained. */
interface BuildFailure {
  known: KnownFailure | null;
  message: string;
}

/** `timeout` exits 124: the build ran past BUILD_TIMEOUT_SECONDS. */
const TIMEOUT_FAILURE: KnownFailure = {
  code: 'BUILD_TIMEOUT',
  explanation: 'The build ran for more than 45 minutes and was stopped. Look above for the step that hung (a test waiting for a service, an interactive prompt).',
};

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
  work: () => Promise<T>,
  opts: { onBusy?: () => Promise<never> } = {}
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
    if (opts.onBusy) await opts.onBusy();
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

export async function processDeployment(job: Job<DeploymentJobData>, token?: string): Promise<void> {
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
  let heldSlots: HeldSlots | undefined;

  // Fair share of the workers: a team or a server at its limit, or this
  // application already deploying, sends the job back to the queue for a few
  // seconds instead of holding a worker while it waits.
  const serverRef = await appService.getApplicationServer(applicationId).catch(() => null);
  for (;;) {
    const slots = await acquireSlots(deploymentUuid, teamId, serverRef?.serverId ?? null);
    if ('held' in slots) {
      heldSlots = slots.held;
      break;
    }
    const why =
      slots.full === 'team'
        ? `your team already has ${slots.limit} deployments running`
        : `this server is already building ${slots.limit} deployments`;
    await realtime.deploymentLog(deploymentUuid, `Queued: ${why}; starting as soon as one finishes.`);
    await retryLater(job, token);
  }

  try {
    await runDeployment(job, token, log, saveLog);
  } finally {
    await heldSlots?.release();
  }
}

async function runDeployment(
  job: Job<DeploymentJobData>,
  token: string | undefined,
  log: (line: string) => Promise<void>,
  saveLog: () => Promise<void>
): Promise<void> {
  const { deploymentUuid, applicationUuid, applicationId, teamId } = job.data;
  await deploymentService.setDeploymentStatus(deploymentUuid, 'in_progress');
  await log(`Deployment ${deploymentUuid} started for application ${applicationUuid}`);

  // Whether the live stack has been touched. Before that point a failure
  // leaves the previous version running, and the application's status alone.
  let switched = false;

  try {
    await withApplicationLock(applicationId, deploymentUuid, log, () => deploy(job.data, log, () => (switched = true)), {
      // Behind another deployment of the same application: back to the queue,
      // the worker goes to someone else meanwhile.
      onBusy: token ? () => retryLater(job, token) as Promise<never> : undefined,
    });
    const app = await appService.getApplication(teamId, applicationUuid);
    if (app) await finalize(app, deploymentUuid, teamId, true);
    logger.info('Deployment succeeded', { event: 'deployment.succeeded', deploymentUuid, applicationUuid });
    await log('✅ Deployment finished successfully');
    await saveLog();
  } catch (err) {
    // Sent back to the queue (application busy): not a failure, nothing ran.
    if (err instanceof DelayedError) {
      await deploymentService.setDeploymentStatus(deploymentUuid, 'queued');
      throw err;
    }
    const message = (err as Error).message;
    const failureCode = err instanceof DeploymentFailure ? err.code : 'UNCLASSIFIED';
    // `deployment.failed` + `failureCode`: Grafana counts failures by cause (dashboard "IDEM · Journaux").
    logger.error('Deployment failed', { event: 'deployment.failed', deploymentUuid, applicationUuid, failureCode, switched, message });
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
  // With Traefik, routes live in the proxy's file provider (routes-<uuid>.yml):
  // domain changes then apply without a deployment.
  const useRoutesFile = labelContext?.proxyType === 'traefik';
  const labels = labelContext ? buildApplicationLabels(app, labelContext, { routesFile: useRoutesFile }) : undefined;
  const network = labelContext?.network;

  const workdir = appWorkdir(app);
  const project = composeProject(app);
  const releasesDir = `${workdir}/releases`;
  const releaseDir = `${releasesDir}/${deploymentUuid.slice(0, 8)}`;
  const srcDir = `${releaseDir}/src`;
  // One image repository per application, one tag per deployment: old images
  // can then be removed without touching another application's, even one that
  // shares its name.
  // An application that runs a registry image keeps the registry's own name,
  // so its old tags can be pruned like the images this platform builds.
  const imageDeploy = toBuildPack(app.build_pack) === 'dockerimage';
  const imageRepository = imageDeploy
    ? (app.docker_registry_image_name ?? '')
    : `ideploy-${app.uuid.toLowerCase()}`;
  const imageTag = `${imageRepository}:${deploymentUuid.slice(0, 8)}`;
  // The version actually deployed of a registry image (tag, or a rollback's).
  let imageVersion: string | null = null;

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

  if (imageDeploy) {
    // Nothing to fetch or build: the image is pulled and run. The version is
    // the one the caller asked for (a pipeline's tag, a rollback), else the
    // application's own tag.
    const name = app.docker_registry_image_name;
    if (!name || !isSafeImageName(name)) {
      throw new Error('This application has no image to run: set the image (e.g. registry.example.com/organisation/app) in its settings.');
    }
    const version = data.commit && data.commit !== 'HEAD' ? data.commit : app.docker_registry_image_tag || 'latest';
    if (!isSafeImageTag(version)) throw new Error(`"${version}" is not a valid image tag.`);
    const reference = `${name}:${version}`;

    await streamStep(deploymentUuid, `Pulling ${reference}`, async () => {
      const login = await resolveRegistryLogin(teamId, name);
      // The login lives in a throw-away Docker config for this pull only: one
      // written to the server's own ~/.docker would stay for every team on it.
      const pull = login
        ? `D=$(mktemp -d) && trap 'rm -rf "$D"' EXIT && ` +
          `printf %s ${shellQuote(login.password)} | DOCKER_CONFIG="$D" docker login ${shellQuote(login.registry)} -u ${shellQuote(login.username)} --password-stdin >/dev/null && ` +
          `DOCKER_CONFIG="$D" docker pull ${shellQuote(reference)}`
        : `docker pull ${shellQuote(reference)}`;
      const r = await executeRemoteCommand(server, key, pull, {
        onData: (c) => log(c),
        redact: login ? [login.password] : undefined,
        noRetry: true,
      });
      if (r.exitCode !== 0) {
        throw new Error(`Pulling the image failed: ${explainPullFailure(r.stderr, name, Boolean(login))}`);
      }
      const digest = await executeRemoteCommand(
        server,
        key,
        `docker image inspect -f '{{index .RepoDigests 0}}' ${shellQuote(reference)}`,
        { noRetry: true }
      ).catch(() => null);
      if (digest?.exitCode === 0 && digest.stdout.trim()) await log(`Digest: ${digest.stdout.trim()}`);
      // The version is what rollback goes back to.
      await deploymentService.recordCommit(deploymentUuid, app.id, version);
    });

    imageVersion = version;
    composeImage = reference;
    compose = generateComposeFile(app, reference, labels, network, runtimeEnv, port);
  } else if (!app.git_repository && !sourceArchive) {
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
            // Before the remote goes: submodules and LFS files fetch through it.
            `${fetchSubmodulesAndLfs(credential?.authenticatedUrl ?? null)} && ` +
            // The remote URL may carry the team's token: not left in .git/config.
            `git remote remove origin && ` +
            `echo "COMMIT=$(git rev-parse HEAD)" && ls -la`,
          { onData: (c) => log(c), redact: credential ? [credential.token] : undefined }
        );
        if (r.exitCode !== 0) throw new Error(`Fetching the code failed: ${explainGitFailure(r.stderr, Boolean(credential))}`);
        const sha = /COMMIT=([0-9a-f]{40})/.exec(r.stdout)?.[1];
        if (sha) await deploymentService.recordCommit(deploymentUuid, app.id, sha);
      });
    }

    const baseDirectory = await resolveBaseDirectory(server, key, srcDir, app.base_directory, log);
    let pack = toBuildPack(app.build_pack);

    // The build plan, read from the code: which application, which runtime
    // version, which commands. Docker and compose builds follow their own files.
    const overrides = { install: app.install_command, build: app.build_command, start: app.start_command };
    const read: { plan: BuildPlanResult | null } = { plan: null };
    // iDeploy's own recipe replaces nixpacks unless a build variable says otherwise.
    const recipes = pack === 'nixpacks' && !buildEnv.some((pair) => /^IDEPLOY_BUILDER=\s*nixpacks\s*$/i.test(pair));
    if (pack === 'nixpacks' || pack === 'static') {
      await streamStep(deploymentUuid, 'Reading the code', async () => {
        read.plan = await readBuildPlan(server, key, srcDir, baseDirectory, overrides, recipes, log);
      });
    }
    const used = read.plan?.language ? read.plan : null;
    // A site with nothing to keep running is served as files (nixpacks would
    // look for a start command and fail).
    if (used?.output === 'static' && pack === 'nixpacks' && !app.start_command) pack = 'static';
    // The user's commands run in their Root directory, as they always did,
    // even when the build itself runs from the monorepo root.
    const appRel = used ? relativeTo(used.buildRoot, used.appDir) : '';
    const own = (command: string | null | undefined) => (command ? (appRel ? `cd ${shellQuote(appRel)} && ${command}` : command) : null);
    // Variables set for runtime only. A static site has no runtime: they can
    // only have been meant for its build (VITE_API_URL…), where they used to
    // be missing without a word. A server gets them at build only as a retry,
    // when its build says a variable is missing.
    const ownKey = (pair: string) => pair.split('=')[0];
    const runtimeOnly = runtimeEnv.filter((pair) => !buildEnv.some((b) => ownKey(b) === ownKey(pair)));
    if (pack === 'static' && runtimeOnly.length) {
      await log(`A static site has no runtime: its variables (${runtimeOnly.map(ownKey).join(', ')}) are given to its build.`);
    }
    const buildContext = {
      srcDir,
      workdir: releaseDir,
      imageTag,
      baseDirectory: used ? used.buildRoot : baseDirectory,
      installCommand: own(app.install_command) ?? used?.install ?? null,
      buildCommand: own(app.build_command) ?? used?.build ?? null,
      startCommand: own(app.start_command) ?? used?.start ?? null,
      publishDirectory: app.publish_directory ? joinPath(appRel, app.publish_directory) : used?.publishDirectory ?? null,
      port,
      buildEnv: pack === 'static' ? [...buildEnv, ...runtimeOnly] : buildEnv,
      composeProject: project,
      dockerfileLocation: app.dockerfile_location,
      dockerfileTarget: app.dockerfile_target_build,
      nixpacksVariables: used?.nixpacksEnv,
      nodeVersion: used?.runtimeVersion?.name === 'Node' ? used.runtimeVersion.version : null,
    };
    /** Run build steps; the failure, explained, instead of an exception — so a fallback can follow. */
    const runBuildSteps = async (steps: { label: string; command: string }[]): Promise<BuildFailure | null> => {
      for (const step of steps) {
        let failure: BuildFailure | null = null;
        await streamStep(deploymentUuid, step.label, async () => {
          // A build that fails fails the same way again: no retry (the SSH
          // retries are for a dropped connection), except a registry timeout.
          const run = () => executeRemoteCommand(server, key, step.command, { onData: (c) => log(c), noRetry: true });
          let r = await run();
          if (r.exitCode !== 0 && explainFailure(`${r.stdout}\n${r.stderr}`)?.retryable) {
            await log('\n↻ A download failed (network). Retrying this step once.');
            r = await run();
          }
          if (r.exitCode === 0) return;
          const all = `${r.stdout}\n${r.stderr}`;
          const output = r.stderr || r.stdout;
          // The missing-ARG hint, printed before the build, leads the error.
          let hint = /⚠ The Dockerfile expects build argument\(s\)[^\n]*/.exec(output)?.[0];
          const known = r.exitCode === 124 ? TIMEOUT_FAILURE : explainFailure(all);
          if (!hint && known) {
            await log(`\n✗ ${known.explanation}`);
            hint = known.explanation;
          }
          // A monorepo root: nixpacks cannot pick the application. Say which
          // ones exist and the commands to set.
          if (!hint && /No start command could be found/.test(all)) {
            const probe = await executeRemoteCommand(server, key, monorepoProbeCommand(buildDirectory(buildContext)), { noRetry: true });
            const monorepo = probe.exitCode === 0 ? monorepoHint(parseMonorepoProbe(probe.stdout)) : null;
            if (monorepo) {
              await log(`\n${monorepo}`);
              hint = monorepo.split('\n')[0];
            }
          }
          failure = { known, message: `${step.label} failed: ${hint ? `${hint} — ` : ''}${output.slice(-400)}` };
        });
        if (failure) return failure;
      }
      return null;
    };

    const recipe = used?.output === 'server' ? used.recipe : undefined;
    // The user's commands win in a recipe too.
    const ownRecipe: NodeRecipe | JavaRecipe | undefined =
      recipe?.kind === 'node'
        ? {
            ...recipe,
            install: own(app.install_command) ?? recipe.install,
            build: own(app.build_command) ?? recipe.build,
            start: own(app.start_command) ?? recipe.start,
            // The contract is read from the plan's start command, not the user's.
            output: app.start_command ? null : recipe.output,
          }
        : recipe && { ...recipe, build: own(app.build_command) ?? recipe.build };
    /** A recipe build: its recipe, the variables its build sees, the registry of its base images. */
    type RecipeAttempt = { recipe: NodeRecipe | JavaRecipe; env: string[]; registry: string };
    const withRecipe = (a: RecipeAttempt) =>
      recipePlan({ ...buildContext, buildEnv: a.env }, recipeDockerfile(a.recipe, a.env.map(ownKey), a.registry), recipeLabel(a.recipe));
    let attempt: RecipeAttempt | null = ownRecipe ? { recipe: ownRecipe, env: buildEnv, registry: '' } : null;
    const plan = attempt ? withRecipe(attempt) : planBuild(pack, buildContext);

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

    // Each fallback runs only when the failure says it can help: a code
    // error fails every way, and is reported at once.
    // Each cause is retried once, three retries at most: a build can need
    // two (a heap, then a variable), never a loop.
    let failure = await runBuildSteps(plan.steps);
    const retried = new Set<string>();
    while (failure && attempt && retried.size < 3) {
      const code = failure.known?.code;
      if (!code || retried.has(code)) break;
      retried.add(code);
      const current: RecipeAttempt = attempt;
      let next: RecipeAttempt | null = null;
      if (code === 'LOCKFILE_OUT_OF_DATE' && current.recipe.kind === 'node' && !app.install_command) {
        await log(
          '\n↻ The lockfile does not match package.json. Building again with an install that updates it — ' +
            'commit an up-to-date lockfile: the versions deployed may differ from the ones you tested.'
        );
        next = { ...current, recipe: { ...current.recipe, install: lenientInstall(current.recipe.manager) } };
      } else if (code === 'NODE_HEAP' && current.recipe.kind === 'node' && !current.env.some((p) => ownKey(p) === 'NODE_OPTIONS')) {
        await log('\n↻ The build ran out of Node.js heap. Building again with a 4 GB heap (NODE_OPTIONS=--max-old-space-size=4096).');
        next = { ...current, env: [...current.env, 'NODE_OPTIONS=--max-old-space-size=4096'] };
      } else if (code === 'MISSING_ENV' && runtimeOnly.length) {
        await log(
          `\n↻ The build needs a variable it was not given. Building again with the runtime variables too (${runtimeOnly.map(ownKey).join(', ')}) — ` +
            'mark the ones the build needs as build variables to skip this retry.'
        );
        next = { ...current, env: [...current.env, ...runtimeOnly.filter((p) => !current.env.some((e) => ownKey(e) === ownKey(p)))] };
      } else if (code === 'DOCKERHUB_RATE_LIMIT' && !current.registry) {
        await log(`\n↻ ${failure.known?.explanation} Building again from Google's mirror of Docker Hub (${DOCKER_HUB_MIRROR}).`);
        next = { ...current, registry: DOCKER_HUB_MIRROR };
      } else if (code === 'BASE_IMAGE_MISSING' || code === 'COREPACK') {
        await log(`\n↻ ${failure.known?.explanation} Building with nixpacks instead.`);
        failure = await runBuildSteps(planBuild('nixpacks', buildContext).steps);
        break;
      }
      if (!next) break;
      attempt = next;
      failure = await runBuildSteps(withRecipe(next).steps);
    }
    if (failure) throw new DeploymentFailure(failure.message, failure.known?.code ?? 'BUILD_FAILED');

    if (plan.runtime === 'compose-file') {
      // The repository ships its own stack; it runs from its own directory.
      composeDir = buildDirectory(buildContext);
      compose = null;
    } else {
      composeImage = imageTag;
      compose = generateComposeFile(app, imageTag, labels, network, runtimeEnv, port);
    }
  }

  // A pipeline's deployment checks the image it just built — what actually
  // ships, dependencies of the base image included — before the live stack is
  // touched: a critical finding stops here with the previous version serving.
  if (data.pipelineExecutionId && composeImage) {
    await streamStep(deploymentUuid, 'Scanning the image (Trivy)', async () => {
      await scanBuiltImage(server, key, composeImage as string, data.pipelineExecutionId as number, log, data.trivyFailOn);
    });
  }

  // The new image runs beside the live version first: a version that cannot
  // start never replaces one that works (`docker compose up` replaces the
  // container in place, and a crash then took the site down).
  if (compose !== null && composeImage && !trialDisabled([...runtimeEnv, ...buildEnv])) {
    const image = composeImage;
    await streamStep(deploymentUuid, 'Trying the new version before the switch', async () => {
      await trialRun(server, key, { app, image, network: network ?? undefined, env: trialEnvironment(runtimeEnv, port), log });
    });
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
    if (compose !== null && useRoutesFile) {
      const { routed, waiting } = await applyRoutes(server, key, app, { port });
      if (routed.length) await log(`Routes: ${routed.join(', ')}`);
      if (waiting.length) await log(`Waiting for DNS (not routed yet): ${waiting.join(', ')} — see Settings › domain.`);
    }
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

  /** A crash at start, with its cause read from the logs when known. */
  const startFailure = async (what: string, logs: string): Promise<DeploymentFailure> => {
    const known = explainRuntimeFailure(logs);
    if (known) await log(`\n✗ ${known.explanation}`);
    return new DeploymentFailure(`${what} ${known ? known.explanation : 'Check the logs above for errors.'}`, known?.code ?? 'START_FAILED');
  };

  // Tracks how much of `docker compose logs` output has already been
  // streamed, across both the polling loop and the later grace-period
  // re-check, so the confirmation never re-sends lines already shown.
  let lastLogLength = 0;

  /** One `docker compose ps` + fresh-log-tail read. Streams any new log output as a side effect. */
  const checkContainerState = async (): Promise<{ isUp: boolean; crashed: boolean; empty: boolean; allLogs: string; allLogsLower: string }> => {
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
      return { ...judgeContainers(states), empty: states.length === 0, allLogs: currentLogs, allLogsLower: currentLogs.toLowerCase() };
    }
    // Not JSON (a very old Compose): read the table.
    const table = psResult.stdout.trim().toLowerCase();
    return {
      isUp: table.includes(' up ') || table.includes('running'),
      crashed: /\bexited \((?!0\))|\bdead\b|\brestarting\b/.test(table),
      empty: table.length === 0,
      allLogs: currentLogs,
      allLogsLower: currentLogs.toLowerCase(),
    };
  };


  await streamStep(deploymentUuid, 'Verifying container', async () => {
    await log('Monitoring container startup and logs...');
    const startTime = Date.now();
    const maxWaitMs = 45000;
    let confirmedUp = false;

    while (Date.now() - startTime < maxWaitMs) {
      const { isUp, crashed, empty, allLogs, allLogsLower } = await checkContainerState();

      if (crashed || (!empty && !isUp)) {
        throw await startFailure('Container exited unexpectedly during startup.', allLogs);
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
    const { isUp, crashed, allLogs } = await checkContainerState();
    if (crashed || !isUp) {
      throw await startFailure('Container crashed shortly after starting — it did not stay up.', allLogs);
    }
    await log('\n✓ Confirmed: still running after the grace period.');
  });

  // The port the proxy routes to must be the one the container listens on.
  // Only for the compose file we generate: a repository's own stack carries
  // its own routing.
  if (compose !== null && composeImage) {
    const image = composeImage;
    await streamStep(deploymentUuid, 'Detecting the port', async () => {
      const { ports: listening, loopbackOnly } = await listeningPorts(server, key, composeDir, project);
      const exposed = await imageExposedPorts(server, key, image);
      const choice = choosePort(port, listening, exposed);
      await log(
        loopbackOnly.length
          ? `⚠ The application listens on ${loopbackOnly.join(', ')} but only on localhost (127.0.0.1): the proxy cannot reach it and the site answers 502. ` +
              'Make it listen on 0.0.0.0 (for Node: app.listen(process.env.PORT, "0.0.0.0"); the HOST variable is set to 0.0.0.0).'
          : describePortChoice(choice, port, listening)
      );
      if (choice.source === 'none' || choice.port === port) return;

      // Route to the real port: new labels and PORT, saved on the application.
      await appService.setExposedPort(app.id, choice.port);
      const routed = { ...app, ports_exposes: String(choice.port) };
      const routedLabels = labelContext ? buildApplicationLabels(routed, labelContext, { routesFile: useRoutesFile }) : undefined;
      if (useRoutesFile) await applyRoutes(server, key, routed, { port: choice.port });
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

  // What is running now is what a plain redeploy runs again.
  if (imageVersion) await appService.setImageTag(app.id, imageVersion);

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

/** `IDEPLOY_TRIAL=false` (a runtime or build variable) skips the trial run: for an app that must never run twice at once. */
export function trialDisabled(env: string[]): boolean {
  return env.some((pair) => /^IDEPLOY_TRIAL=\s*(false|0|no|off)\s*$/i.test(pair));
}

/** The environment the generated compose gives the container: the user's variables, PORT and HOST unless they set them. */
export function trialEnvironment(runtimeEnv: string[], port: number): string[] {
  const env = [...runtimeEnv];
  if (!env.some((e) => e.startsWith('PORT='))) env.push(`PORT=${port}`);
  if (!env.some((e) => e.startsWith('HOST='))) env.push('HOST=0.0.0.0');
  return env;
}

/**
 * Run the new image beside the live version, with its variables and on its
 * network (its database resolves), but without ports or routing — no traffic
 * reaches it. It must stay up until it says it is ready, or for the settle
 * time; stopped at start, the deployment fails with the cause and the live
 * version keeps serving. The first deployment has nothing to protect: its
 * start is checked after the switch, as before.
 */
async function trialRun(
  server: Parameters<typeof executeRemoteCommand>[0],
  key: Parameters<typeof executeRemoteCommand>[1],
  opts: { app: { name: string; uuid: string }; image: string; network?: string; env: string[]; log: (line: string) => Promise<void> }
): Promise<void> {
  const live = composeServiceName(opts.app);
  const name = `${live}-trial`;
  const running = await executeRemoteCommand(server, key, `docker ps -q -f ${shellQuote(`name=^${live}$`)}`, { noRetry: true });
  if (running.exitCode !== 0 || !running.stdout.trim()) {
    await opts.log('No live version to protect yet: the start is checked after the switch.');
    return;
  }
  // The values never reach the log, even if a command echoes them.
  const secrets = opts.env.map((pair) => pair.slice(pair.indexOf('=') + 1)).filter((v) => v.length >= 6);
  const envFlags = opts.env.map((pair) => `-e ${shellQuote(pair)}`).join(' ');
  const started = await executeRemoteCommand(
    server,
    key,
    `docker rm -f ${shellQuote(name)} >/dev/null 2>&1; ` +
      `docker run -d --init --name ${shellQuote(name)} --label ideploy.trial=true --label traefik.enable=false ` +
      `${opts.network ? `--network ${shellQuote(opts.network)} ` : ''}${envFlags} ${shellQuote(opts.image)}`,
    { noRetry: true, redact: secrets }
  );
  if (started.exitCode !== 0) {
    // The trial is a safeguard: unable to run it, the deployment goes on as before.
    await opts.log(`⚠ The trial run could not start (${(started.stderr || started.stdout).trim().slice(0, 200)}): switching without it.`);
    return;
  }
  try {
    const began = Date.now();
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const r = await executeRemoteCommand(
        server,
        key,
        `docker inspect -f '{{.State.Status}} {{.State.ExitCode}}' ${shellQuote(name)}; echo @@LOGS; docker logs --tail 200 ${shellQuote(name)} 2>&1`,
        { noRetry: true, redact: secrets }
      );
      const at = r.stdout.indexOf('@@LOGS');
      const [status, exitCode] = (at === -1 ? r.stdout : r.stdout.slice(0, at)).trim().split(/\s+/);
      const logs = at === -1 ? '' : r.stdout.slice(at + 7);
      const elapsed = Date.now() - began;
      if (status === 'exited' || status === 'dead') {
        await opts.log(`\nThe new version stopped after ${Math.round(elapsed / 1000)}s (exit code ${exitCode}). Its last lines:\n${logs.split('\n').slice(-60).join('\n')}`);
        const known = explainRuntimeFailure(logs);
        if (known) await opts.log(`\n✗ ${known.explanation}`);
        throw new DeploymentFailure(
          `The new version stopped at start${known ? `: ${known.explanation}` : ' — see its last lines above.'} The live version keeps serving.` +
            (known ? '' : ' If this application cannot run twice at once (a bot, a queue consumer), set the variable IDEPLOY_TRIAL=false.'),
          known?.code ?? 'START_FAILED'
        );
      }
      // "Ready" is not enough on its own: Next.js prints "Ready in 157ms"
      // and then exits for want of a build. Still running a while later is.
      const ready = READY_LOG_PHRASES.some((p) => logs.toLowerCase().includes(p));
      if (status === 'running' && ((ready && elapsed >= TRIAL_READY_MIN_MS) || elapsed >= SETTLE_MS)) {
        await opts.log(ready ? '✓ The new version started and is ready.' : '✓ The new version is running and has not crashed.');
        return;
      }
      if (elapsed >= TRIAL_MAX_MS) {
        await opts.log(`⚠ The new version did not settle within ${TRIAL_MAX_MS / 1000}s (state: ${status ?? 'unknown'}): switching, its start is checked after.`);
        return;
      }
    }
  } finally {
    // Stopped gracefully (a job in progress may finish), then removed.
    await executeRemoteCommand(server, key, `docker stop -t 10 ${shellQuote(name)} >/dev/null 2>&1; docker rm -f ${shellQuote(name)} >/dev/null 2>&1; true`, {
      noRetry: true,
    }).catch(() => undefined);
  }
}

/**
 * Shell that completes a checkout: git submodules (a shallow fetch left them
 * empty, and the build failed on missing files), and Git LFS files (left as
 * small text pointers: an image, a model, a font that "exists" but is not
 * the file). Private submodules on the same host use the clone's token.
 * Neither stops the deployment: a submodule the token cannot read is said,
 * and the build reports what it misses.
 */
export function fetchSubmodulesAndLfs(authenticatedUrl: string | null): string {
  let rewrite = '';
  if (authenticatedUrl) {
    try {
      const url = new URL(authenticatedUrl);
      if (url.username) {
        const auth = `${url.protocol}//${url.username}:${url.password}@${url.host}/`;
        rewrite =
          ` -c ${shellQuote(`url.${auth}.insteadOf=https://${url.host}/`)}` +
          ` -c ${shellQuote(`url.${auth}.insteadOf=git@${url.host}:`)}` +
          ` -c ${shellQuote(`url.${auth}.insteadOf=ssh://git@${url.host}/`)}`;
      }
    } catch {
      /* not a URL: submodules fetch with their own addresses */
    }
  }
  return (
    `{ if [ -f .gitmodules ]; then ` +
    `git${rewrite} submodule update --init --recursive --depth 1 && echo "Git submodules fetched." || ` +
    `echo "⚠ Git submodules could not be fetched (private, or on another host): the build will miss their files."; fi; } && ` +
    `{ if grep -qs 'filter=lfs' .gitattributes; then ` +
    `command -v git-lfs >/dev/null 2>&1 || apt-get install -y git-lfs >/dev/null 2>&1 || true; ` +
    `if command -v git-lfs >/dev/null 2>&1; then git lfs install --local >/dev/null && git lfs pull && echo "Git LFS files fetched." || echo "⚠ Git LFS files could not be fetched: the build sees pointers instead of the files."; ` +
    `else echo "⚠ This repository stores files with Git LFS and git-lfs cannot be installed on the server: the build sees pointers instead of the files."; fi; fi; }`
  );
}

/**
 * The build plan of the checkout: read once over SSH, decided here, written
 * to the log. A blocking issue (a monorepo with several applications and none
 * picked, no way to start the app…) stops the deployment before the build,
 * with what to do. Unreadable: null, and the build engine decides alone.
 */
async function readBuildPlan(
  server: Parameters<typeof executeRemoteCommand>[0],
  key: Parameters<typeof executeRemoteCommand>[1],
  srcDir: string,
  appDir: string,
  overrides: { install?: string | null; build?: string | null; start?: string | null },
  recipes: boolean,
  log: (line: string) => Promise<void>
): Promise<BuildPlanResult | null> {
  const r = await executeRemoteCommand(server, key, snapshotCommand(srcDir), { noRetry: true });
  if (r.exitCode !== 0 && !r.stdout.includes('@@F ')) {
    await log('⚠ The code could not be read before the build: the build engine decides alone.');
    return null;
  }
  const snapshot = parseSnapshot(r.stdout);
  // Short of space: what can go without risk goes — untagged images and
  // build cache unused for a week (each release's image keeps its tag, for
  // rollback). Then measured again.
  if (snapshot.diskFreeMb !== null && snapshot.diskFreeMb < DISK_CLEANUP_BELOW_MB) {
    await log(`\n⚠ ${snapshot.diskFreeMb} MB free on the server: removing unused images and old build cache.`);
    const clean = await executeRemoteCommand(
      server,
      key,
      `docker image prune -f >/dev/null 2>&1; docker builder prune -f --filter until=168h >/dev/null 2>&1; ` +
        `df -Pk ${shellQuote(srcDir)} | awk 'NR==2{print "@@DISK " int($4/1024)}'`,
      { noRetry: true }
    ).catch(() => null);
    const after = Number(/@@DISK (\d+)/.exec(clean?.stdout ?? '')?.[1]);
    if (after) {
      await log(`  ${after} MB free now.`);
      snapshot.diskFreeMb = after;
    }
  }
  const plan = await analyzeRepository(snapshot.files, appDir, {
    overrides,
    resources: { memoryAvailableMb: snapshot.memoryAvailableMb, diskFreeMb: snapshot.diskFreeMb },
  });
  // A Java start command of the user's names the jars where nixpacks puts them: nixpacks builds it.
  const recipe = recipes && plan.recipe && !(plan.recipe.kind === 'java' && overrides.start) ? plan.recipe : undefined;
  plan.recipe = recipe;
  // The engine's own limits (Gradle 9, a recent JDK) do not apply to a recipe.
  if (recipe) plan.issues = plan.issues.filter((i) => i.engine !== 'nixpacks');
  const effective = {
    install: overrides.install ? `${overrides.install} (yours)` : null,
    build: overrides.build ? `${overrides.build} (yours)` : null,
    start: overrides.start ? `${overrides.start} (yours)` : null,
  };
  const builder = !plan.language
    ? null
    : recipe
      ? `Builder: iDeploy recipe, ${recipeLabel(recipe)} — dependencies cached between builds (build variable IDEPLOY_BUILDER=nixpacks to use nixpacks)`
      : plan.output === 'static'
        ? 'Builder: static site — built in a Node container, served by nginx'
        : 'Builder: nixpacks';
  const lines = [...describePlan(plan, effective), ...(builder ? [builder] : [])];
  await log(`\n──► Build plan, read from the code\n${lines.map((l) => `  ${l}`).join('\n')}`);
  const blocking = plan.issues.find((i) => i.severity === 'blocking');
  if (blocking) throw new DeploymentFailure(blocking.message, blocking.code);
  return plan;
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

/**
 * Trivy on the image just built. The result is recorded on the pipeline
 * execution that asked for the deployment; a finding at or above the
 * threshold fails the deployment before it switches anything.
 */
async function scanBuiltImage(
  server: Parameters<typeof executeRemoteCommand>[0],
  key: Parameters<typeof executeRemoteCommand>[1],
  image: string,
  executionId: number,
  log: (line: string) => Promise<void>,
  failOn?: string
): Promise<void> {
  const r = await executeRemoteCommand(
    server,
    key,
    `docker run --rm -v ideploy-trivy-cache:/root/.cache -v /var/run/docker.sock:/var/run/docker.sock:ro ` +
      `aquasec/trivy:latest image --quiet --format json --scanners vuln ${shellQuote(image)}`,
    { noRetry: true }
  );
  if (r.exitCode !== 0) {
    const detail = (r.stderr || r.stdout).slice(-300);
    await log(`The image could not be scanned: ${detail}`);
    await pipelineService.recordScanResult(executionId, 'trivy-image', { status: 'failed', summary: detail });
    throw new Error('Trivy could not scan the built image');
  }
  const { counts, findings } = summariseTrivy(r.stdout);
  const line = `Image vulnerabilities — critical ${counts.CRITICAL}, high ${counts.HIGH}, medium ${counts.MEDIUM}, low ${counts.LOW}`;
  await log(line);
  // The application's policy; the platform default only when none was passed.
  const threshold = (failOn as Parameters<typeof trivyFails>[1]) ?? trivyFailThreshold();
  const fails = trivyFails(counts, threshold);
  await pipelineService.recordScanResult(executionId, 'trivy-image', {
    status: fails ? 'failed' : 'success',
    vulnerabilities: counts.CRITICAL + counts.HIGH + counts.MEDIUM + counts.LOW + counts.UNKNOWN,
    critical_count: counts.CRITICAL,
    high_count: counts.HIGH,
    medium_count: counts.MEDIUM,
    low_count: counts.LOW,
    vulnerabilities_detail: findings,
    summary: fails ? line : `${line}${threshold === 'NONE' ? ' (report only)' : ''}`,
  });
  if (fails) throw new Error(`The built image has vulnerabilities at or above ${threshold}; nothing was deployed.`);
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
): Promise<{ ports: number[]; loopbackOnly: number[] }> {
  const command =
    `cd ${shellQuote(composeDir)} && C=$(docker compose -p ${shellQuote(project)} ps -q | head -1) && ` +
    `P=$(docker inspect -f '{{.State.Pid}}' "$C") && cat /proc/$P/net/tcp /proc/$P/net/tcp6 2>/dev/null`;
  const started = Date.now();
  for (;;) {
    const r = await executeRemoteCommand(server, key, command, { noRetry: true }).catch(() => null);
    const ports = r ? parseListeningPorts(r.stdout) : [];
    if (ports.length > 0 || Date.now() - started > LISTEN_WAIT_MS) {
      return { ports, loopbackOnly: r && ports.length === 0 ? parseLoopbackOnlyPorts(r.stdout) : [] };
    }
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
