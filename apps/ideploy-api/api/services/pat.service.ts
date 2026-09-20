/**
 * Sanctum personal access token (PAT) verification — for public-API parity
 * with the Laravel app (`/api/v1/*` Bearer tokens). Tokens are stored as a
 * sha256 hex in `personal_access_tokens.token`; the client presents
 * `{id}|{plaintext}` (or, legacy, the raw hashed value).
 */
import crypto from 'crypto';
import pool from '../config/db.config';
import { AuthUser } from '../interfaces/express.interface';
import { unprocessable } from '../utils/errors';
import logger from '../config/logger';

export interface PatResult {
  user: AuthUser;
  abilities: string[];
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** The `tokenable` morph Laravel writes for a user-owned Sanctum token. */
const TOKENABLE_TYPE = 'App\\Models\\User';

export async function verifyPat(token: string): Promise<PatResult | null> {
  let row: Record<string, unknown> | undefined;

  if (token.includes('|')) {
    const [idPart, plain] = token.split('|', 2);
    const id = parseInt(idPart, 10);
    if (!id || !plain) return null;
    const { rows } = await pool.query('SELECT * FROM personal_access_tokens WHERE id = $1 LIMIT 1', [id]);
    const candidate = rows[0];
    if (candidate) {
      const expected = Buffer.from(String(candidate.token));
      const actual = Buffer.from(sha256(plain));
      if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
        row = candidate;
      }
    }
  } else {
    const { rows } = await pool.query(
      'SELECT * FROM personal_access_tokens WHERE token = $1 LIMIT 1',
      [sha256(token)]
    );
    row = rows[0];
  }

  if (!row) return null;
  if (row.expires_at && new Date(String(row.expires_at)).getTime() < Date.now()) return null;

  // tokenable is the user (App\Models\User)
  const userId = Number(row.tokenable_id);
  const { rows: urows } = await pool.query(
    'SELECT id, idem_uid, email, name FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );
  if (!urows[0]) return null;

  // Touch last_used_at (best-effort).
  await pool.query('UPDATE personal_access_tokens SET last_used_at = now() WHERE id = $1', [row.id]);

  let abilities: string[] = ['*'];
  try {
    abilities = row.abilities ? JSON.parse(String(row.abilities)) : ['*'];
  } catch {
    abilities = ['*'];
  }

  return {
    user: {
      id: Number(urows[0].id),
      idemUid: (urows[0].idem_uid as string) ?? null,
      email: String(urows[0].email),
      name: String(urows[0].name),
      currentTeamId: row.team_id ? Number(row.team_id) : null,
    },
    abilities,
  };
}

// ── Token management (list / issue / revoke) ──────────────────────────────
//
// Only the sha256 of a token is stored, so the plaintext exists exactly once:
// in the response to the request that created it. Nothing else in this module
// can return it, and `listTokens` deliberately never selects the `token`
// column — a leaked list of hashes is still a list worth not leaking.

export interface PatView {
  id: number;
  name: string;
  abilities: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
}

/** The abilities a token may be granted. `*` means every ability. */
const KNOWN_ABILITIES = ['*', 'read', 'write', 'deploy'] as const;

function mapView(r: Record<string, unknown>): PatView {
  let abilities: string[] = ['*'];
  try {
    abilities = r.abilities ? JSON.parse(String(r.abilities)) : ['*'];
  } catch {
    abilities = ['*'];
  }
  return {
    id: Number(r.id),
    name: String(r.name),
    abilities,
    lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    createdAt: r.created_at ? String(r.created_at) : null,
  };
}

/** A user's own tokens. Scoped by `tokenable_id`: tokens are personal. */
export async function listTokens(userId: number): Promise<PatView[]> {
  const { rows } = await pool.query(
    `SELECT id, name, abilities, last_used_at, expires_at, created_at
     FROM personal_access_tokens
     WHERE tokenable_type = $1 AND tokenable_id = $2
     ORDER BY created_at DESC NULLS LAST, id DESC`,
    [TOKENABLE_TYPE, userId]
  );
  return rows.map(mapView);
}

export interface IssuedToken {
  token: PatView;
  /**
   * `{id}|{plaintext}`, in the Sanctum format `verifyPat` accepts. Shown once
   * and never recoverable — the database holds only its hash.
   */
  plainTextToken: string;
}

/**
 * Issue a token for a user, in the format the Laravel app also accepts.
 *
 * `expiresInDays` is optional but recommended; a token with no expiry is valid
 * until it is revoked by hand.
 */
export async function createToken(
  user: { id: number; currentTeamId: number },
  dto: { name: string; abilities?: string[]; expiresInDays?: number }
): Promise<IssuedToken> {
  const name = dto.name.trim();
  if (!name) throw unprocessable('PAT_NAME_REQUIRED', 'A name is required.');

  const abilities = dto.abilities?.length ? dto.abilities : ['*'];
  const unknown = abilities.filter((a) => !KNOWN_ABILITIES.includes(a as (typeof KNOWN_ABILITIES)[number]));
  if (unknown.length) {
    throw unprocessable(
      'PAT_UNKNOWN_ABILITY',
      `Unknown ability: ${unknown.join(', ')}. Allowed: ${KNOWN_ABILITIES.join(', ')}.`
    );
  }

  if (dto.expiresInDays !== undefined && (dto.expiresInDays <= 0 || dto.expiresInDays > 3650)) {
    throw unprocessable('PAT_INVALID_EXPIRY', 'Expiry must be between 1 and 3650 days.');
  }

  // 40 bytes of CSPRNG output, matching Sanctum's token length.
  const plain = crypto.randomBytes(40).toString('hex');
  const expiresAt =
    dto.expiresInDays === undefined
      ? null
      : new Date(Date.now() + dto.expiresInDays * 86_400_000).toISOString();

  const { rows } = await pool.query(
    `INSERT INTO personal_access_tokens
       (tokenable_type, tokenable_id, name, token, team_id, abilities, expires_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
     RETURNING id, name, abilities, last_used_at, expires_at, created_at`,
    [
      TOKENABLE_TYPE,
      user.id,
      name,
      sha256(plain),
      String(user.currentTeamId),
      JSON.stringify(abilities),
      expiresAt,
    ]
  );

  const view = mapView(rows[0]);
  // The value itself is never logged — only that one was issued.
  logger.info('Personal access token issued', { userId: user.id, tokenId: view.id, abilities });

  return { token: view, plainTextToken: `${view.id}|${plain}` };
}

/**
 * Revoke a token.
 *
 * Scoped to the owner: a token id is a small integer, and without this check
 * any authenticated user could revoke anyone's token by guessing.
 *
 * @returns false when the token does not exist or is not this user's.
 */
export async function revokeToken(userId: number, tokenId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM personal_access_tokens WHERE id = $1 AND tokenable_type = $2 AND tokenable_id = $3',
    [tokenId, TOKENABLE_TYPE, userId]
  );
  const revoked = (rowCount ?? 0) > 0;
  if (revoked) logger.info('Personal access token revoked', { userId, tokenId });
  return revoked;
}
