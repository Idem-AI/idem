import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import * as service from '../services/workspace.service';
import * as scheduling from '../services/server-scheduling.service';
import { canSelectRegion } from '../services/subscription.service';

export async function list(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.listWorkspaces(req.user!.currentTeamId!));
  } catch (err) {
    respondWithError(res, err, 'Listing workspaces');
  }
}

export async function get(req: CustomRequest, res: Response): Promise<void> {
  try {
    const workspace = await service.getWorkspace(
      req.user!.currentTeamId!,
      String(req.params.uuid)
    );
    if (!workspace) return fail(res, 'Workspace not found', 404, 'NOT_FOUND');
    ok(res, workspace);
  } catch (err) {
    respondWithError(res, err, 'Fetching the workspace');
  }
}

export async function create(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.createWorkspace(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    respondWithError(res, err, 'Creating the workspace');
  }
}

export async function update(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.updateWorkspace(req.user!.currentTeamId!, String(req.params.uuid), req.body));
  } catch (err) {
    respondWithError(res, err, 'Updating the workspace');
  }
}

export async function remove(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await service.deleteWorkspace(req.user!.currentTeamId!, String(req.params.uuid));
    if (!deleted) return fail(res, 'Workspace not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    respondWithError(res, err, 'Deleting the workspace');
  }
}

/**
 * What the creation form needs to render: whether this plan may choose a region,
 * and which regions actually have capacity.
 *
 * Served together so the form makes one call and cannot offer a region we would
 * then silently override.
 */
export async function creationOptions(req: CustomRequest, res: Response): Promise<void> {
  try {
    const teamId = req.user!.currentTeamId!;
    const [regionSelectionAllowed, availableRegions] = await Promise.all([
      canSelectRegion(teamId),
      scheduling.listAvailableRegions(),
    ]);

    ok(res, {
      regionSelectionAllowed,
      availableRegions,
      defaultRegion: scheduling.DEFAULT_REGION,
      deploymentTypes: service.DEPLOYMENT_TYPES,
    });
  } catch (err) {
    respondWithError(res, err, 'Loading the workspace options');
  }
}

export async function addEnvironment(req: CustomRequest, res: Response): Promise<void> {
  try {
    const environment = await service.createEnvironment(
      req.user!.currentTeamId!,
      String(req.params.uuid),
      String(req.body.name)
    );
    ok(res, environment, 201);
  } catch (err) {
    respondWithError(res, err, 'Adding the environment');
  }
}

export async function removeEnvironment(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await service.deleteEnvironment(
      req.user!.currentTeamId!,
      String(req.params.uuid),
      String(req.params.environmentUuid)
    );
    if (!deleted) return fail(res, 'Environment not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    respondWithError(res, err, 'Deleting the environment');
  }
}

// ── Projects ──────────────────────────────────────────────

export async function listProjects(req: CustomRequest, res: Response): Promise<void> {
  try {
    const environmentName = req.query.environment_name ? String(req.query.environment_name) : undefined;
    ok(
      res,
      await service.listProjects(req.user!.currentTeamId!, String(req.params.uuid), environmentName)
    );
  } catch (err) {
    respondWithError(res, err, 'Listing projects');
  }
}

export async function createProject(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.name) return fail(res, 'name is required', 422, 'VALIDATION');
  try {
    ok(
      res,
      await service.createProject(req.user!.currentTeamId!, String(req.params.uuid), req.body),
      201
    );
  } catch (err) {
    respondWithError(res, err, 'Creating the project');
  }
}

export async function removeProject(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await service.deleteProject(
      req.user!.currentTeamId!,
      String(req.params.uuid),
      String(req.params.projectUuid)
    );
    if (!deleted) return fail(res, 'Project not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    respondWithError(res, err, 'Deleting the project');
  }
}
