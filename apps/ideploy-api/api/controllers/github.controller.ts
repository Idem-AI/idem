import { Request, Response } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail } from '../utils/response';
import logger from '../config/logger';
import * as github from '../services/github.service';

/** GET /github/auth/url — returns the GitHub authorize URL (authenticated). */
export async function authUrl(req: CustomRequest, res: Response): Promise<void> {
  if (!github.isConfigured()) {
    return fail(res, 'GitHub OAuth is not configured (set GITHUB_CLIENT_ID/SECRET).', 503, 'GITHUB_NOT_CONFIGURED');
  }
  ok(res, { authUrl: github.getAuthUrl(req.user!.id, Date.now()) });
}

/** GET /github/auth/callback — OAuth redirect target (NOT authenticated; uses state). */
export async function callback(req: Request, res: Response): Promise<void> {
  const code = String(req.query.code ?? '');
  const state = String(req.query.state ?? '');
  if (!code || !state) {
    res.redirect(`${process.env.IDEPLOY_WEB_URL || 'http://localhost:4202'}/new-project?github=error`);
    return;
  }
  const redirectUrl = await github.handleCallback(code, state);
  res.redirect(redirectUrl);
}

/** GET /github/user — connection status. */
export async function status(req: CustomRequest, res: Response): Promise<void> {
  try {
    const username = await github.getStatus(req.user!.id);
    ok(res, { connected: Boolean(username), username });
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to get GitHub status');
  }
}

/** GET /github/repositories — list the user's repos. */
export async function repositories(req: CustomRequest, res: Response): Promise<void> {
  try {
    ok(res, await github.listRepos(req.user!.id));
  } catch (err) {
    logger.warn('listRepos error', { message: (err as Error).message });
    fail(res, (err as Error).message || 'Failed to list repositories', 400);
  }
}

/** GET /github/detect?repo=owner/name — auto-detect framework preset. */
export async function detect(req: CustomRequest, res: Response): Promise<void> {
  const repo = String(req.query.repo ?? '');
  if (!repo) return fail(res, 'repo is required', 422, 'VALIDATION');
  try {
    ok(res, await github.detectFramework(req.user!.id, repo));
  } catch (err) {
    fail(res, (err as Error).message || 'Failed to detect framework');
  }
}

/** DELETE /github/disconnect. */
export async function disconnect(req: CustomRequest, res: Response): Promise<void> {
  await github.disconnect(req.user!.id);
  ok(res, { disconnected: true });
}
