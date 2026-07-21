import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as dbService from '../services/database.service';
import * as backupService from '../services/db-backup.service';
import { getDbType } from '../services/database-types';

export async function list(req: CustomRequest, res: Response): Promise<void> {
  try {
    const envId = req.query.environment_id ? Number(req.query.environment_id) : undefined;
    ok(res, await dbService.listDatabases(req.user!.currentTeamId!, envId));
  } catch (err) {
    logger.error('listDatabases error', { message: (err as Error).message });
    fail(res, 'Failed to list databases');
  }
}

export async function get(req: CustomRequest, res: Response): Promise<void> {
  try {
    const db = await dbService.getDatabase(
      req.user!.currentTeamId!,
      String(req.params.type),
      String(req.params.uuid)
    );
    if (!db) return fail(res, 'Database not found', 404, 'NOT_FOUND');
    ok(res, db);
  } catch (err) {
    fail(res, 'Failed to fetch database');
  }
}

export async function create(req: CustomRequest, res: Response): Promise<void> {
  const type = String(req.params.type);
  if (!getDbType(type)) return fail(res, `Unknown database type: ${type}`, 422, 'VALIDATION');
  const { name, environment_id, destination_id } = req.body ?? {};
  if (!name || !environment_id || !destination_id) {
    return fail(res, 'name, environment_id and destination_id are required', 422, 'VALIDATION');
  }
  try {
    ok(res, await dbService.createDatabase(req.user!.currentTeamId!, type, req.body), 201);
  } catch (err) {
    logger.error('createDatabase error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to create database');
  }
}

export async function remove(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await dbService.deleteDatabase(
      req.user!.currentTeamId!,
      String(req.params.type),
      String(req.params.uuid)
    );
    if (!deleted) return fail(res, 'Database not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, 'Failed to delete database');
  }
}

async function lifecycle(
  req: CustomRequest,
  res: Response,
  action: 'start' | 'stop' | 'restart'
): Promise<void> {
  try {
    ok(
      res,
      await dbService.lifecycle(
        req.user!.currentTeamId!,
        String(req.params.type),
        String(req.params.uuid),
        action
      )
    );
  } catch (err) {
    logger.error(`db ${action} error`, { message: (err as Error).message });
    fail(res, (err as Error).message || `Failed to ${action} database`);
  }
}
export const start = (req: CustomRequest, res: Response) => lifecycle(req, res, 'start');
export const stop = (req: CustomRequest, res: Response) => lifecycle(req, res, 'stop');
export const restart = (req: CustomRequest, res: Response) => lifecycle(req, res, 'restart');

// ── Backups ───────────────────────────────────────────────
export async function listSchedules(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(
      res,
      await backupService.listSchedules(
        req.user!.currentTeamId!,
        String(req.params.type),
        String(req.params.uuid)
      )
    );
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list backup schedules');
  }
}

export async function createSchedule(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.frequency) return fail(res, 'frequency (cron) is required', 422, 'VALIDATION');
  try {
    ok(
      res,
      await backupService.createSchedule(
        req.user!.currentTeamId!,
        String(req.params.type),
        String(req.params.uuid),
        req.body
      ),
      201
    );
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to create backup schedule');
  }
}

export async function backupNow(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(
      res,
      await backupService.backupNow(
        req.user!.currentTeamId!,
        String(req.params.type),
        String(req.params.uuid),
        Date.now()
      )
    );
  } catch (err) {
    logger.error('backupNow error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to run backup');
  }
}

export async function deleteSchedule(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await backupService.deleteSchedule(
      req.user!.currentTeamId!,
      String(req.params.scheduleUuid)
    );
    if (!deleted) return fail(res, 'Schedule not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, 'Failed to delete backup schedule');
  }
}

export async function listExecutions(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(
      res,
      await backupService.listExecutions(req.user!.currentTeamId!, String(req.params.scheduleUuid))
    );
  } catch (err) {
    fail(res, 'Failed to list backup executions');
  }
}
