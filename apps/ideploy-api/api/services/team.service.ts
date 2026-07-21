/**
 * Team management — team details, members (roles), and invitations.
 * Ports Coolify's Team/TeamInvitation models + the Team Livewire components.
 * Role hierarchy: owner > admin > member.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';

export interface TeamMember {
  user_id: number;
  name: string;
  email: string;
  role: string;
}

export interface TeamInvitation {
  id: number;
  uuid: string;
  email: string;
  role: string;
  link: string;
}

/** The caller's role in a team (or null if not a member). */
export async function roleOf(userId: number, teamId: number): Promise<string | null> {
  const { rows } = await pool.query(
    'SELECT role FROM team_user WHERE user_id = $1 AND team_id = $2 LIMIT 1',
    [userId, teamId]
  );
  return rows[0] ? String(rows[0].role) : null;
}

export async function requireAdmin(userId: number, teamId: number): Promise<void> {
  const role = await roleOf(userId, teamId);
  if (role !== 'owner' && role !== 'admin') throw new Error('Forbidden: admin or owner role required');
}

export async function getTeam(teamId: number): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    'SELECT id, name, description, personal_team FROM teams WHERE id = $1 LIMIT 1',
    [teamId]
  );
  return rows[0] ?? null;
}

export async function updateTeam(
  teamId: number,
  dto: { name?: string; description?: string }
): Promise<Record<string, unknown> | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (dto.name !== undefined) {
    params.push(dto.name);
    sets.push(`name = $${params.length}`);
  }
  if (dto.description !== undefined) {
    params.push(dto.description);
    sets.push(`description = $${params.length}`);
  }
  if (sets.length === 0) return getTeam(teamId);
  params.push(teamId);
  await pool.query(`UPDATE teams SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
  return getTeam(teamId);
}

export async function listMembers(teamId: number): Promise<TeamMember[]> {
  const { rows } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email, tu.role
     FROM team_user tu JOIN users u ON u.id = tu.user_id
     WHERE tu.team_id = $1 ORDER BY tu.role, u.name`,
    [teamId]
  );
  return rows.map((r) => ({
    user_id: Number(r.user_id),
    name: String(r.name),
    email: String(r.email),
    role: String(r.role),
  }));
}

export async function updateMemberRole(teamId: number, userId: number, role: string): Promise<void> {
  if (!['owner', 'admin', 'member'].includes(role)) throw new Error('Invalid role');
  await pool.query('UPDATE team_user SET role = $1, updated_at = now() WHERE team_id = $2 AND user_id = $3', [
    role,
    teamId,
    userId,
  ]);
}

export async function removeMember(teamId: number, userId: number): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM team_user WHERE team_id = $1 AND user_id = $2', [
    teamId,
    userId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function listInvitations(teamId: number): Promise<TeamInvitation[]> {
  const { rows } = await pool.query(
    'SELECT id, uuid, email, role, link FROM team_invitations WHERE team_id = $1 ORDER BY created_at DESC',
    [teamId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    uuid: String(r.uuid),
    email: String(r.email),
    role: String(r.role),
    link: String(r.link),
  }));
}

export async function createInvitation(
  teamId: number,
  dto: { email: string; role?: string },
  baseUrl: string
): Promise<TeamInvitation> {
  const uuid = randomUUID();
  const link = `${baseUrl}/invitations/${uuid}`;
  const { rows } = await pool.query(
    `INSERT INTO team_invitations (uuid, team_id, email, role, link, via, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'link', now(), now()) RETURNING id, uuid, email, role, link`,
    [uuid, teamId, dto.email, dto.role ?? 'member', link]
  );
  return {
    id: Number(rows[0].id),
    uuid: String(rows[0].uuid),
    email: String(rows[0].email),
    role: String(rows[0].role),
    link: String(rows[0].link),
  };
}

export async function deleteInvitation(teamId: number, uuid: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM team_invitations WHERE team_id = $1 AND uuid = $2', [
    teamId,
    uuid,
  ]);
  return (rowCount ?? 0) > 0;
}
