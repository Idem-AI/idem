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

/** Build the GitHub authorize URL. `state` carries the user id (+ nonce). */
export function getAuthUrl(userId: number, nowMs: number): string {
  const state = Buffer.from(JSON.stringify({ userId, t: nowMs })).toString('base64url');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPE,
    state,
    redirect_uri: callbackUrl(),
    allow_signup: 'false',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
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
      return `${WEB_URL}/new-project?github=error`;
    }
    await redis.set(tokenKey(parsed.userId), encryptString(accessToken));
    logger.info('GitHub connected for user', { userId: parsed.userId });
    return `${WEB_URL}/new-project?github=connected`;
  } catch (err) {
    logger.error('GitHub OAuth callback failed', { message: (err as Error).message });
    return `${WEB_URL}/new-project?github=error`;
  }
}

async function getToken(userId: number): Promise<string | null> {
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
): Promise<{ preset: string; buildPack: string; hasDockerfile: boolean }> {
  const token = await getToken(userId);
  const headers = token
    ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    : { Accept: 'application/vnd.github+json' };

  let hasDockerfile = false;
  try {
    const { status } = await axios.get(`https://api.github.com/repos/${fullName}/contents/Dockerfile`, {
      headers,
      timeout: 8000,
      validateStatus: () => true,
    });
    hasDockerfile = status === 200;
  } catch {
    /* ignore */
  }

  let preset = 'Other';
  try {
    const { data } = await axios.get(`https://api.github.com/repos/${fullName}/contents/package.json`, {
      headers,
      timeout: 10000,
      validateStatus: () => true,
    });
    if (data?.content) {
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

  // Default build method: Docker only if a Dockerfile exists AND there's no
  // detected JS framework to run buildless; otherwise buildless.
  const buildPack = hasDockerfile && preset === 'Dockerfile' ? 'dockerfile' : 'buildless';
  return { preset, buildPack, hasDockerfile };
}
