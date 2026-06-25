import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import * as tagService from '../services/tag.service';

export async function list(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await tagService.list(req.user!.currentTeamId!));
  } catch {
    fail(res, 'Failed to list tags');
  }
}

export async function create(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.name) return fail(res, 'name is required', 422, 'VALIDATION');
  try {
    ok(res, await tagService.create(req.user!.currentTeamId!, String(req.body.name)), 201);
  } catch {
    fail(res, 'Failed to create tag (name may already exist)');
  }
}

export async function remove(req: CustomRequest, res: Response): Promise<void> {
  try {
    const deleted = await tagService.remove(req.user!.currentTeamId!, String(req.params.uuid));
    if (!deleted) return fail(res, 'Tag not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch {
    fail(res, 'Failed to delete tag');
  }
}

export async function attach(req: CustomRequest, res: Response): Promise<void> {
  const { taggable_type, taggable_id } = req.body ?? {};
  if (!taggable_type || !taggable_id)
    return fail(res, 'taggable_type and taggable_id are required', 422, 'VALIDATION');
  try {
    await tagService.attach(req.user!.currentTeamId!, String(req.params.uuid), String(taggable_type), Number(taggable_id));
    ok(res, { attached: true });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to attach tag');
  }
}

export async function detach(req: CustomRequest, res: Response): Promise<void> {
  const { taggable_type, taggable_id } = req.body ?? {};
  try {
    await tagService.detach(req.user!.currentTeamId!, String(req.params.uuid), String(taggable_type), Number(taggable_id));
    ok(res, { detached: true });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to detach tag');
  }
}
