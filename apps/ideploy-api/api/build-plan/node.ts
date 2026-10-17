/**
 * JavaScript applications: which framework, served how, built with what —
 * and, in a monorepo, built from the workspace root so the shared packages
 * are there (what Vercel does with a Root Directory).
 */
import { BuildPlanResult, AppCandidate, NodeRecipe, PlanIssue } from './types';
import { RepoFiles, dirOf, joinPath, relativeTo } from './repo-files';

export interface PackageJson {
  name?: string;
  main?: string;
  module?: string;
  exports?: unknown;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string };
  volta?: { node?: string };
  workspaces?: string[] | { packages?: string[] };
  packageManager?: string;
}

export async function readPackage(files: RepoFiles, dir: string): Promise<PackageJson | null> {
  const text = await files.read(joinPath(dir, 'package.json'));
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as PackageJson) : null;
  } catch {
    return null;
  }
}

// ── Node version ───────────────────────────────────────────────────────────

/** The majors nixpacks installs. */
export const NODE_MAJORS = [16, 18, 20, 22];
const LATEST_NODE = NODE_MAJORS[NODE_MAJORS.length - 1];

/** The major a version spec asks for: `20`, `v18.17.0`, `^20.11`, `>=18`, `^18 || ^20`, `lts/*`. */
export function nodeMajorFromSpec(spec: string): number | null {
  const s = spec.trim().toLowerCase();
  if (!s) return null;
  if (/^(lts(\/\*)?|lts\/[a-z]+|node|latest|stable|current)$/.test(s)) return LATEST_NODE;
  if (s.includes('||')) {
    const majors = s.split('||').map(nodeMajorFromSpec).filter((m): m is number => m !== null);
    return majors.length ? Math.max(...majors) : null;
  }
  // A lower bound alone (`>=18`): any recent version works — take the latest.
  if (/^>=?\s*v?\d+/.test(s) && !/</.test(s)) return LATEST_NODE;
  const m = /(\d+)/.exec(s);
  return m ? Number(m[1]) : null;
}

/** The supported major to install for the one asked for. */
export function supportedNodeMajor(major: number): number {
  if (major >= LATEST_NODE) return LATEST_NODE;
  return NODE_MAJORS.find((m) => m >= major) ?? LATEST_NODE;
}

async function detectNodeVersion(
  files: RepoFiles,
  dirs: string[],
  packages: (PackageJson | null)[]
): Promise<{ version: string; source: string; requested: number } | null> {
  for (const dir of dirs) {
    for (const name of ['.nvmrc', '.node-version']) {
      const text = await files.read(joinPath(dir, name));
      const major = text ? nodeMajorFromSpec(text.split('\n')[0]) : null;
      if (major) return { version: String(supportedNodeMajor(major)), source: joinPath(dir, name), requested: major };
    }
    const tools = await files.read(joinPath(dir, '.tool-versions'));
    const toolMajor = tools ? nodeMajorFromSpec(/^nodejs\s+(\S+)/m.exec(tools)?.[1] ?? '') : null;
    if (toolMajor) return { version: String(supportedNodeMajor(toolMajor)), source: joinPath(dir, '.tool-versions'), requested: toolMajor };
  }
  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    const spec = pkg?.volta?.node ?? pkg?.engines?.node;
    const major = spec ? nodeMajorFromSpec(spec) : null;
    if (major) {
      const source = `${joinPath(dirs[i], 'package.json')} (${pkg?.volta?.node ? 'volta' : 'engines'})`;
      return { version: String(supportedNodeMajor(major)), source, requested: major };
    }
  }
  return null;
}

// ── Package manager ────────────────────────────────────────────────────────

export type NodeManager = 'pnpm' | 'yarn' | 'npm' | 'bun';

function detectManager(files: RepoFiles, root: string, pkg: PackageJson | null): { manager: NodeManager; lockfiles: string[] } {
  const has = (name: string) => files.paths.includes(joinPath(root, name));
  const lockfiles = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb', 'bun.lock'].filter(has);
  const declared = /^(pnpm|yarn|npm|bun)@/.exec(pkg?.packageManager ?? '')?.[1] as NodeManager | undefined;
  if (declared) return { manager: declared, lockfiles };
  if (has('pnpm-lock.yaml')) return { manager: 'pnpm', lockfiles };
  if (has('yarn.lock')) return { manager: 'yarn', lockfiles };
  if (has('bun.lockb') || has('bun.lock')) return { manager: 'bun', lockfiles };
  return { manager: 'npm', lockfiles };
}

export function runScript(manager: NodeManager, script: string): string {
  return `${manager} run ${script}`;
}

/**
 * The corepack bundled with older Node fails to verify recent pnpm releases
 * ("Cannot find matching keyid"), and Node 25 ships none: the latest one,
 * over the bundled one (--force), as pnpm's documentation advises.
 */
export const FRESH_COREPACK = 'npm install -g --force corepack@latest && corepack enable';

/** The install a container with only Node needs (the static build; nixpacks installs on its own). */
export function installCommand(manager: NodeManager, lockfiles: string[], pnpmMajor: number | null): string {
  switch (manager) {
    case 'pnpm':
      return `${FRESH_COREPACK} && ${pnpmMajor ? `corepack prepare pnpm@${pnpmMajor} --activate && ` : ''}pnpm install${lockfiles.includes('pnpm-lock.yaml') ? ' --frozen-lockfile' : ''}`;
    case 'yarn':
      return `${FRESH_COREPACK} && yarn install`;
    case 'bun':
      return 'npm install -g bun && bun install';
    default:
      return lockfiles.includes('package-lock.json') ? 'npm ci' : 'npm install';
  }
}

/** Node of a recipe when the code does not say: the active LTS. */
const RECIPE_NODE_DEFAULT = 22;

/** The install inside iDeploy's own image (corepack already set up). */
function recipeInstall(manager: 'pnpm' | 'yarn' | 'npm', lockfiles: string[]): string {
  // Frozen only with a lockfile to hold to (without one, pnpm refuses to install at all).
  if (manager === 'pnpm') return lockfiles.includes('pnpm-lock.yaml') ? 'pnpm install --frozen-lockfile' : 'pnpm install';
  if (manager === 'yarn') return 'yarn install';
  return lockfiles.includes('package-lock.json') ? 'npm ci' : 'npm install';
}

/** pnpm for the lockfile's format when `packageManager` does not say: `9.0` → 9, `6.0` → 8, `5.4` → 7. */
export function pnpmMajorForLockfile(header: string | null): number | null {
  const v = /lockfileVersion:\s*['"]?(\d+)/.exec(header ?? '')?.[1];
  if (!v) return null;
  const n = Number(v);
  if (n >= 9) return 9;
  if (n === 6) return 8;
  if (n === 5) return 7;
  return null;
}

// ── Workspaces ─────────────────────────────────────────────────────────────

function globToRegExp(glob: string): RegExp {
  const g = glob.replace(/^\.\//, '').replace(/\/+$/, '');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    if (g[i] === '*' && g[i + 1] === '*') {
      re += '.*';
      i++;
      if (g[i + 1] === '/') i++;
    } else if (g[i] === '*') re += '[^/]*';
    else re += g[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** The `packages:` list of a pnpm-workspace.yaml. */
export function parsePnpmWorkspace(yaml: string): string[] {
  const globs: string[] = [];
  let inPackages = false;
  for (const line of yaml.split('\n')) {
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^\S/.test(line)) break;
    const m = inPackages ? /^\s*-\s*['"]?([^'"#]+?)['"]?\s*(#.*)?$/.exec(line) : null;
    if (m) globs.push(m[1].trim());
  }
  return globs;
}

async function workspaceGlobs(files: RepoFiles, dir: string, pkg: PackageJson | null): Promise<string[] | null> {
  const pnpm = await files.read(joinPath(dir, 'pnpm-workspace.yaml'));
  if (pnpm !== null) return parsePnpmWorkspace(pnpm);
  const ws = pkg?.workspaces;
  if (Array.isArray(ws)) return ws;
  if (ws && Array.isArray(ws.packages)) return ws.packages;
  return null;
}

function matchesGlobs(globs: string[], rel: string): boolean {
  const positive = globs.filter((g) => !g.startsWith('!'));
  const negative = globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1));
  return positive.some((g) => globToRegExp(g).test(rel)) && !negative.some((g) => globToRegExp(g).test(rel));
}

/** Every package folder of the workspace rooted at `root`. */
function workspacePackageDirs(files: RepoFiles, root: string, globs: string[]): string[] {
  return files.paths
    .filter((p) => p.endsWith('/package.json') || p === 'package.json')
    .map(dirOf)
    .filter((d) => d !== root && (root === '' || d.startsWith(`${root}/`)))
    .filter((d) => matchesGlobs(globs, relativeTo(root, d)))
    .sort();
}

/** The ancestors of `dir`, root first: `apps/web` → ['', 'apps', 'apps/web']. */
function ancestors(dir: string): string[] {
  const parts = dir ? dir.split('/') : [];
  return ['', ...parts.map((_, i) => parts.slice(0, i + 1).join('/'))];
}

// ── Frameworks ─────────────────────────────────────────────────────────────

interface Framework {
  label: string;
  output: 'server' | 'static';
  /** Static: the build output, relative to the application folder. */
  publish?: string;
  /** Server: how to start it when it has no start script. Run in the application folder. */
  defaultStart?: string;
  /** Builds that need memory (bundlers, compilers). */
  heavy?: boolean;
  /** Next.js: where the build goes (`.next` unless next.config sets `distDir`). */
  distDir?: string;
  issue?: PlanIssue;
}

/** Scripts that start a development server, not a production one. */
const DEV_COMMAND = /^\s*(vite(\s+dev)?(\s|$)|vite\s+preview|next\s+dev|nuxi?\s+dev|react-scripts\s+start|ng\s+serve|vue-cli-service\s+serve|gatsby\s+develop|astro\s+dev|remix\s+dev|nodemon|ts-node-dev|tsx\s+watch|nest\s+start\s+--watch)|--watch\b/;

async function firstFile(files: RepoFiles, dir: string, names: string[]): Promise<string | null> {
  for (const name of names) {
    const text = await files.read(joinPath(dir, name));
    if (text !== null) return text;
  }
  return null;
}

/** Angular: the output of the project to build, and whether it renders on the server. */
async function angularFramework(files: RepoFiles, dir: string): Promise<Framework> {
  const fallback: Framework = { label: 'Angular', output: 'static', publish: 'dist', heavy: true };
  const text = await files.read(joinPath(dir, 'angular.json'));
  if (!text) return fallback;
  try {
    const config = JSON.parse(text) as { defaultProject?: string; projects?: Record<string, AngularProject> };
    const projects = Object.entries(config.projects ?? {});
    const entry =
      projects.find(([name]) => name === config.defaultProject) ?? projects.find(([, p]) => p.projectType === 'application') ?? projects[0];
    if (!entry) return fallback;
    const [name, project] = entry;
    const build = project.architect?.build ?? project.targets?.build;
    const builder = build?.builder ?? '';
    const options = build?.options ?? {};
    const out = options.outputPath;
    const base = typeof out === 'string' ? out : out?.base ?? `dist/${name}`;
    // The application builder (Angular 17+) writes the browser files to a sub-folder.
    const modern = /:application$/.test(builder);
    const browser = modern ? joinPath(base, typeof out === 'object' && out?.browser !== undefined ? out.browser : 'browser') : base;
    if (modern && options.ssr) {
      return { label: 'Angular (SSR)', output: 'server', defaultStart: `node ${joinPath(base, 'server/server.mjs')}`, heavy: true };
    }
    return { label: 'Angular', output: 'static', publish: browser, heavy: true };
  } catch {
    return fallback;
  }
}

interface AngularProject {
  projectType?: string;
  architect?: { build?: AngularTarget };
  targets?: { build?: AngularTarget };
}
interface AngularTarget {
  builder?: string;
  options?: { outputPath?: string | { base?: string; browser?: string }; ssr?: unknown };
}

const outDir = (config: string | null, fallback: string) => /outDir\s*:\s*['"`]([^'"`]+)['"`]/.exec(config ?? '')?.[1] ?? fallback;

/**
 * A framework's command in a script: the other signal when the dependency
 * is not declared in the application's own package.json (hoisted to the
 * workspace root, or pulled in through another package).
 */
const SCRIPT_SIGNALS: Record<string, RegExp> = {
  next: /(^|[\s;&|(])next\s+(build|start|dev)\b/,
  nuxt: /(^|[\s;&|(])nuxi?\s+(build|generate|dev|start)\b/,
  '@react-router/dev': /(^|[\s;&|(])react-router(-serve)?\s+(build|dev|\.)/,
  '@remix-run/dev': /(^|[\s;&|(])remix(-serve)?\s+(vite:)?(build|dev|\.)/,
  astro: /(^|[\s;&|(])astro\s+(build|dev|preview)\b/,
  '@angular/core': /(^|[\s;&|(])ng\s+(build|serve)\b/,
  gatsby: /(^|[\s;&|(])gatsby\s+(build|develop)\b/,
  'react-scripts': /(^|[\s;&|(])react-scripts\s+(build|start)\b/,
  '@vue/cli-service': /(^|[\s;&|(])vue-cli-service\s+(build|serve)\b/,
  '@nestjs/core': /(^|[\s;&|(])nest\s+(build|start)\b/,
  vite: /(^|[\s;&|(])vite(\s+(build|dev|preview)|\s*$)/m,
};

/**
 * The framework, from the application's own signals: its dependencies, its
 * scripts, its configuration files. Never the workspace root's dependencies:
 * a root declaring `next` for one application would make every other one a
 * Next.js application.
 */
export async function detectFramework(files: RepoFiles, dir: string, pkg: PackageJson): Promise<Framework> {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const scripts = Object.values(pkg.scripts ?? {}).join('\n');
  const has = (name: string) => name in deps || Boolean(SCRIPT_SIGNALS[name]?.test(scripts));
  const hasFile = (name: string) => files.paths.includes(joinPath(dir, name));

  if (has('next')) {
    const config = await firstFile(files, dir, ['next.config.js', 'next.config.mjs', 'next.config.ts']);
    if (/output\s*:\s*['"]export['"]/.test(config ?? '')) return { label: 'Next.js (static export)', output: 'static', publish: 'out', heavy: true };
    // `distDir` moves .next (and its BUILD_ID) elsewhere.
    const distDir = /distDir\s*:\s*['"`]([^'"`]+)['"`]/.exec(config ?? '')?.[1]?.replace(/^\.\//, '') ?? '.next';
    return { label: 'Next.js', output: 'server', defaultStart: 'npx next start', heavy: true, distDir };
  }
  if (has('nuxt')) {
    if (/nuxi?\s+generate/.test(pkg.scripts?.build ?? '')) {
      return { label: 'Nuxt (static)', output: 'static', publish: '.output/public', heavy: true };
    }
    return { label: 'Nuxt', output: 'server', defaultStart: 'node .output/server/index.mjs', heavy: true };
  }
  if (has('@react-router/dev')) {
    const config = await firstFile(files, dir, ['react-router.config.ts', 'react-router.config.js']);
    if (/ssr\s*:\s*false/.test(config ?? '')) return { label: 'React Router (SPA)', output: 'static', publish: 'build/client', heavy: true };
    return { label: 'React Router', output: 'server', defaultStart: 'npx react-router-serve ./build/server/index.js', heavy: true };
  }
  if (has('@remix-run/dev')) {
    const entry = has('vite') ? './build/server/index.js' : './build/index.js';
    return { label: 'Remix', output: 'server', defaultStart: `npx remix-serve ${entry}`, heavy: true };
  }
  if (has('@sveltejs/kit')) {
    const config = await firstFile(files, dir, ['svelte.config.js', 'svelte.config.ts']);
    if (/adapter-static/.test(config ?? '') || has('@sveltejs/adapter-static')) return { label: 'SvelteKit (static)', output: 'static', publish: 'build', heavy: true };
    if (/adapter-node/.test(config ?? '') || has('@sveltejs/adapter-node')) return { label: 'SvelteKit', output: 'server', defaultStart: 'node build', heavy: true };
    return {
      label: 'SvelteKit',
      output: 'server',
      heavy: true,
      issue: {
        code: 'SVELTEKIT_ADAPTER',
        severity: 'blocking',
        message:
          'This SvelteKit app uses an adapter for another host (adapter-auto picks Vercel or Netlify): it builds nothing that runs on a server. ' +
          'Install @sveltejs/adapter-node (a server) or @sveltejs/adapter-static (a static site) and set it in svelte.config.js.',
      },
    };
  }
  if (has('astro')) {
    const config = await firstFile(files, dir, ['astro.config.mjs', 'astro.config.ts']);
    if (/output\s*:\s*['"](server|hybrid)['"]/.test(config ?? '')) {
      if (!has('@astrojs/node')) {
        return {
          label: 'Astro (server)',
          output: 'server',
          heavy: true,
          issue: {
            code: 'ASTRO_ADAPTER',
            severity: 'blocking',
            message: 'This Astro site renders on the server but has no Node adapter. Run `npx astro add node`, or remove `output: "server"` to build a static site.',
          },
        };
      }
      return { label: 'Astro (server)', output: 'server', defaultStart: 'node ./dist/server/entry.mjs', heavy: true };
    }
    return { label: 'Astro', output: 'static', publish: outDir(config, 'dist'), heavy: true };
  }
  if (has('@angular/core') && hasFile('angular.json')) return angularFramework(files, dir);
  if (has('gatsby')) return { label: 'Gatsby', output: 'static', publish: 'public', heavy: true };
  if (has('react-scripts')) return { label: 'Create React App', output: 'static', publish: 'build', heavy: true };
  if (has('@vue/cli-service')) {
    const config = await files.read(joinPath(dir, 'vue.config.js'));
    return { label: 'Vue CLI', output: 'static', publish: /outputDir\s*:\s*['"`]([^'"`]+)/.exec(config ?? '')?.[1] ?? 'dist', heavy: true };
  }
  if (has('@nestjs/core')) return { label: 'NestJS', output: 'server', defaultStart: 'node dist/main' };
  // A Vite project with its own index.html is a site; without one, a library or a custom server.
  if (has('vite') && hasFile('index.html')) {
    const config = await firstFile(files, dir, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']);
    return { label: 'Vite', output: 'static', publish: outDir(config, 'dist'), heavy: true };
  }

  const label = has('express') ? 'Express' : has('fastify') ? 'Fastify' : has('koa') ? 'Koa' : has('hono') ? 'Hono' : 'Node.js';
  const mainCandidates = [pkg.main, 'index.js', 'server.js', 'app.js', 'main.js', 'src/index.js', 'src/server.js'].filter(
    (f): f is string => Boolean(f)
  );
  const main = mainCandidates.find((f) => hasFile(f.replace(/^\.\//, '')));
  return { label, output: 'server', defaultStart: main ? `node ${main.replace(/^\.\//, '')}` : undefined };
}

/** Flags of `node` (and the serve commands) that take the next word as their value. */
const FLAGS_WITH_VALUE = new Set(['-r', '--require', '--import', '--loader', '--experimental-loader', '--env-file', '-p', '--port', '--title']);

/** The file a start command runs: `node -r dotenv/config dist/index.js` → `dist/index.js`. */
export function startEntry(command: string): string | null {
  for (const segment of command.split(/&&|\|\||;/)) {
    const words = segment.trim().split(/\s+/).filter((w) => !/^\w+=/.test(w)); // FOO=bar node …
    const at = words.findIndex((w) => /^(node|remix-serve|react-router-serve)$/.test(w.split('/').pop() ?? ''));
    if (at === -1) continue;
    for (let i = at + 1; i < words.length; i++) {
      const w = words[i];
      if (w.startsWith('-')) {
        if (FLAGS_WITH_VALUE.has(w)) i++;
        continue;
      }
      return w.replace(/^\.\//, '');
    }
  }
  return null;
}

/**
 * What the build must leave behind for the start command to run — checked in
 * the image, so a build that "succeeds" without building (an orchestrator
 * that ran no task, a script building another folder) is caught there, with
 * what went wrong, instead of shipping an image that crashes at start.
 *
 * `next start` needs `.next/BUILD_ID` — certain, so a missing one fails the
 * build (`strict`). `node dist/main` needs `dist/main(.js)` — read from a
 * command, so a missing one is a warning; the trial run before the switch
 * still keeps a broken image from replacing the live one.
 */
export function buildOutputContract(
  framework: string,
  startCommand: string,
  appRel: string,
  appBuild: string | null,
  nextDistDir = '.next'
): NodeRecipe['output'] {
  if (framework.startsWith('Next') || /(^|[\s;&|(])next\s+start\b/.test(startCommand)) {
    return { path: joinPath(appRel, nextDistDir, 'BUILD_ID'), alternatives: [], build: appBuild, strict: true };
  }
  const entry = startEntry(startCommand);
  if (!entry || entry.includes('$')) return null;
  const path = joinPath(appRel, entry);
  // `node dist/main` runs dist/main.js; `node build` runs build/index.js.
  const alternatives = /\.[cm]?[jt]s$/.test(entry) ? [] : [`${path}.js`, `${path}/index.js`];
  return { path, alternatives, build: appBuild, strict: false };
}

/** The production start script, ignoring development servers. */
export function startScript(pkg: PackageJson): string | null {
  const scripts = pkg.scripts ?? {};
  return ['start:prod', 'start:production', 'start'].find((s) => scripts[s] && !DEV_COMMAND.test(scripts[s])) ?? null;
}

/** A workspace package worth deploying on its own. */
async function candidate(files: RepoFiles, dir: string, pkg: PackageJson): Promise<AppCandidate | null> {
  const framework = await detectFramework(files, dir, pkg);
  const script = startScript(pkg);
  const generic = ['Node.js', 'Express', 'Fastify', 'Koa', 'Hono'].includes(framework.label);
  // A plain Node package with neither a start script nor a server framework is a library.
  if (generic && !script && !(framework.label !== 'Node.js' && framework.defaultStart)) return null;
  const output = framework.output === 'static' && script && !framework.label.startsWith('Next') ? 'server' : framework.output;
  return { dir, name: pkg.name ?? dir, framework: framework.label, output };
}

// ── The plan ───────────────────────────────────────────────────────────────

export interface NodePlanOptions {
  /** The user's own commands: they win, and a monorepo root with a start command needs no app picked. */
  overrides?: { install?: string | null; build?: string | null; start?: string | null };
}

export async function planNode(files: RepoFiles, appDir: string, options: NodePlanOptions = {}): Promise<BuildPlanResult | null> {
  const appPkg = await readPackage(files, appDir);
  if (!appPkg) return null;
  const issues: PlanIssue[] = [];

  // The workspace this folder belongs to: the highest ancestor whose
  // workspaces include it (or the folder itself, when it is the root of one).
  let workspaceRoot: string | null = null;
  let rootPkg: PackageJson | null = null;
  let globs: string[] = [];
  for (const dir of ancestors(appDir)) {
    const pkg = dir === appDir ? appPkg : await readPackage(files, dir);
    const g = await workspaceGlobs(files, dir, pkg);
    if (g && g.length && (dir === appDir || matchesGlobs(g, relativeTo(dir, appDir)))) {
      workspaceRoot = dir;
      rootPkg = pkg;
      globs = g;
      break;
    }
  }

  // The root of a monorepo: which application?
  if (workspaceRoot === appDir) {
    const userStart = options.overrides?.start;
    const dirs = workspacePackageDirs(files, appDir, globs);
    const apps: AppCandidate[] = [];
    for (const dir of dirs) {
      const pkg = await readPackage(files, dir);
      const app = pkg ? await candidate(files, dir, pkg) : null;
      if (app) apps.push(app);
    }
    // apps/* first: that is where monorepos keep what they deploy.
    apps.sort((a, b) => Number(!/^apps?\//.test(a.dir)) - Number(!/^apps?\//.test(b.dir)) || a.dir.localeCompare(b.dir));
    if (!userStart && !startScript(appPkg)) {
      if (apps.length === 1) {
        const plan = await planNode(files, apps[0].dir, options);
        if (plan) {
          plan.issues.unshift({ code: 'MONOREPO_SINGLE_APP', severity: 'info', message: `Monorepo: deploying ${apps[0].name} (${apps[0].dir}), its only application.` });
          return plan;
        }
      }
      const plan = await planWorkspaceApp(files, appDir, appDir, appPkg, appPkg, issues, options);
      plan.apps = apps;
      plan.framework = `Monorepo (${plan.tool}${plan.workspace?.orchestrator ? ` + ${plan.workspace.orchestrator}` : ''})`;
      plan.output = null;
      // The root itself starts nothing: the issue is which application, said below.
      plan.issues = plan.issues.filter((i) => i.code !== 'NO_START_COMMAND');
      plan.issues.push(
        apps.length > 1
          ? {
              code: 'MONOREPO_PICK_APP',
              severity: 'blocking',
              message:
                `This repository is a monorepo with ${apps.length} applications: ${apps.map((a) => `${a.dir} (${a.framework})`).join(', ')}. ` +
                'Set the Root directory to the one to deploy (Settings › Build options) — one iDeploy application per service. ' +
                'iDeploy installs from the repository root, so the shared packages are built too.',
            }
          : {
              code: 'MONOREPO_NO_APP',
              severity: 'blocking',
              message:
                'This repository is a monorepo, but no application was found in it (no package with a start script or a known framework). ' +
                'Set the Root directory to the application folder, or set a start command.',
            }
      );
      return plan;
    }
    const plan = await planWorkspaceApp(files, appDir, appDir, appPkg, appPkg, issues, options);
    plan.apps = apps;
    return plan;
  }

  return planWorkspaceApp(files, workspaceRoot ?? appDir, appDir, rootPkg ?? appPkg, appPkg, issues, options);
}

async function planWorkspaceApp(
  files: RepoFiles,
  buildRoot: string,
  appDir: string,
  rootPkg: PackageJson,
  appPkg: PackageJson,
  issues: PlanIssue[],
  options: NodePlanOptions
): Promise<BuildPlanResult> {
  const inWorkspace = buildRoot !== appDir;
  const appRel = relativeTo(buildRoot, appDir);
  const { manager, lockfiles } = detectManager(files, buildRoot, rootPkg);
  const framework = await detectFramework(files, appDir, appPkg);
  if (framework.issue) issues.push(framework.issue);

  const orchestrator =
    files.paths.includes(joinPath(buildRoot, 'turbo.json')) ? 'turbo' : files.paths.includes(joinPath(buildRoot, 'nx.json')) ? 'nx' : null;

  if (lockfiles.length > 1) {
    issues.push({
      code: 'MULTIPLE_LOCKFILES',
      severity: 'warning',
      message: `Several lockfiles (${lockfiles.join(', ')}): ${manager} is used. Delete the others so the install is the one you test locally.`,
    });
  } else if (lockfiles.length === 0) {
    issues.push({
      code: 'NO_LOCKFILE',
      severity: 'warning',
      message: 'No lockfile is committed: dependency versions may differ from the ones you tested. Commit package-lock.json, pnpm-lock.yaml or yarn.lock.',
    });
  }

  const nixpacksEnv: Record<string, string> = {};
  const version = await detectNodeVersion(
    files,
    inWorkspace ? [appDir, buildRoot] : [appDir],
    inWorkspace ? [appPkg, rootPkg] : [appPkg]
  );
  if (version) {
    nixpacksEnv.NIXPACKS_NODE_VERSION = version.version;
    if (String(version.requested) !== version.version) {
      issues.push({
        code: 'NODE_VERSION_ADJUSTED',
        severity: version.requested > Number(version.version) ? 'warning' : 'info',
        message: `Node ${version.requested} is asked for (${version.source}); Node ${version.version} is used, the closest version available.`,
      });
    }
  }

  const script = startScript(appPkg);
  const keepsStaticExport = framework.label.startsWith('Next');
  const output: 'server' | 'static' = framework.output === 'static' && script && !keepsStaticExport ? 'server' : framework.output;

  const plan: BuildPlanResult = {
    language: 'node',
    framework: framework.label,
    appDir,
    buildRoot,
    output,
    tool: manager,
    runtimeVersion: version ? { name: 'Node', version: version.version, source: version.source } : undefined,
    workspace: inWorkspace ? { manager, orchestrator, packageName: appPkg.name ?? appRel } : undefined,
    nixpacksEnv,
    issues,
  };
  const inApp = (command: string) => (appRel ? `cd ${appRel} && ${command}` : command);
  const hasBuild = Boolean(appPkg.scripts?.build);

  // Build: in a workspace, the application and the packages it depends on.
  if (inWorkspace) {
    const name = appPkg.name ?? appRel;
    // The package manager's own graph first: it runs the build scripts of the
    // application and of the workspace packages it depends on, in order, from
    // package.json alone. nx depends on its own project names and targets
    // ("No tasks were run" built nothing, and the image shipped without its
    // build); turbo needs its task declared in turbo.json, and says so loudly.
    if (orchestrator === 'turbo') plan.build = `npx turbo run build --filter=${name}`;
    else if (manager === 'pnpm') plan.build = `pnpm --filter '${name}...' run --if-present build`;
    else if (manager === 'npm') plan.build = 'npm run build --workspaces --if-present';
    else if (orchestrator === 'nx') plan.build = `npx nx run-many -t build --projects=${name}`;
    else if (hasBuild) plan.build = inApp(runScript(manager, 'build'));
  } else if (output === 'static' && hasBuild) {
    plan.build = runScript(manager, 'build');
  }

  if (output === 'static') {
    const lockHeader = manager === 'pnpm' && !rootPkg.packageManager ? await files.read(joinPath(buildRoot, 'pnpm-lock.yaml')) : null;
    plan.install = installCommand(manager, lockfiles, pnpmMajorForLockfile(lockHeader));
    plan.publishDirectory = joinPath(appRel, framework.publish ?? 'dist');
    if (!plan.build && !hasBuild) {
      issues.push({ code: 'NO_BUILD_SCRIPT', severity: 'warning', message: `${framework.label} site without a "build" script: its files are served as they are in ${plan.publishDirectory}.` });
    }
  } else {
    // Start: a production script, else the framework's own server.
    if (script && (inWorkspace || script !== 'start')) plan.start = inApp(runScript(manager, script));
    else if (!script && framework.defaultStart) plan.start = inApp(framework.defaultStart);
    else if (!script && !options.overrides?.start && !framework.issue) {
      issues.push({
        code: 'NO_START_COMMAND',
        severity: 'blocking',
        message:
          `No way to start this ${framework.label} application was found: add a "start" script to ${joinPath(appDir, 'package.json')} ` +
          '(e.g. "start": "node dist/index.js"), or set a start command in Settings › Build options.',
      });
    }
  }

  // Prisma's migrations, when the project has some (prisma/migrations).
  const prismaDeps = { ...(appPkg.dependencies ?? {}), ...(appPkg.devDependencies ?? {}) };
  if (('prisma' in prismaDeps || '@prisma/client' in prismaDeps) && files.paths.some((p) => p.startsWith(`${joinPath(appDir, 'prisma/migrations')}/`))) {
    plan.release = inApp('npx prisma migrate deploy');
  }

  // iDeploy's own build for a server it knows how to start.
  const recipeStart = plan.start ?? (script ? inApp(runScript(manager, script)) : null);
  if (output === 'server' && manager !== 'bun' && recipeStart && !framework.issue) {
    const lockHeader = manager === 'pnpm' && !rootPkg.packageManager ? await files.read(joinPath(buildRoot, 'pnpm-lock.yaml')) : null;
    plan.recipe = {
      kind: 'node',
      nodeVersion: String(Math.max(version?.requested ?? RECIPE_NODE_DEFAULT, 16)),
      manager,
      pnpmMajor: pnpmMajorForLockfile(lockHeader),
      hasPackageManagerField: Boolean(rootPkg.packageManager),
      install: recipeInstall(manager, lockfiles),
      build: plan.build ?? (hasBuild ? inApp(runScript(manager, 'build')) : null),
      start: recipeStart,
      nextCacheDir: framework.label.startsWith('Next') ? joinPath(appRel, framework.distDir ?? '.next', 'cache') : null,
      output: buildOutputContract(
        framework.label,
        script ? appPkg.scripts?.[script] ?? '' : framework.defaultStart ?? '',
        appRel,
        hasBuild ? inApp(runScript(manager, 'build')) : null,
        framework.distDir
      ),
    };
  }

  return plan;
}
