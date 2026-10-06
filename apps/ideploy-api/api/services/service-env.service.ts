/**
 * The environment variables of a service (docker-compose stack), stored in
 * `environment_variables` against the service and written to the stack's
 * `.env` before every start (service.service.ts).
 */
import { randomUUID } from 'node:crypto';
import pool from '../config/db.config';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';
import { notFound, unprocessable } from '../utils/errors';

const SERVICE_MODEL = 'App\\Models\\Service';
const VALID_KEY = /^[A-Za-z_][A-Za-z0-9_]{0,254}$/;

export interface ServiceEnvVar {
  key: string;
  value: string;
}

/** Variables by service id (no team check — callers have one). */
export async function listByServiceId(serviceId: number): Promise<ServiceEnvVar[]> {
  const { rows } = await pool.query(
    `SELECT key, value FROM environment_variables
     WHERE resourceable_type = $1 AND resourceable_id = $2 ORDER BY key`,
    [SERVICE_MODEL, serviceId]
  );
  return rows.map((r) => ({ key: String(r.key), value: tryDecryptString((r.value as string) ?? null) ?? '' }));
}

async function serviceIdOf(teamId: number, uuid: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT s.id FROM services s JOIN environments e ON e.id = s.environment_id JOIN projects p ON p.id = e.project_id
     WHERE s.uuid = $1 AND p.team_id = $2 LIMIT 1`,
    [uuid, teamId]
  );
  if (!rows[0]) throw notFound('Service');
  return Number(rows[0].id);
}

export async function listForService(teamId: number, uuid: string): Promise<ServiceEnvVar[]> {
  return listByServiceId(await serviceIdOf(teamId, uuid));
}

/** Replace the whole set: what the editor shows is what is stored. */
export async function replaceForServiceId(serviceId: number, vars: ServiceEnvVar[]): Promise<ServiceEnvVar[]> {
  const seen = new Set<string>();
  for (const v of vars) {
    if (!VALID_KEY.test(v.key)) {
      throw unprocessable('INVALID_VARIABLE_NAME', `"${v.key}" is not a valid variable name (letters, digits and _, not starting with a digit).`);
    }
    if (seen.has(v.key)) throw unprocessable('DUPLICATE_VARIABLE', `"${v.key}" is defined twice.`);
    seen.add(v.key);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM environment_variables WHERE resourceable_type = $1 AND resourceable_id = $2', [
      SERVICE_MODEL,
      serviceId,
    ]);
    for (const [index, v] of vars.entries()) {
      await client.query(
        `INSERT INTO environment_variables
           (uuid, key, value, resourceable_type, resourceable_id, is_runtime, is_buildtime, "order", created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, false, $6, now(), now())`,
        [randomUUID(), v.key, encryptString(v.value), SERVICE_MODEL, serviceId, index]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return listByServiceId(serviceId);
}

export async function replaceForService(teamId: number, uuid: string, vars: ServiceEnvVar[]): Promise<ServiceEnvVar[]> {
  return replaceForServiceId(await serviceIdOf(teamId, uuid), vars);
}
