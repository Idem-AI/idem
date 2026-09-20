/**
 * Self-contained GitHub OAuth + repository listing for iDeploy.
 *
 * This does NOT depend on the global Idem API — iDeploy owns the whole flow:
 *  - getAuthUrl: build the GitHub authorize URL (state carries the user id)
 *  - handleCallback: exchange the code for an access token, store it per user
 *  - getStatus / listRepos / disconnect
 *
 * The per-user OAuth access token is stored in Redis (encrypted with the
 * Laravel-compatible crypto) — no schema change needed.
 */
import axios from 'axios';
import redis from '../config/redis.config';
import logger from '../config/logger';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';
import { detectEnvVars } from './env-detection.service';
import { DetectedEnvVar } from '../utils/env-example';
import {
  detectNonNodeEcosystem,
  detectNodePackageManager,
  findManifestDirectories,
  EcosystemWarning,
  ManifestDirectory,
} from './ecosystem-detection.service';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const SCOPE = 'repo user:email';
const API_BASE = process.env.IDEPLOY_API_PUBLIC_URL || 'http://localhost:3002';
const WEB_URL = process.env.IDEPLOY_WEB_URL || 'http://localhost:4202';

function callbackUrl(): string {
  return `${API_BASE}/api/v1/github/auth/callback`;
}
function tokenKey(userId: number): string {
  return `ideploy:github:token:${userId}`;
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

/**
 * Only a same-origin relative path is a safe redirect target — `//evil.com`
 * (protocol-relative) or an absolute URL in `return_to` would send the
 * browser off-site straight after it hands over an OAuth code. Anything that
 * doesn't look like a bare path falls back to `/new-project`, the previous
 * fixed behaviour.
 */
function sanitizeReturnTo(path: string | undefined): string {
  if (!path) return '/new-project';
  if (!path.startsWith('/') || path.startsWith('//')) return '/new-project';
  return path;
}

/** `${WEB_URL}${returnTo}` plus a `provider=status` query param, however `returnTo` is itself punctuated. */
function buildRedirect(returnTo: string, status: 'connected' | 'error'): string {
  const separator = returnTo.includes('?') ? '&' : '?';
  return `${WEB_URL}${returnTo}${separator}github=${status}`;
}

/** Build the GitHub authorize URL. `state` carries the user id (+ nonce + where to send the browser back). */
export function getAuthUrl(userId: number, nowMs: number, returnTo?: string): string {
  const state = Buffer.from(JSON.stringify({ userId, t: nowMs, returnTo: sanitizeReturnTo(returnTo) })).toString('base64url');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPE,
    state,
    redirect_uri: callbackUrl(),
    allow_signup: 'false',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

function parseState(state: string): { userId: number; returnTo: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    if (decoded?.userId) return { userId: Number(decoded.userId), returnTo: sanitizeReturnTo(decoded.returnTo) };
  } catch {
    /* ignore */
  }
  return null;
}

/** Exchange the OAuth code for an access token and store it. Returns the web redirect URL. */
export async function handleCallback(code: string, state: string): Promise<string> {
  const parsed = parseState(state);
  if (!parsed) return `${WEB_URL}/new-project?github=error`;

  try {
    const { data } = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: callbackUrl() },
      { headers: { Accept: 'application/json' }, timeout: 15000 }
    );
    const accessToken: string | undefined = data?.access_token;
    if (!accessToken) {
      logger.warn('GitHub OAuth: no access_token in response', { error: data?.error });
      return buildRedirect(parsed.returnTo, 'error');
    }
    await redis.set(tokenKey(parsed.userId), encryptString(accessToken));
    logger.info('GitHub connected for user', { userId: parsed.userId });
    return buildRedirect(parsed.returnTo, 'connected');
  } catch (err) {
    logger.error('GitHub OAuth callback failed', { message: (err as Error).message });
    return buildRedirect(parsed.returnTo, 'error');
  }
}

export async function getToken(userId: number): Promise<string | null> {
  const stored = await redis.get(tokenKey(userId));
  return stored ? tryDecryptString(stored) : null;
}

/** Returns the connected GitHub username, or null if not connected. */
export async function getStatus(userId: number): Promise<string | null> {
  const token = await getToken(userId);
  if (!token) return null;
  try {
    const { data } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      timeout: 10000,
    });
    return data?.login ?? null;
  } catch {
    return null;
  }
}

export interface GithubRepo {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
}

export async function listRepos(userId: number): Promise<GithubRepo[]> {
  const token = await getToken(userId);
  if (!token) throw new Error('GitHub not connected');
  const { data } = await axios.get('https://api.github.com/user/repos', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    params: { per_page: 100, sort: 'updated', affiliation: 'owner,collaborator,organization_member' },
    timeout: 15000,
  });
  return (data as Record<string, unknown>[]).map((r) => ({
    name: String(r.name),
    fullName: String(r.full_name),
    description: (r.description as string) ?? '',
    private: Boolean(r.private),
    htmlUrl: String(r.html_url),
    cloneUrl: String(r.clone_url),
    defaultBranch: String(r.default_branch ?? 'main'),
    language: (r.language as string) ?? null,
    updatedAt: String(r.updated_at ?? ''),
  }));
}

export async function disconnect(userId: number): Promise<void> {
  await redis.del(tokenKey(userId));
}

/**
 * Detect the framework + whether the repo has a Dockerfile. `buildPack` is the
 * suggested default ('buildless' unless a Dockerfile is present). The UI lets
 * the user switch to/from Docker when a Dockerfile exists.
 */
export async function detectFramework(
  userId: number,
  fullName: string
): Promise<{
  preset: string;
  buildPack: string;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  envVars: DetectedEnvVar[];
  ecosystem: string;
  buildTool?: string;
  suggestedPort: number | null;
  startCommandHint?: string;
  warnings: EcosystemWarning[];
  /** Set only when exactly one application root was found outside the repo root — the operator's Root Directory field, pre-filled instead of blank. */
  rootDirSuggestion?: string;
  /** Set only when 2+ application roots were found and none could be picked automatically — lets the UI offer a choice instead of a blind text field. */
  monorepoCandidates?: ManifestDirectory[];
}> {
  const token = await getToken(userId);
  const headers = token
    ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' };

  // The whole file tree, fetched once, so every "does X exist" check below
  // is a Set lookup rather than its own request. Verified live: the
  // previous version made one existence-check request per candidate file —
  // Dockerfile, both compose spellings, every language's manifest, eight
  // .env.example spellings — 25 to 30 requests for a single detection.
  // GitHub's unauthenticated rate limit is 60/hour *shared across every
  // caller hitting this server's IP without their own connected token*;
  // that exhausted it after detecting two repositories. This still costs
  // two requests (resolving the default branch, then the tree), but every
  // existence check after that is free, and only files actually present get
  // a content fetch at all.
  let treeFetchFailed = false;
  const treePaths: string[] = await (async () => {
    try {
      const { data: repoData, status: repoStatus } = await axios.get(`https://api.github.com/repos/${fullName}`, {
        headers,
        timeout: 8000,
        validateStatus: () => true,
      });
      if (repoStatus !== 200) {
        treeFetchFailed = true;
        return [];
      }
      const branch = repoData?.default_branch || 'main';
      const { data, status } = await axios.get(
        `https://api.github.com/repos/${fullName}/git/trees/${encodeURIComponent(branch)}`,
        { headers, params: { recursive: 1 }, timeout: 10000, validateStatus: () => true }
      );
      if (status !== 200 || !Array.isArray(data?.tree)) {
        treeFetchFailed = true;
        return [];
      }
      return (data.tree as { type: string; path: string }[]).filter((t) => t.type === 'blob').map((t) => t.path);
    } catch {
      treeFetchFailed = true;
      return [];
    }
  })();
  const known = new Set(treePaths);

  const getFile = async (path: string): Promise<string | null> => {
    if (!known.has(path)) return null;
    try {
      const { data, status } = await axios.get(`https://api.github.com/repos/${fullName}/contents/${path}`, {
        headers,
        timeout: 8000,
        validateStatus: () => true,
      });
      return status === 200 && data?.content ? Buffer.from(data.content, 'base64').toString('utf8') : null;
    } catch {
      return null;
    }
  };

  const hasDockerfile = known.has('Dockerfile');
  const hasDockerCompose = known.has('docker-compose.yml') || known.has('docker-compose.yaml');

  let preset = 'Other';
  let ecosystem = 'unknown';
  let buildTool: string | undefined;
  let suggestedPort: number | null = null;
  let startCommandHint: string | undefined;
  let warnings: EcosystemWarning[] = [];

  // Try every language with a fixed-name manifest before falling back to
  // Node's own (already-existing) package.json-based detection below — a
  // repo with a pom.xml is Java whether or not it also happens to have a
  // stray package.json from some tooling.
  const nonNode = await detectNonNodeEcosystem({ getFile });
  if (nonNode) {
    preset = nonNode.framework;
    ecosystem = nonNode.ecosystem;
    buildTool = nonNode.buildTool;
    suggestedPort = nonNode.suggestedPort;
    startCommandHint = nonNode.startCommandHint;
    warnings = nonNode.warnings;
  } else {
    const packageJson = await getFile('package.json');
    try {
      if (packageJson) {
        const pkg = JSON.parse(packageJson);
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (deps.next) preset = 'Next.js';
        else if (deps.vite) preset = 'Vite';
        else if (deps['@angular/core']) preset = 'Angular';
        else if (deps.express || deps.fastify) preset = 'Node.js';
        else preset = 'Node.js';
        ecosystem = 'node';
        suggestedPort = 3000;
        buildTool = await detectNodePackageManager({ getFile });
      } else if (hasDockerfile) {
        preset = 'Dockerfile';
        ecosystem = 'dockerfile';
      }
    } catch {
      if (hasDockerfile) {
        preset = 'Dockerfile';
        ecosystem = 'dockerfile';
      }
    }
  }

  let rootDirSuggestion: string | undefined;
  let monorepoCandidates: ManifestDirectory[] | undefined;

  // Nothing at the repository root named anything we recognise — before
  // giving up as "Other", check whether the actual application just lives
  // in a subdirectory (a monorepo with only docs/config at the root, or a
  // repo organised as apps/<name>). Free: the tree is already fetched.
  if (ecosystem === 'unknown') {
    const candidates = findManifestDirectories(treePaths).filter((c) => c.dir !== '');
    if (candidates.length === 1) {
      const dir = candidates[0].dir;
      const scopedGetFile = (path: string): Promise<string | null> => getFile(`${dir}/${path}`);
      const scopedNonNode = await detectNonNodeEcosystem({ getFile: scopedGetFile });
      if (scopedNonNode) {
        preset = scopedNonNode.framework;
        ecosystem = scopedNonNode.ecosystem;
        buildTool = scopedNonNode.buildTool;
        suggestedPort = scopedNonNode.suggestedPort;
        startCommandHint = scopedNonNode.startCommandHint;
        warnings = [...warnings, ...scopedNonNode.warnings];
        rootDirSuggestion = dir;
      } else if (candidates[0].manifestFile === 'package.json') {
        const scopedPackageJson = await scopedGetFile('package.json');
        if (scopedPackageJson) {
          try {
            const pkg = JSON.parse(scopedPackageJson);
            const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
            if (deps.next) preset = 'Next.js';
            else if (deps.vite) preset = 'Vite';
            else if (deps['@angular/core']) preset = 'Angular';
            else preset = 'Node.js';
            ecosystem = 'node';
            suggestedPort = 3000;
            buildTool = await detectNodePackageManager({ getFile: scopedGetFile });
            rootDirSuggestion = dir;
          } catch {
            /* malformed package.json in the candidate directory — leave as Other */
          }
        }
      } else if (candidates[0].manifestFile === 'Dockerfile') {
        preset = 'Dockerfile';
        ecosystem = 'dockerfile';
        rootDirSuggestion = dir;
      }
    } else if (candidates.length > 1) {
      monorepoCandidates = candidates;
    }
  }

  if (treeFetchFailed) {
    warnings = [
      ...warnings,
      {
        code: 'DETECTION_INCOMPLETE',
        message:
          'Could not fully read this repository\'s file list (GitHub API issue, possibly a rate limit) — ' +
          'framework and environment variable detection may be incomplete. Review the settings below before deploying.',
        severity: 'warning',
      },
    ];
  }

  // Default build method: Docker only if a Dockerfile exists AND there's no
  // detected JS framework to run buildless; otherwise buildless (nixpacks
  // builds every non-Docker ecosystem above too, not just Node).
  const buildPack = hasDockerfile && preset === 'Dockerfile' ? 'dockerfile' : 'buildless';

  // Which variables the repository itself needs, from wherever it declares
  // or actually reads them — see env-detection.service.ts for the sources
  // checked and why a Dockerfile-only repository still yields something.
  // Scoped to the discovered subdirectory when the application isn't at the
  // repository root (its own .env.example lives next to its own manifest,
  // not at the root that holds nothing but a README) — both getFile and
  // listFiles have to agree on what "relative" means, or the fallback
  // source scan would double-prefix every path it tries.
  const envVars = await detectEnvVars(
    rootDirSuggestion
      ? {
          getFile: (path: string) => getFile(`${rootDirSuggestion}/${path}`),
          async listFiles() {
            const prefix = `${rootDirSuggestion}/`;
            return treePaths.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
          },
        }
      : {
          getFile,
          // Already fetched above — no reason to ask GitHub for the same tree twice.
          async listFiles() {
            return treePaths;
          },
        }
  );

  return {
    preset,
    buildPack,
    hasDockerfile,
    hasDockerCompose,
    envVars,
    ecosystem,
    buildTool,
    suggestedPort,
    startCommandHint,
    warnings,
    rootDirSuggestion,
    monorepoCandidates,
  };
}
