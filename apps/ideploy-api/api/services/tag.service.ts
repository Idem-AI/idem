/**
 * Tags + taggables. Ports Coolify's Tag model (team-scoped) and the
 * polymorphic taggables pivot. Resources are referenced by their model class.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';

export interface Tag {
  id: number;
  uuid: string;
  name: string;
}

function map(r: Record<string, unknown>): Tag {
  return { id: Number(r.id), uuid: String(r.uuid), name: String(r.name) };
}

export async function list(teamId: number): Promise<Tag[]> {
  const { rows } = await pool.query('SELECT id, uuid, name FROM tags WHERE team_id = $1 ORDER BY name', [
    teamId,
  ]);
  return rows.map(map);
}

export async function create(teamId: number, name: string): Promise<Tag> {
  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO tags (uuid, name, team_id, created_at, updated_at) VALUES ($1,$2,$3, now(), now())
     RETURNING id, uuid, name`,
    [uuid, name, teamId]
  );
  return map(rows[0]);
}

export async function remove(teamId: number, uuid: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM tags WHERE team_id = $1 AND uuid = $2', [
    teamId,
    uuid,
  ]);
  return (rowCount ?? 0) > 0;
}

async function tagOwned(teamId: number, tagUuid: string): Promise<number> {
  const { rows } = await pool.query('SELECT id FROM tags WHERE team_id = $1 AND uuid = $2 LIMIT 1', [
    teamId,
    tagUuid,
  ]);
  if (!rows[0]) throw new Error('Tag not found');
  return Number(rows[0].id);
}

export async function attach(
  teamId: number,
  tagUuid: string,
  taggableType: string,
  taggableId: number
): Promise<void> {
  const tagId = await tagOwned(teamId, tagUuid);
  await pool.query(
    `INSERT INTO taggables (tag_id, taggable_id, taggable_type, created_at, updated_at)
     VALUES ($1,$2,$3, now(), now())
     ON CONFLICT (tag_id, taggable_id, taggable_type) DO NOTHING`,
    [tagId, taggableId, taggableType]
  );
}

export async function detach(
  teamId: number,
  tagUuid: string,
  taggableType: string,
  taggableId: number
): Promise<void> {
  const tagId = await tagOwned(teamId, tagUuid);
  await pool.query(
    `DELETE FROM taggables WHERE tag_id = $1 AND taggable_id = $2 AND taggable_type = $3`,
    [tagId, taggableId, taggableType]
  );
}
