/**
 * Authorization guards — who may do a thing, once `authenticate` has settled
 * who they are.
 *
 * Two distinct notions of "admin" exist and conflating them is a privilege
 * escalation waiting to happen:
 *
 *  - **Team role** (`team_user.role`): owner/admin *of one team*. Governs the
 *    team's own resources.
 *  - **Instance role** (`users.idem_role`): administrator *of the deployment*.
 *    Governs settings that affect every team.
 *
 * Being an owner of your own team must not grant the second. `requireTeamAdmin`
 * and `requireInstanceAdmin` are therefore separate and never substitutable.
 */
import { Response, NextFunction } from 'express';
import { CustomRequest } from '../interfaces/express.interface';
import { fail } from '../utils/response';
import logger from '../config/logger';
import pool from '../config/db.config';
import { roleOf } from '../services/team.service';

/** Instance-level roles that may administer the deployment. */
const INSTANCE_ADMIN_ROLES = new Set(['admin', 'owner', 'root', 'superadmin']);

/** Team roles that may act on a team's own resources beyond reading them. */
const TEAM_ADMIN_ROLES = new Set(['owner', 'admin']);

/**
 * Require the caller to administer *this deployment*.
 *
 * The role is read fresh from the database rather than taken from the session:
 * a demotion has to take effect on the next request, not on the next login.
 */
export async function requireInstanceAdmin(
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    fail(res, 'Unauthenticated.', 401, 'UNAUTHENTICATED');
    return;
  }

  try {
    const { rows } = await pool.query('SELECT idem_role FROM users WHERE id = $1 LIMIT 1', [userId]);
    const role = rows[0]?.idem_role ? String(rows[0].idem_role).toLowerCase() : null;

    if (!role || !INSTANCE_ADMIN_ROLES.has(role)) {
      // Logged because a refused administrative attempt is worth seeing.
      logger.warn('Instance admin action refused', { userId, role });
      fail(res, 'This action requires an instance administrator.', 403, 'NOT_INSTANCE_ADMIN');
      return;
    }
    next();
  } catch (err) {
    logger.error('requireInstanceAdmin failed', { message: (err as Error).message });
    fail(res, 'Authorization check failed.', 500, 'INTERNAL');
  }
}

/** Require owner/admin of the team the request is acting for. */
export async function requireTeamAdmin(
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.id;
  const teamId = req.user?.currentTeamId;
  if (!userId || !teamId) {
    fail(res, 'No team selected for this request.', 403, 'NO_TEAM');
    return;
  }

  try {
    const role = await roleOf(userId, teamId);
    if (!role || !TEAM_ADMIN_ROLES.has(role.toLowerCase())) {
      logger.warn('Team admin action refused', { userId, teamId, role });
      fail(res, 'This action requires the owner or an admin of this team.', 403, 'NOT_TEAM_ADMIN');
      return;
    }
    next();
  } catch (err) {
    logger.error('requireTeamAdmin failed', { message: (err as Error).message });
    fail(res, 'Authorization check failed.', 500, 'INTERNAL');
  }
}
