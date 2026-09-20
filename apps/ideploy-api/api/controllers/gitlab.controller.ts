import { Request, Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as gitlab from '../services/gitlab.service';

/** GET /gitlab/auth/url — returns the GitLab authorize URL (authenticated). */
export async function authUrl(req: CustomRequest, res: Response): Promise<void> {
  if (!gitlab.isConfigured()) {
    return fail(res, 'GitLab OAuth is not configured (set GITLAB_CLIENT_ID/SECRET).', 503, 'GITLAB_NOT_CONFIGURED');
  }
  const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : undefined;
  ok(res, { authUrl: gitlab.getAuthUrl(req.user!.id, Date.now(), returnTo) });
}

/** GET /gitlab/auth/callback — OAuth redirect target (NOT authenticated; uses state). */
export async function callback(req: Request, res: Response): Promise<void> {
  const code = String(req.query.code ?? '');
  const state = String(req.query.state ?? '');
  if (!code || !state) {
    res.redirect(`${process.env.IDEPLOY_WEB_URL || 'http://localhost:4202'}/new-project?gitlab=error`);
    return;
  }
  const redirectUrl = await gitlab.handleCallback(code, state);
  res.redirect(redirectUrl);
}

/** GET /gitlab/user — connection status. */
export async function status(req: CustomRequest, res: Response): Promise<void> {
  try {
    const username = await gitlab.getStatus(req.user!.id);
    ok(res, { connected: Boolean(username), username });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to get GitLab status');
  }
}

/** GET /gitlab/repositories — list the user's projects. */
export async function repositories(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await gitlab.listRepos(req.user!.id));
  } catch (err) {
    logger.warn('gitlab listRepos error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to list projects', 400);
  }
}

/** GET /gitlab/detect?repo=namespace/project — auto-detect framework preset. */
export async function detect(req: CustomRequest, res: Response): Promise<void> {
  const repo = String(req.query.repo ?? '');
  if (!repo) return fail(res, 'repo is required', 422, 'VALIDATION');
  try {
    ok(res, await gitlab.detectFramework(req.user!.id, repo));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to detect framework');
  }
}

/** DELETE /gitlab/disconnect. */
export async function disconnect(req: CustomRequest, res: Response): Promise<void> {
  await gitlab.disconnect(req.user!.id);
  ok(res, { disconnected: true });
}
