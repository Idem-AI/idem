/**
 * Instance settings (singleton), version/update info, changelog read tracking,
 * and global search. Ports InstanceSettings + the changelog/global-search
 * Livewire components.
 */
import pool from '../config/db.config';

const UPDATABLE = [
  'fqdn',
  'wildcard_domain',
  'default_redirect_404',
  'public_port_min',
  'public_port_max',
  'do_not_track',
  'is_auto_update_enabled',
  'is_registration_enabled',
] as const;

export async function getInstanceSettings(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query('SELECT * FROM instance_settings ORDER BY id LIMIT 1');
  return rows[0] ?? null;
}

export async function updateInstanceSettings(dto: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const current = await getInstanceSettings();
  if (!current) throw new Error('Instance settings row not found');
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const f of UPDATABLE) {
    if (dto[f] !== undefined) {
      params.push(dto[f]);
      sets.push(`${f} = $${params.length}`);
    }
  }
  if (sets.length === 0) return current;
  params.push(current.id);
  await pool.query(`UPDATE instance_settings SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
  return getInstanceSettings();
}

export function getVersion(): { version: string; autoUpdate: boolean } {
  return {
    version: process.env.IDEPLOY_VERSION || '1.0.0',
    autoUpdate: (process.env.IDEPLOY_AUTO_UPDATE ?? 'true') === 'true',
  };
}

// ── Changelog ─────────────────────────────────────────────
export async function markChangelogRead(userId: number, releaseTag: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_changelog_reads (user_id, release_tag, read_at, created_at, updated_at)
     VALUES ($1,$2, now(), now(), now())
     ON CONFLICT (user_id, release_tag) DO NOTHING`,
    [userId, releaseTag]
  );
}

export async function getChangelogReads(userId: number): Promise<string[]> {
  const { rows } = await pool.query('SELECT release_tag FROM user_changelog_reads WHERE user_id = $1', [
    userId,
  ]);
  return rows.map((r) => String(r.release_tag));
}

// ── Global search ─────────────────────────────────────────
export interface SearchHit {
  type: string;
  uuid: string;
  name: string;
}

export async function globalSearch(teamId: number, query: string): Promise<SearchHit[]> {
  const q = `%${query}%`;
  const hits: SearchHit[] = [];

  const projects = await pool.query(
    'SELECT uuid, name FROM projects WHERE team_id = $1 AND name ILIKE $2 LIMIT 10',
    [teamId, q]
  );
  hits.push(...projects.rows.map((r) => ({ type: 'project', uuid: String(r.uuid), name: String(r.name) })));

  const servers = await pool.query(
    'SELECT uuid, name FROM servers WHERE team_id = $1 AND name ILIKE $2 LIMIT 10',
    [teamId, q]
  );
  hits.push(...servers.rows.map((r) => ({ type: 'server', uuid: String(r.uuid), name: String(r.name) })));

  const apps = await pool.query(
    `SELECT a.uuid, a.name FROM applications a
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND a.name ILIKE $2 LIMIT 10`,
    [teamId, q]
  );
  hits.push(...apps.rows.map((r) => ({ type: 'application', uuid: String(r.uuid), name: String(r.name) })));

  const services = await pool.query(
    `SELECT s.uuid, s.name FROM services s
     JOIN environments e ON e.id = s.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND s.name ILIKE $2 LIMIT 10`,
    [teamId, q]
  );
  hits.push(...services.rows.map((r) => ({ type: 'service', uuid: String(r.uuid), name: String(r.name) })));

  return hits;
}
