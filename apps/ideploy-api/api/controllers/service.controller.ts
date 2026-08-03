import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import logger from '../config/logger';
import * as service from '../services/service.service';
import * as templates from '../services/templates.service';
import { resolveWorkspaceDestination } from '../services/workspace.service';

export async function list(req: CustomRequest, res: Response): Promise<void> {
  try {
    const envId = req.query.environment_id ? Number(req.query.environment_id) : undefined;
    ok(res, await service.listServices(req.user!.currentTeamId!, envId));
  } catch (err) {
    logger.error('listServices error', { message: (err as Error).message });
    fail(res, 'Failed to list services');
  }
}

export async function get(req: CustomRequest, res: Response): Promise<void> {
  try {
    const svc = await service.getService(req.user!.currentTeamId!, String(req.params.uuid));
    if (!svc) return fail(res, 'Service not found', 404, 'NOT_FOUND');
    const subResources = await service.getSubResources(svc.id);
    ok(res, { ...svc, ...subResources });
  } catch (err) {
    fail(res, 'Failed to fetch service');
  }
}

/**
 * Create a service (Docker Compose stack) inside a workspace.
 *
 * The destination is resolved from the workspace, not accepted from the
 * client — see the identical note on `application.controller.ts::createApplication`.
 */
export async function create(req: CustomRequest, res: Response): Promise<void> {
  const { name, workspace_uuid, environment_name, project_name, docker_compose_raw } = req.body ?? {};
  if (!name || !workspace_uuid || !docker_compose_raw) {
    return fail(res, 'name, workspace_uuid and docker_compose_raw are required', 422, 'VALIDATION');
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
      await service.createService(teamId, {
        ...req.body,
        environment_id: destination.environmentId,
        destination_id: destination.destinationId,
        project_id: destination.projectId,
      }),
      201
    );
  } catch (err) {
    respondWithError(res, err, 'Creating the service');
  }
}

/** Create a service from a one-click template. */
export async function createFromTemplate(req: CustomRequest, res: Response): Promise<void> {
  const { template, name, workspace_uuid, environment_name, project_name } = req.body ?? {};
  if (!template || !name || !workspace_uuid) {
    return fail(res, 'template, name and workspace_uuid are required', 422, 'VALIDATION');
  }
  const compose = templates.getTemplateCompose(String(template));
  if (!compose) return fail(res, `Unknown template: ${template}`, 404, 'NOT_FOUND');
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
      await service.createService(teamId, {
        name,
        environment_id: destination.environmentId,
        destination_id: destination.destinationId,
        project_id: destination.projectId,
        docker_compose_raw: compose,
        service_type: String(template),
      }),
      201
    );
  } catch (err) {
    respondWithError(res, err, 'Creating the service from a template');
  }
}

export async function remove(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await service.deleteService(req.user!.currentTeamId!, String(req.params.uuid));
    if (!deleted) return fail(res, 'Service not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, 'Failed to delete service');
  }
}

async function lifecycle(
  req: CustomRequest,
  res: Response,
  action: 'start' | 'stop' | 'restart'
): Promise<void> {
  try {
    ok(res, await service.lifecycle(req.user!.currentTeamId!, String(req.params.uuid), action));
  } catch (err) {
    logger.error(`service ${action} error`, { message: (err as Error).message });
    fail(res, (err as Error).message || `Failed to ${action} service`);
  }
}
export const start = (req: CustomRequest, res: Response) => lifecycle(req, res, 'start');
export const stop = (req: CustomRequest, res: Response) => lifecycle(req, res, 'stop');
export const restart = (req: CustomRequest, res: Response) => lifecycle(req, res, 'restart');

// ── Templates ─────────────────────────────────────────────
export async function listTemplates(_req: CustomRequest, res: Response): Promise<void> {
  ok(res, templates.listTemplates());
}
