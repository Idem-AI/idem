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

export function getAuthUrl(userId: number, nowMs: number): string {
  const state = Buffer.from(JSON.stringify({ userId, t: nowMs })).toString('base64url');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPE,
    state,
    redirect_uri: callbackUrl(),
    response_type: 'code',
  });
  return `${INSTANCE_URL}/oauth/authorize?${params.toString()}`;
}

function parseState(state: string): { userId: number } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    if (decoded?.userId) return { userId: Number(decoded.userId) };
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
      return `${WEB_URL}/new-project?gitlab=error`;
    }
    await redis.set(tokenKey(parsed.userId), encryptString(accessToken));
    logger.info('GitLab connected for user', { userId: parsed.userId });
    return `${WEB_URL}/new-project?gitlab=connected`;
  } catch (err) {
    logger.error('GitLab OAuth callback failed', { message: (err as Error).message });
    return `${WEB_URL}/new-project?gitlab=error`;
  }
}

async function getToken(userId: number): Promise<string | null> {
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
): Promise<{ preset: string; buildPack: string; hasDockerfile: boolean; hasDockerCompose: boolean }> {
  const token = await getToken(userId);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const projectPath = encodeURIComponent(fullName);

  async function fileExists(path: string): Promise<boolean> {
    try {
      const { status } = await axios.get(
        `${INSTANCE_URL}/api/v4/projects/${projectPath}/repository/files/${encodeURIComponent(path)}`,
        { headers, params: { ref: 'HEAD' }, timeout: 8000, validateStatus: () => true }
      );
      return status === 200;
    } catch {
      return false;
    }
  }

  const hasDockerfile = await fileExists('Dockerfile');
  const hasDockerCompose = (await fileExists('docker-compose.yml')) || (await fileExists('docker-compose.yaml'));

  let preset = 'Other';
  try {
    const { data, status } = await axios.get(
      `${INSTANCE_URL}/api/v4/projects/${projectPath}/repository/files/package.json`,
      { headers, params: { ref: 'HEAD' }, timeout: 10000, validateStatus: () => true }
    );
    if (status === 200 && data?.content) {
      const pkg = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (deps.next) preset = 'Next.js';
      else if (deps.vite) preset = 'Vite';
      else if (deps['@angular/core']) preset = 'Angular';
      else if (deps.express || deps.fastify) preset = 'Node.js';
      else preset = 'Node.js';
    } else if (hasDockerfile) {
      preset = 'Dockerfile';
    }
  } catch {
    if (hasDockerfile) preset = 'Dockerfile';
  }

  const buildPack = hasDockerfile && preset === 'Dockerfile' ? 'dockerfile' : 'buildless';
  return { preset, buildPack, hasDockerfile, hasDockerCompose };
}
