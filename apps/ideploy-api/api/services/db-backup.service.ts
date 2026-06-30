/**
 * Scheduled database backups — schedule CRUD, on-demand "backup now", and
 * execution tracking. Ports DatabaseBackupJob + the ScheduledDatabaseBackup
 * model. Cron scheduling runs via BullMQ repeatable jobs (see jobs/backup.worker).
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import { getDbType, DbType } from './database-types';
import { tryDecryptString } from '../utils/laravel-crypto';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';
import * as databaseService from './database.service';

import { backupRoot } from '../utils/paths';
const BACKUP_ROOT = backupRoot();

export interface BackupSchedule {
  id: number;
  uuid: string;
  enabled: boolean;
  frequency: string;
  save_s3: boolean;
  number_of_backups_locally: number;
  database_type: string;
  database_id: number;
}

function mapSchedule(r: Record<string, unknown>): BackupSchedule {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    enabled: Boolean(r.enabled),
    frequency: String(r.frequency),
    save_s3: Boolean(r.save_s3),
    number_of_backups_locally: Number(r.number_of_backups_locally),
    database_type: String(r.database_type),
    database_id: Number(r.database_id),
  };
}

export async function listSchedules(
  teamId: number,
  type: string,
  dbUuid: string
): Promise<BackupSchedule[]> {
  const t = getDbType(type);
  if (!t) throw new Error(`Unknown database type: ${type}`);
  const db = await databaseService.getDatabase(teamId, type, dbUuid);
  if (!db) throw new Error('Database not found');
  const { rows } = await pool.query(
    `SELECT * FROM scheduled_database_backups
     WHERE team_id = $1 AND database_type = $2 AND database_id = $3 ORDER BY id`,
    [teamId, t.model, db.id]
  );
  return rows.map(mapSchedule);
}

export async function createSchedule(
  teamId: number,
  type: string,
  dbUuid: string,
  dto: { frequency: string; save_s3?: boolean; number_of_backups_locally?: number }
): Promise<BackupSchedule> {
  const t = getDbType(type);
  if (!t) throw new Error(`Unknown database type: ${type}`);
  const db = await databaseService.getDatabase(teamId, type, dbUuid);
  if (!db) throw new Error('Database not found');

  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO scheduled_database_backups
       (uuid, enabled, save_s3, frequency, number_of_backups_locally, database_type, database_id, team_id, created_at, updated_at)
     VALUES ($1, true, $2, $3, $4, $5, $6, $7, now(), now()) RETURNING *`,
    [
      uuid,
      dto.save_s3 ?? false,
      dto.frequency,
      dto.number_of_backups_locally ?? 7,
      t.model,
      db.id,
      teamId,
    ]
  );
  return mapSchedule(rows[0]);
}

export async function deleteSchedule(teamId: number, uuid: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM scheduled_database_backups WHERE team_id = $1 AND uuid = $2',
    [teamId, uuid]
  );
  return (rowCount ?? 0) > 0;
}

export async function listExecutions(
  teamId: number,
  scheduleUuid: string
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool.query(
    `SELECT ex.uuid, ex.status, ex.size, ex.filename, ex.created_at
     FROM scheduled_database_backup_executions ex
     JOIN scheduled_database_backups sb ON sb.id = ex.scheduled_database_backup_id
     WHERE sb.team_id = $1 AND sb.uuid = $2 ORDER BY ex.created_at DESC LIMIT 50`,
    [teamId, scheduleUuid]
  );
  return rows;
}

async function loadCreds(t: DbType, dbUuid: string): Promise<Record<string, string>> {
  const { rows } = await pool.query(`SELECT * FROM ${t.table} WHERE uuid = $1 LIMIT 1`, [dbUuid]);
  const row = rows[0];
  const creds: Record<string, string> = {};
  for (const f of t.fields) {
    const stored = row[f.col] as string | null;
    creds[f.col] = f.encrypted ? (tryDecryptString(stored) ?? '') : String(stored ?? '');
  }
  return creds;
}

/**
 * Run a backup now: docker exec the dump command inside the DB container, write
 * to the host backup dir, and record an execution row. `nowMs` is passed in so
 * the function stays deterministic for callers/tests.
 */
export async function backupNow(
  teamId: number,
  type: string,
  dbUuid: string,
  nowMs: number,
  scheduleId?: number
): Promise<{ success: boolean; filename: string; output: string }> {
  const t = getDbType(type);
  if (!t) throw new Error(`Unknown database type: ${type}`);
  if (!t.dumpCommand) throw new Error(`Backups are not supported for ${type}`);

  const db = await databaseService.getDatabase(teamId, type, dbUuid);
  if (!db || !db.destination_id) throw new Error('Database or destination not found');

  const { rows: drows } = await pool.query(
    'SELECT server_id FROM standalone_dockers WHERE id = $1 LIMIT 1',
    [db.destination_id]
  );
  if (!drows[0]) throw new Error('Destination not found');
  const server = await serverService.getServerById(teamId, Number(drows[0].server_id));
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found');

  const creds = await loadCreds(t, dbUuid);
  const containerName = `${type}-${dbUuid}`;
  const dir = `${BACKUP_ROOT}/${dbUuid}`;
  const filename = `${dir}/backup-${nowMs}.dump`;
  const innerDump = t.dumpCommand(creds, '/tmp/ideploy-dump');

  // Record a running execution if tied to a schedule.
  let executionUuid: string | null = null;
  if (scheduleId) {
    executionUuid = randomUUID();
    await pool.query(
      `INSERT INTO scheduled_database_backup_executions (uuid, status, scheduled_database_backup_id, created_at, updated_at)
       VALUES ($1, 'running', $2, now(), now())`,
      [executionUuid, scheduleId]
    );
  }

  const script = [
    `mkdir -p ${dir}`,
    `docker exec ${containerName} sh -c ${JSON.stringify(innerDump)}`,
    `docker cp ${containerName}:/tmp/ideploy-dump ${filename}`,
    `ls -l ${filename}`,
  ].join(' && ');

  const result = await executeRemoteCommand(server, key, script);
  const success = result.exitCode === 0;

  if (executionUuid) {
    await pool.query(
      `UPDATE scheduled_database_backup_executions
       SET status = $1, filename = $2, message = $3, updated_at = now() WHERE uuid = $4`,
      [success ? 'success' : 'failed', filename, result.stdout.slice(0, 2000), executionUuid]
    );
  }

  return { success, filename, output: result.stdout + result.stderr };
}

/** All enabled schedules across teams — used to register repeatable jobs. */
export async function listAllEnabledSchedules(): Promise<
  (BackupSchedule & { team_id: number })[]
> {
  const { rows } = await pool.query(
    'SELECT * FROM scheduled_database_backups WHERE enabled = true'
  );
  return rows.map((r) => ({ ...mapSchedule(r), team_id: Number(r.team_id) }));
}
