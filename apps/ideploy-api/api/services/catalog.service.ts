/**
 * Catalog endpoints for the top-level nav screens: Git sources
 * (github_apps / gitlab_apps, read-only — they are created through the GitHub
 * connect flow) and S3 storages, which are fully managed here because scheduled
 * backups target them.
 *
 * Team-scoped; secrets are never returned.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import logger from '../config/logger';
import { encryptString } from '../utils/laravel-crypto';
import { conflict } from '../utils/errors';

export interface GitSource {
  uuid: string;
  name: string;
  provider: 'github' | 'gitlab';
  organization: string | null;
  html_url: string;
}

export async function listSources(teamId: number): Promise<GitSource[]> {
  const out: GitSource[] = [];
  try {
    const gh = await pool.query(
      'SELECT uuid, name, organization, html_url FROM github_apps WHERE team_id = $1 ORDER BY name',
      [teamId]
    );
    out.push(...gh.rows.map((r) => ({
      uuid: String(r.uuid),
      name: String(r.name),
      provider: 'github' as const,
      organization: (r.organization as string) ?? null,
      html_url: String(r.html_url),
    })));
  } catch {
    /* table may be absent */
  }
  try {
    const gl = await pool.query(
      'SELECT uuid, name, organization, html_url FROM gitlab_apps WHERE team_id = $1 ORDER BY name',
      [teamId]
    );
    out.push(...gl.rows.map((r) => ({
      uuid: String(r.uuid),
      name: String(r.name),
      provider: 'gitlab' as const,
      organization: (r.organization as string) ?? null,
      html_url: String(r.html_url),
    })));
  } catch {
    /* table may be absent */
  }
  return out;
}

export interface S3Storage {
  uuid: string;
  name: string;
  region: string;
  endpoint: string | null;
}

export async function listS3Storages(teamId: number): Promise<S3Storage[]> {
  const { rows } = await pool.query(
    'SELECT uuid, name, region, endpoint FROM s3_storages WHERE team_id = $1 ORDER BY name',
    [teamId]
  );
  return rows.map((r) => ({
    uuid: String(r.uuid),
    name: String(r.name),
    region: String(r.region),
    endpoint: (r.endpoint as string) ?? null,
  }));
}

export interface CreateS3StorageDto {
  name: string;
  bucket: string;
  key: string;
  secret: string;
  region?: string;
  endpoint?: string;
  description?: string;
}

/**
 * Register an S3-compatible bucket for backups to be copied to.
 *
 * The access key and secret are Laravel-encrypted at rest, consistent with how
 * every other credential in this schema is stored, and are never read back out
 * by any endpoint — only used by the backup worker.
 *
 * `is_usable` stays false until something actually writes to the bucket: the
 * credentials are unverified at this point, and claiming otherwise would make
 * a backup appear safe before anything has proved it.
 */
export async function createS3Storage(
  teamId: number,
  dto: CreateS3StorageDto
): Promise<S3Storage> {
  const { rows } = await pool.query(
    `INSERT INTO s3_storages
       (uuid, name, description, region, key, secret, bucket, endpoint, team_id, is_usable, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false, now(), now())
     RETURNING uuid, name, region, endpoint`,
    [
      randomUUID(),
      dto.name,
      dto.description ?? null,
      dto.region ?? 'us-east-1',
      encryptString(dto.key),
      encryptString(dto.secret),
      dto.bucket,
      dto.endpoint ?? null,
      teamId,
    ]
  );
  logger.info('S3 storage created', { teamId, name: dto.name, bucket: dto.bucket });
  const r = rows[0];
  return {
    uuid: String(r.uuid),
    name: String(r.name),
    region: String(r.region),
    endpoint: (r.endpoint as string) ?? null,
  };
}

/**
 * Remove an S3 storage.
 *
 * Refuses while a backup schedule still points at it: deleting it silently
 * would leave those schedules copying to a bucket that no longer resolves, and
 * the failure would only surface the next time a backup ran.
 */
export async function deleteS3Storage(teamId: number, uuid: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT id FROM s3_storages WHERE team_id = $1 AND uuid = $2 LIMIT 1',
    [teamId, uuid]
  );
  if (!rows[0]) return false;
  const id = Number(rows[0].id);

  const { rows: users } = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM scheduled_database_backups
     WHERE s3_storage_id = $1 AND save_s3 = true`,
    [id]
  );
  if (Number(users[0].count) > 0) {
    throw conflict(
      'S3_STORAGE_IN_USE',
      `This storage is still used by ${users[0].count} backup schedule(s). Point them elsewhere before deleting it.`
    );
  }

  await pool.query('DELETE FROM s3_storages WHERE id = $1', [id]);
  logger.info('S3 storage deleted', { teamId, uuid });
  return true;
}
