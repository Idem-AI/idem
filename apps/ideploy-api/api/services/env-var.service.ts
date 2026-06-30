/**
 * Environment variable domain service for applications.
 *
 * The `environment_variables` table has churned across Coolify versions
 * (legacy `application_id` + modern polymorphic `resourceable_type/id`, plus
 * is_build_time / is_buildtime / is_runtime / is_preview flags). To stay robust
 * on the shared live schema we introspect the real columns once and only write
 * the ones that exist. `value` is a Laravel `encrypted` cast → encrypted at rest.
 */
import pool from '../config/db.config';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';
import * as appService from './application.service';

const APP_MODEL = 'App\\Models\\Application';

let columnCache: Set<string> | null = null;

async function envColumns(): Promise<Set<string>> {
  if (columnCache) return columnCache;
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'environment_variables'`
  );
  columnCache = new Set(rows.map((r) => String(r.column_name)));
  return columnCache;
}

export interface EnvVarView {
  id: number;
  key: string;
  value: string | null;
  is_runtime: boolean;
  is_buildtime: boolean;
  is_preview: boolean;
}

function mapRow(r: Record<string, unknown>): EnvVarView {
  return {
    id: Number(r.id),
    key: String(r.key),
    value: tryDecryptString((r.value as string) ?? null),
    is_runtime: r.is_runtime === undefined ? true : Boolean(r.is_runtime),
    is_buildtime: Boolean(r.is_buildtime ?? r.is_build_time ?? false),
    is_preview: Boolean(r.is_preview),
  };
}

/** All env vars for an application (team-scoped via the application). */
export async function listForApplication(teamId: number, appUuid: string): Promise<EnvVarView[]> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw new Error('Application not found');
  const cols = await envColumns();

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (cols.has('resourceable_type') && cols.has('resourceable_id')) {
    params.push(APP_MODEL, app.id);
    conditions.push(`(resourceable_type = $${params.length - 1} AND resourceable_id = $${params.length})`);
  }
  if (cols.has('application_id')) {
    params.push(app.id);
    conditions.push(`application_id = $${params.length}`);
  }
  const where = conditions.length ? conditions.join(' OR ') : '1=0';

  const { rows } = await pool.query(
    `SELECT * FROM environment_variables WHERE ${where} ORDER BY key`,
    params
  );
  // Dedup by key (resourceable + legacy may overlap).
  const seen = new Set<string>();
  const out: EnvVarView[] = [];
  for (const r of rows.map(mapRow)) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    out.push(r);
  }
  return out;
}

export interface UpsertEnvVarDto {
  key: string;
  value: string;
  is_runtime?: boolean;
  is_buildtime?: boolean;
  is_preview?: boolean;
}

export async function upsertForApplication(
  teamId: number,
  appUuid: string,
  dto: UpsertEnvVarDto
): Promise<EnvVarView> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw new Error('Application not found');
  const cols = await envColumns();

  // Build a column→value map limited to columns that actually exist.
  const values: Record<string, unknown> = {
    key: dto.key,
    value: encryptString(dto.value),
  };
  if (cols.has('resourceable_type')) values.resourceable_type = APP_MODEL;
  if (cols.has('resourceable_id')) values.resourceable_id = app.id;
  if (cols.has('application_id')) values.application_id = app.id;
  if (cols.has('is_runtime')) values.is_runtime = dto.is_runtime ?? true;
  if (cols.has('is_buildtime')) values.is_buildtime = dto.is_buildtime ?? true;
  if (cols.has('is_build_time')) values.is_build_time = dto.is_buildtime ?? false;
  if (cols.has('is_preview')) values.is_preview = dto.is_preview ?? false;

  // Upsert by (application, key): delete existing then insert (simplest robust path).
  if (cols.has('resourceable_id')) {
    await pool.query(
      `DELETE FROM environment_variables WHERE key = $1 AND resourceable_type = $2 AND resourceable_id = $3`,
      [dto.key, APP_MODEL, app.id]
    );
  } else if (cols.has('application_id')) {
    await pool.query(`DELETE FROM environment_variables WHERE key = $1 AND application_id = $2`, [
      dto.key,
      app.id,
    ]);
  }

  const colNames = [...Object.keys(values)];
  if (cols.has('created_at')) colNames.push('created_at');
  if (cols.has('updated_at')) colNames.push('updated_at');
  const colParams = Object.values(values);
  const placeholders = colParams.map((_, i) => `$${i + 1}`);
  if (cols.has('created_at')) placeholders.push('now()');
  if (cols.has('updated_at')) placeholders.push('now()');

  const { rows } = await pool.query(
    `INSERT INTO environment_variables (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    colParams
  );
  return mapRow(rows[0]);
}

export async function deleteForApplication(
  teamId: number,
  appUuid: string,
  key: string
): Promise<boolean> {
  const app = await appService.getApplication(teamId, appUuid);
  if (!app) throw new Error('Application not found');
  const cols = await envColumns();
  if (cols.has('resourceable_id')) {
    const { rowCount } = await pool.query(
      `DELETE FROM environment_variables WHERE key = $1 AND resourceable_type = $2 AND resourceable_id = $3`,
      [key, APP_MODEL, app.id]
    );
    return (rowCount ?? 0) > 0;
  }
  const { rowCount } = await pool.query(
    `DELETE FROM environment_variables WHERE key = $1 AND application_id = $2`,
    [key, app.id]
  );
  return (rowCount ?? 0) > 0;
}
