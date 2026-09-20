/**
 * Self-contained GitLab OAuth + repository listing for iDeploy — the same
 * shape as `github.service.ts`, mirrored rather than shared, because the two
 * providers' APIs (project vs. repo, `/api/v4` vs `/repos`, OAuth2 token
 * exchange details) differ enough that a shared abstraction would just be an
 * if/else in disguise.
 *
 * Unlike GitHub, this also honours `GITLAB_INSTANCE_URL` — GitLab is commonly
 * self-hosted, and an operator who already self-hosts iDeploy is a plausible
 * self-hoster of GitLab too. Defaults to gitlab.com when unset.
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

const CLIENT_ID = process.env.GITLAB_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET || '';
const INSTANCE_URL = (process.env.GITLAB_INSTANCE_URL || 'https://gitlab.com').replace(/\/$/, '');
const SCOPE = 'read_user read_api read_repository';
const API_BASE = process.env.IDEPLOY_API_PUBLIC_URL || 'http://localhost:3002';
const WEB_URL = process.env.IDEPLOY_WEB_URL || 'http://localhost:4202';

function callbackUrl(): string {
  return `${API_BASE}/api/v1/gitlab/auth/callback`;
}
function tokenKey(userId: number): string {
  return `ideploy:gitlab:token:${userId}`;
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

/** See `github.service.ts`'s twin of this — same reasoning: only a same-origin relative path is a safe redirect target. */
function sanitizeReturnTo(path: string | undefined): string {
  if (!path) return '/new-project';
  if (!path.startsWith('/') || path.startsWith('//')) return '/new-project';
  return path;
}

function buildRedirect(returnTo: string, status: 'connected' | 'error'): string {
  const separator = returnTo.includes('?') ? '&' : '?';
  return `${WEB_URL}${returnTo}${separator}gitlab=${status}`;
}

export function getAuthUrl(userId: number, nowMs: number, returnTo?: string): string {
  const state = Buffer.from(JSON.stringify({ userId, t: nowMs, returnTo: sanitizeReturnTo(returnTo) })).toString('base64url');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPE,
    state,
    redirect_uri: callbackUrl(),
    response_type: 'code',
  });
  return `${INSTANCE_URL}/oauth/authorize?${params.toString()}`;
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
  if (!parsed) return `${WEB_URL}/new-project?gitlab=error`;

  try {
    const { data } = await axios.post(
      `${INSTANCE_URL}/oauth/token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl(),
      },
      { headers: { Accept: 'application/json' }, timeout: 15000 }
    );
    const accessToken: string | undefined = data?.access_token;
    if (!accessToken) {
      logger.warn('GitLab OAuth: no access_token in response', { error: data?.error });
      return buildRedirect(parsed.returnTo, 'error');
    }
    await redis.set(tokenKey(parsed.userId), encryptString(accessToken));
    logger.info('GitLab connected for user', { userId: parsed.userId });
    return buildRedirect(parsed.returnTo, 'connected');
  } catch (err) {
    logger.error('GitLab OAuth callback failed', { message: (err as Error).message });
    return buildRedirect(parsed.returnTo, 'error');
  }
}

export async function getToken(userId: number): Promise<string | null> {
  const stored = await redis.get(tokenKey(userId));
  return stored ? tryDecryptString(stored) : null;
}

/** Returns the connected GitLab username, or null if not connected. */
export async function getStatus(userId: number): Promise<string | null> {
  const token = await getToken(userId);
  if (!token) return null;
  try {
    const { data } = await axios.get(`${INSTANCE_URL}/api/v4/user`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return data?.username ?? null;
  } catch {
    return null;
  }
}

export interface GitlabRepo {
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

/** GitLab calls them "projects", not "repositories" — the shape returned matches `GithubRepo` regardless. */
export async function listRepos(userId: number): Promise<GitlabRepo[]> {
  const token = await getToken(userId);
  if (!token) throw new Error('GitLab not connected');
  const { data } = await axios.get(`${INSTANCE_URL}/api/v4/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { membership: true, per_page: 100, order_by: 'last_activity_at', simple: true },
    timeout: 15000,
  });
  return (data as Record<string, unknown>[]).map((p) => ({
    name: String(p.name),
    fullName: String(p.path_with_namespace),
    description: (p.description as string) ?? '',
    private: String(p.visibility ?? 'private') !== 'public',
    htmlUrl: String(p.web_url),
    cloneUrl: String(p.http_url_to_repo),
    defaultBranch: String(p.default_branch ?? 'main'),
    language: null, // GitLab's project list endpoint doesn't return a primary language; `simple: true` keeps the call fast.
    updatedAt: String(p.last_activity_at ?? ''),
  }));
}

export async function disconnect(userId: number): Promise<void> {
  await redis.del(tokenKey(userId));
}

/**
 * Detect the framework + whether the repo has a Dockerfile, mirroring
 * `github.service.ts::detectFramework`. `fullName` is the URL-encodable
 * `namespace/project` path GitLab's API expects as a single path segment.
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
  rootDirSuggestion?: string;
  monorepoCandidates?: ManifestDirectory[];
}> {
  const token = await getToken(userId);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const projectPath = encodeURIComponent(fullName);

  // The whole file tree, fetched once — every existence check below is then
  // a Set lookup, not its own request. See github.service.ts's identical
  // change for why: the previous version made one request per candidate
  // file (Dockerfile, both compose spellings, every language's manifest,
  // eight .env.example spellings), and a detection this expensive is a
  // rate-limit problem waiting to happen, especially against a self-hosted
  // GitLab instance an admin has configured with a tighter limit than
  // GitLab.com's own.
  let treeFetchFailed = false;
  const treePaths: string[] = await (async () => {
    try {
      const { data, status } = await axios.get(
        `${INSTANCE_URL}/api/v4/projects/${projectPath}/repository/tree`,
        { headers, params: { ref: 'HEAD', recursive: true, per_page: 100 }, timeout: 10000, validateStatus: () => true }
      );
      if (status !== 200 || !Array.isArray(data)) {
        treeFetchFailed = true;
        return [];
      }
      return (data as { type: string; path: string }[]).filter((t) => t.type === 'blob').map((t) => t.path);
    } catch {
      treeFetchFailed = true;
      return [];
    }
  })();
  const known = new Set(treePaths);

  /** Content of one file — only ever requested for a path the tree already confirmed exists. */
  async function fileContent(path: string): Promise<string | null> {
    if (!known.has(path)) return null;
    try {
      const { data, status } = await axios.get(
        `${INSTANCE_URL}/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(path)}`,
        { headers, params: { ref: 'HEAD' }, timeout: 8000, validateStatus: () => true }
      );
      if (status === 200 && data?.content) return Buffer.from(data.content, 'base64').toString('utf8');
      return null;
    } catch {
      return null;
    }
  }

  const hasDockerfile = known.has('Dockerfile');
  const hasDockerCompose = known.has('docker-compose.yml') || known.has('docker-compose.yaml');

  let preset = 'Other';
  let ecosystem = 'unknown';
  let buildTool: string | undefined;
  let suggestedPort: number | null = null;
  let startCommandHint: string | undefined;
  let warnings: EcosystemWarning[] = [];

  const nonNode = await detectNonNodeEcosystem({ getFile: fileContent });
  if (nonNode) {
    preset = nonNode.framework;
    ecosystem = nonNode.ecosystem;
    buildTool = nonNode.buildTool;
    suggestedPort = nonNode.suggestedPort;
    startCommandHint = nonNode.startCommandHint;
    warnings = nonNode.warnings;
  } else {
    const packageJson = await fileContent('package.json');
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
        buildTool = await detectNodePackageManager({ getFile: fileContent });
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

  // Nothing at the project root named anything we recognise — before giving
  // up as "Other", check whether the application lives in a subdirectory.
  // Free: the tree is already fetched. See github.service.ts's identical
  // block for the full reasoning.
  if (ecosystem === 'unknown') {
    const candidates = findManifestDirectories(treePaths).filter((c) => c.dir !== '');
    if (candidates.length === 1) {
      const dir = candidates[0].dir;
      const scopedGetFile = (path: string): Promise<string | null> => fileContent(`${dir}/${path}`);
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
          'Could not fully read this project\'s file list (GitLab API issue, possibly a rate limit) — ' +
          'framework and environment variable detection may be incomplete. Review the settings below before deploying.',
        severity: 'warning',
      },
    ];
  }

  const buildPack = hasDockerfile && preset === 'Dockerfile' ? 'dockerfile' : 'buildless';

  // Which variables the project needs, from wherever it declares or reads
  // them — see env-detection.service.ts for the sources checked. Scoped to
  // the discovered subdirectory when the application isn't at the project
  // root — see github.service.ts's identical branch for why both getFile
  // and listFiles have to agree on what "relative" means here.
  const envVars = await detectEnvVars(
    rootDirSuggestion
      ? {
          getFile: (path: string) => fileContent(`${rootDirSuggestion}/${path}`),
          async listFiles() {
            const prefix = `${rootDirSuggestion}/`;
            return treePaths.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
          },
        }
      : {
          getFile: fileContent,
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
