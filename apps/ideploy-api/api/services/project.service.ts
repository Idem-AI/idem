/**
 * Project + Environment domain service. Team-scoped.
 * Ports Coolify's Project/Environment models for the vertical slice.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import { ProjectRow, EnvironmentRow } from '../models/ideploy.types';

function mapProject(r: Record<string, unknown>): ProjectRow {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    team_id: Number(r.team_id),
  };
}

function mapEnvironment(r: Record<string, unknown>): EnvironmentRow {
  return {
    id: Number(r.id),
    uuid: r.uuid ? String(r.uuid) : '',
    name: String(r.name),
    project_id: Number(r.project_id),
  };
}

export async function listProjects(teamId: number): Promise<ProjectRow[]> {
  const { rows } = await pool.query('SELECT * FROM projects WHERE team_id = $1 ORDER BY name', [teamId]);
  return rows.map(mapProject);
}

export async function getProject(teamId: number, uuid: string): Promise<ProjectRow | null> {
  const { rows } = await pool.query('SELECT * FROM projects WHERE team_id = $1 AND uuid = $2 LIMIT 1', [
    teamId,
    uuid,
  ]);
  return rows[0] ? mapProject(rows[0]) : null;
}

export async function createProject(
  teamId: number,
  dto: { name: string; description?: string }
): Promise<ProjectRow> {
  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO projects (uuid, name, description, team_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4, now(), now()) RETURNING *`,
    [uuid, dto.name, dto.description ?? null, teamId]
  );
  const project = mapProject(rows[0]);
  // Coolify always creates a default "production" environment.
  // `environments.uuid` is NOT NULL (added by a later migration) — set it.
  await pool.query(
    `INSERT INTO environments (uuid, name, project_id, created_at, updated_at)
     VALUES ($1, 'production', $2, now(), now())`,
    [randomUUID(), project.id]
  );
  return project;
}

export async function deleteProject(teamId: number, uuid: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM projects WHERE team_id = $1 AND uuid = $2', [
    teamId,
    uuid,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function listEnvironments(teamId: number, projectUuid: string): Promise<EnvironmentRow[]> {
  const { rows } = await pool.query(
    `SELECT e.* FROM environments e
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND p.uuid = $2 ORDER BY e.name`,
    [teamId, projectUuid]
  );
  return rows.map(mapEnvironment);
}
