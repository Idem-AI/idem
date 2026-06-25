import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as service from '../services/service.service';
import * as templates from '../services/templates.service';

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

export async function create(req: CustomRequest, res: Response): Promise<void> {
  const { name, environment_id, destination_id, docker_compose_raw } = req.body ?? {};
  if (!name || !environment_id || !destination_id || !docker_compose_raw) {
    return fail(
      res,
      'name, environment_id, destination_id and docker_compose_raw are required',
      422,
      'VALIDATION'
    );
  }
  try {
    ok(res, await service.createService(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    logger.error('createService error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to create service');
  }
}

/** Create a service from a one-click template. */
export async function createFromTemplate(req: CustomRequest, res: Response): Promise<void> {
  const { template, name, environment_id, destination_id } = req.body ?? {};
  if (!template || !name || !environment_id || !destination_id) {
    return fail(res, 'template, name, environment_id and destination_id are required', 422, 'VALIDATION');
  }
  const compose = templates.getTemplateCompose(String(template));
  if (!compose) return fail(res, `Unknown template: ${template}`, 404, 'NOT_FOUND');
  try {
    ok(
      res,
      await service.createService(req.user!.currentTeamId!, {
        name,
        environment_id,
        destination_id,
        docker_compose_raw: compose,
        service_type: String(template),
      }),
      201
    );
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to create service from template');
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
