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
 * Ensure the user belongs to at least one team. New SSO-synced users have no
 * team yet (Coolify creates a personal team on registration); without one,
 * every team-scoped action (project creation, etc.) is blocked. We create a
 * personal team + owner membership when the user has none.
 */
async function ensurePersonalTeam(userId: number, name: string): Promise<void> {
  const { rows } = await pool.query('SELECT 1 FROM team_user WHERE user_id = $1 LIMIT 1', [userId]);
  if (rows[0]) return;

  const teamName = `${name}'s Team`;
  const teamRes = await pool.query(
    `INSERT INTO teams (name, description, personal_team, created_at, updated_at)
     VALUES ($1, $2, true, now(), now()) RETURNING id`,
    [teamName, 'Personal team']
  );
  const teamId = Number(teamRes.rows[0].id);
  await pool.query(
    `INSERT INTO team_user (team_id, user_id, role, created_at, updated_at)
     VALUES ($1, $2, 'owner', now(), now())
     ON CONFLICT (team_id, user_id) DO NOTHING`,
    [teamId, userId]
  );
  logger.info('[IDEM Auth] Created personal team for user', { userId, teamId });
}

/**
 * Find-or-create the local user from a verified profile. Mirrors
 * IdemAuthService::syncUser (match by idem_uid, else link by email, else create;
 * password stays null because auth is delegated). Also guarantees the user has
 * a team so team-scoped features work.
 */
export async function syncUser(profile: IdemProfile): Promise<SyncedUser> {
  const name = profile.displayName || profile.email.split('@')[0];

  // 1. By idem_uid
  const byUid = await pool.query(
    'SELECT id, idem_uid, email, name FROM users WHERE idem_uid = $1 LIMIT 1',
    [profile.uid]
  );
  if (byUid.rows[0]) {
    const id = Number(byUid.rows[0].id);
    await pool.query(
      `UPDATE users SET name = $1, email = $2, photo_url = $3,
         email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE id = $4`,
      [name, profile.email, profile.photoURL ?? null, id]
    );
    await ensurePersonalTeam(id, name);
    return { id, idem_uid: profile.uid, email: profile.email, name };
  }

  // 2. By email → link idem_uid
  const byEmail = await pool.query(
    'SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [profile.email]
  );
  if (byEmail.rows[0]) {
    const id = Number(byEmail.rows[0].id);
    await pool.query(
      `UPDATE users SET idem_uid = $1, name = $2, photo_url = $3,
         email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE id = $4`,
      [profile.uid, name, profile.photoURL ?? null, id]
    );
    logger.info('[IDEM Auth] Existing user linked to IDEM', { userId: id, uid: profile.uid });
    await ensurePersonalTeam(id, name);
    return { id, idem_uid: profile.uid, email: profile.email, name };
  }

  // 3. Create
  const created = await pool.query(
    `INSERT INTO users (idem_uid, name, email, photo_url, email_verified_at, password, created_at, updated_at)
     VALUES ($1,$2,$3,$4, now(), NULL, now(), now()) RETURNING id`,
    [profile.uid, name, profile.email, profile.photoURL ?? null]
  );
  const id = Number(created.rows[0].id);
  logger.info('[IDEM Auth] New user created from API', { userId: id, uid: profile.uid });
  await ensurePersonalTeam(id, name);
  return { id, idem_uid: profile.uid, email: profile.email, name };
}
