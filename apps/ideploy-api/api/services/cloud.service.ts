/**
 * Cloud credentials domain service — cloud provider tokens + cloud-init
 * scripts. Both store an `encrypted` column (Laravel cast), so the secret is
 * encrypted at rest and never returned over the API.
 */
import pool from '../config/db.config';
import { encryptString, decryptString } from '../utils/laravel-crypto';
import { CloudProviderTokenRow, CloudInitScriptRow } from '../models/ideploy.types';

// ── Cloud provider tokens ─────────────────────────────────

export interface CloudTokenView {
  id: number;
  provider: string;
  name: string | null;
}

export async function listTokens(teamId: number): Promise<CloudTokenView[]> {
  const { rows } = await pool.query(
    'SELECT id, provider, name FROM cloud_provider_tokens WHERE team_id = $1 ORDER BY provider, name',
    [teamId]
  );
  return rows.map((r) => ({ id: Number(r.id), provider: String(r.provider), name: (r.name as string) ?? null }));
}

export async function createToken(
  teamId: number,
  dto: { provider: string; token: string; name?: string }
): Promise<CloudTokenView> {
  const { rows } = await pool.query(
    `INSERT INTO cloud_provider_tokens (team_id, provider, token, name, created_at, updated_at)
     VALUES ($1,$2,$3,$4, now(), now()) RETURNING id, provider, name`,
    [teamId, dto.provider, encryptString(dto.token), dto.name ?? null]
  );
  return { id: Number(rows[0].id), provider: String(rows[0].provider), name: (rows[0].name as string) ?? null };
}

export async function deleteToken(teamId: number, id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM cloud_provider_tokens WHERE team_id = $1 AND id = $2',
    [teamId, id]
  );
  return (rowCount ?? 0) > 0;
}

/** Decrypt a token for internal use (e.g. Hetzner provisioning). */
export async function getDecryptedToken(teamId: number, id: number): Promise<string | null> {
  const { rows } = await pool.query(
    'SELECT token FROM cloud_provider_tokens WHERE team_id = $1 AND id = $2 LIMIT 1',
    [teamId, id]
  );
  if (!rows[0]) return null;
  return decryptString(String((rows[0] as CloudProviderTokenRow).token));
}

// ── Cloud-init scripts ────────────────────────────────────

export interface CloudInitView {
  id: number;
  name: string;
}

export async function listInitScripts(teamId: number): Promise<CloudInitView[]> {
  const { rows } = await pool.query(
    'SELECT id, name FROM cloud_init_scripts WHERE team_id = $1 ORDER BY name',
    [teamId]
  );
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}

export async function createInitScript(
  teamId: number,
  dto: { name: string; script: string }
): Promise<CloudInitView> {
  const { rows } = await pool.query(
    `INSERT INTO cloud_init_scripts (team_id, name, script, created_at, updated_at)
     VALUES ($1,$2,$3, now(), now()) RETURNING id, name`,
    [teamId, dto.name, encryptString(dto.script)]
  );
  return { id: Number(rows[0].id), name: String(rows[0].name) };
}

export async function getInitScript(teamId: number, id: number): Promise<string | null> {
  const { rows } = await pool.query(
    'SELECT script FROM cloud_init_scripts WHERE team_id = $1 AND id = $2 LIMIT 1',
    [teamId, id]
  );
  if (!rows[0]) return null;
  return decryptString(String((rows[0] as CloudInitScriptRow).script));
}

export async function deleteInitScript(teamId: number, id: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM cloud_init_scripts WHERE team_id = $1 AND id = $2',
    [teamId, id]
  );
  return (rowCount ?? 0) > 0;
}
