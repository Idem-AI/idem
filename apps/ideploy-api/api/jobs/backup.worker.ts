/**
 * Scheduled backup worker (BullMQ) — replaces Coolify's DatabaseBackupJob +
 * the Console/Kernel cron entry. On startup we register one repeatable job per
 * enabled schedule (cron = the schedule's `frequency`); the worker runs the
 * dump via db-backup.service.
 */
import { Job } from 'bullmq';
import pool from '../config/db.config';
import logger from '../config/logger';
import { QUEUE_NAMES, getQueue } from '../queue/queues';
import { registerWorker } from '../queue/worker';
import { DB_TYPES } from '../services/database-types';
import * as backupService from '../services/db-backup.service';

interface BackupJobData {
  scheduleId: number;
  scheduleUuid: string;
  teamId: number;
  type: string;
  dbUuid: string;
}

/** Map a polymorphic model class back to a registry type key. */
function typeFromModel(model: string): string | null {
  const entry = Object.values(DB_TYPES).find((t) => t.model === model);
  return entry?.key ?? null;
}

async function processBackup(job: Job<BackupJobData>): Promise<void> {
  const { teamId, type, dbUuid, scheduleId } = job.data;
  // Date.now() is fine in app runtime (only forbidden in workflow scripts).
  const nowMs = Date.now();
  const result = await backupService.backupNow(teamId, type, dbUuid, nowMs, scheduleId);
  if (!result.success) throw new Error('Backup failed');
}

export function registerBackupWorker(): void {
  registerWorker<BackupJobData>(QUEUE_NAMES.databases, processBackup, 2);
  logger.info('Backup worker registered');
}

/**
 * Schedule repeatable backup jobs from the enabled schedules in the DB. Call on
 * startup; safe to call again (BullMQ dedups repeatable jobs by key).
 */
export async function registerBackupScheduler(): Promise<void> {
  let schedules: Awaited<ReturnType<typeof backupService.listAllEnabledSchedules>> = [];
  try {
    schedules = await backupService.listAllEnabledSchedules();
  } catch (err) {
    logger.warn('Could not load backup schedules (DB not ready?)', {
      message: (err as Error).message,
    });
    return;
  }

  const queue = getQueue(QUEUE_NAMES.databases);
  for (const s of schedules) {
    const type = typeFromModel(s.database_type);
    if (!type) continue;
    // Resolve the database uuid from its id.
    const t = DB_TYPES[type];
    const { rows } = await pool.query(`SELECT uuid FROM ${t.table} WHERE id = $1 LIMIT 1`, [
      s.database_id,
    ]);
    if (!rows[0]) continue;

    await queue.add(
      'backup',
      {
        scheduleId: s.id,
        scheduleUuid: s.uuid,
        teamId: s.team_id,
        type,
        dbUuid: String(rows[0].uuid),
      } satisfies BackupJobData,
      {
        repeat: { pattern: s.frequency },
        jobId: `backup:${s.uuid}`,
      }
    );
  }
  logger.info(`Registered ${schedules.length} backup schedule(s)`);
}
