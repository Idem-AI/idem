/**
 * Instance administration — a view across every team, for whoever operates the
 * deployment.
 *
 * Deliberately read-mostly for teams/users. The destructive operations an
 * admin panel is often given (delete a team, impersonate a user) are absent
 * because nothing here needs them yet, and an endpoint that can erase another
 * team's data should exist only when there is a reason for it.
 *
 * The one thing this file does create is IDEM-managed servers — the shared
 * fleet `placeOnManagedServer` (server-scheduling.service) places SaaS
 * workspaces onto. That is additive infrastructure, not a cross-team
 * destructive action, and is the reason this admin surface exists at all: a
 * server a regular team registers is never `idem_managed` (server.routes.ts's
 * public schema does not accept the field), so promoting a machine into the
 * shared fleet can only happen here.
 */
import pool from '../config/db.config';
import * as serverService from './server.service';
import { CreatedServer } from './server.service';

export interface InstanceOverview {
  users: number;
  teams: number;
  servers: number;
  applications: number;
  databases: number;
  services: number;
  /** Servers no health check has reached on its last run. */
  unreachableServers: number;
}

async function count(sql: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(sql);
  return Number(rows[0]?.count ?? 0);
}

/** Headline figures for the whole deployment. */
export async function getOverview(): Promise<InstanceOverview> {
  const [users, teams, servers, applications, services, unreachableServers] = await Promise.all([
    count('SELECT count(*)::text AS count FROM users'),
    count('SELECT count(*)::text AS count FROM teams'),
    count('SELECT count(*)::text AS count FROM servers'),
    count('SELECT count(*)::text AS count FROM applications'),
    count('SELECT count(*)::text AS count FROM services'),
    count(
      `SELECT count(*)::text AS count FROM server_settings
       WHERE is_reachable = false`
    ).catch(() => 0),
  ]);

  // Databases live in one table per engine, so the total is their sum.
  const { rows: tables } = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'standalone_%'`
  );
  const databaseCounts = await Promise.all(
    tables.map((t) => count(`SELECT count(*)::text AS count FROM "${t.table_name}"`).catch(() => 0))
  );

  return {
    users,
    teams,
    servers,
    applications,
    databases: databaseCounts.reduce((sum, n) => sum + n, 0),
    services,
    unreachableServers,
  };
}

export interface AdminTeamRow {
  id: number;
  name: string;
  members: number;
  servers: number;
  createdAt: string | null;
}

/**
 * Every team with what it owns.
 *
 * Counts are computed in the query rather than by loading rows: an instance
 * with a few thousand teams should still answer in one round trip.
 */
export async function listTeams(): Promise<AdminTeamRow[]> {
  const { rows } = await pool.query(
    `SELECT t.id,
            t.name,
            t.created_at,
            (SELECT count(*) FROM team_user tu WHERE tu.team_id = t.id) AS members,
            (SELECT count(*) FROM servers s WHERE s.team_id = t.id)     AS servers
     FROM teams t
     ORDER BY t.name`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    members: Number(r.members),
    servers: Number(r.servers),
    createdAt: r.created_at ? String(r.created_at) : null,
  }));
}

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  instanceRole: string | null;
  teams: number;
  createdAt: string | null;
}

/** Every user. Nothing secret is selected — no tokens, no password material. */
export async function listUsers(limit = 200): Promise<AdminUserRow[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.idem_role, u.created_at,
            (SELECT count(*) FROM team_user tu WHERE tu.user_id = u.id) AS teams
     FROM users u
     ORDER BY u.created_at DESC NULLS LAST, u.id DESC
     LIMIT $1`,
    [limit]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    email: String(r.email),
    instanceRole: r.idem_role ? String(r.idem_role) : null,
    teams: Number(r.teams),
    createdAt: r.created_at ? String(r.created_at) : null,
  }));
}

// ── Server fleet ─────────────────────────────

export interface AdminServerRow {
  id: number;
  uuid: string;
  name: string;
  ip: string;
  team: string;
  idemManaged: boolean;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  loadScore: number;
  isReachable: boolean;
  isUsable: boolean;
  createdAt: string | null;
}

export interface ServerFleetStats {
  total: number;
  managed: number;
  client: number;
  reachable: number;
}

/** Every server on the instance — the operator's own plus every team's. */
export async function listServers(): Promise<AdminServerRow[]> {
  const { rows } = await pool.query(
    `SELECT s.id, s.uuid, s.name, s.ip, t.name AS team_name,
            s.idem_managed, s.country_code, s.region, s.city,
            COALESCE(s.load_score, 0) AS load_score,
            COALESCE(ss.is_reachable, false) AS is_reachable,
            COALESCE(ss.is_usable, false) AS is_usable,
            s.created_at
     FROM servers s
     JOIN teams t ON t.id = s.team_id
     LEFT JOIN server_settings ss ON ss.server_id = s.id
     ORDER BY s.idem_managed DESC, s.created_at DESC`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    ip: String(r.ip),
    team: String(r.team_name),
    idemManaged: Boolean(r.idem_managed),
    countryCode: (r.country_code as string) ?? null,
    region: (r.region as string) ?? null,
    city: (r.city as string) ?? null,
    loadScore: Number(r.load_score),
    isReachable: Boolean(r.is_reachable),
    isUsable: Boolean(r.is_usable),
    createdAt: r.created_at ? String(r.created_at) : null,
  }));
}

export async function getServerFleetStats(): Promise<ServerFleetStats> {
  const [total, managed, reachable] = await Promise.all([
    count('SELECT count(*)::text AS count FROM servers'),
    count('SELECT count(*)::text AS count FROM servers WHERE idem_managed = true'),
    count(
      `SELECT count(*)::text AS count FROM server_settings
       WHERE is_reachable = true`
    ).catch(() => 0),
  ]);
  return { total, managed, client: total - managed, reachable };
}

export interface CreateManagedServerDto {
  name: string;
  description?: string;
  ip: string;
  port?: number;
  user?: string;
  private_key_id: number;
  country_code?: string;
  region?: string;
  city?: string;
}

/**
 * Register a server into the shared IDEM-managed fleet.
 *
 * Owned by the operating admin's own team: the schema requires *some* team on
 * every server row (`servers.team_id` is `NOT NULL`), and `placeOnManagedServer`
 * never filters by team for `idem_managed` servers, so which team owns the row
 * has no bearing on who it can be placed for — unlike a client's own server,
 * it is never resolved through that team's own workspaces.
 */
export async function createManagedServer(
  adminTeamId: number,
  dto: CreateManagedServerDto
): Promise<CreatedServer> {
  return serverService.createServer(adminTeamId, {
    name: dto.name,
    description: dto.description,
    ip: dto.ip,
    port: dto.port,
    user: dto.user,
    private_key_id: dto.private_key_id,
    idem_managed: true,
    country_code: dto.country_code,
    region: dto.region,
    city: dto.city,
  });
}

/** Promote or demote an existing server from the shared fleet, or edit its placement geography. */
export async function updateServerFleetStatus(
  uuid: string,
  patch: { idem_managed?: boolean; country_code?: string | null; region?: string | null; city?: string | null }
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const push = (column: string, value: unknown): void => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };
  if (patch.idem_managed !== undefined) push('idem_managed', patch.idem_managed);
  if (patch.country_code !== undefined) push('country_code', patch.country_code);
  if (patch.region !== undefined) push('region', patch.region);
  if (patch.city !== undefined) push('city', patch.city);
  if (sets.length === 0) return true;

  params.push(uuid);
  const { rowCount } = await pool.query(
    `UPDATE servers SET ${sets.join(', ')}, updated_at = now() WHERE uuid = $${params.length}`,
    params
  );
  return (rowCount ?? 0) > 0;
}
