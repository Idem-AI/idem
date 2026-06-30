import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as service from '../services/destination.service';

export async function listForServer(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.listForServer(req.user!.currentTeamId!, String(req.params.serverUuid)));
  } catch (err) {
    logger.error('listDestinations error', { message: (err as Error).message });
    fail(res, 'Failed to list destinations');
  }
}

export async function create(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(
      res,
      await service.createDestination(
        req.user!.currentTeamId!,
        String(req.params.serverUuid),
        req.body ?? {}
      ),
      201
    );
  } catch (err) {
    logger.error('createDestination error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to create destination');
  }
}

export async function remove(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await service.deleteDestination(
      req.user!.currentTeamId!,
      String(req.params.uuid)
    );
    if (!deleted) return fail(res, 'Destination not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    logger.error('deleteDestination error', { message: (err as Error).message });
    fail(res, 'Failed to delete destination');
  }
}
