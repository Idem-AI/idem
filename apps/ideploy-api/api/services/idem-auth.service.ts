/**
 * Authentication delegation — faithful port of the Laravel app's
 * `App\Services\IdemAuthService`.
 *
 * iDeploy does NOT authenticate users itself. The central Idem API (apps/api)
 * owns authentication and issues an httpOnly `session` cookie. Every other app
 * (including iDeploy) simply verifies that cookie by calling the central API
 * `GET /auth/profile` (credentials forwarded), then syncs the returned identity
 * into iDeploy's own `users` table (keyed by `idem_uid`).
 *
 * This is the same delegation the rest of the monorepo uses — we do not build a
 * second auth system here.
 */
import axios from 'axios';
import pool from '../config/db.config';
import logger from '../config/logger';

const IDEM_API_URL = process.env.IDEM_API_URL || 'http://localhost:3001';

export interface IdemProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}

export interface SyncedUser {
  id: number;
  idem_uid: string;
  email: string;
  name: string;
}

/**
 * Verify a session cookie against the central Idem API and return the profile,
 * or null if unauthenticated. Mirrors IdemAuthService::verifySession.
 */
export async function verifySession(sessionCookie: string | undefined): Promise<IdemProfile | null> {
  if (!sessionCookie) return null;
  try {
    const { data, status } = await axios.get(`${IDEM_API_URL}/auth/profile`, {
      headers: { Cookie: `session=${sessionCookie}`, Accept: 'application/json' },
      timeout: 10000,
      validateStatus: () => true,
    });
    if (status >= 200 && status < 300 && data?.uid && data?.email) {
      return {
        uid: String(data.uid),
        email: String(data.email),
        displayName: data.displayName ?? null,
        photoURL: data.photoURL ?? null,
      };
    }
    return null;
  } catch (err) {
    logger.error('[IDEM Auth] Error verifying session with central API', {
      message: (err as Error).message,
      apiUrl: IDEM_API_URL,
    });
    return null;
  }
}

/**
 * Find-or-create the local user from a verified profile. Mirrors
 * IdemAuthService::syncUser (match by idem_uid, else link by email, else create;
 * password stays null because auth is delegated).
 */
export async function syncUser(profile: IdemProfile): Promise<SyncedUser> {
  const name = profile.displayName || profile.email.split('@')[0];

  // 1. By idem_uid
  const byUid = await pool.query(
    'SELECT id, idem_uid, email, name FROM users WHERE idem_uid = $1 LIMIT 1',
    [profile.uid]
  );
  if (byUid.rows[0]) {
    await pool.query(
      `UPDATE users SET name = $1, email = $2, photo_url = $3,
         email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE id = $4`,
      [name, profile.email, profile.photoURL ?? null, byUid.rows[0].id]
    );
    return { id: Number(byUid.rows[0].id), idem_uid: profile.uid, email: profile.email, name };
  }

  // 2. By email → link idem_uid
  const byEmail = await pool.query(
    'SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [profile.email]
  );
  if (byEmail.rows[0]) {
    await pool.query(
      `UPDATE users SET idem_uid = $1, name = $2, photo_url = $3,
         email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE id = $4`,
      [profile.uid, name, profile.photoURL ?? null, byEmail.rows[0].id]
    );
    logger.info('[IDEM Auth] Existing user linked to IDEM', { userId: byEmail.rows[0].id, uid: profile.uid });
    return { id: Number(byEmail.rows[0].id), idem_uid: profile.uid, email: profile.email, name };
  }

  // 3. Create
  const created = await pool.query(
    `INSERT INTO users (idem_uid, name, email, photo_url, email_verified_at, password, created_at, updated_at)
     VALUES ($1,$2,$3,$4, now(), NULL, now(), now()) RETURNING id`,
    [profile.uid, name, profile.email, profile.photoURL ?? null]
  );
  logger.info('[IDEM Auth] New user created from API', { userId: created.rows[0].id, uid: profile.uid });
  return { id: Number(created.rows[0].id), idem_uid: profile.uid, email: profile.email, name };
}
