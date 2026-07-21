/**
 * Read-only catalog endpoints for the top-level nav screens that don't yet have
 * a full CRUD module: Git sources (github_apps / gitlab_apps) and S3 storages.
 * Team-scoped; secrets are never returned.
 */
import pool from '../config/db.config';

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
