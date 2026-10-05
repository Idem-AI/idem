/**
 * GitHub/GitLab tokens, kept with what renews them.
 *
 * Only the access token used to be stored. GitLab's OAuth tokens expire after
 * two hours and a GitHub App's after eight: the first deployment after
 * connecting worked, every one after failed ("Invalid username or token",
 * then — once the rejected token was dropped — "could not read Username").
 * The refresh token and the expiry are now stored too, and an expiring token
 * is renewed before use.
 *
 * Values written before this change were the bare access token: they are
 * read as such (no refresh possible), and replaced at the next connection.
 */
import { randomBytes } from 'crypto';
import redis from '../config/redis.config';
import logger from '../config/logger';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';

export interface StoredToken {
  access: string;
  refresh?: string;
  /** Epoch milliseconds; absent when the provider gave no expiry. */
  expiresAt?: number;
}

/** Renew a little before the end, so a token never expires mid-clone. */
const RENEW_MARGIN_MS = 5 * 60 * 1000;

/** An OAuth token response (access_token, refresh_token, expires_in) as stored. */
export function fromOAuthResponse(data: unknown, now = Date.now()): StoredToken | null {
  const d = data as { access_token?: string; refresh_token?: string; expires_in?: number } | null;
  if (!d?.access_token) return null;
  return {
    access: d.access_token,
    ...(d.refresh_token ? { refresh: d.refresh_token } : {}),
    ...(d.expires_in ? { expiresAt: now + Number(d.expires_in) * 1000 } : {}),
  };
}

/** A stored value: the JSON written now, or a bare token written before. */
export function parseStored(decrypted: string): StoredToken {
  if (decrypted.startsWith('{')) {
    try {
      const t = JSON.parse(decrypted) as StoredToken;
      if (t.access) return t;
    } catch {
      /* a bare token that happens to start with a brace: fall through */
    }
  }
  return { access: decrypted };
}

export function needsRenewal(token: StoredToken, now = Date.now()): boolean {
  return Boolean(token.refresh && token.expiresAt && token.expiresAt - RENEW_MARGIN_MS <= now);
}

export async function saveToken(key: string, token: StoredToken): Promise<void> {
  await redis.set(key, encryptString(JSON.stringify(token)));
}

export async function readToken(key: string): Promise<StoredToken | null> {
  const stored = await redis.get(key);
  const decrypted = stored ? tryDecryptString(stored) : null;
  return decrypted ? parseStored(decrypted) : null;
}

/** Exchanges a refresh token for a new OAuth token response. */
export type Refresher = (refreshToken: string) => Promise<unknown>;

/**
 * A usable access token: the stored one, renewed first when it is about to
 * expire (or when `force`, after the provider refused it). Refresh tokens are
 * single-use, so renewals are serialised by a lock and a concurrent caller
 * reads the token the first one saved.
 */
export async function freshToken(key: string, refresh: Refresher, force = false): Promise<string | null> {
  const token = await readToken(key);
  if (!token) return null;
  if (!token.refresh || (!force && !needsRenewal(token))) return token.access;

  const lockKey = `${key}:renewing`;
  const lock = randomBytes(8).toString('hex');
  if (!(await redis.set(lockKey, lock, 'PX', 30_000, 'NX'))) {
    // Someone else is renewing: wait for their result.
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!(await redis.get(lockKey))) break;
    }
    return (await readToken(key))?.access ?? null;
  }
  try {
    const renewed = fromOAuthResponse(await refresh(token.refresh));
    if (!renewed) throw new Error('no access_token in the refresh response');
    // A provider that does not rotate the refresh token keeps the old one valid.
    await saveToken(key, { ...renewed, refresh: renewed.refresh ?? token.refresh });
    return renewed.access;
  } catch (err) {
    logger.warn('OAuth token renewal failed', { key, message: (err as Error).message });
    return force ? null : token.access;
  } finally {
    if ((await redis.get(lockKey)) === lock) await redis.del(lockKey);
  }
}
