import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import logger from '../config/logger';
import * as service from '../services/service.service';
import * as templates from '../services/templates.service';
import { resolveWorkspaceDestination } from '../services/workspace.service';
import { realtime } from '../services/realtime.service';
import { assertComposeIsSafe, ComposePolicyError } from '../docker/compose-policy';

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
  if (typeof name !== 'string' || typeof docker_compose_raw !== 'string' || docker_compose_raw.length > 200_000) {
    return fail(res, 'name and docker_compose_raw must be strings (compose ≤ 200 KB)', 422, 'VALIDATION');
  }
  // Un compose utilisateur ne doit jamais sortir de ses conteneurs : pas de mode
  // privilégié, d'espace de noms de l'hôte, de montage de chemins de l'hôte ni
  // du socket Docker.
  try {
    assertComposeIsSafe(docker_compose_raw);
  } catch (err) {
    if (err instanceof ComposePolicyError) {
      return fail(res, err.message, 422, 'COMPOSE_NOT_ALLOWED');
    }
    throw err;
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
        // Champs explicites : recopier le corps laissait le client fixer des
        // colonnes réservées au serveur (`service_type`, par exemple).
        name,
        docker_compose_raw,
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
  const uuid = String(req.params.uuid);
  try {
    ok(
      res,
      await service.lifecycle(req.user!.currentTeamId!, uuid, action, (chunk) =>
        realtime.serviceLog(uuid, chunk)
      )
    );
  } catch (err) {
    logger.error(`service ${action} error`, { message: (err as Error).message });
    void realtime.serviceLog(uuid, `\n❌ ${(err as Error).message || `Failed to ${action} service`}\n`);
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

/** A single template's detail (the "browse a service" page's Install screen). */
export async function getTemplate(req: CustomRequest, res: Response): Promise<void> {
  const t = templates.getTemplateSummary(String(req.params.name));
  if (!t) return fail(res, `Unknown template: ${req.params.name}`, 404, 'NOT_FOUND');
  ok(res, t);
}
