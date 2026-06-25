import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as appService from '../services/application.service';
import * as envVarService from '../services/env-var.service';
import * as deploymentService from '../services/deployment.service';
import * as taskService from '../services/scheduled-task.service';
import * as volumeService from '../services/volume.service';

export async function listApplications(req: CustomRequest, res: Response): Promise<void> {
  try {
    const envId = req.query.environment_id ? Number(req.query.environment_id) : undefined;
    ok(res, await appService.listApplications(req.user!.currentTeamId!, envId));
  } catch (err) {
    logger.error('listApplications error', { message: (err as Error).message });
    fail(res, 'Failed to list applications');
  }
}

export async function getApplication(req: CustomRequest, res: Response): Promise<void> {
  try {
    const app = await appService.getApplication(req.user!.currentTeamId!, String(req.params.uuid));
    if (!app) return fail(res, 'Application not found', 404, 'NOT_FOUND');
    ok(res, app);
  } catch (err) {
    logger.error('getApplication error', { message: (err as Error).message });
    fail(res, 'Failed to fetch application');
  }
}

export async function createApplication(req: CustomRequest, res: Response): Promise<void> {
  const { name, environment_id, git_repository } = req.body ?? {};
  if (!name || !environment_id || !git_repository) {
    return fail(res, 'name, environment_id and git_repository are required', 422, 'VALIDATION');
  }
  try {
    ok(res, await appService.createApplication(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    logger.error('createApplication error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to create application');
  }
}

export async function updateApplication(req: CustomRequest, res: Response): Promise<void> {
  try {
    const updated = await appService.updateApplication(
      req.user!.currentTeamId!,
      String(req.params.uuid),
      req.body ?? {}
    );
    if (!updated) return fail(res, 'Application not found', 404, 'NOT_FOUND');
    ok(res, updated);
  } catch (err) {
    logger.error('updateApplication error', { message: (err as Error).message });
    fail(res, 'Failed to update application');
  }
}

async function lifecycle(
  req: CustomRequest,
  res: Response,
  action: 'start' | 'stop' | 'restart'
): Promise<void> {
  try {
    ok(res, await appService.lifecycleAction(req.user!.currentTeamId!, String(req.params.uuid), action));
  } catch (err) {
    logger.error(`${action}Application error`, { message: (err as Error).message });
    fail(res, (err as Error).message || `Failed to ${action} application`);
  }
}
export const startApplication = (req: CustomRequest, res: Response) => lifecycle(req, res, 'start');
export const stopApplication = (req: CustomRequest, res: Response) => lifecycle(req, res, 'stop');
export const restartApplication = (req: CustomRequest, res: Response) =>
  lifecycle(req, res, 'restart');

// ── Environment variables ─────────────────────────────────
export async function listEnvVars(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await envVarService.listForApplication(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list environment variables');
  }
}

export async function upsertEnvVar(req: CustomRequest, res: Response): Promise<void> {
  const { key, value } = req.body ?? {};
  if (!key || value === undefined) return fail(res, 'key and value are required', 422, 'VALIDATION');
  try {
    ok(res, await envVarService.upsertForApplication(req.user!.currentTeamId!, String(req.params.uuid), req.body), 201);
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to save environment variable');
  }
}

export async function deleteEnvVar(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await envVarService.deleteForApplication(
      req.user!.currentTeamId!,
      String(req.params.uuid),
      String(req.params.key)
    );
    if (!deleted) return fail(res, 'Variable not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to delete environment variable');
  }
}

// ── Deployments / previews ────────────────────────────────
export async function listDeployments(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await deploymentService.listForApplication(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list deployments');
  }
}

export async function listPreviews(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await appService.listPreviews(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list previews');
  }
}

// ── Scheduled tasks ───────────────────────────────────────
export async function listTasks(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await taskService.listForApplication(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list scheduled tasks');
  }
}
export async function createTask(req: CustomRequest, res: Response): Promise<void> {
  const { name, command, frequency } = req.body ?? {};
  if (!name || !command || !frequency)
    return fail(res, 'name, command and frequency are required', 422, 'VALIDATION');
  try {
    ok(res, await taskService.createForApplication(req.user!.currentTeamId!, String(req.params.uuid), req.body), 201);
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to create scheduled task');
  }
}
export async function runTask(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await taskService.runNow(req.user!.currentTeamId!, String(req.params.taskUuid)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to run task');
  }
}
export async function deleteTask(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await taskService.deleteTask(req.user!.currentTeamId!, String(req.params.taskUuid));
    if (!deleted) return fail(res, 'Task not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, 'Failed to delete task');
  }
}
export async function taskExecutions(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await taskService.listExecutions(req.user!.currentTeamId!, String(req.params.taskUuid)));
  } catch (err) {
    fail(res, 'Failed to list task executions');
  }
}

// ── Volumes ───────────────────────────────────────────────
export async function listVolumes(req: CustomRequest, res: Response): Promise<void> {
  try {
    const teamId = req.user!.currentTeamId!;
    const uuid = String(req.params.uuid);
    ok(res, {
      persistent: await volumeService.listPersistent(teamId, uuid),
      files: await volumeService.listFiles(teamId, uuid),
    });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list volumes');
  }
}
export async function createPersistentVolume(req: CustomRequest, res: Response): Promise<void> {
  const { name, mount_path } = req.body ?? {};
  if (!name || !mount_path) return fail(res, 'name and mount_path are required', 422, 'VALIDATION');
  try {
    ok(res, await volumeService.createPersistent(req.user!.currentTeamId!, String(req.params.uuid), req.body), 201);
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to create volume');
  }
}
export async function createFileVolume(req: CustomRequest, res: Response): Promise<void> {
  const { fs_path, mount_path } = req.body ?? {};
  if (!fs_path || !mount_path) return fail(res, 'fs_path and mount_path are required', 422, 'VALIDATION');
  try {
    ok(res, await volumeService.createFile(req.user!.currentTeamId!, String(req.params.uuid), req.body), 201);
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to create file volume');
  }
}
export async function deletePersistentVolume(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await volumeService.deletePersistent(
      req.user!.currentTeamId!,
      String(req.params.uuid),
      Number(req.params.id)
    );
    if (!deleted) return fail(res, 'Volume not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, 'Failed to delete volume');
  }
}

// ── Ops (status / metrics / exec) ─────────────────────────
export async function containerStatus(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, { status: await appService.getContainerStatus(req.user!.currentTeamId!, String(req.params.uuid)) });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to get status');
  }
}
export async function metrics(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, { metrics: await appService.getMetrics(req.user!.currentTeamId!, String(req.params.uuid)) });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to get metrics');
  }
}
export async function exec(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.command) return fail(res, 'command is required', 422, 'VALIDATION');
  try {
    ok(res, await appService.execCommand(req.user!.currentTeamId!, String(req.params.uuid), String(req.body.command)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to exec command');
  }
}
