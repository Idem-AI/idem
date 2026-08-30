/**
 * Standalone database domain service — covers all 8 Coolify DB types via the
 * registry in database-types.ts. CRUD + lifecycle (start/stop/restart) over
 * SSH. Credential columns are encrypted per the registry's rules.
 */
import { randomUUID, randomBytes } from 'crypto';
import pool from '../config/db.config';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';
import { DatabaseRow } from '../models/ideploy.types';
import { DB_TYPES, DbField, DbType, getDbType } from './database-types';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';

const STANDALONE_DOCKER_MODEL = 'App\\Models\\StandaloneDocker';

function genSecret(): string {
  return randomBytes(16).toString('base64url');
}

/** Read a `viaEnvVar` field's real value out of the polymorphic `environment_variables` table. */
async function loadEnvVarValue(model: string, resourceId: number, key: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT value FROM environment_variables WHERE resourceable_type = $1 AND resourceable_id = $2 AND key = $3 LIMIT 1`,
    [model, resourceId, key]
  );
  return rows[0] ? tryDecryptString(rows[0].value as string | null) : null;
}

/** Write a `viaEnvVar` field's value — updates the existing row if one exists, otherwise creates it. */
async function upsertEnvVarValue(model: string, resourceId: number, key: string, value: string): Promise<void> {
  const encrypted = encryptString(value);
  const { rowCount } = await pool.query(
    `UPDATE environment_variables SET value = $1, updated_at = now()
     WHERE resourceable_type = $2 AND resourceable_id = $3 AND key = $4`,
    [encrypted, model, resourceId, key]
  );
  if (rowCount === 0) {
    await pool.query(
      `INSERT INTO environment_variables
         (uuid, key, value, resourceable_type, resourceable_id, is_runtime, is_buildtime, is_literal, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, false, true, now(), now())`,
      [randomUUID(), key, encrypted, model, resourceId]
    );
  }
}

/** Same name `lifecycle()` gives the container — the DNS name other resources on the `ideploy` network reach it by. */
export function containerNameFor(type: string, uuid: string): string {
  return `${type}-${uuid}`;
}

/**
 * A ready-to-paste connection string per engine. Redis-family engines have no
 * username (just `--requirepass`); every other engine's URL scheme and creds
 * come straight from that type's own field list in `database-types.ts`.
 */
function buildConnectionUrl(type: string, creds: Record<string, string>, host: string, port: number): string | null {
  switch (type) {
    case 'postgresql':
      return `postgres://${creds.postgres_user}:${creds.postgres_password}@${host}:${port}/${creds.postgres_db}`;
    case 'mysql':
      return `mysql://${creds.mysql_user}:${creds.mysql_password}@${host}:${port}/${creds.mysql_database}`;
    case 'mariadb':
      return `mysql://${creds.mariadb_user}:${creds.mariadb_password}@${host}:${port}/${creds.mariadb_database}`;
    case 'mongodb':
      return `mongodb://${creds.mongo_initdb_root_username}:${creds.mongo_initdb_root_password}@${host}:${port}/${creds.mongo_initdb_database}?authSource=admin`;
    case 'redis':
    case 'keydb':
    case 'dragonfly':
      return `redis://:${creds[`${type}_password`]}@${host}:${port}`;
    case 'clickhouse':
      return `http://${creds.clickhouse_admin_user}:${creds.clickhouse_admin_password}@${host}:${port}`;
    default:
      return null;
  }
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
    project_id: r.project_id ? Number(r.project_id) : null,
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
  /** The Project this belongs to, resolved server-side — never client-chosen. */
  project_id?: number | null;
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
  const cols: string[] = [
    'uuid',
    'name',
    'image',
    'status',
    'environment_id',
    'destination_id',
    'destination_type',
    'project_id',
  ];
  const vals: unknown[] = [
    uuid,
    dto.name,
    dto.image || t.image,
    'exited',
    dto.environment_id,
    dto.destination_id,
    STANDALONE_DOCKER_MODEL,
    dto.project_id ?? null,
  ];

  // A `viaEnvVar` field has no column on this table to insert into — its
  // value is written to `environment_variables` once the row (and its id)
  // exists below.
  const envVarFields: { field: DbField; value: string }[] = [];
  for (const f of t.fields) {
    const raw = dto.credentials?.[f.col] ?? f.default ?? (f.generate ? genSecret() : '');
    if (f.viaEnvVar) {
      envVarFields.push({ field: f, value: raw });
      continue;
    }
    cols.push(f.col);
    vals.push(f.encrypted ? encryptString(raw) : raw);
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`);
  const { rows } = await pool.query(
    `INSERT INTO ${t.table} (${cols.join(', ')}, created_at, updated_at)
     VALUES (${placeholders.join(', ')}, now(), now()) RETURNING *`,
    vals
  );
  const created = mapRow(type, rows[0]);

  for (const { field, value } of envVarFields) {
    await upsertEnvVarValue(t.model, created.id, field.viaEnvVar!, value);
  }

  return created;
}

export async function deleteDatabase(teamId: number, type: string, uuid: string): Promise<boolean> {
  const t = getDbType(type);
  if (!t) return false;
  // Ensure ownership first.
  const db = await getDatabase(teamId, type, uuid);
  if (!db) return false;
  // Best-effort: tear down the container on the host before deleting the
  // record — confirmed live that without this, deleting a running database
  // only removed the row, leaving its real container behind on the server,
  // invisible to the app and running forever (the same fix `service.service.ts`'s
  // own `deleteService` already applies).
  try {
    await lifecycle(teamId, type, uuid, 'stop');
  } catch {
    /* ignore — a database that was never started, or whose server is unreachable, has nothing to tear down */
  }
  await pool.query(`DELETE FROM ${t.table} WHERE id = $1`, [db.id]);
  return true;
}

/** Decrypt credentials of a database row for container env injection. */
async function loadCredentials(t: DbType, uuid: string): Promise<Record<string, string>> {
  const { rows } = await pool.query(`SELECT * FROM ${t.table} WHERE uuid = $1 LIMIT 1`, [uuid]);
  const row = rows[0];
  const creds: Record<string, string> = {};
  for (const f of t.fields) {
    if (f.viaEnvVar) {
      creds[f.col] = (await loadEnvVarValue(t.model, Number(row.id), f.viaEnvVar)) ?? f.default ?? '';
      continue;
    }
    const stored = row[f.col] as string | null;
    creds[f.col] = f.encrypted ? (tryDecryptString(stored) ?? '') : String(stored ?? '');
  }
  return creds;
}

export interface DatabaseDetail extends DatabaseRow {
  /** Every credential column for this engine, decrypted — keyed by DB column name (e.g. `postgres_password`). */
  credentials: Record<string, string>;
  /** The internal port this engine listens on (`database-types.ts`'s own registry, not user-editable). */
  port: number;
  /** DNS name other resources on the shared `ideploy` network reach this database by. */
  internal_host: string;
  /** Ready-to-paste connection string using the internal host — null for engine/field combinations with nothing sensible to build (shouldn't happen for the 8 registered types). */
  connection_url: string | null;
  /** Same, but through the server's public IP and `public_port` — only when `is_public` is set; this is the one piece of information a database's own page was showing nothing for. */
  public_connection_url: string | null;
}

/**
 * The single-record fetch a database's own page needs: real credentials (this
 * project's user explicitly could not see them anywhere, "on ne peut même pas
 * les définir" — not shown, not editable) and a ready connection string, not
 * just the metadata `listDatabases()` returns for a table of many rows.
 */
export async function getDatabaseDetail(
  teamId: number,
  type: string,
  uuid: string
): Promise<DatabaseDetail | null> {
  const t = getDbType(type);
  if (!t) return null;
  const db = await getDatabase(teamId, type, uuid);
  if (!db) return null;

  const credentials = await loadCredentials(t, uuid);
  const internalHost = containerNameFor(type, uuid);
  const connectionUrl = buildConnectionUrl(type, credentials, internalHost, t.port);

  let publicConnectionUrl: string | null = null;
  if (db.is_public && db.public_port && db.destination_id) {
    try {
      const { server } = await resolveServer(teamId, db.destination_id);
      if (server) publicConnectionUrl = buildConnectionUrl(type, credentials, server.ip, db.public_port);
    } catch {
      /* server/key not resolvable — leave the public URL out rather than fail the whole page over it */
    }
  }

  return { ...db, credentials, port: t.port, internal_host: internalHost, connection_url: connectionUrl, public_connection_url: publicConnectionUrl };
}

/**
 * Overwrite one or more credential columns.
 *
 * Mirrors the legacy Postgres/MySQL/… "General" pages, which let the operator
 * edit Username/Password/Initial Database directly (with an explicit warning
 * that this only takes effect on the *next* start, since a running
 * container's env was already baked in at `docker run` — this does not try
 * to live-reconfigure a running database, only changes what the next
 * start/restart will use). Only columns this engine's own field registry
 * declares can be written — an unknown key is rejected rather than silently
 * ignored, since a typo'd key silently doing nothing is worse than an error.
 */
export async function updateCredentials(
  teamId: number,
  type: string,
  uuid: string,
  updates: Record<string, string>
): Promise<DatabaseDetail | null> {
  const t = getDbType(type);
  if (!t) return null;
  const db = await getDatabase(teamId, type, uuid);
  if (!db) return null;

  const knownCols = new Set(t.fields.map((f) => f.col));
  const sets: string[] = [];
  const vals: unknown[] = [];
  const envUpdates: { field: DbField; value: string }[] = [];
  for (const [col, value] of Object.entries(updates)) {
    if (!knownCols.has(col)) throw new Error(`Unknown credential field for ${type}: ${col}`);
    const field = t.fields.find((f) => f.col === col)!;
    if (field.viaEnvVar) {
      envUpdates.push({ field, value });
      continue;
    }
    sets.push(`${col} = $${vals.length + 1}`);
    vals.push(field.encrypted ? encryptString(value) : value);
  }

  if (sets.length > 0) {
    vals.push(db.id);
    await pool.query(`UPDATE ${t.table} SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
  }
  for (const { field, value } of envUpdates) {
    await upsertEnvVarValue(t.model, db.id, field.viaEnvVar!, value);
  }
  return getDatabaseDetail(teamId, type, uuid);
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

/**
 * How long after `docker run`/`docker restart` to wait before trusting the
 * container's status — mirrors `service.service.ts`'s own `SERVICE_SETTLE_MS`
 * and the reasoning behind it: the command itself only reports whether Docker
 * *started* the container, not whether it immediately crashed (bad
 * credentials, a corrupt volume). Trusting the exit code alone is exactly how
 * a database's status could say "running" while `docker ps` disagreed.
 */
const DB_SETTLE_MS = 4000;

export async function lifecycle(
  teamId: number,
  type: string,
  uuid: string,
  action: 'start' | 'stop' | 'restart',
  onData?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  const t = getDbType(type);
  if (!t) throw new Error(`Unknown database type: ${type}`);
  const db = await getDatabase(teamId, type, uuid);
  if (!db) throw new Error('Database not found');
  if (!db.destination_id) throw new Error('Database has no destination');

  const { server, key } = await resolveServer(teamId, db.destination_id);
  const containerName = containerNameFor(type, uuid);
  const log = (line: string) => onData?.(line);

  let cmd: string;
  let redact: string[] = [];
  if (action === 'stop') {
    cmd = `docker rm -f ${containerName} 2>/dev/null; echo stopped`;
  } else if (action === 'restart') {
    cmd = `docker restart ${containerName}`;
  } else {
    const creds = await loadCredentials(t, uuid);
    // Every credential value gets scrubbed from anything streamed back — this
    // command embeds them as literal `-e KEY=value` flags, and while `docker
    // run` itself doesn't normally echo its own invocation, an error message
    // that happened to quote the failing command back would otherwise leak
    // them straight into the live console.
    redact = Object.values(creds).filter(Boolean);
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

  const result = await executeRemoteCommand(server!, key!, cmd, { onData, redact });

  if (action === 'stop') {
    await setStatus(t, uuid, 'exited');
    return { success: result.exitCode === 0, output: result.stdout + result.stderr };
  }

  // start/restart: wait out the settle window, then ask Docker directly what
  // actually happened, rather than trust the exit code of the command that
  // only started the container.
  await new Promise((resolve) => setTimeout(resolve, DB_SETTLE_MS));
  log(`\nChecking container status after ${DB_SETTLE_MS / 1000}s…\n`);
  const inspect = await executeRemoteCommand(
    server!,
    key!,
    `docker inspect ${containerName} --format '{{.State.Status}}' 2>/dev/null`,
    { noRetry: true }
  );
  const actualStatus = inspect.stdout.trim() || 'exited';
  await setStatus(t, uuid, actualStatus);
  log(`  ${containerName}: ${actualStatus}\n`);

  return { success: result.exitCode === 0 && actualStatus === 'running', output: result.stdout + result.stderr };
}
