import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { basename } from 'path';
import { ok, fail, respondWithError } from '../utils/response';
import logger from '../config/logger';
import * as dbService from '../services/database.service';
import * as backupService from '../services/db-backup.service';
import { getDbType } from '../services/database-types';
import { resolveWorkspaceDestination } from '../services/workspace.service';

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

/**
 * Create a database inside a workspace.
 *
 * As with applications, the destination is resolved from the workspace, not
 * accepted from the client — that resolution is what guarantees the database
 * lands next to the application that is meant to reach it.
 */
export async function create(req: CustomRequest, res: Response): Promise<void> {
  const type = String(req.params.type);
  if (!getDbType(type)) return fail(res, `Unknown database type: ${type}`, 422, 'VALIDATION');
  const { name, workspace_uuid, environment_name, project_name } = req.body ?? {};
  if (!name || !workspace_uuid) {
    return fail(res, 'name and workspace_uuid are required', 422, 'VALIDATION');
  }
  try {
    const teamId = req.user!.currentTeamId!;
    const destination = await resolveWorkspaceDestination(
      teamId,
      workspace_uuid,
      environment_name,
      project_name
    );
    ok(
      res,
      await dbService.createDatabase(teamId, type, {
        ...req.body,
        environment_id: destination.environmentId,
        destination_id: destination.destinationId,
        project_id: destination.projectId,
      }),
      201
    );
  } catch (err) {
    respondWithError(res, err, 'Creating the database');
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

/**
 * Stream a backup file to the client.
 *
 * Deliberately not wrapped in the `{ success, data }` envelope: the body is the
 * file itself. Headers are sent only once the file is confirmed present on the
 * server, so a failure still produces a normal JSON error rather than a
 * half-written download the browser would save as a corrupt file.
 */
export async function downloadBackup(req: CustomRequest, res: Response): Promise<void> {
  try {
    const backup = await backupService.resolveBackupForDownload(
      req.user!.currentTeamId!,
      String(req.params.executionUuid)
    );

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(backup.sizeBytes));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${basename(backup.filename).replace(/"/g, '')}"`
    );

    await backupService.streamBackup(backup, res);
    res.end();
  } catch (err) {
    // Once bytes are on the wire the status line is already committed; all we can
    // do is cut the response so the client sees a truncated transfer, not a
    // silently short file.
    if (res.headersSent) {
      logger.error('Backup download failed mid-stream', {
        message: (err as Error).message,
      });
      res.destroy();
      return;
    }
    respondWithError(res, err, 'Downloading the backup');
  }
}
