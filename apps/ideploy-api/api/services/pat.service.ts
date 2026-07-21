/**
 * Sanctum personal access token (PAT) verification — for public-API parity
 * with the Laravel app (`/api/v1/*` Bearer tokens). Tokens are stored as a
 * sha256 hex in `personal_access_tokens.token`; the client presents
 * `{id}|{plaintext}` (or, legacy, the raw hashed value).
 */
import crypto from 'crypto';
import pool from '../config/db.config';
import { AuthUser } from '../interfaces/express.interface';

export interface PatResult {
  user: AuthUser;
  abilities: string[];
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

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
