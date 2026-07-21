import { Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import * as team from '../services/team.service';

const ctx = (req: CustomRequest) => ({ teamId: req.user!.currentTeamId!, userId: req.user!.id });

export async function get(req: CustomRequest, res: Response): Promise<void> {
  const { teamId } = ctx(req);
  const t = await team.getTeam(teamId);
  if (!t) return fail(res, 'Team not found', 404, 'NOT_FOUND');
  ok(res, t);
}

export async function update(req: CustomRequest, res: Response): Promise<void> {
  const { teamId, userId } = ctx(req);
  try {
    await team.requireAdmin(userId, teamId);
    ok(res, await team.updateTeam(teamId, req.body ?? {}));
  } catch (err) {
    fail(res, (err as Error).message, 403);
  }
}

export async function members(req: CustomRequest, res: Response): Promise<void> {
  ok(res, await team.listMembers(ctx(req).teamId));
}

export async function setRole(req: CustomRequest, res: Response): Promise<void> {
  const { teamId, userId } = ctx(req);
  try {
    await team.requireAdmin(userId, teamId);
    await team.updateMemberRole(teamId, Number(req.params.userId), String(req.body?.role));
    ok(res, { updated: true });
  } catch (err) {
    fail(res, (err as Error).message, 403);
  }
}

export async function removeMember(req: CustomRequest, res: Response): Promise<void> {
  const { teamId, userId } = ctx(req);
  try {
    await team.requireAdmin(userId, teamId);
    const removed = await team.removeMember(teamId, Number(req.params.userId));
    if (!removed) return fail(res, 'Member not found', 404, 'NOT_FOUND');
    ok(res, { removed: true });
  } catch (err) {
    fail(res, (err as Error).message, 403);
  }
}

export async function listInvitations(req: CustomRequest, res: Response): Promise<void> {
  ok(res, await team.listInvitations(ctx(req).teamId));
}

export async function createInvitation(req: CustomRequest, res: Response): Promise<void> {
  const { teamId, userId } = ctx(req);
  if (!req.body?.email) return fail(res, 'email is required', 422, 'VALIDATION');
  try {
    await team.requireAdmin(userId, teamId);
    const baseUrl = process.env.IDEPLOY_WEB_URL || 'http://localhost:4202';
    ok(res, await team.createInvitation(teamId, req.body, baseUrl), 201);
  } catch (err) {
    fail(res, (err as Error).message, 403);
  }
}

export async function deleteInvitation(req: CustomRequest, res: Response): Promise<void> {
  const { teamId, userId } = ctx(req);
  try {
    await team.requireAdmin(userId, teamId);
    const deleted = await team.deleteInvitation(teamId, String(req.params.uuid));
    if (!deleted) return fail(res, 'Invitation not found', 404, 'NOT_FOUND');
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, (err as Error).message, 403);
  }
}
