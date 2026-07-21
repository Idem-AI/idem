/**
 * Shared environment variables — defined at team / project / environment level
 * and reusable across resources. Ports Coolify's SharedEnvironmentVariable.
 * `value` is Laravel-`encrypted`.
 */
import pool from '../config/db.config';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';

export type SharedScope = 'team' | 'project' | 'environment';

export interface SharedEnvVar {
  id: number;
  key: string;
  value: string | null;
  scope: SharedScope;
  scopeId: number;
}

function scopeColumn(scope: SharedScope): string {
  return scope === 'team' ? 'team_id' : scope === 'project' ? 'project_id' : 'environment_id';
}

function mapRow(scope: SharedScope, scopeId: number, r: Record<string, unknown>): SharedEnvVar {
  return {
    id: Number(r.id),
    key: String(r.key),
    value: tryDecryptString((r.value as string) ?? null),
    scope,
    scopeId,
  };
}

/** Verify the caller's team owns the given scope target. */
async function assertScopeOwnership(teamId: number, scope: SharedScope, scopeId: number): Promise<void> {
  if (scope === 'team') {
    if (scopeId !== teamId) throw new Error('Forbidden scope');
    return;
  }
  if (scope === 'project') {
    const { rows } = await pool.query('SELECT 1 FROM projects WHERE id = $1 AND team_id = $2', [scopeId, teamId]);
    if (!rows[0]) throw new Error('Project not in team');
    return;
  }
  const { rows } = await pool.query(
    `SELECT 1 FROM environments e JOIN projects p ON p.id = e.project_id WHERE e.id = $1 AND p.team_id = $2`,
    [scopeId, teamId]
  );
  if (!rows[0]) throw new Error('Environment not in team');
}

export async function list(teamId: number, scope: SharedScope, scopeId: number): Promise<SharedEnvVar[]> {
  await assertScopeOwnership(teamId, scope, scopeId);
  const col = scopeColumn(scope);
  const { rows } = await pool.query(
    `SELECT id, key, value FROM shared_environment_variables WHERE ${col} = $1 ORDER BY key`,
    [scopeId]
  );
  return rows.map((r) => mapRow(scope, scopeId, r));
}

export async function upsert(
  teamId: number,
  scope: SharedScope,
  scopeId: number,
  dto: { key: string; value: string }
): Promise<SharedEnvVar> {
  await assertScopeOwnership(teamId, scope, scopeId);
  const col = scopeColumn(scope);
  await pool.query(`DELETE FROM shared_environment_variables WHERE ${col} = $1 AND key = $2`, [scopeId, dto.key]);
  const { rows } = await pool.query(
    `INSERT INTO shared_environment_variables (key, value, is_shared, ${col}, created_at, updated_at)
     VALUES ($1, $2, true, $3, now(), now()) RETURNING id, key, value`,
    [dto.key, encryptString(dto.value), scopeId]
  );
  return mapRow(scope, scopeId, rows[0]);
}

export async function remove(
  teamId: number,
  scope: SharedScope,
  scopeId: number,
  key: string
): Promise<boolean> {
  await assertScopeOwnership(teamId, scope, scopeId);
  const col = scopeColumn(scope);
  const { rowCount } = await pool.query(
    `DELETE FROM shared_environment_variables WHERE ${col} = $1 AND key = $2`,
    [scopeId, key]
  );
  return (rowCount ?? 0) > 0;
}
