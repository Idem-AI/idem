/**
 * Placement of workspaces onto IDEM-managed servers.
 *
 * A zone is a country (`servers.country_code`). Within the requested zone, a new
 * workspace goes to the healthy server that is most ready to receive it: the one
 * with the most free memory, CPU and disk, as measured by the health sweep
 * (server-health.service.ts, every minute). A workspace keeps its server for life
 * so its applications, databases and services share one Docker network; the
 * capacity guard (`assertServerCanHost`) refuses a new resource on a server that
 * can no longer take it rather than moving anything silently.
 *
 * Servers whose measurements are missing or stale still accept placements, but
 * only after every freshly measured server, ordered by `load_score` (the number
 * of resources they host, refreshed by the sweep). A server added a minute ago
 * is not blocked; a server whose figures are unknown does not beat one whose
 * figures are good.
 *
 * Note on the schema: `servers` carries duplicate pairs — `idem_managed` /
 * `managed_by_idem` and `load_score` / `idem_load_score`. `idem_managed` and
 * `load_score` are authoritative; the others are abandoned earlier attempts.
 */
import pool from '../config/db.config';
import logger from '../config/logger';
import { ServerRow } from '../models/ideploy.types';
import { unprocessable } from '../utils/errors';

/** Region used when a team cannot, or does not, choose one. */
export const DEFAULT_REGION = process.env.IDEM_DEFAULT_REGION || 'DE';

/** Measurements older than this no longer describe the server (the sweep runs every minute). */
export const METRICS_MAX_AGE_MS = parseInt(process.env.SCHEDULER_METRICS_MAX_AGE_SECONDS || '300', 10) * 1000;

/** Below this share of free disk a server takes no new resource (images and logs need room). */
export const MIN_FREE_DISK_RATIO = Number(process.env.SCHEDULER_MIN_FREE_DISK_PERCENT ?? 10) / 100;

/** Below this much usable memory a server takes no new resource, whatever is requested. */
export const MIN_FREE_MEMORY_MB = Number(process.env.SCHEDULER_MIN_FREE_MEMORY_MB ?? 256);

/** Weights of the readiness score; they sum to 1. */
export const READINESS_WEIGHTS = { memory: 0.4, cpu: 0.3, disk: 0.2, occupancy: 0.1 } as const;

/** What a server has, what is free on it, and what is already committed to it. */
export interface ServerCapacity {
  cpuCores: number | null;
  load1m: number | null;
  ramMb: number | null;
  memAvailableMb: number | null;
  diskGb: number | null;
  diskFreeGb: number | null;
  resourcesUpdatedAt: Date | null;
  /** Sum of the memory limits declared by the resources it hosts (0 = none declared). */
  reservedMemoryMb: number;
  /** Applications, services and databases it hosts. */
  resourceCount: number;
  /** `servers.max_applications`. */
  maxResources: number;
}

/** What the resource about to be placed asks for. 0 = not declared. */
export interface ResourceDemand {
  memoryMb: number;
}

export type ExclusionReason = 'full' | 'memory' | 'disk';

export interface Readiness {
  /** 0 (exhausted) to 1 (idle); only meaningful when `measured`. */
  score: number;
  /** True when fresh measurements were available. */
  measured: boolean;
  /** Set when the server must not take the resource. */
  excluded: ExclusionReason | null;
  /** Memory the resource could still get, when known. */
  freeMemoryMb: number | null;
}

export interface ManagedServerCandidate {
  id: number;
  uuid: string;
  name: string;
  countryCode: string | null;
  loadScore: number;
  capacity: ServerCapacity;
  readiness: Readiness;
}

const NO_DEMAND: ResourceDemand = { memoryMb: 0 };

/**
 * A Docker memory limit as stored on applications and databases (`'0'`, `'512m'`,
 * `'2g'`, a number of bytes…), in megabytes. `'0'` and anything unreadable mean
 * "no limit declared", i.e. 0.
 */
export function parseMemoryLimit(value: string | null | undefined): number {
  if (!value) return 0;
  const match = /^\s*(\d+(?:\.\d+)?)\s*([bkmg]?)b?\s*$/i.exec(value);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mb =
    unit === 'g' ? amount * 1024 : unit === 'm' ? amount : unit === 'k' ? amount / 1024 : amount / (1024 * 1024);
  return Math.round(mb);
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * How ready a server is to take one more resource. Pure, so the whole policy is
 * testable without a database.
 *
 * Free memory is the smaller of what the kernel reports as available and what is
 * left once the memory limits declared by hosted resources are subtracted from
 * the total: the first catches real usage, the second catches promises already
 * made to resources that are idle right now.
 */
export function assessReadiness(
  capacity: ServerCapacity,
  demand: ResourceDemand = NO_DEMAND,
  now: Date = new Date(),
  maxAgeMs: number = METRICS_MAX_AGE_MS
): Readiness {
  const occupancyFree = capacity.maxResources > 0 ? clamp01(1 - capacity.resourceCount / capacity.maxResources) : 0;

  if (capacity.resourceCount >= capacity.maxResources) {
    return { score: 0, measured: false, excluded: 'full', freeMemoryMb: null };
  }

  const fresh =
    capacity.resourcesUpdatedAt !== null && now.getTime() - capacity.resourcesUpdatedAt.getTime() <= maxAgeMs;
  if (!fresh || capacity.memAvailableMb === null) {
    return { score: 0, measured: false, excluded: null, freeMemoryMb: null };
  }

  const uncommitted = capacity.ramMb !== null ? capacity.ramMb - capacity.reservedMemoryMb : Infinity;
  const freeMemoryMb = Math.max(0, Math.min(capacity.memAvailableMb, uncommitted));

  if (freeMemoryMb < Math.max(MIN_FREE_MEMORY_MB, demand.memoryMb)) {
    return { score: 0, measured: true, excluded: 'memory', freeMemoryMb };
  }

  const diskRatio =
    capacity.diskGb && capacity.diskFreeGb !== null ? clamp01(capacity.diskFreeGb / capacity.diskGb) : null;
  if (diskRatio !== null && diskRatio < MIN_FREE_DISK_RATIO) {
    return { score: 0, measured: true, excluded: 'disk', freeMemoryMb };
  }

  // An unknown component counts as average rather than as good or bad.
  const memory = capacity.ramMb ? clamp01(freeMemoryMb / capacity.ramMb) : 0.5;
  const cpu =
    capacity.cpuCores && capacity.load1m !== null ? clamp01(1 - capacity.load1m / capacity.cpuCores) : 0.5;
  const disk = diskRatio ?? 0.5;

  const score =
    READINESS_WEIGHTS.memory * memory +
    READINESS_WEIGHTS.cpu * cpu +
    READINESS_WEIGHTS.disk * disk +
    READINESS_WEIGHTS.occupancy * occupancyFree;

  return { score: Math.round(score * 1000) / 1000, measured: true, excluded: null, freeMemoryMb };
}

/** Measured servers first, best score first; then the unmeasured ones, fewest resources first. */
export function compareCandidates(a: ManagedServerCandidate, b: ManagedServerCandidate): number {
  if (a.readiness.measured !== b.readiness.measured) return a.readiness.measured ? -1 : 1;
  if (a.readiness.measured && a.readiness.score !== b.readiness.score) return b.readiness.score - a.readiness.score;
  if (!a.readiness.measured && a.loadScore !== b.loadScore) return a.loadScore - b.loadScore;
  return a.id - b.id;
}

/** Every application, service and database hosted on a server, with its declared memory limit. */
const HOSTED_RESOURCES_SQL = (() => {
  const viaDestination = (table: string, limit: string) => `
    SELECT sd.server_id, ${limit} AS limits_memory
    FROM ${table} r JOIN standalone_dockers sd ON sd.id = r.destination_id
    WHERE r.destination_type LIKE '%StandaloneDocker' AND r.deleted_at IS NULL`;
  const databases = [
    'standalone_postgresqls',
    'standalone_mysqls',
    'standalone_mariadbs',
    'standalone_mongodbs',
    'standalone_redis',
    'standalone_keydbs',
    'standalone_dragonflies',
    'standalone_clickhouses',
  ];
  return [
    viaDestination('applications', 'r.limits_memory'),
    viaDestination('services', 'NULL::varchar'),
    ...databases.map((t) => viaDestination(t, 'r.limits_memory')),
  ].join('\n    UNION ALL');
})();

/** Resource count and declared memory per server. */
async function hostedResources(serverIds: number[]): Promise<Map<number, { count: number; reservedMb: number }>> {
  const totals = new Map<number, { count: number; reservedMb: number }>();
  if (serverIds.length === 0) return totals;

  const { rows } = await pool.query<{ server_id: string; limits_memory: string | null }>(
    `SELECT server_id, limits_memory FROM (${HOSTED_RESOURCES_SQL}) hosted WHERE server_id = ANY($1)`,
    [serverIds]
  );
  for (const row of rows) {
    const id = Number(row.server_id);
    const entry = totals.get(id) ?? { count: 0, reservedMb: 0 };
    entry.count += 1;
    entry.reservedMb += parseMemoryLimit(row.limits_memory);
    totals.set(id, entry);
  }
  return totals;
}

const toNumber = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/**
 * Healthy managed servers able to take a new resource, best first.
 *
 * "Healthy" means both reachable and usable: a server that answers SSH but has no
 * working Docker would accept the placement and fail every deployment onto it.
 * Servers that are full, short of memory or short of disk are left out.
 */
export async function listManagedServers(
  region?: string,
  demand: ResourceDemand = NO_DEMAND
): Promise<ManagedServerCandidate[]> {
  return (await rankManagedServers(region, demand)).filter((c) => c.readiness.excluded === null);
}

/** Same as `listManagedServers` but keeps the excluded servers, for the admin view. */
export async function rankManagedServers(
  region?: string,
  demand: ResourceDemand = NO_DEMAND,
  { healthyOnly = true }: { healthyOnly?: boolean } = {}
): Promise<ManagedServerCandidate[]> {
  const conditions = ['s.idem_managed = true'];
  if (healthyOnly) {
    conditions.push(
      'COALESCE(ss.is_reachable, false) = true',
      'COALESCE(ss.is_usable, false) = true',
      'COALESCE(ss.force_disabled, false) = false'
    );
  }
  const params: unknown[] = [];
  if (region) {
    params.push(region);
    conditions.push(`s.country_code = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT s.id, s.uuid, s.name, s.country_code, COALESCE(s.load_score, 0) AS load_score,
            s.cpu_cores, s.load_1m, s.ram_mb, s.mem_available_mb, s.disk_gb, s.disk_free_gb,
            s.resources_updated_at, s.max_applications
     FROM servers s
     JOIN server_settings ss ON ss.server_id = s.id
     WHERE ${conditions.join(' AND ')}`,
    params
  );

  const hosted = await hostedResources(rows.map((r) => Number(r.id)));
  const now = new Date();

  return rows
    .map((r) => {
      const id = Number(r.id);
      const usage = hosted.get(id) ?? { count: 0, reservedMb: 0 };
      const capacity: ServerCapacity = {
        cpuCores: toNumber(r.cpu_cores),
        load1m: toNumber(r.load_1m),
        ramMb: toNumber(r.ram_mb),
        memAvailableMb: toNumber(r.mem_available_mb),
        diskGb: toNumber(r.disk_gb),
        diskFreeGb: toNumber(r.disk_free_gb),
        resourcesUpdatedAt: r.resources_updated_at ? new Date(r.resources_updated_at) : null,
        reservedMemoryMb: usage.reservedMb,
        resourceCount: usage.count,
        maxResources: Number(r.max_applications ?? 50),
      };
      return {
        id,
        uuid: String(r.uuid),
        name: String(r.name),
        countryCode: (r.country_code as string) ?? null,
        loadScore: Number(r.load_score),
        capacity,
        readiness: assessReadiness(capacity, demand, now),
      };
    })
    .sort(compareCandidates);
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
  const candidates = preferred.length > 0 ? preferred : await listManagedServers();

  if (candidates.length === 0) {
    throw unprocessable(
      'NO_MANAGED_CAPACITY',
      'No IDEM-managed server is available right now. Try again shortly, or deploy on one of your own servers.'
    );
  }

  const chosen = candidates[0];
  const fellBackToAnyRegion = Boolean(region) && preferred.length === 0;
  logger.info('Workspace placed on a managed server', {
    serverId: chosen.id,
    region: chosen.countryCode,
    requestedRegion: region ?? null,
    fellBackToAnyRegion,
    measured: chosen.readiness.measured,
    readiness: chosen.readiness.score,
    candidates: candidates.length,
  });

  return {
    serverId: chosen.id,
    serverName: chosen.name,
    region: chosen.countryCode,
    fellBackToAnyRegion,
  };
}

/**
 * Refuse a new resource on a managed server that can no longer take it.
 *
 * A workspace never moves (its resources share one Docker network), so the only
 * honest answer when its server is full is a clear refusal. Customers' own
 * servers are theirs to fill: they are not checked.
 *
 * @throws DomainError SERVER_AT_CAPACITY
 */
export async function assertServerCanHost(serverId: number, demand: ResourceDemand = NO_DEMAND): Promise<void> {
  const [candidate] = (await rankManagedServers(undefined, demand, { healthyOnly: false })).filter(
    (c) => c.id === serverId
  );
  if (!candidate || candidate.readiness.excluded === null) return;

  const reason = {
    full: 'it hosts as many resources as it is allowed to',
    memory: 'it does not have enough free memory',
    disk: 'it is running out of disk space',
  }[candidate.readiness.excluded];

  logger.warn('Refused a new resource on a server at capacity', {
    serverId,
    reason: candidate.readiness.excluded,
    freeMemoryMb: candidate.readiness.freeMemoryMb,
    requestedMemoryMb: demand.memoryMb,
  });
  throw unprocessable(
    'SERVER_AT_CAPACITY',
    `This workspace's server cannot take a new resource right now: ${reason}. Create a new workspace, or remove unused resources from this one.`
  );
}

/**
 * Regions with managed capacity right now, for the region picker.
 *
 * Offering a region with no healthy server would let a user choose a placement we
 * then silently override.
 */
export async function listAvailableRegions(): Promise<string[]> {
  const servers = await listManagedServers();
  const regions = new Set(servers.map((s) => s.countryCode).filter((c): c is string => Boolean(c)));
  return [...regions].sort();
}

/**
 * Recompute a server's load score: the number of resources it currently hosts.
 * Used to order servers whose measurements are missing or stale.
 */
export async function refreshLoadScore(serverId: number): Promise<number> {
  const score = (await hostedResources([serverId])).get(serverId)?.count ?? 0;
  await pool.query('UPDATE servers SET load_score = $2 WHERE id = $1', [serverId, score]);
  return score;
}

/** Refresh every managed server's load score. Run by the health sweep. */
export async function refreshAllLoadScores(): Promise<number> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM servers WHERE idem_managed = true');
  const ids = rows.map((r) => Number(r.id));
  const hosted = await hostedResources(ids);
  for (const id of ids) {
    await pool.query('UPDATE servers SET load_score = $2 WHERE id = $1', [id, hosted.get(id)?.count ?? 0]);
  }
  return ids.length;
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
