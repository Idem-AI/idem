import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as service from '../services/private-key.service';

export async function list(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.listPrivateKeys(req.user!.currentTeamId!));
  } catch (err) {
    logger.error('listPrivateKeys error', { message: (err as Error).message });
    fail(res, 'Failed to list private keys');
  }
}

export async function get(req: CustomRequest, res: Response): Promise<void> {
  try {
    const key = await service.getPrivateKeyView(req.user!.currentTeamId!, String(req.params.uuid));
    if (!key) return fail(res, 'Private key not found', 404, 'NOT_FOUND');
    ok(res, key);
  } catch (err) {
    logger.error('getPrivateKey error', { message: (err as Error).message });
    fail(res, 'Failed to fetch private key');
  }
}

export async function create(req: CustomRequest, res: Response): Promise<void> {
  const { name, private_key } = req.body ?? {};
  if (!name || !private_key) return fail(res, 'name and private_key are required', 422, 'VALIDATION');
  try {
    ok(res, await service.createPrivateKey(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    logger.error('createPrivateKey error', { message: (err as Error).message });
    fail(res, 'Failed to create private key');
  }
}

export async function remove(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await service.deletePrivateKey(req.user!.currentTeamId!, String(req.params.uuid));
    if (!deleted) return fail(res, 'Private key not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    logger.error('deletePrivateKey error', { message: (err as Error).message });
    fail(res, 'Failed to delete private key');
  }
}
