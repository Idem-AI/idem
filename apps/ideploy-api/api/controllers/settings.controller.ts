import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import * as settings from '../services/settings.service';

export async function getInstance(_req: CustomRequest, res: Response): Promise<void> {
  ok(res, await settings.getInstanceSettings());
}

export async function updateInstance(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await settings.updateInstanceSettings(req.body ?? {}));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to update instance settings');
  }
}

export async function version(_req: CustomRequest, res: Response): Promise<void> {
  ok(res, settings.getVersion());
}

export async function changelogReads(req: CustomRequest, res: Response): Promise<void> {
  ok(res, await settings.getChangelogReads(req.user!.id));
}

export async function markChangelogRead(req: CustomRequest, res: Response): Promise<void> {
  if (!req.body?.release_tag) return fail(res, 'release_tag is required', 422, 'VALIDATION');
  await settings.markChangelogRead(req.user!.id, String(req.body.release_tag));
  ok(res, { read: true });
}

export async function search(req: CustomRequest, res: Response): Promise<void> {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return ok(res, []);
  ok(res, await settings.globalSearch(req.user!.currentTeamId!, q));
}
