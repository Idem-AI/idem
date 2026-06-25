/**
 * Private key (SSH key) domain service. Team-scoped.
 * The `private_key` column is Laravel-`encrypted`, so we encrypt on write and
 * never expose the decrypted key over the API (only the public metadata).
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import { PrivateKeyRow } from '../models/ideploy.types';
import { encryptString } from '../utils/laravel-crypto';

/** Safe (decrypted-key-free) view of a private key. */
export interface PrivateKeyView {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  is_git_related: boolean;
}

function toView(r: Record<string, unknown>): PrivateKeyView {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    is_git_related: Boolean(r.is_git_related),
  };
}

export async function listPrivateKeys(teamId: number): Promise<PrivateKeyView[]> {
  const { rows } = await pool.query(
    'SELECT id, uuid, name, description, is_git_related FROM private_keys WHERE team_id = $1 ORDER BY name',
    [teamId]
  );
  return rows.map(toView);
}

export async function getPrivateKeyView(teamId: number, uuid: string): Promise<PrivateKeyView | null> {
  const { rows } = await pool.query(
    'SELECT id, uuid, name, description, is_git_related FROM private_keys WHERE team_id = $1 AND uuid = $2 LIMIT 1',
    [teamId, uuid]
  );
  return rows[0] ? toView(rows[0]) : null;
}

export interface CreatePrivateKeyDto {
  name: string;
  description?: string;
  private_key: string; // raw PEM — encrypted before storage
  is_git_related?: boolean;
}

export async function createPrivateKey(
  teamId: number,
  dto: CreatePrivateKeyDto
): Promise<PrivateKeyView> {
  const uuid = randomUUID();
  const encrypted = encryptString(dto.private_key.trim());
  const { rows } = await pool.query(
    `INSERT INTO private_keys (uuid, name, description, private_key, is_git_related, team_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now(), now())
     RETURNING id, uuid, name, description, is_git_related`,
    [uuid, dto.name, dto.description ?? null, encrypted, dto.is_git_related ?? false, teamId]
  );
  return toView(rows[0]);
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
