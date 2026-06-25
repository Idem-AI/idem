import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import * as service from '../services/shared-env.service';
import { SharedScope } from '../services/shared-env.service';

const SCOPES: SharedScope[] = ['team', 'project', 'environment'];

function parseScope(req: CustomRequest): { scope: SharedScope; scopeId: number } | null {
  const scope = String(req.params.scope) as SharedScope;
  const scopeId = Number(req.params.scopeId);
  if (!SCOPES.includes(scope) || !scopeId) return null;
  return { scope, scopeId };
}

export async function list(req: CustomRequest, res: Response): Promise<void> {
  const parsed = parseScope(req);
  if (!parsed) return fail(res, 'Invalid scope', 422, 'VALIDATION');
  try {
    ok(res, await service.list(req.user!.currentTeamId!, parsed.scope, parsed.scopeId));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to list shared variables');
  }
}

export async function upsert(req: CustomRequest, res: Response): Promise<void> {
  const parsed = parseScope(req);
  if (!parsed) return fail(res, 'Invalid scope', 422, 'VALIDATION');
  const { key, value } = req.body ?? {};
  if (!key || value === undefined) return fail(res, 'key and value are required', 422, 'VALIDATION');
  try {
    ok(res, await service.upsert(req.user!.currentTeamId!, parsed.scope, parsed.scopeId, req.body), 201);
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to save shared variable');
  }
}

export async function remove(req: CustomRequest, res: Response): Promise<void> {
  const parsed = parseScope(req);
  if (!parsed) return fail(res, 'Invalid scope', 422, 'VALIDATION');
  try {
    const deleted = await service.remove(req.user!.currentTeamId!, parsed.scope, parsed.scopeId, String(req.params.key));
    if (!deleted) return fail(res, 'Variable not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to delete shared variable');
  }
}
