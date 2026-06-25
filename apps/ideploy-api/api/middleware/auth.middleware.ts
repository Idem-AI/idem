/**
 * Authentication middleware — delegated, NOT a local auth system.
 *
 * Primary path: the httpOnly `session` cookie issued by the central Idem API.
 * We verify it by calling that API's `/auth/profile` (see idem-auth.service),
 * then sync the identity into iDeploy's `users` table and resolve the team.
 * This is the exact mechanism the Laravel app and the rest of the monorepo use.
 *
 * Secondary path: Sanctum personal access tokens (`Authorization: Bearer <PAT>`)
 * for the programmatic public API — these are iDeploy's own existing tokens
 * (`personal_access_tokens`), not a new auth system.
 */
import { Response, NextFunction } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { verifySession, syncUser } from '../services/idem-auth.service';
import { resolveCurrentTeam } from '../services/user.service';
import { verifyPat } from '../services/pat.service';
import { fail } from '../utils/response';
import logger from '../config/logger';

export async function authenticate(
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Session cookie (primary, user-facing).
  const sessionCookie = req.cookies?.session as string | undefined;
  if (sessionCookie) {
    const profile = await verifySession(sessionCookie);
    if (profile) {
      const user = await syncUser(profile);
      const requestedTeam = req.headers['x-current-team']
        ? parseInt(String(req.headers['x-current-team']), 10)
        : undefined;
      const currentTeamId = await resolveCurrentTeam(user.id, requestedTeam);
      req.user = { id: user.id, idemUid: user.idem_uid, email: user.email, name: user.name, currentTeamId };
      next();
      return;
    }
  }

  // 2. Sanctum PAT (programmatic public API).
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const pat = await verifyPat(header.slice(7));
      if (pat) {
        req.user = pat.user;
        next();
        return;
      }
    } catch (err) {
      logger.warn('PAT verification error', { message: (err as Error).message });
    }
  }

  fail(res, 'Unauthenticated: invalid or missing session', 401, 'UNAUTHENTICATED');
}

/** Guard requiring an active current team on the request. */
export function requireTeam(req: CustomRequest, res: Response, next: NextFunction): void {
  if (!req.user?.currentTeamId) {
    fail(res, 'No team selected for this request.', 403, 'NO_TEAM');
    return;
  }
  next();
}
