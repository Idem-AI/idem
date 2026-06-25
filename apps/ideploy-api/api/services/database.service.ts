/**
 * Standalone database domain service — covers all 8 Coolify DB types via the
 * registry in database-types.ts. CRUD + lifecycle (start/stop/restart) over
 * SSH. Credential columns are encrypted per the registry's rules.
 */
import { randomUUID, randomBytes } from 'crypto';
import pool from '../config/db.config';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';
import { DatabaseRow } from '../models/ideploy.types';
import { DB_TYPES, DbType, getDbType } from './database-types';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';

const STANDALONE_DOCKER_MODEL = 'App\\Models\\StandaloneDocker';

function genSecret(): string {
  return randomBytes(16).toString('base64url');
}

function mapRow(type: string, r: Record<string, unknown>): DatabaseRow {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    type,
    image: String(r.image),
    status: (r.status as string) ?? null,
    is_public: Boolean(r.is_public),
    public_port: r.public_port ? Number(r.public_port) : null,
    environment_id: r.environment_id ? Number(r.environment_id) : null,
    destination_id: r.destination_id ? Number(r.destination_id) : null,
    destination_type: (r.destination_type as string) ?? null,
  };
}

/** List databases of every type for the team (joined via environment→project). */
export async function listDatabases(teamId: number, environmentId?: number): Promise<DatabaseRow[]> {
  const all: DatabaseRow[] = [];
  for (const type of Object.values(DB_TYPES)) {
    const params: unknown[] = [teamId];
    let sql = `SELECT d.* FROM ${type.table} d
       JOIN environments e ON e.id = d.environment_id
       JOIN projects p ON p.id = e.project_id
       WHERE p.team_id = $1`;
    if (environmentId) {
      params.push(environmentId);
      sql += ` AND d.environment_id = $2`;
    }
    try {
      const { rows } = await pool.query(sql, params);
      all.push(...rows.map((r) => mapRow(type.key, r)));
    } catch {
      // Table may not exist on older schemas — skip.
    }
  }
  return all;
}

export async function getDatabase(
  teamId: number,
  type: string,
  uuid: string
): Promise<DatabaseRow | null> {
  const t = getDbType(type);
  if (!t) return null;
  const { rows } = await pool.query(
    `SELECT d.* FROM ${t.table} d
     JOIN environments e ON e.id = d.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND d.uuid = $2 LIMIT 1`,
    [teamId, uuid]
  );
  return rows[0] ? mapRow(type, rows[0]) : null;
}

export interface CreateDatabaseDto {
  name: string;
  environment_id: number;
  destination_id: number; // StandaloneDocker id
  image?: string;
  /** Optional explicit credential overrides keyed by column name. */
  credentials?: Record<string, string>;
}

async function assertEnvironmentInTeam(teamId: number, environmentId: number): Promise<void> {
  const { rows } = await pool.query(
    `SELECT e.id FROM environments e JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND e.id = $2 LIMIT 1`,
    [teamId, environmentId]
  );
  if (!rows[0]) throw new Error('Environment not found in current team');
}

export async function createDatabase(
  teamId: number,
  type: string,
  dto: CreateDatabaseDto
): Promise<DatabaseRow> {
  const t = getDbType(type);
  if (!t) throw new Error(`Unknown database type: ${type}`);
  await assertEnvironmentInTeam(teamId, dto.environment_id);

  const uuid = randomUUID();
  const cols: string[] = ['uuid', 'name', 'image', 'status', 'environment_id', 'destination_id', 'destination_type'];
  const vals: unknown[] = [
    uuid,
    dto.name,
    dto.image || t.image,
    'exited',
    dto.environment_id,
    dto.destination_id,
    STANDALONE_DOCKER_MODEL,
  ];

  for (const f of t.fields) {
    const raw = dto.credentials?.[f.col] ?? f.default ?? (f.generate ? genSecret() : '');
    cols.push(f.col);
    vals.push(f.encrypted ? encryptString(raw) : raw);
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO ${t.table} (${cols.join(', ')}, created_at, updated_at)
     VALUES (${placeholders.join(', ')}, now(), now()) RETURNING *`,
    vals
  );
  return mapRow(type, rows[0]);
}

export async function deleteDatabase(teamId: number, type: string, uuid: string): Promise<boolean> {
  const t = getDbType(type);
  if (!t) return false;
  // Ensure ownership first.
  const db = await getDatabase(teamId, type, uuid);
  if (!db) return false;
  await pool.query(`DELETE FROM ${t.table} WHERE id = $1`, [db.id]);
  return true;
}

/** Decrypt credentials of a database row for container env injection. */
async function loadCredentials(t: DbType, uuid: string): Promise<Record<string, string>> {
  const { rows } = await pool.query(`SELECT * FROM ${t.table} WHERE uuid = $1 LIMIT 1`, [uuid]);
  const row = rows[0];
  const creds: Record<string, string> = {};
  for (const f of t.fields) {
    const stored = row[f.col] as string | null;
    creds[f.col] = f.encrypted ? (tryDecryptString(stored) ?? '') : String(stored ?? '');
  }
  return creds;
}

async function resolveServer(
  teamId: number,
  destinationId: number
): Promise<{ server: Awaited<ReturnType<typeof serverService.getServerById>>; key: Awaited<ReturnType<typeof serverService.getPrivateKey>> }> {
  const { rows } = await pool.query('SELECT server_id FROM standalone_dockers WHERE id = $1 LIMIT 1', [
    destinationId,
  ]);
  if (!rows[0]) throw new Error('Destination not found');
  const server = await serverService.getServerById(teamId, Number(rows[0].server_id));
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found');
  return { server, key };
}

export async function setStatus(t: DbType, uuid: string, status: string): Promise<void> {
  await pool.query(`UPDATE ${t.table} SET status = $1, updated_at = now() WHERE uuid = $2`, [
    status,
    uuid,
  ]);
}

export async function lifecycle(
  teamId: number,
  type: string,
  uuid: string,
  action: 'start' | 'stop' | 'restart'
): Promise<{ success: boolean; output: string }> {
  const t = getDbType(type);
  if (!t) throw new Error(`Unknown database type: ${type}`);
  const db = await getDatabase(teamId, type, uuid);
  if (!db) throw new Error('Database not found');
  if (!db.destination_id) throw new Error('Database has no destination');

  const { server, key } = await resolveServer(teamId, db.destination_id);
  const containerName = `${type}-${uuid}`;

  let cmd: string;
  if (action === 'stop') {
    cmd = `docker rm -f ${containerName} 2>/dev/null; echo stopped`;
  } else if (action === 'restart') {
    cmd = `docker restart ${containerName}`;
  } else {
    const creds = await loadCredentials(t, uuid);
    const envFlags = t.fields
      .filter((f) => f.env)
      .map((f) => `-e ${f.env}=${JSON.stringify(creds[f.col])}`)
      .join(' ');
    const command = t.command?.(creds);
    cmd =
      `docker rm -f ${containerName} 2>/dev/null; ` +
      `docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy; ` +
      `docker run -d --name ${containerName} --restart unless-stopped --network ideploy ` +
      `--label ideploy.managed=true ${envFlags} ${db.image} ${command ?? ''}`;
  }

  const result = await executeRemoteCommand(server!, key!, cmd);
  if (result.exitCode === 0) {
    await setStatus(t, uuid, action === 'stop' ? 'exited' : 'running');
  }
  return { success: result.exitCode === 0, output: result.stdout + result.stderr };
}
