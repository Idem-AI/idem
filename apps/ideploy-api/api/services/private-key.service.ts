/**
 * Private key (SSH key) domain service. Team-scoped.
 *
 * The `private_key` column is Laravel-`encrypted`, so we encrypt on write and
 * never expose the decrypted key over the API — only public metadata and, on
 * request, the derived *public* key.
 *
 * Keys can be supplied (paste an existing PEM) or generated here. Either way we
 * verify the material is a usable private key before storing it: an unusable key
 * accepted at this boundary resurfaces much later as an opaque SSH failure
 * during a deployment.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import { PrivateKeyRow } from '../models/ideploy.types';
import { encryptString, decryptString } from '../utils/laravel-crypto';
import { conflict, notFound, unprocessable } from '../utils/errors';
import {
  SshKeyType,
  computeFingerprint,
  derivePublicKey,
  generateKeyPair,
  isUsablePrivateKey,
} from '../ssh/keygen';

/** Safe (decrypted-key-free) view of a private key. */
export interface PrivateKeyView {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  is_git_related: boolean;
  fingerprint: string | null;
}

/** A freshly generated key, plus the public half the user must install. */
export interface GeneratedPrivateKeyView extends PrivateKeyView {
  /** `authorized_keys` line to add on the target server. */
  public_key: string;
  type: SshKeyType;
}

function toView(r: Record<string, unknown>): PrivateKeyView {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    is_git_related: Boolean(r.is_git_related),
    fingerprint: (r.fingerprint as string) ?? null,
  };
}

const VIEW_COLUMNS = 'id, uuid, name, description, is_git_related, fingerprint';

export async function listPrivateKeys(teamId: number): Promise<PrivateKeyView[]> {
  const { rows } = await pool.query(
    `SELECT ${VIEW_COLUMNS} FROM private_keys WHERE team_id = $1 ORDER BY name`,
    [teamId]
  );
  return rows.map(toView);
}

export async function getPrivateKeyView(
  teamId: number,
  uuid: string
): Promise<PrivateKeyView | null> {
  const { rows } = await pool.query(
    `SELECT ${VIEW_COLUMNS} FROM private_keys WHERE team_id = $1 AND uuid = $2 LIMIT 1`,
    [teamId, uuid]
  );
  return rows[0] ? toView(rows[0]) : null;
}

/**
 * Is this key already registered for the team?
 *
 * Mirrors Laravel's `fingerprintExists`, which scopes by team: the same key may
 * legitimately be registered by two different customers.
 */
async function fingerprintExists(teamId: number, fingerprint: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM private_keys WHERE team_id = $1 AND fingerprint = $2 LIMIT 1',
    [teamId, fingerprint]
  );
  return rows.length > 0;
}

export interface CreatePrivateKeyDto {
  name: string;
  description?: string;
  private_key: string; // raw PEM — encrypted before storage
  is_git_related?: boolean;
}

/** Insert a key that has already been validated and fingerprinted. */
async function insertKey(
  teamId: number,
  params: {
    name: string;
    description?: string | null;
    privateKey: string;
    fingerprint: string | null;
    isGitRelated: boolean;
  }
): Promise<PrivateKeyView> {
  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO private_keys
       (uuid, name, description, private_key, fingerprint, is_git_related, team_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now())
     RETURNING ${VIEW_COLUMNS}`,
    [
      uuid,
      params.name,
      params.description ?? null,
      encryptString(params.privateKey),
      params.fingerprint,
      params.isGitRelated,
      teamId,
    ]
  );
  return toView(rows[0]);
}

/**
 * Register an existing private key.
 *
 * Rejects material that is not a usable private key — most often a *public* key
 * pasted into the wrong field.
 */
export async function createPrivateKey(
  teamId: number,
  dto: CreatePrivateKeyDto
): Promise<PrivateKeyView> {
  const privateKey = dto.private_key.trim();

  if (!(await isUsablePrivateKey(privateKey))) {
    throw unprocessable(
      'INVALID_PRIVATE_KEY',
      'This is not a usable SSH private key. Paste the full private key file, ' +
        'not the public key (the one ending in .pub).'
    );
  }

  const fingerprint = await computeFingerprint(privateKey);
  if (fingerprint && (await fingerprintExists(teamId, fingerprint))) {
    throw conflict('DUPLICATE_PRIVATE_KEY', 'This key is already registered for your team.');
  }

  return insertKey(teamId, {
    name: dto.name,
    description: dto.description,
    privateKey,
    fingerprint,
    isGitRelated: dto.is_git_related ?? false,
  });
}

export interface GeneratePrivateKeyDto {
  name: string;
  description?: string;
  type?: SshKeyType;
  is_git_related?: boolean;
}

/**
 * Generate a new key pair and store the private half.
 *
 * Returns the public key so the UI can show it once for installation on the
 * server. It is not stored: the private key is the single source of truth and
 * the public half is derived on demand (see `getPublicKeyFor`).
 */
export async function generatePrivateKey(
  teamId: number,
  dto: GeneratePrivateKeyDto
): Promise<GeneratedPrivateKeyView> {
  const type = dto.type ?? 'ed25519';
  const pair = await generateKeyPair(type);

  // A freshly generated key colliding is effectively impossible, but the check
  // costs nothing and keeps the invariant "one fingerprint per team" true.
  if (await fingerprintExists(teamId, pair.fingerprint)) {
    throw conflict('DUPLICATE_PRIVATE_KEY', 'This key is already registered for your team.');
  }

  const view = await insertKey(teamId, {
    name: dto.name,
    description: dto.description,
    privateKey: pair.privateKey,
    fingerprint: pair.fingerprint,
    isGitRelated: dto.is_git_related ?? false,
  });

  return { ...view, public_key: pair.publicKey, type };
}

/**
 * The `authorized_keys` line for a stored key, so the user can install it on a
 * server after the fact.
 */
export async function getPublicKeyFor(teamId: number, uuid: string): Promise<string> {
  const row = await getPrivateKeyByUuid(teamId, uuid);
  if (!row) throw notFound('Private key');

  try {
    return await derivePublicKey(decryptString(row.private_key));
  } catch {
    throw unprocessable(
      'UNREADABLE_PRIVATE_KEY',
      'The stored key could not be read. It may have been saved with a different encryption key.'
    );
  }
}

export async function deletePrivateKey(teamId: number, uuid: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM private_keys WHERE team_id = $1 AND uuid = $2', [
    teamId,
    uuid,
  ]);
  return (rowCount ?? 0) > 0;
}

/** Full row incl. encrypted key — internal use only (e.g. SSH engine). */
export async function getPrivateKeyByUuid(
  teamId: number,
  uuid: string
): Promise<PrivateKeyRow | null> {
  const { rows } = await pool.query(
    'SELECT * FROM private_keys WHERE team_id = $1 AND uuid = $2 LIMIT 1',
    [teamId, uuid]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    private_key: String(r.private_key),
    is_git_related: Boolean(r.is_git_related),
    team_id: Number(r.team_id),
  };
}
