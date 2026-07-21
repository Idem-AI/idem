import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as service from '../services/proxy.service';

export async function status(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.getProxyStatus(req.user!.currentTeamId!, String(req.params.serverUuid)));
  } catch (err) {
    logger.error('proxyStatus error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to get proxy status');
  }
}

export async function start(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.startProxy(req.user!.currentTeamId!, String(req.params.serverUuid)));
  } catch (err) {
    logger.error('startProxy error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to start proxy');
  }
}

export async function stop(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.stopProxy(req.user!.currentTeamId!, String(req.params.serverUuid)));
  } catch (err) {
    logger.error('stopProxy error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to stop proxy');
  }
}

export async function configuration(req: CustomRequest, res: Response): Promise<void> {
  ok(res, { compose: service.buildTraefikCompose() });
}
