import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import logger from '../config/logger';
import * as serverService from '../services/server.service';

export async function listServers(req: CustomRequest, res: Response): Promise<void> {
  try {
    const servers = await serverService.listServers(req.user!.currentTeamId!);
    ok(res, servers);
  } catch (err) {
    logger.error('listServers error', { message: (err as Error).message });
    fail(res, 'Failed to list servers');
  }
}

export async function getServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    const server = await serverService.getServer(req.user!.currentTeamId!, String(req.params.uuid));
    if (!server) return fail(res, 'Server not found', 404, 'NOT_FOUND');
    ok(res, server);
  } catch (err) {
    logger.error('getServer error', { message: (err as Error).message });
    fail(res, 'Failed to fetch server');
  }
}

/** One-click: use THIS machine (local Docker) as a server + destination. */
export async function createLocalServer(req: CustomRequest, res: Response): Promise<void> {
  // Local-machine deployment is a dev/testing convenience — never in production.
  if (process.env.NODE_ENV === 'production') {
    return fail(res, 'Local server is disabled in production.', 403, 'LOCAL_DISABLED');
  }
  try {
    const result = await serverService.ensureLocalServer(req.user!.currentTeamId!);
    ok(res, result, 201);
  } catch (err) {
    logger.error('createLocalServer error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to set up local server');
  }
}

/** Body validated by `createServerSchema` on the route. */
export async function createServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    const { server, destinationId } = await serverService.createServer(
      req.user!.currentTeamId!,
      req.body
    );
    // Flat shape: the destination is an implementation detail of "a usable
    // server", but callers need its id to target deployments.
    ok(res, { ...server, destination_id: destinationId }, 201);
  } catch (err) {
    respondWithError(res, err, 'Creating the server');
  }
}

export async function deleteServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await serverService.deleteServer(req.user!.currentTeamId!, String(req.params.uuid));
    if (!deleted) return fail(res, 'Server not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    logger.error('deleteServer error', { message: (err as Error).message });
    fail(res, 'Failed to delete server');
  }
}

/** Full readiness report — every check carries a remedy when it fails. */
export async function validateServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await serverService.validateServer(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    respondWithError(res, err, 'Validating the server');
  }
}

/** Install and configure Docker, then re-check readiness. */
export async function setUpServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await serverService.setUpServer(req.user!.currentTeamId!, String(req.params.uuid)));
  } catch (err) {
    respondWithError(res, err, 'Setting up the server');
  }
}
