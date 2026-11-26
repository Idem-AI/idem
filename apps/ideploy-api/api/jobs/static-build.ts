/**
 * Building a site from its sources on the server that will serve it — what
 * iCode sends now instead of a site its browser built.
 *
 * Why here and not in the browser: the WebContainer is a Node in a browser
 * tab, several times slower than a real one and sharing the user's (often
 * modest) device with the live preview. Lovable and Replit build in their own
 * cloud too. Why here and not on iCode's server: the code is AI-written and
 * user-editable, `vite build` runs its configuration and the pre-render runs
 * its React code — it must run isolated, and Docker is already on this server.
 *
 * The build runs in a throwaway `node:<v>-slim` container:
 *   - as an unprivileged user (1000), no capability, no privilege escalation;
 *   - bounded: 2 CPUs, 1.5 GB of memory, 1024 processes, 10 minutes;
 *   - on Docker's default bridge, never on the applications' network: it
 *     reaches npm and Google Fonts, not its neighbours;
 *   - with only `<workdir>/build` mounted.
 *
 * What makes it fast:
 *   - dependencies stay between builds (`<workdir>/build/src/**\/node_modules`,
 *     stamped with a digest of package.json, lockfile and .npmrc): a republish
 *     after a text change runs `vite build` only;
 *   - the npm cache is the application's own (`<workdir>/build/.npm`): never
 *     shared between teams, so no build can poison another's packages;
 *   - the image is pulled once per server, in the background as soon as an
 *     address is reserved (`ensureBuildImage`);
 *   - the dependencies themselves can be installed at reservation time, from
 *     the package.json alone (`prepareDependencies`), while the user reads.
 *
 * The output goes straight into the release nginx serves (static-fast-path):
 * no image is built.
 */
import { createTarGz, readTarGz } from '../utils/tar';
import { executeRemoteCommand, shellQuote, uploadRemoteFile } from '../ssh/ssh';
import { tryAcquire, release } from './deploy-slots';
import { writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ApplicationRow, PrivateKeyRow, ServerRow } from '../models/ideploy.types';

const q = shellQuote;

/** Builds at once on one server: each takes up to 2 CPUs; the sites it serves keep the rest. */
export const BUILDS_PER_SERVER = 3;
const BUILD_TIMEOUT_SECONDS = 600;
/** Printed by the build when the build environment itself is missing (not the site's fault): iCode then builds in the browser. */
export const BUILD_UNAVAILABLE_MARKER = 'IDEPLOY_BUILD_UNAVAILABLE';
/** The site's own build report (`.idem/build-report.json`), passed to iCode through the log. */
export const BUILD_REPORT_MARKER = '@@IDEM_BUILD_REPORT';

export interface SiteBuild {
  /** Folder of the project inside the archive ('' for the root, `frontend` for a complete application). */
  baseDir: string;
  install: string;
  build: string;
  /** Build-time variables (`KEY=value`), e.g. VITE_API_URL. */
  env: string[];
  nodeImage: string;
}

/** `/frontend` → `frontend`; `/` or nothing → ''. */
export function normalizeBaseDir(base: string | null | undefined): string {
  return (base ?? '').replace(/^\.?\/+|\/+$/g, '');
}

export function buildImageFor(nodeVersion?: string | null): string {
  return `node:${/^\d+$/.test(nodeVersion ?? '') ? nodeVersion : '20'}-slim`;
}

/**
 * What to do with the archive: build it when it holds the project
 * (`package.json` with a `build` script, or a build command set), serve it as
 * is when it holds a site already built (no package.json — what iCode sends
 * when it built in the browser). Null: neither (the caller reports it).
 */
export function siteBuildFor(app: ApplicationRow, archive: Buffer, buildEnv: string[] = []): SiteBuild | 'prebuilt' | null {
  const baseDir = normalizeBaseDir(app.base_directory);
  const files = readTarGz(archive);
  const at = (path: string) => (baseDir ? `${baseDir}/${path}` : path);
  const manifest = files[at('package.json')];
  if (!manifest) {
    const publish = (app.publish_directory ?? 'dist').replace(/^\.?\/+|\/+$/g, '') || 'dist';
    return files[at(`${publish}/index.html`)] || files[at('index.html')] || files[`${publish}/index.html`] || files['index.html'] ? 'prebuilt' : null;
  }
  let hasBuildScript = false;
  try {
    hasBuildScript = typeof JSON.parse(manifest.toString('utf8'))?.scripts?.build === 'string';
  } catch {
    /* an unreadable package.json: the build command, if any, says what to run */
  }
  const build = app.build_command?.trim() || (hasBuildScript ? 'npm run build' : '');
  if (!build) return null;
  return {
    baseDir,
    install: app.install_command?.trim() || 'npm install --no-audit --no-fund --prefer-offline --loglevel=error',
    build,
    env: buildEnv,
    nodeImage: buildImageFor(null),
  };
}

/** Pull the build image if the server does not have it. Quiet; never throws. */
export async function ensureBuildImage(server: ServerRow, key: PrivateKeyRow, image = buildImageFor(null)): Promise<void> {
  await executeRemoteCommand(server, key, `docker image inspect ${q(image)} >/dev/null 2>&1 || docker pull -q ${q(image)} >/dev/null 2>&1; true`, {
    noRetry: true,
  }).catch(() => undefined);
}

/** The shell run INSIDE the container: dependencies when they changed, then the build. */
export function containerScript(build: Pick<SiteBuild, 'install' | 'build'>, installOnly = false): string {
  return [
    'set -e',
    'S=$(cat package.json package-lock.json npm-shrinkwrap.json .npmrc 2>/dev/null | sha256sum | cut -c1-64)',
    'if [ -d node_modules ] && [ "$(cat node_modules/.ideploy-deps 2>/dev/null)" = "$S" ]; then',
    '  echo "Dependencies unchanged: kept from the previous build."',
    'else',
    '  echo "Installing dependencies…"',
    `  ${build.install}`,
    '  mkdir -p node_modules && echo "$S" > node_modules/.ideploy-deps',
    'fi',
    ...(installOnly ? [] : ['echo "Building the site…"', build.build]),
  ].join('\n');
}

/** The `docker run` of a build: isolated, bounded, the build folder only. */
export function dockerRunCommand(opts: { name: string; buildRoot: string; workDir: string; image: string; env: string[]; script: string }): string {
  const env = [
    'HOME=/work/.home',
    'npm_config_cache=/work/.npm',
    'npm_config_update_notifier=false',
    'CI=1',
    ...opts.env,
  ]
    .map((pair) => `-e ${q(pair)}`)
    .join(' ');
  return [
    `timeout ${BUILD_TIMEOUT_SECONDS} docker run --rm --name ${q(opts.name)}`,
    '--user 1000:1000 --cap-drop ALL --security-opt no-new-privileges',
    '--cpus 2 --memory 1536m --memory-swap 1536m --pids-limit 1024',
    env,
    `-v ${q(`${opts.buildRoot}:/work`)} -w ${q(opts.workDir)}`,
    q(opts.image),
    `sh -c ${q(opts.script)}`,
  ].join(' ');
}

/** Hold one of the server's build places for as long as `work` runs; waits a second at a time for one. */
async function withBuildPlace<T>(serverId: number, member: string, log: (line: string) => Promise<void>, work: () => Promise<T>): Promise<T> {
  const slot = `ideploy:slots:site-build:${serverId}`;
  let announced = false;
  while (!(await tryAcquire(slot, member, BUILDS_PER_SERVER))) {
    if (!announced) await log('Waiting for a build place on the server…');
    announced = true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const renew = setInterval(() => void tryAcquire(slot, member, BUILDS_PER_SERVER).catch(() => undefined), 20_000);
  renew.unref?.();
  try {
    return await work();
  } finally {
    clearInterval(renew);
    await release(slot, member).catch(() => undefined);
  }
}

/** Send `archive` to the server as `<remotePath>`. */
async function uploadArchive(server: ServerRow, key: PrivateKeyRow, archive: Buffer, remotePath: string, tag: string): Promise<void> {
  const local = join(tmpdir(), `ideploy-build-${tag}.tgz`);
  await writeFile(local, archive);
  try {
    await uploadRemoteFile(server, key, local, remotePath);
  } finally {
    await rm(local, { force: true });
  }
}

/** The host side: new sources in place, the previous dependencies moved under them, ownership for the build user. */
function placeSourcesScript(buildRoot: string, incoming: string, baseDir: string): string {
  const keep = ['node_modules', ...(baseDir ? [`${baseDir}/node_modules`] : [])];
  return [
    'set -e',
    `cd ${q(buildRoot)}`,
    'rm -rf next && mkdir -p next .npm .home',
    `tar xzf ${q(incoming)} -C next && rm -f ${q(incoming)}`,
    `for d in ${keep.map(q).join(' ')}; do if [ -d "src/$d" ]; then mkdir -p "next/$(dirname "$d")"; mv "src/$d" "next/$d"; fi; done`,
    'rm -rf src && mv next src',
    // Only what is new changes owner: the dependencies kept are already the build user's.
    'find . ! -user 1000 -exec chown 1000:1000 {} + 2>/dev/null || true',
  ].join('\n');
}

export interface BuildContext {
  deploymentUuid: string;
  app: ApplicationRow;
  server: ServerRow;
  key: PrivateKeyRow;
  workdir: string;
  archive: Buffer;
  build: SiteBuild;
  /** Where the built site must end up (`<release>/html`), absolute. */
  outputDir: string;
  publish: string;
  log: (line: string) => Promise<void>;
}

/**
 * Build the site and copy its output to `outputDir`. Throws with the build's
 * own words on failure; with BUILD_UNAVAILABLE_MARKER in the message when the
 * build environment (Docker, the image) is what failed.
 */
export async function buildSite(ctx: BuildContext): Promise<void> {
  const { server, key, build, log } = ctx;
  const buildRoot = `${ctx.workdir}/build`;
  const id = ctx.deploymentUuid.slice(0, 8);
  const incoming = `${buildRoot}/incoming-${id}.tgz`;
  const project = build.baseDir ? `src/${build.baseDir}` : 'src';

  const prepared = await executeRemoteCommand(server, key, `mkdir -p ${q(buildRoot)}`, { noRetry: true });
  if (prepared.exitCode !== 0) throw new Error(`Failed to prepare the build directory: ${prepared.stderr.slice(0, 300)}`);
  // The upload and the image check run together: neither needs the other.
  await Promise.all([uploadArchive(server, key, ctx.archive, incoming, ctx.deploymentUuid), ensureBuildImage(server, key, build.nodeImage)]);

  const placed = await executeRemoteCommand(server, key, placeSourcesScript(buildRoot, incoming, build.baseDir), { noRetry: true });
  if (placed.exitCode !== 0) throw new Error(`Unpacking the sources failed: ${(placed.stderr || placed.stdout).slice(0, 300)}`);

  await withBuildPlace(server.id, ctx.deploymentUuid, log, async () => {
    const name = `ideploy-build-${id}`;
    const run = dockerRunCommand({
      name,
      buildRoot,
      workDir: `/work/${project}`,
      image: build.nodeImage,
      env: build.env,
      script: containerScript(build),
    });
    const script = [
      `docker image inspect ${q(build.nodeImage)} >/dev/null 2>&1 || { echo ${BUILD_UNAVAILABLE_MARKER}: build image missing >&2; exit 90; }`,
      `${run}; CODE=$?`,
      `if [ $CODE -eq 124 ]; then docker rm -f ${q(name)} >/dev/null 2>&1; echo "The build ran for more than ${BUILD_TIMEOUT_SECONDS / 60} minutes and was stopped." >&2; fi`,
      // 125–127: Docker could not start the container at all (not the site's fault).
      `if [ $CODE -ge 125 ] && [ $CODE -le 127 ]; then echo ${BUILD_UNAVAILABLE_MARKER}: docker run failed >&2; fi`,
      'exit $CODE',
    ].join('\n');
    const r = await executeRemoteCommand(server, key, `cd ${q(buildRoot)} && { ${script}\n}`, { noRetry: true, onData: (chunk) => log(chunk) });
    if (r.exitCode !== 0) {
      const output = `${r.stdout}\n${r.stderr}`.trim();
      const unavailable = output.includes(BUILD_UNAVAILABLE_MARKER);
      throw new Error(`${unavailable ? `${BUILD_UNAVAILABLE_MARKER} ` : ''}The site did not build.\n${output.slice(-3000)}`);
    }
  });

  const copy = [
    'set -e',
    `cd ${q(`${buildRoot}/${project}`)}`,
    `if [ ! -f ${q(`${ctx.publish}/index.html`)} ]; then echo "NO_INDEX" >&2; exit 3; fi`,
    `rm -rf ${q(ctx.outputDir)} && mkdir -p ${q(ctx.outputDir.slice(0, ctx.outputDir.lastIndexOf('/')))}`,
    `cp -a ${q(ctx.publish)} ${q(ctx.outputDir)}`,
    `chmod -R a+rX ${q(ctx.outputDir)}`,
    `if [ -f .idem/build-report.json ]; then echo "${BUILD_REPORT_MARKER} $(base64 -w0 .idem/build-report.json)"; fi`,
  ].join('\n');
  const r = await executeRemoteCommand(server, key, copy, { noRetry: true });
  if (r.exitCode === 3 || /NO_INDEX/.test(r.stderr)) {
    throw new Error(`The build wrote no ${ctx.publish}/index.html. Check the build script and the publish directory.`);
  }
  if (r.exitCode !== 0) throw new Error(`Collecting the built site failed: ${(r.stderr || r.stdout).slice(0, 300)}`);
  const report = r.stdout.split('\n').find((line) => line.startsWith(BUILD_REPORT_MARKER));
  if (report) await log(report);
}

/**
 * Install the dependencies of a site that is not published yet, from its
 * manifests alone (package.json, lockfile, .npmrc): what iCode sends when its
 * publish window opens. The first build then only builds. Never throws.
 */
export async function prepareDependencies(opts: {
  server: ServerRow;
  key: PrivateKeyRow;
  workdir: string;
  baseDir: string;
  files: Record<string, string>;
  tag: string;
}): Promise<boolean> {
  const { server, key } = opts;
  const allowed = new Set(['package.json', 'package-lock.json', 'npm-shrinkwrap.json', '.npmrc']);
  const manifests = Object.fromEntries(
    Object.entries(opts.files)
      .filter(([path, content]) => typeof content === 'string' && allowed.has(path))
      .map(([path, content]) => [opts.baseDir ? `${opts.baseDir}/${path}` : path, content])
  );
  if (!Object.keys(manifests).some((p) => p.endsWith('package.json'))) return false;
  const buildRoot = `${opts.workdir}/build`;
  const incoming = `${buildRoot}/incoming-prepare-${opts.tag}.tgz`;
  const project = opts.baseDir ? `src/${opts.baseDir}` : 'src';
  try {
    await executeRemoteCommand(server, key, `mkdir -p ${q(buildRoot)}`, { noRetry: true });
    await Promise.all([uploadArchive(server, key, createTarGz(manifests), incoming, `prepare-${opts.tag}`), ensureBuildImage(server, key)]);
    // Only the manifests are laid over: a first deployment that started meanwhile is not disturbed (the caller holds the lock).
    const placed = await executeRemoteCommand(
      server,
      key,
      [
        'set -e',
        `cd ${q(buildRoot)}`,
        `mkdir -p .npm .home ${q(project)}`,
        `tar xzf ${q(incoming)} -C src && rm -f ${q(incoming)}`,
        'find . ! -user 1000 -exec chown 1000:1000 {} + 2>/dev/null || true',
      ].join('\n'),
      { noRetry: true }
    );
    if (placed.exitCode !== 0) return false;
    const run = dockerRunCommand({
      name: `ideploy-prepare-${opts.tag}`,
      buildRoot,
      workDir: `/work/${project}`,
      image: buildImageFor(null),
      env: [],
      script: containerScript({ install: 'npm install --no-audit --no-fund --prefer-offline --loglevel=error', build: '' }, true),
    });
    const r = await executeRemoteCommand(server, key, `cd ${q(buildRoot)} && ${run}`, { noRetry: true });
    return r.exitCode === 0;
  } catch {
    return false;
  }
}
