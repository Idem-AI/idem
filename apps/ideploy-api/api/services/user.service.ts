/**
 * Team resolution helpers for the authenticated user.
 *
 * Identity itself is owned by the central Idem API and synced via
 * idem-auth.service; this module only resolves which team a request acts on,
 * using the `team_user` pivot in iDeploy's own database.
 */
import pool from '../config/db.config';

/** Team ids the user belongs to (via the team_user pivot). */
export async function getUserTeamIds(userId: number): Promise<number[]> {
  const { rows } = await pool.query(
    'SELECT team_id FROM team_user WHERE user_id = $1 ORDER BY team_id ASC',
    [userId]
  );
  return rows.map((r) => Number((r as { team_id: number }).team_id));
}

/**
 * Resolve the current team for the request. If a team id is requested (e.g. via
 * an X-Current-Team header) it is honored only when the user is a member.
 */
export async function resolveCurrentTeam(
  userId: number,
  requestedTeamId?: number
): Promise<number | null> {
  const teamIds = await getUserTeamIds(userId);
  if (teamIds.length === 0) return null;
  if (requestedTeamId && teamIds.includes(requestedTeamId)) return requestedTeamId;
  return teamIds[0];
}
