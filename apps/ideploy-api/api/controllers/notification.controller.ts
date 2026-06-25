import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import * as service from '../services/notification.service';

export async function get(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.getSettings(String(req.params.channel), req.user!.currentTeamId!));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to get notification settings', 422);
  }
}

export async function update(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.updateSettings(String(req.params.channel), req.user!.currentTeamId!, req.body ?? {}));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to update notification settings', 422);
  }
}

export async function test(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await service.testSend(String(req.params.channel), req.user!.currentTeamId!, req.body?.message));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to send test notification');
  }
}
