import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as projectService from '../services/project.service';

export async function listProjects(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await projectService.listProjects(req.user!.currentTeamId!));
  } catch (err) {
    logger.error('listProjects error', { message: (err as Error).message });
    fail(res, 'Failed to list projects');
  }
}

export async function getProject(req: CustomRequest, res: Response): Promise<void> {
  try {
    const project = await projectService.getProject(req.user!.currentTeamId!, String(req.params.uuid));
    if (!project) return fail(res, 'Project not found', 404, 'NOT_FOUND');
    ok(res, project);
  } catch (err) {
    logger.error('getProject error', { message: (err as Error).message });
    fail(res, 'Failed to fetch project');
  }
}

export async function createProject(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.name) return fail(res, 'name is required', 422, 'VALIDATION');
  try {
    ok(res, await projectService.createProject(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    logger.error('createProject error', { message: (err as Error).message });
    fail(res, 'Failed to create project');
  }
}

export async function deleteProject(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await projectService.deleteProject(req.user!.currentTeamId!, String(req.params.uuid));
    if (!deleted) return fail(res, 'Project not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    logger.error('deleteProject error', { message: (err as Error).message });
    fail(res, 'Failed to delete project');
  }
}

export async function listEnvironments(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await projectService.listEnvironments(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    logger.error('listEnvironments error', { message: (err as Error).message });
    fail(res, 'Failed to list environments');
  }
}
