/**
 * Find every environment variable a repository plausibly needs, from
 * whichever of the places real projects actually declare them.
 *
 * A `.env.example` is the clean case, and plenty of repositories never ship
 * one at all — a Dockerfile-only backend that reads `process.env.X` straight
 * from its own source is exactly as real a project, and the previous version
 * of this detector found nothing for it. So this checks, in order of how
 * cheap and how authoritative each source is:
 *
 *   1. An example env file (`.env.example` and its common spellings) — a
 *      file whose entire purpose is naming these variables.
 *   2. `docker-compose.yml` / `.yaml` — an `environment:` block on a service
 *      is a declaration too, sometimes with a real default value.
 *   3. The `Dockerfile` itself — `ENV`/`ARG` lines.
 *   4. Only if the above found nothing: a bounded scan of the repository's
 *      own source for `process.env.KEY` and its equivalents in a handful of
 *      other languages. This is the expensive path (it lists the whole repo
 *      tree and fetches a capped number of files), so it only runs when
 *      cheaper sources came up empty — most repositories with a proper
 *      example file never reach it.
 *
 * Every source is provider-agnostic: GitHub and GitLab each hand in a small
 * `RepoAccess` that knows how to fetch a file and list the tree, and this
 * module never touches either API directly.
 */
import YAML from 'yaml';
import { DetectedEnvVar, ENV_EXAMPLE_FILENAMES, parseEnvExample } from '../utils/env-example';

export interface RepoAccess {
  /** Raw text content of one file at the repository root, or null if it isn't there / can't be read. */
  getFile(path: string): Promise<string | null>;
  /** Every file path in the repository's default branch. Returns [] rather than throwing when it can't be listed. */
  listFiles(): Promise<string[]>;
}

const COMPOSE_FILENAMES = ['docker-compose.yml', 'docker-compose.yaml'] as const;

/** Variables that show up in virtually every codebase and are never something an operator fills in here. */
const IGNORED_KEYS = new Set([
  'NODE_ENV',
  'PATH',
  'HOME',
  'PWD',
  'CI',
  'TERM',
  'SHELL',
  'LANG',
  'USER',
  'HOSTNAME',
  'TZ',
]);

/** How many source files the fallback scan will fetch and search, at most. */
const SOURCE_SCAN_FILE_LIMIT = 20;
/** Skip anything bigger — a bundled/minified/vendored file wastes the budget without teaching us anything. */
const SOURCE_SCAN_MAX_FILE_SIZE = 80_000;
/** How many file fetches run at once — see `fetchBounded`'s own doc comment. */
const FETCH_CONCURRENCY = 8;

/**
 * Fetch every path with `getFile`, at most `FETCH_CONCURRENCY` requests in
 * flight, and return only the ones that actually had content.
 *
 * Verified live: fetching the (now up to 20) example-file candidates plus a
 * capped source scan one request at a time, awaited in sequence, made a
 * single `detectFramework` call take over 40 seconds against a real
 * repository and time out — exactly the kind of failure this whole feature
 * exists to prevent, just moved one layer down.
 */
async function fetchBounded(repo: RepoAccess, paths: readonly string[]): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(paths.length).fill(null);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= paths.length) return;
      results[index] = await repo.getFile(paths[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, paths.length) }, worker));
  return results;
}

function mergeIn(found: Map<string, string>, key: string, value: string): void {
  if (!key || IGNORED_KEYS.has(key)) return;
  const existing = found.get(key);
  // Keep the first non-empty value seen; a later, less-authoritative source
  // naming the same key with nothing to say about it must not blank out a
  // real default an earlier one already supplied.
  if (existing === undefined || (!existing && value)) found.set(key, value);
}

/**
 * Compose's `environment:` accepts either a list (`- KEY=value`) or a map
 * (`KEY: value`) — both are legal YAML for the same field, and a real
 * project uses whichever its author preferred.
 */
function parseComposeEnv(yamlText: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  let doc: unknown;
  try {
    doc = YAML.parse(yamlText);
  } catch {
    return out;
  }
  const services = (doc as { services?: Record<string, { environment?: unknown }> } | null)?.services;
  if (!services || typeof services !== 'object') return out;

  for (const service of Object.values(services)) {
    const env = service?.environment;
    if (Array.isArray(env)) {
      for (const entry of env) {
        if (typeof entry !== 'string') continue;
        const eq = entry.indexOf('=');
        if (eq === -1) out.push({ key: entry.trim(), value: '' });
        else out.push({ key: entry.slice(0, eq).trim(), value: entry.slice(eq + 1).trim() });
      }
    } else if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
        out.push({ key, value: value === null || value === undefined ? '' : String(value) });
      }
    }
  }
  return out;
}

/** `ENV KEY=value`, `ENV KEY value`, and `ARG KEY=default` — Dockerfile's two `ENV` grammars plus build args. */
function parseDockerfileEnv(dockerfile: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const rawLine of dockerfile.split(/\r?\n/)) {
    const line = rawLine.trim();
    const envMatch = /^ENV\s+(.+)$/i.exec(line);
    const argMatch = /^ARG\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*(.*))?$/i.exec(line);
    if (argMatch) {
      out.push({ key: argMatch[1], value: (argMatch[2] ?? '').replace(/^["']|["']$/g, '') });
      continue;
    }
    if (!envMatch) continue;
    const rest = envMatch[1];
    if (rest.includes('=')) {
      // `ENV KEY1=val1 KEY2=val2` — a simple split is enough for the common
      // case of unquoted, space-free values; anything stranger just yields a
      // key with no value, which is still useful to have surfaced.
      for (const pair of rest.match(/[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)/g) ?? []) {
        const eq = pair.indexOf('=');
        out.push({ key: pair.slice(0, eq), value: pair.slice(eq + 1).replace(/^["']|["']$/g, '') });
      }
    } else {
      // `ENV KEY value` — the single-pair legacy form.
      const sp = rest.indexOf(' ');
      if (sp === -1) out.push({ key: rest, value: '' });
      else out.push({ key: rest.slice(0, sp), value: rest.slice(sp + 1).trim() });
    }
  }
  return out;
}

/** Per-language patterns for reading an environment variable straight from source. */
const SOURCE_PATTERNS: RegExp[] = [
  // process.env.KEY / process.env.KEY || 'default' / process.env.KEY || 3000  (Node/JS/TS)
  /process\.env\.([A-Z][A-Z0-9_]*)\s*(?:\|\|\s*(?:['"]([^'"]*)['"]|(\d+)))?/g,
  // process.env['KEY']
  /process\.env\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g,
  // import.meta.env.KEY  (Vite)
  /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
  // os.environ.get('KEY', 'default') / os.environ['KEY']  (Python)
  /os\.environ\.get\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*(?:,\s*['"]([^'"]*)['"])?\s*\)/g,
  /os\.environ\[\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\]/g,
  // os.getenv('KEY', 'default')  (Python)
  /os\.getenv\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*(?:,\s*['"]([^'"]*)['"])?\s*\)/g,
  // os.Getenv("KEY")  (Go)
  /os\.Getenv\(\s*"([A-Z][A-Z0-9_]*)"\s*\)/g,
  // System.getenv("KEY")  (Java/Kotlin)
  /System\.getenv\(\s*"([A-Z][A-Z0-9_]*)"\s*\)/g,
];

function parseSourceEnvRefs(content: string): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  for (const pattern of SOURCE_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content))) {
      // Group 2 covers a quoted default on every pattern; group 3 exists
      // only on the JS/TS one, for `|| 3000` — an unquoted numeric fallback,
      // which is at least as common in real code as a quoted one.
      out.push({ key: m[1], value: m[2] ?? m[3] ?? '' });
    }
  }
  return out;
}

const SOURCE_EXTENSIONS = new Set(['.js', '.ts', '.mjs', '.cjs', '.jsx', '.tsx', '.py', '.go', '.rb', '.java', '.php']);
const EXCLUDED_DIRS = ['node_modules/', 'dist/', 'build/', '.git/', 'vendor/', 'venv/', '.next/', 'coverage/'];
/** Filenames worth checking before anything else — where configuration usually lives. */
const PRIORITY_NAME = /^(index|server|app|main|bootstrap|config|settings)\.(js|ts|mjs|cjs|py|go|rb)$/i;

/** Pick a small, high-signal set of source files to scan, cheapest-and-most-likely first. */
function pickCandidateFiles(paths: string[]): string[] {
  const candidates = paths.filter((p) => {
    if (EXCLUDED_DIRS.some((dir) => p.includes(dir))) return false;
    const dot = p.lastIndexOf('.');
    return dot !== -1 && SOURCE_EXTENSIONS.has(p.slice(dot));
  });

  candidates.sort((a, b) => {
    const scoreOf = (p: string): number => {
      const base = p.slice(p.lastIndexOf('/') + 1);
      if (PRIORITY_NAME.test(base)) return 0;
      if (p.startsWith('src/config/') || p.startsWith('config/')) return 1;
      if (p.startsWith('src/')) return 2;
      return 3;
    };
    return scoreOf(a) - scoreOf(b);
  });

  return candidates.slice(0, SOURCE_SCAN_FILE_LIMIT);
}

export async function detectEnvVars(repo: RepoAccess): Promise<DetectedEnvVar[]> {
  const found = new Map<string, string>();

  // Every declarative-file candidate — example files, compose, Dockerfile —
  // fetched as one batch, not three sequential ones: each is an independent
  // existence check with nothing to learn from the others first, so there is
  // no reason to pay for the round trip three times over.
  const declarativePaths = [...ENV_EXAMPLE_FILENAMES, ...COMPOSE_FILENAMES, 'Dockerfile'];
  const declarativeContents = await fetchBounded(repo, declarativePaths);
  const exampleCount = ENV_EXAMPLE_FILENAMES.length;

  for (const content of declarativeContents.slice(0, exampleCount)) {
    if (content !== null) {
      for (const v of parseEnvExample(content)) mergeIn(found, v.key, v.defaultValue);
    }
  }
  for (const content of declarativeContents.slice(exampleCount, exampleCount + COMPOSE_FILENAMES.length)) {
    if (content !== null) {
      for (const v of parseComposeEnv(content)) mergeIn(found, v.key, v.value);
    }
  }
  const dockerfile = declarativeContents[declarativeContents.length - 1];
  if (dockerfile !== null) {
    for (const v of parseDockerfileEnv(dockerfile)) mergeIn(found, v.key, v.value);
  }

  // The expensive fallback: only worth the API calls it costs when nothing
  // cheaper found a single variable to show.
  if (found.size === 0) {
    const files = await repo.listFiles();
    const candidates = pickCandidateFiles(files);
    const contents = await fetchBounded(repo, candidates);
    for (const content of contents) {
      if (!content || content.length > SOURCE_SCAN_MAX_FILE_SIZE) continue;
      for (const v of parseSourceEnvRefs(content)) mergeIn(found, v.key, v.value);
    }
  }

  return [...found.entries()].map(([key, defaultValue]) => ({ key, defaultValue }));
}
