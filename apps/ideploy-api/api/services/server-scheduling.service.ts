/**
 * Placement of workspaces onto IDEM-managed servers.
 *
 * Ports the selection Laravel performs in `Project\AddEmpty::resolveIdemServer`
 * plus `IdemServerService`: among the managed fleet, prefer the requested region,
 * require the server to be healthy, and pick the least loaded one.
 *
 * Kept separate from `server.service` because the question is different: that
 * module answers "what is this team's server", this one answers "which of *our*
 * servers should host this". They will diverge further as placement gains
 * strategies.
 *
 * Note on the schema: `servers` carries duplicate pairs — `idem_managed` /
 * `managed_by_idem` and `load_score` / `idem_load_score`. The Laravel queries use
 * `idem_managed` and `load_score`, so those are authoritative here too; the others
 * appear to be abandoned earlier attempts.
 */
import pool from '../config/db.config';
import logger from '../config/logger';
import { ServerRow } from '../models/ideploy.types';
import { unprocessable } from '../utils/errors';

/** Region used when a team cannot, or does not, choose one. */
export const DEFAULT_REGION = process.env.IDEM_DEFAULT_REGION || 'DE';

export interface ManagedServerCandidate {
  id: number;
  uuid: string;
  name: string;
  countryCode: string | null;
  loadScore: number;
}

const CANDIDATE_COLUMNS = `
  s.id, s.uuid, s.name, s.country_code, COALESCE(s.load_score, 0) AS load_score`;

/**
 * Healthy managed servers, least loaded first.
 *
 * "Healthy" means both reachable and usable: a server that answers SSH but has no
 * working Docker would accept the placement and fail every deployment onto it.
 */
export async function listManagedServers(region?: string): Promise<ManagedServerCandidate[]> {
  const conditions = [
    's.idem_managed = true',
    'COALESCE(ss.is_reachable, false) = true',
    'COALESCE(ss.is_usable, false) = true',
    'COALESCE(ss.force_disabled, false) = false',
  ];
  const params: unknown[] = [];

  if (region) {
    params.push(region);
    conditions.push(`s.country_code = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT ${CANDIDATE_COLUMNS}
     FROM servers s
     JOIN server_settings ss ON ss.server_id = s.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY load_score ASC, s.id ASC`,
    params
  );

  return rows.map((r) => ({
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    countryCode: (r.country_code as string) ?? null,
    loadScore: Number(r.load_score),
  }));
}

export interface Placement {
  serverId: number;
  serverName: string;
  /** Region actually used — may differ from the request, see `fellBackToAnyRegion`. */
  region: string | null;
  /** True when no healthy server existed in the requested region. */
  fellBackToAnyRegion: boolean;
}

/**
 * Choose a managed server for a workspace.
 *
 * Falls back to any region when the requested one has nothing healthy: a customer
 * is far better served by a running deployment elsewhere than by a refusal, and
 * the caller is told the preference was not honoured so it can surface that.
 *
 * @throws DomainError NO_MANAGED_CAPACITY when the managed fleet has nothing to offer.
 */
export async function placeOnManagedServer(region?: string): Promise<Placement> {
  const preferred = region ? await listManagedServers(region) : [];
  if (preferred.length > 0) {
    const chosen = preferred[0];
    return {
      serverId: chosen.id,
      serverName: chosen.name,
      region: chosen.countryCode,
      fellBackToAnyRegion: false,
    };
  }

  const anywhere = await listManagedServers();
  if (anywhere.length === 0) {
    throw unprocessable(
      'NO_MANAGED_CAPACITY',
      'No IDEM-managed server is available right now. Try again shortly, or deploy on one of your own servers.'
    );
  }

  const chosen = anywhere[0];
  if (region) {
    logger.warn('No healthy managed server in the requested region; placed elsewhere', {
      requestedRegion: region,
      chosenRegion: chosen.countryCode,
      serverId: chosen.id,
    });
  }

  return {
    serverId: chosen.id,
    serverName: chosen.name,
    region: chosen.countryCode,
    fellBackToAnyRegion: Boolean(region),
  };
}

/**
 * Regions with managed capacity right now, for the region picker.
 *
 * Offering a region with no healthy server would let a user choose a placement we
 * then silently override.
 */
export async function listAvailableRegions(): Promise<string[]> {
  const servers = await listManagedServers();
  const regions = new Set(
    servers.map((s) => s.countryCode).filter((c): c is string => Boolean(c))
  );
  return [...regions].sort();
}

/**
 * Recompute a server's load score: the number of resources it currently hosts.
 *
 * A count is a crude proxy for load — it ignores how heavy each resource is — but
 * it is the same measure the Laravel side ranks on, and it spreads placements
 * evenly, which is the point. Replacing it with real metrics later only changes
 * this function.
 */
export async function refreshLoadScore(serverId: number): Promise<number> {
  const { rows } = await pool.query<{ score: string }>(
    `SELECT (
       (SELECT count(*) FROM applications
         WHERE destination_id IN (SELECT id FROM standalone_dockers WHERE server_id = $1)
           AND destination_type LIKE '%StandaloneDocker')
       +
       (SELECT count(*) FROM services
         WHERE destination_id IN (SELECT id FROM standalone_dockers WHERE server_id = $1)
           AND destination_type LIKE '%StandaloneDocker')
     )::text AS score`,
    [serverId]
  );
  const score = Number(rows[0].score);

  await pool.query('UPDATE servers SET load_score = $2, updated_at = now() WHERE id = $1', [
    serverId,
    score,
  ]);
  return score;
}

/** Refresh every managed server's load score. Cheap enough to run on a schedule. */
export async function refreshAllLoadScores(): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM servers WHERE idem_managed = true'
  );
  for (const row of rows) {
    await refreshLoadScore(Number(row.id));
  }
  return rows.length;
}

/** Resolve the Docker destination on a managed server, creating it if absent. */
export async function destinationForServer(serverId: number): Promise<number> {
  const { rows } = await pool.query(
    'SELECT id FROM standalone_dockers WHERE server_id = $1 ORDER BY id LIMIT 1',
    [serverId]
  );
  if (!rows[0]) {
    throw unprocessable(
      'SERVER_NOT_PROVISIONED',
      'That server has no Docker destination yet. Run the server setup step first.'
    );
  }
  return Number(rows[0].id);
}

/** Narrow a full server row to the placement view. */
export function toCandidate(server: ServerRow, loadScore = 0): ManagedServerCandidate {
  return {
    id: server.id,
    uuid: server.uuid,
    name: server.name,
    countryCode: null,
    loadScore,
  };
}
