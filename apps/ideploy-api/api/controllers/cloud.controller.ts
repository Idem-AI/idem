import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as cloud from '../services/cloud.service';
import { HetznerService } from '../services/hetzner.service';

// ── Cloud provider tokens ─────────────────────────────────
export async function listTokens(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await cloud.listTokens(req.user!.currentTeamId!));
  } catch (err) {
    logger.error('listTokens error', { message: (err as Error).message });
    fail(res, 'Failed to list cloud tokens');
  }
}

export async function createToken(req: CustomRequest, res: Response): Promise<void> {
  const { provider, token } = req.body ?? {};
  if (!provider || !token) return fail(res, 'provider and token are required', 422, 'VALIDATION');
  try {
    ok(res, await cloud.createToken(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    logger.error('createToken error', { message: (err as Error).message });
    fail(res, 'Failed to create cloud token');
  }
}

export async function deleteToken(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await cloud.deleteToken(req.user!.currentTeamId!, Number(req.params.id));
    if (!deleted) return fail(res, 'Token not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    logger.error('deleteToken error', { message: (err as Error).message });
    fail(res, 'Failed to delete cloud token');
  }
}

// ── Cloud-init scripts ────────────────────────────────────
export async function listInitScripts(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await cloud.listInitScripts(req.user!.currentTeamId!));
  } catch (err) {
    logger.error('listInitScripts error', { message: (err as Error).message });
    fail(res, 'Failed to list cloud-init scripts');
  }
}

export async function createInitScript(req: CustomRequest, res: Response): Promise<void> {
  const { name, script } = req.body ?? {};
  if (!name || !script) return fail(res, 'name and script are required', 422, 'VALIDATION');
  try {
    ok(res, await cloud.createInitScript(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    logger.error('createInitScript error', { message: (err as Error).message });
    fail(res, 'Failed to create cloud-init script');
  }
}

export async function deleteInitScript(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await cloud.deleteInitScript(req.user!.currentTeamId!, Number(req.params.id));
    if (!deleted) return fail(res, 'Script not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    logger.error('deleteInitScript error', { message: (err as Error).message });
    fail(res, 'Failed to delete cloud-init script');
  }
}

// ── Hetzner ───────────────────────────────────────────────
async function hetznerClient(req: CustomRequest): Promise<HetznerService> {
  const tokenId = Number(req.query.token_id ?? req.body?.token_id);
  if (!tokenId) throw new Error('token_id (cloud provider token) is required');
  const token = await cloud.getDecryptedToken(req.user!.currentTeamId!, tokenId);
  if (!token) throw new Error('Cloud provider token not found');
  return new HetznerService(token);
}

export async function hetznerLocations(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await (await hetznerClient(req)).getLocations());
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to fetch Hetzner locations');
  }
}

export async function hetznerServerTypes(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await (await hetznerClient(req)).getServerTypes());
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to fetch Hetzner server types');
  }
}

export async function hetznerCreateServer(req: CustomRequest, res: Response): Promise<void> {
  const { name, server_type, image } = req.body ?? {};
  if (!name || !server_type || !image) {
    return fail(res, 'name, server_type and image are required', 422, 'VALIDATION');
  }
  try {
    const client = await hetznerClient(req);
    ok(res, await client.createServer(req.body), 201);
  } catch (err) {
    logger.error('hetznerCreateServer error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to create Hetzner server');
  }
}
