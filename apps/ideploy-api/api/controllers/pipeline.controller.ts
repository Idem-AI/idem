import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as pipeline from '../services/pipeline.service';

const team = (req: CustomRequest) => req.user!.currentTeamId!;
const appUuid = (req: CustomRequest) => String(req.params.uuid);

export async function getConfig(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await pipeline.getOrCreateConfig(team(req), appUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to get pipeline config');
  }
}

export async function updateConfig(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await pipeline.updateConfig(team(req), appUuid(req), req.body ?? {}));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to update pipeline config');
  }
}

export async function trigger(req: CustomRequest, res: Response): Promise<void> {
  try {
    const result = await pipeline.trigger(team(req), appUuid(req), {
      branch: req.body?.branch,
      triggerType: 'manual',
    });
    ok(res, result, 202);
  } catch (err) {
    logger.error('triggerPipeline error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to trigger pipeline');
  }
}

export async function listExecutions(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await pipeline.listExecutions(team(req), appUuid(req)));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list executions');
  }
}

export async function getExecution(req: CustomRequest, res: Response): Promise<void> {
  try {
    const execution = await pipeline.getExecution(team(req), String(req.params.executionUuid));
    if (!execution) return fail(res, 'Execution not found', 404, 'NOT_FOUND');
    ok(res, execution);
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to fetch execution');
  }
}
