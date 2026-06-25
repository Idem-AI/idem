import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
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

export async function createServer(req: CustomRequest, res: Response): Promise<void> {
  const { name, ip, private_key_id } = req.body ?? {};
  if (!name || !ip || !private_key_id) {
    return fail(res, 'name, ip and private_key_id are required', 422, 'VALIDATION');
  }
  try {
    const server = await serverService.createServer(req.user!.currentTeamId!, req.body);
    ok(res, server, 201);
  } catch (err) {
    logger.error('createServer error', { message: (err as Error).message });
    fail(res, 'Failed to create server');
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

export async function validateServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    const result = await serverService.validateServer(req.user!.currentTeamId!, String(req.params.uuid));
    ok(res, result);
  } catch (err) {
    logger.error('validateServer error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to validate server');
  }
}

export async function installDocker(req: CustomRequest, res: Response): Promise<void> {
  try {
    const result = await serverService.installDocker(req.user!.currentTeamId!, String(req.params.uuid));
    ok(res, result);
  } catch (err) {
    logger.error('installDocker error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to install Docker');
  }
}
