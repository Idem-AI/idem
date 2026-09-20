/**
 * Server domain service — CRUD + SSH validation + Docker install.
 * Ports the relevant bits of Coolify's Server model, ValidateServer and
 * InstallDocker actions. Team-scoped: every query is constrained to the
 * caller's current team.
 */
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import pool, { withTransaction } from '../config/db.config';
import logger from '../config/logger';
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';
import { executeRemoteCommand, testConnection, isLocalServer } from '../ssh/ssh';
import { encryptString } from '../utils/laravel-crypto';
import { conflict, notFound } from '../utils/errors';
import { DB_TYPES } from './database-types';
import {
  ProvisionResult,
  ServerReadiness,
  checkReadiness,
  provision,
} from './server-setup.service';
import { HealthProbe, probeServer } from './server-health.service';

/**
 * The Docker network every managed container joins, so resources in the same
 * environment can reach each other by container name. Matches the Laravel side.
 */
export const DEFAULT_NETWORK = 'ideploy';

function mapServer(row: Record<string, unknown>): ServerRow {
  return {
    id: Number(row.id),
    uuid: String(row.uuid),
    name: String(row.name),
    description: (row.description as string) ?? null,
    ip: String(row.ip),
    port: Number(row.port),
    user: String(row.user),
    team_id: Number(row.team_id),
    private_key_id: Number(row.private_key_id),
    proxy: (row.proxy as Record<string, unknown>) ?? null,
  };
}

export async function listServers(teamId: number): Promise<ServerRow[]> {
  const { rows } = await pool.query('SELECT * FROM servers WHERE team_id = $1 ORDER BY name', [teamId]);
  return rows.map(mapServer);
}

export async function getServer(teamId: number, uuid: string): Promise<ServerRow | null> {
  const { rows } = await pool.query('SELECT * FROM servers WHERE team_id = $1 AND uuid = $2 LIMIT 1', [
    teamId,
    uuid,
  ]);
  return rows[0] ? mapServer(rows[0]) : null;
}

export async function getServerById(teamId: number, id: number): Promise<ServerRow | null> {
  const { rows } = await pool.query('SELECT * FROM servers WHERE team_id = $1 AND id = $2 LIMIT 1', [
    teamId,
    id,
  ]);
  return rows[0] ? mapServer(rows[0]) : null;
}

export interface ServerSettings {
  /**
   * A real domain pointed at this server (a wildcard `A`/`ALIAS` record — e.g.
   * `*.apps.example.com` → the server's IP) replaces sslip.io for every
   * application on it. sslip.io itself resolves correctly everywhere (this
   * has been verified repeatedly against public resolvers) — where it fails
   * is specific client-side/ISP DNS resolvers that refuse or rate-limit
   * dynamic-DNS-style domains, which nothing on our side can fix. A domain
   * the operator actually controls has no such failure mode.
   */
  wildcardDomain: string | null;
}

/** Read this server's own settings row — created for every server at registration. */
export async function getServerSettings(teamId: number, uuid: string): Promise<ServerSettings> {
  const server = await getServer(teamId, uuid);
  if (!server) throw notFound('Server');
  const { rows } = await pool.query('SELECT wildcard_domain FROM server_settings WHERE server_id = $1 LIMIT 1', [
    server.id,
  ]);
  return { wildcardDomain: (rows[0]?.wildcard_domain as string | null) ?? null };
}

export async function updateServerSettings(
  teamId: number,
  uuid: string,
  dto: { wildcardDomain?: string | null }
): Promise<ServerSettings> {
  const server = await getServer(teamId, uuid);
  if (!server) throw notFound('Server');
  if (dto.wildcardDomain !== undefined) {
    const value = dto.wildcardDomain?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || null;
    await pool.query('UPDATE server_settings SET wildcard_domain = $1, updated_at = now() WHERE server_id = $2', [
      value,
      server.id,
    ]);
  }
  return getServerSettings(teamId, uuid);
}

export async function getPrivateKey(teamId: number, id: number): Promise<PrivateKeyRow | null> {
  const { rows } = await pool.query(
    'SELECT * FROM private_keys WHERE id = $1 AND team_id = $2 LIMIT 1',
    [id, teamId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    private_key: String(r.private_key),
    is_git_related: Boolean(r.is_git_related),
    team_id: Number(r.team_id),
  };
}

export interface CreateServerDto {
  name: string;
  description?: string;
  ip: string;
  port?: number;
  user?: string;
  private_key_id: number;
  /** Dedicated to building Docker images — no application ever deploys onto it. */
  is_build_server?: boolean;
  /** Docker Swarm role. Mutually exclusive; only meaningful for clustered setups. */
  is_swarm_manager?: boolean;
  is_swarm_worker?: boolean;
  /**
   * Part of the shared IDEM-managed fleet `placeOnManagedServer` places
   * workspaces onto — never client-settable, only ever set by the admin
   * server-management endpoints (`admin.service.ts`).
   */
  idem_managed?: boolean;
  country_code?: string | null;
  region?: string | null;
  city?: string | null;
}

export interface CreatedServer {
  server: ServerRow;
  /** The Docker destination created alongside it — resources deploy onto this. */
  destinationId: number;
}

/**
 * Insert a server together with everything that makes it usable.
 *
 * A bare `servers` row is not a working server. Two companions are mandatory,
 * and both were previously missing — which is why adding a server appeared to
 * succeed and then failed at deploy time with `NO_DESTINATION`:
 *
 *  - `server_settings` — a 1:1 row the schema expects. The Laravel model creates
 *    it in a `created` hook; every settings-aware feature (and the Laravel UI)
 *    breaks without it.
 *  - a `standalone_dockers` destination named `ideploy` — the network resources
 *    are deployed onto, and what makes them reachable from one another.
 *
 * All three are written in one transaction: a partially created server is worse
 * than no server, because nothing surfaces the missing pieces.
 */
async function insertServerWithDependencies(
  client: PoolClient,
  teamId: number,
  params: {
    name: string;
    description: string | null;
    ip: string;
    port: number;
    user: string;
    privateKeyId: number;
    isBuildServer: boolean;
    isSwarmManager: boolean;
    isSwarmWorker: boolean;
    idemManaged: boolean;
    countryCode: string | null;
    region: string | null;
    city: string | null;
  }
): Promise<CreatedServer> {
  const uuid = randomUUID();

  const { rows } = await client.query(
    `INSERT INTO servers
       (uuid, name, description, ip, port, "user", team_id, private_key_id, proxy,
        idem_managed, country_code, region, city, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}',$9,$10,$11,$12, now(), now()) RETURNING *`,
    [
      uuid,
      params.name,
      params.description,
      params.ip,
      params.port,
      params.user,
      teamId,
      params.privateKeyId,
      params.idemManaged,
      params.countryCode,
      params.region,
      params.city,
    ]
  );
  const server = mapServer(rows[0]);

  // Every other column has a database default; only the role flags are ours to set.
  await client.query(
    `INSERT INTO server_settings (server_id, is_build_server, is_swarm_manager, is_swarm_worker, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now())`,
    [server.id, params.isBuildServer, params.isSwarmManager, params.isSwarmWorker]
  );

  const destination = await client.query(
    `INSERT INTO standalone_dockers (uuid, name, network, server_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now()) RETURNING id`,
    [randomUUID(), DEFAULT_NETWORK, DEFAULT_NETWORK, server.id]
  );

  return { server, destinationId: Number(destination.rows[0].id) };
}

/**
 * Register a server. The Docker network itself is created on the host later, by
 * `installDocker` / `setUpServer`; this only records intent so the resource can
 * be targeted immediately.
 */
export async function createServer(teamId: number, dto: CreateServerDto): Promise<CreatedServer> {
  // Fail before opening a transaction if the key is not the team's to use.
  const key = await getPrivateKey(teamId, dto.private_key_id);
  if (!key) throw notFound('Private key');

  // A build server never also carries a Swarm role, and a server is at most one
  // of manager/worker — silently reconciled here rather than trusted from the
  // client, since a contradictory combination in the database is a stuck server.
  const isBuildServer = Boolean(dto.is_build_server);
  const isSwarmManager = !isBuildServer && Boolean(dto.is_swarm_manager);
  const isSwarmWorker = !isBuildServer && !isSwarmManager && Boolean(dto.is_swarm_worker);

  const created = await withTransaction((client) =>
    insertServerWithDependencies(client, teamId, {
      name: dto.name,
      description: dto.description ?? null,
      ip: dto.ip,
      port: dto.port ?? 22,
      user: dto.user ?? 'root',
      privateKeyId: dto.private_key_id,
      isBuildServer,
      isSwarmManager,
      isSwarmWorker,
      idemManaged: Boolean(dto.idem_managed),
      countryCode: dto.country_code ?? null,
      region: dto.region ?? null,
      city: dto.city ?? null,
    })
  );

  logger.info('Server created', {
    teamId,
    uuid: created.server.uuid,
    ip: dto.ip,
    destinationId: created.destinationId,
  });
  return created;
}

/** What is still deployed on a server, by kind. */
export interface ServerOccupancy {
  applications: number;
  databases: number;
  services: number;
  total: number;
}

/**
 * Resources are located by their destination, not by a direct server column:
 * `destination_id` + `destination_type` is how every resource table points at
 * the Docker network it runs on.
 */
const ON_SERVER_DESTINATION = `
  destination_id IN (SELECT id FROM standalone_dockers WHERE server_id = $1)
  AND destination_type LIKE '%StandaloneDocker'`;

async function countIn(table: string, serverId: number): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${table} WHERE ${ON_SERVER_DESTINATION}`,
    [serverId]
  );
  return Number(rows[0].count);
}

/** Everything currently deployed on a server. */
export async function getServerOccupancy(serverId: number): Promise<ServerOccupancy> {
  const databaseTables = [...new Set(Object.values(DB_TYPES).map((t) => t.table))];

  const [applications, services, ...databaseCounts] = await Promise.all([
    countIn('applications', serverId),
    countIn('services', serverId),
    ...databaseTables.map((table) => countIn(table, serverId)),
  ]);
  const databases = databaseCounts.reduce((sum, n) => sum + n, 0);

  return {
    applications,
    databases,
    services,
    total: applications + databases + services,
  };
}

/** One resource deployed on a server, flattened across the three kinds. */
export interface ServerResource {
  uuid: string;
  name: string;
  kind: 'application' | 'database' | 'service';
  /** The database engine (`postgresql`, `redis`, …) — null for the other kinds. */
  databaseType: string | null;
  status: string | null;
}

/**
 * Everything deployed on a server, as rows rather than counts.
 *
 * `getServerOccupancy` answers "may I delete this server"; this answers "what is
 * on it", which is what the detail screen shows. The table name is interpolated
 * from `DB_TYPES` — a closed, code-owned registry, never request input — while
 * the server id stays a bound parameter.
 */
export async function listServerResources(
  teamId: number,
  uuid: string
): Promise<ServerResource[]> {
  const server = await getServer(teamId, uuid);
  if (!server) throw notFound('Server');

  const selectFrom = (
    table: string,
    kind: ServerResource['kind'],
    dbType: string | null,
    // `services` has no status column of its own (a Service is a stack; its
    // status lives on its service_applications/service_databases rows) — a
    // bare `status` against it threw "column does not exist", uncaught,
    // inside this function's own `Promise.all`, so any server that had ever
    // hosted a Service failed to list *any* of its resources, silently.
    statusExpr = 'r.status'
  ) =>
    pool
      .query<{ uuid: string; name: string; status: string | null }>(
        `SELECT r.uuid, r.name, ${statusExpr} AS status FROM ${table} r WHERE ${ON_SERVER_DESTINATION} ORDER BY r.name`,
        [server.id]
      )
      .then(({ rows }) =>
        rows.map((r) => ({
          uuid: String(r.uuid),
          name: String(r.name),
          kind,
          databaseType: dbType,
          status: r.status ?? null,
        }))
      );

  // One entry per distinct table: several logical types share a table (keydb and
  // redis, for instance), and querying it twice would duplicate every row.
  const databaseTables = new Map<string, string>();
  for (const type of Object.values(DB_TYPES)) {
    if (!databaseTables.has(type.table)) databaseTables.set(type.table, type.key);
  }

  const SERVICE_STATUS_EXPR = `(
    SELECT sa.status FROM service_applications sa WHERE sa.service_id = r.id ORDER BY sa.id LIMIT 1
  )`;

  const groups = await Promise.all([
    selectFrom('applications', 'application', null),
    selectFrom('services', 'service', null, SERVICE_STATUS_EXPR),
    ...[...databaseTables].map(([table, key]) => selectFrom(table, 'database', key)),
  ]);

  return groups.flat();
}

/** Liveness and disk headroom for a single server, probed on demand. */
export async function getServerHealth(teamId: number, uuid: string): Promise<HealthProbe> {
  const { server, key } = await serverWithKey(teamId, uuid);
  return probeServer(server, key);
}

/**
 * Infrastructure rows tied to a server that the database will not clean up for
 * us: they either have no foreign key at all, or one with `NO ACTION`.
 *
 * This gap is inherited — the Laravel app has no delete hook either, so it
 * orphans these rows too, and a server holding an SSL certificate cannot be
 * deleted at all (the `NO ACTION` constraint rejects it). Cleaning up here fixes
 * our path without altering a Laravel-owned constraint; adding real cascading
 * foreign keys is worth doing once Laravel is retired and any existing orphans
 * have been purged.
 *
 * Order matters: children before the row they point at.
 */
const SERVER_INFRA_TABLES = [
  'ssl_certificates',
  'application_deployment_queues',
  'docker_cleanup_executions',
  'server_settings',
  'standalone_dockers',
  'swarm_dockers',
] as const;

/**
 * Delete a server and its infrastructure rows.
 *
 * Refuses while resources are still deployed on it: cascading would silently
 * destroy a customer's applications and databases. The caller is told what to
 * remove first.
 *
 * @returns false when no such server exists for the team.
 * @throws DomainError SERVER_HAS_RESOURCES when the server is still in use.
 */
export async function deleteServer(teamId: number, uuid: string): Promise<boolean> {
  const server = await getServer(teamId, uuid);
  if (!server) return false;

  const occupancy = await getServerOccupancy(server.id);
  if (occupancy.total > 0) {
    const parts = [
      occupancy.applications && `${occupancy.applications} application(s)`,
      occupancy.databases && `${occupancy.databases} database(s)`,
      occupancy.services && `${occupancy.services} service(s)`,
    ].filter(Boolean);

    throw conflict(
      'SERVER_HAS_RESOURCES',
      `This server still hosts ${parts.join(', ')}. Delete or move them before removing the server.`
    );
  }

  await withTransaction(async (client) => {
    for (const table of SERVER_INFRA_TABLES) {
      await client.query(`DELETE FROM ${table} WHERE server_id = $1`, [server.id]);
    }
    await client.query('DELETE FROM servers WHERE id = $1', [server.id]);
  });

  logger.info('Server deleted', { teamId, uuid, serverId: server.id });
  return true;
}

/**
 * Create (or reuse) the "local" server — this machine, where Docker Desktop /
 * the local daemon runs. Commands execute directly (no SSH). Also ensures a
 * Docker destination so deployments can run immediately. Ideal for local testing.
 */
export async function ensureLocalServer(
  teamId: number
): Promise<{ server: ServerRow; destinationId: number; dockerOk: boolean }> {
  const found = await pool.query(
    `SELECT * FROM servers WHERE team_id = $1 AND ip IN ('127.0.0.1','localhost') ORDER BY id LIMIT 1`,
    [teamId]
  );

  let server: ServerRow;
  let destinationId: number;

  if (found.rows[0]) {
    server = mapServer(found.rows[0]);
    destinationId = await ensureDestination(server.id);
  } else {
    const created = await withTransaction(async (client) => {
      // `servers.private_key_id` is NOT NULL, but local execution never uses a
      // key: store a placeholder so the column is satisfied honestly.
      const key = await client.query(
        `INSERT INTO private_keys (uuid, name, description, private_key, is_git_related, team_id, created_at, updated_at)
         VALUES ($1, 'localhost', 'Placeholder key for the local server (no SSH used)', $2, false, $3, now(), now())
         RETURNING id`,
        [randomUUID(), encryptString('# local server — no SSH key needed'), teamId]
      );

      return insertServerWithDependencies(client, teamId, {
        name: 'localhost',
        description: 'This machine (local Docker)',
        ip: '127.0.0.1',
        port: 22,
        user: process.env.USER || process.env.USERNAME || 'root',
        privateKeyId: Number(key.rows[0].id),
        isBuildServer: false,
        isSwarmManager: false,
        isSwarmWorker: false,
        idemManaged: false,
        countryCode: null,
        region: null,
        city: null,
      });
    });
    server = created.server;
    destinationId = created.destinationId;
    logger.info('Local server created', { teamId, uuid: server.uuid });
  }

  // Local commands ignore the key entirely; a stub keeps the signature honest.
  const stubKey: PrivateKeyRow = {
    id: server.private_key_id,
    uuid: '',
    name: 'local',
    description: null,
    private_key: '',
    is_git_related: false,
    team_id: teamId,
  };

  const dockerProbe = await executeRemoteCommand(
    server,
    stubKey,
    'docker version --format "{{.Server.Version}}" 2>/dev/null || echo NO_DOCKER',
    { noRetry: true }
  );
  const dockerOk = !dockerProbe.stdout.includes('NO_DOCKER') && dockerProbe.exitCode === 0;

  if (dockerOk) {
    await executeRemoteCommand(server, stubKey, ensureNetworkCommand(DEFAULT_NETWORK), {
      noRetry: true,
    });
  }

  return { server, destinationId, dockerOk };
}

/** Idempotent: create the network only if it is not already there. */
function ensureNetworkCommand(network: string): string {
  return `docker network inspect ${network} >/dev/null 2>&1 || docker network create --attachable ${network}`;
}

/**
 * Backfill a destination for a server that predates atomic creation.
 *
 * Servers created before this was fixed have no `standalone_dockers` row, so
 * every deployment onto them fails. Repairing on read keeps them working without
 * a migration that would have to guess at network names.
 */
async function ensureDestination(serverId: number): Promise<number> {
  const existing = await pool.query(
    'SELECT id FROM standalone_dockers WHERE server_id = $1 ORDER BY id LIMIT 1',
    [serverId]
  );
  if (existing.rows[0]) return Number(existing.rows[0].id);

  const created = await pool.query(
    `INSERT INTO standalone_dockers (uuid, name, network, server_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, now(), now()) RETURNING id`,
    [randomUUID(), DEFAULT_NETWORK, DEFAULT_NETWORK, serverId]
  );
  logger.info('Backfilled the missing Docker destination for a server', { serverId });
  return Number(created.rows[0].id);
}

/** Validate connectivity + detect Docker. Ports ValidateServer. */
/** Resolve a server plus the key needed to reach it, or explain what is missing. */
async function serverWithKey(
  teamId: number,
  uuid: string
): Promise<{ server: ServerRow; key: PrivateKeyRow }> {
  const server = await getServer(teamId, uuid);
  if (!server) throw notFound('Server');

  const key = await getPrivateKey(teamId, server.private_key_id);
  if (!key) throw notFound('The private key configured for this server');

  return { server, key };
}

/**
 * Full readiness report: SSH, OS support, Docker engine and version, the Compose
 * plugin, the shared network and disk headroom — each with a remedy when it fails.
 */
export async function validateServer(teamId: number, uuid: string): Promise<ServerReadiness> {
  const { server, key } = await serverWithKey(teamId, uuid);
  return checkReadiness(server, key);
}

/**
 * Bring the server to a deployable state, streaming progress.
 *
 * Supersedes the previous `installDocker`, which only piped the Docker
 * convenience script: it left the daemon unconfigured (no log rotation, so the
 * disk filled silently), the Compose plugin unverified and the shared network
 * absent.
 */
export async function setUpServer(
  teamId: number,
  uuid: string,
  onData?: (chunk: string) => void
): Promise<ProvisionResult> {
  const { server, key } = await serverWithKey(teamId, uuid);
  return provision(server, key, onData);
}

export interface DockerCleanupResult {
  success: boolean;
  /** Human-readable summary `docker system prune` prints — includes space reclaimed. */
  output: string;
}

/**
 * Reclaim disk space: dangling images, stopped containers, unused build cache,
 * and (opt-in) unused volumes/networks. Ports the on-demand half of
 * `DockerCleanup` — the scheduled/threshold-triggered half is a fuller feature
 * (cron settings UI, `server_settings.docker_cleanup_*`) not built yet.
 *
 * Never touches named volumes unless `pruneVolumes` is explicitly set: a
 * database's data directory is also an "unused volume" the moment its
 * container is stopped, and losing it silently is a much worse outcome than
 * a server that stays a bit fuller than it has to.
 */
export async function cleanupDocker(
  teamId: number,
  uuid: string,
  opts: { pruneVolumes?: boolean } = {},
  onData?: (chunk: string) => void
): Promise<DockerCleanupResult> {
  const { server, key } = await serverWithKey(teamId, uuid);
  const parts = ['docker system prune -af'];
  if (opts.pruneVolumes) parts.push('docker volume prune -f');
  const result = await executeRemoteCommand(server, key, parts.join(' && '), {
    onData,
    noRetry: true,
  });
  return { success: result.exitCode === 0, output: result.stdout + result.stderr };
}
