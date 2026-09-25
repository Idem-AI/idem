/**
 * Application domain service. Team-scoped via environment → project → team.
 * Ports the core of Coolify's Application model for the vertical slice
 * (create / list / get / env vars). Deployment lives in deployment.service.
 */
import { randomUUID } from 'crypto';
import pool, { withTransaction } from '../config/db.config';
import logger from '../config/logger';
import { conflict } from '../utils/errors';
import { assertDomainsAvailable, generateFqdn, getServerForDestination, subdomainSlug } from './domain.service';
import { ApplicationRow } from '../models/ideploy.types';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';
import { appWorkdir } from '../docker/compose';

function mapApp(r: Record<string, unknown>): ApplicationRow {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    fqdn: (r.fqdn as string) ?? null,
    git_repository: (r.git_repository as string) ?? null,
    git_branch: (r.git_branch as string) ?? null,
    build_pack: (r.build_pack as string) ?? null,
    ports_exposes: (r.ports_exposes as string) ?? null,
    ports_mappings: (r.ports_mappings as string) ?? null,
    environment_id: Number(r.environment_id),
    destination_id: r.destination_id ? Number(r.destination_id) : null,
    destination_type: (r.destination_type as string) ?? null,
    project_id: r.project_id ? Number(r.project_id) : null,
    status: (r.status as string) ?? null,
    base_directory: (r.base_directory as string) ?? null,
    build_command: (r.build_command as string) ?? null,
    start_command: (r.start_command as string) ?? null,
    install_command: (r.install_command as string) ?? null,
    publish_directory: (r.publish_directory as string) ?? null,
    workspace_name: (r.workspace_name as string) ?? undefined,
    workspace_uuid: (r.workspace_uuid as string) ?? undefined,
  };
}

/**
 * Public URL to open the app: the FQDN if set, else the first published host
 * port (local dev) as http://localhost:<port>. Null if not exposed yet.
 */
/** An `fqdn` column may hold several comma-separated domains. */
function splitDomains(fqdn: string): string[] {
  return fqdn
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

export function computeAppLink(app: ApplicationRow): string | null {
  if (app.fqdn) {
    const f = app.fqdn.split(',')[0].trim();
    return /^https?:\/\//.test(f) ? f : `https://${f}`;
  }
  if (app.ports_mappings) {
    const first = app.ports_mappings.split(',')[0].trim(); // "hostPort:containerPort"
    const hostPort = first.split(':')[0];
    if (hostPort) return `http://localhost:${hostPort}`;
  }
  return null;
}

/** Verify an application belongs to the team and return it. */
export async function getApplication(teamId: number, uuid: string): Promise<ApplicationRow | null> {
  const { rows } = await pool.query(
    `SELECT a.* FROM applications a
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND a.uuid = $2 LIMIT 1`,
    [teamId, uuid]
  );
  return rows[0] ? mapApp(rows[0]) : null;
}

/**
 * Look up an application by primary key, without a team filter.
 *
 * For callers that have already established authorisation by another route — the
 * webhook handler, which authenticates by signature rather than by session.
 * Everything user-facing must keep going through the team-scoped `getApplication`.
 */
export async function getApplicationById(id: number): Promise<ApplicationRow | null> {
  const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? mapApp(rows[0]) : null;
}

export async function listApplications(teamId: number, environmentId?: number): Promise<ApplicationRow[]> {
  const params: unknown[] = [teamId];
  let sql = `SELECT a.*, p.name AS workspace_name, p.uuid AS workspace_uuid FROM applications a
     JOIN environments e ON e.id = a.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1`;
  if (environmentId) {
    params.push(environmentId);
    sql += ` AND a.environment_id = $2`;
  }
  sql += ' ORDER BY a.name';
  const { rows } = await pool.query(sql, params);
  return rows.map(mapApp);
}

export interface CreateApplicationDto {
  name: string;
  description?: string;
  environment_id: number;
  git_repository: string;
  git_branch?: string;
  build_pack?: string;
  ports_exposes?: string;
  fqdn?: string;
  destination_id?: number;
  destination_type?: string;
  base_directory?: string;
  build_command?: string;
  start_command?: string;
  install_command?: string;
  publish_directory?: string;
  /** The Project this belongs to, resolved server-side — never client-chosen. */
  project_id?: number | null;
}

/** Ensure the target environment belongs to the team. */
async function assertEnvironmentInTeam(teamId: number, environmentId: number): Promise<void> {
  const { rows } = await pool.query(
    `SELECT e.id FROM environments e
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND e.id = $2 LIMIT 1`,
    [teamId, environmentId]
  );
  if (!rows[0]) throw new Error('Environment not found in current team');
}

export async function createApplication(
  teamId: number,
  dto: CreateApplicationDto
): Promise<ApplicationRow> {
  await assertEnvironmentInTeam(teamId, dto.environment_id);

  // Refuse a domain another resource already serves: the proxy would resolve the
  // clash arbitrarily and one application would start answering for the other.
  if (dto.fqdn) {
    await assertDomainsAvailable(splitDomains(dto.fqdn));
  }

  const uuid = randomUUID();

  // No domain of its own means no HTTPS URL and no clean way to reach it — the
  // previous fallback (`http://localhost:{port}`) only worked when the browser
  // happened to be on the same machine as the server. Every application gets a
  // working hostname the moment it deploys, the same guarantee the Laravel side
  // gives via sslip.io.
  let fqdn = dto.fqdn ?? null;
  if (!fqdn && dto.destination_id) {
    const server = await getServerForDestination(dto.destination_id);
    if (server) {
      fqdn = await generateFqdn(server.id, server.ip, subdomainSlug(dto.name, uuid));
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO applications
       (uuid, name, description, git_repository, git_branch, git_commit_sha,
        build_pack, ports_exposes, fqdn, environment_id, destination_id, destination_type,
        base_directory, build_command, start_command, install_command, publish_directory,
        project_id, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'HEAD',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'exited', now(), now())
     RETURNING *`,
    [
      uuid,
      dto.name,
      dto.description ?? null,
      dto.git_repository,
      dto.git_branch ?? 'main',
      dto.build_pack ?? 'nixpacks',
      dto.ports_exposes ?? '3000',
      fqdn,
      dto.environment_id,
      dto.destination_id ?? null,
      dto.destination_type ?? null,
      dto.base_directory ?? '/',
      dto.build_command ?? null,
      dto.start_command ?? null,
      dto.install_command ?? null,
      dto.publish_directory ?? null,
      dto.project_id ?? null,
    ]
  );
  return mapApp(rows[0]);
}

/** Fields safe to update via the config screens (General / Source). */
export interface UpdateApplicationDto {
  name?: string;
  description?: string;
  fqdn?: string;
  git_repository?: string;
  git_branch?: string;
  build_pack?: string;
  ports_exposes?: string;
  ports_mappings?: string;
  install_command?: string;
  build_command?: string;
  start_command?: string;
  base_directory?: string;
  publish_directory?: string;
}

const UPDATABLE: (keyof UpdateApplicationDto)[] = [
  'name',
  'description',
  'fqdn',
  'git_repository',
  'git_branch',
  'build_pack',
  'ports_exposes',
  'ports_mappings',
  'install_command',
  'build_command',
  'start_command',
  'base_directory',
  'publish_directory',
];

export async function updateApplication(
  teamId: number,
  uuid: string,
  dto: UpdateApplicationDto
): Promise<ApplicationRow | null> {
  const existing = await getApplication(teamId, uuid);
  if (!existing) return null;

  if (dto.fqdn !== undefined && dto.fqdn !== existing.fqdn) {
    await assertDomainsAvailable(splitDomains(dto.fqdn), existing.id);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const field of UPDATABLE) {
    if (dto[field] !== undefined) {
      params.push(dto[field]);
      sets.push(`${field} = $${params.length}`);
    }
  }
  if (sets.length === 0) return existing;
  params.push(existing.id);
  const { rows } = await pool.query(
    `UPDATE applications SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
    params
  );
  return mapApp(rows[0]);
}

export async function setStatus(applicationId: number, status: string): Promise<void> {
  await pool.query('UPDATE applications SET status = $1, updated_at = now() WHERE id = $2', [
    status,
    applicationId,
  ]);
}

/** Pull request preview deployments for an application. */
export async function listPreviews(teamId: number, uuid: string): Promise<Record<string, unknown>[]> {
  const app = await getApplication(teamId, uuid);
  if (!app) throw new Error('Application not found');
  const { rows } = await pool.query(
    `SELECT uuid, pull_request_id, pull_request_html_url, fqdn, status
     FROM application_previews WHERE application_id = $1 ORDER BY pull_request_id`,
    [app.id]
  );
  return rows;
}

/** Morph type Laravel stores for an application in polymorphic tables. */
const APP_MODEL = 'App\\Models\\Application';

export type ServerCleanup = 'done' | 'failed' | 'skipped';

/**
 * Stop the application's stack, drop its volumes and remove its working
 * directory on the server. Best-effort: an unreachable server must not keep a
 * record alive forever, but the caller is told so it can say what is left.
 */
async function teardownOnServer(teamId: number, app: ApplicationRow): Promise<ServerCleanup> {
  const serverRef = await getApplicationServer(app.id);
  if (!serverRef) return 'skipped';

  try {
    const server = await serverService.getServerById(teamId, serverRef.serverId);
    if (!server) return 'skipped';
    const key = await serverService.getPrivateKey(teamId, server.private_key_id);
    if (!key) return 'failed';

    const workdir = appWorkdir(app);
    const result = await executeRemoteCommand(
      server,
      key,
      `if [ -d ${workdir} ]; then cd ${workdir} && docker compose down --volumes --remove-orphans; cd / && rm -rf ${workdir}; fi`
    );
    if (result.exitCode !== 0) {
      logger.warn('Application teardown failed on server', { uuid: app.uuid, stderr: result.stderr });
      return 'failed';
    }
    return 'done';
  } catch (err) {
    logger.warn('Application teardown failed on server', { uuid: app.uuid, message: (err as Error).message });
    return 'failed';
  }
}

/**
 * Delete an application: its containers and volumes on the server, then every
 * row that points at it. Tables with a foreign key cascade on their own; the
 * polymorphic ones (env vars, volumes, tags, certificates) and the unkeyed
 * ones have to be cleared by hand or they outlive the application.
 *
 * Refused while a deployment is queued or running: the worker would otherwise
 * recreate the containers of an application that no longer exists.
 */
export async function deleteApplication(
  teamId: number,
  uuid: string
): Promise<{ serverCleanup: ServerCleanup } | null> {
  const app = await getApplication(teamId, uuid);
  if (!app) return null;

  const { rows: active } = await pool.query(
    `SELECT 1 FROM application_deployment_queues
     WHERE application_id = $1 AND status IN ('queued', 'in_progress') LIMIT 1`,
    [String(app.id)]
  );
  if (active[0]) {
    throw conflict(
      'DEPLOYMENT_IN_PROGRESS',
      'A deployment is running for this application. Wait for it to finish or cancel it, then delete.'
    );
  }

  const serverCleanup = await teardownOnServer(teamId, app);

  await withTransaction(async (client) => {
    const id = app.id;
    await client.query('DELETE FROM environment_variables WHERE resourceable_type = $1 AND resourceable_id = $2', [APP_MODEL, id]);
    await client.query('DELETE FROM local_persistent_volumes WHERE resource_type = $1 AND resource_id = $2', [APP_MODEL, id]);
    await client.query('DELETE FROM local_file_volumes WHERE resource_type = $1 AND resource_id = $2', [APP_MODEL, id]);
    await client.query('DELETE FROM ssl_certificates WHERE resource_type = $1 AND resource_id = $2', [APP_MODEL, id]);
    await client.query('DELETE FROM taggables WHERE taggable_type = $1 AND taggable_id = $2', [APP_MODEL, id]);
    await client.query(
      'DELETE FROM scheduled_task_executions WHERE scheduled_task_id IN (SELECT id FROM scheduled_tasks WHERE application_id = $1)',
      [id]
    );
    await client.query('DELETE FROM scheduled_tasks WHERE application_id = $1', [id]);
    await client.query('DELETE FROM application_previews WHERE application_id = $1', [id]);
    await client.query('DELETE FROM application_settings WHERE application_id = $1', [id]);
    await client.query('DELETE FROM application_deployment_queues WHERE application_id = $1', [String(id)]);
    await client.query('DELETE FROM applications WHERE id = $1', [id]);
  });

  logger.info('Application deleted', { uuid, teamId, serverCleanup });
  return { serverCleanup };
}

/** Run a docker compose lifecycle action (start/stop/restart) over SSH. */
export async function lifecycleAction(
  teamId: number,
  uuid: string,
  action: 'start' | 'stop' | 'restart'
): Promise<{ success: boolean; output: string }> {
  const app = await getApplication(teamId, uuid);
  if (!app) throw new Error('Application not found');
  const serverRef = await getApplicationServer(app.id);
  if (!serverRef) throw new Error('No server/destination resolved for this application');
  const server = await serverService.getServerById(teamId, serverRef.serverId);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found');

  const workdir = appWorkdir(app);
  const cmd =
    action === 'stop'
      ? `cd ${workdir} && docker compose down`
      : action === 'restart'
        ? `cd ${workdir} && docker compose restart`
        : `cd ${workdir} && docker compose up -d`;

  const result = await executeRemoteCommand(server, key, cmd);
  if (result.exitCode === 0) {
    await setStatus(app.id, action === 'stop' ? 'exited' : 'running');
  }
  return { success: result.exitCode === 0, output: result.stdout + result.stderr };
}

/** Resolve the app's server + key for ops commands. */
async function resolveAppServer(teamId: number, uuid: string) {
  const app = await getApplication(teamId, uuid);
  if (!app) throw new Error('Application not found');
  const ref = await getApplicationServer(app.id);
  if (!ref) throw new Error('No server/destination resolved for this application');
  const server = await serverService.getServerById(teamId, ref.serverId);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found');
  return { app, server, key };
}

/** Container status (docker ps) for the application's managed containers. */
export async function getContainerStatus(teamId: number, uuid: string): Promise<string> {
  const { server, key } = await resolveAppServer(teamId, uuid);
  const r = await executeRemoteCommand(
    server,
    key,
    `docker ps -a --filter label=ideploy.applicationUuid=${uuid} --format '{{.Names}}\\t{{.Status}}'`,
    { noRetry: true }
  );
  return r.stdout.trim();
}

/** Live-ish resource metrics (docker stats, one snapshot). */
export async function getMetrics(teamId: number, uuid: string): Promise<string> {
  const { server, key } = await resolveAppServer(teamId, uuid);
  const r = await executeRemoteCommand(
    server,
    key,
    `docker stats --no-stream --format '{{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}' $(docker ps --filter label=ideploy.applicationUuid=${uuid} -q)`,
    { noRetry: true }
  );
  return r.stdout.trim();
}

/** One container's resource use, as numbers rather than a formatted string. */
export interface ContainerUsage {
  name: string;
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryLimitBytes: number | null;
  memoryPercent: number | null;
  networkInBytes: number | null;
  networkOutBytes: number | null;
}

/** `1.5GiB` / `937.2MB` / `0B` → bytes. Null when the field is unparseable. */
function parseSize(value: string): number | null {
  const match = /^([\d.]+)\s*([KMGTP]?i?B)$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  // Docker mixes IEC (GiB) and SI (GB) in the same output, so both are handled.
  const units: Record<string, number> = {
    b: 1,
    kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, pb: 1e15,
    kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4, pib: 1024 ** 5,
  };
  const factor = units[match[2].toLowerCase()];
  return factor ? Math.round(amount * factor) : null;
}

function parsePercent(value: string): number | null {
  const n = Number(value.trim().replace('%', ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse `docker stats` output into typed rows.
 *
 * Exported for its own sake: the format is fiddly enough (mixed IEC/SI units,
 * `--` for a container that is starting) that it deserves unit tests without a
 * server attached.
 */
export function parseDockerStats(stdout: string): ContainerUsage[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, cpu, memUsage, memPercent, netIo] = line.split('\t');
      // `1.2GiB / 4GiB`
      const [used, limit] = (memUsage ?? '').split('/').map((s) => s?.trim() ?? '');
      // `1.4kB / 648B`
      const [netIn, netOut] = (netIo ?? '').split('/').map((s) => s?.trim() ?? '');
      return {
        name: name ?? '',
        cpuPercent: parsePercent(cpu ?? ''),
        memoryUsedBytes: parseSize(used ?? ''),
        memoryLimitBytes: parseSize(limit ?? ''),
        memoryPercent: parsePercent(memPercent ?? ''),
        networkInBytes: parseSize(netIn ?? ''),
        networkOutBytes: parseSize(netOut ?? ''),
      };
    })
    .filter((row) => row.name !== '');
}

/**
 * Structured resource usage for the insights screen.
 *
 * A snapshot, not a time series: nothing in this schema records history, and
 * inventing a chart out of one sample would be a graph of a single point
 * pretending to be a trend. The screen polls if it wants movement.
 */
export async function getResourceUsage(teamId: number, uuid: string): Promise<ContainerUsage[]> {
  const { server, key } = await resolveAppServer(teamId, uuid);
  const r = await executeRemoteCommand(
    server,
    key,
    `docker stats --no-stream --format '{{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}\\t{{.NetIO}}' ` +
      `$(docker ps --filter label=ideploy.applicationUuid=${uuid} -q)`,
    { noRetry: true }
  );
  return parseDockerStats(r.stdout);
}

/** One-shot command execution inside the app's container (Execute Container Command). */
export async function execCommand(
  teamId: number,
  uuid: string,
  command: string
): Promise<{ exitCode: number; output: string }> {
  const { server, key } = await resolveAppServer(teamId, uuid);
  const target = `$(docker ps --filter label=ideploy.applicationUuid=${uuid} --format '{{.Names}}' | head -1)`;
  const r = await executeRemoteCommand(server, key, `docker exec ${target} sh -c ${JSON.stringify(command)}`, {
    noRetry: true,
  });
  return { exitCode: r.exitCode, output: r.stdout + r.stderr };
}

/** Resolve the server (via destination) hosting an application. */
export async function getApplicationServer(
  applicationId: number
): Promise<{ serverId: number } | null> {
  // destination is a StandaloneDocker/SwarmDocker which has a server_id.
  const { rows } = await pool.query(
    `SELECT s.id AS server_id
     FROM applications a
     JOIN standalone_dockers sd ON sd.id = a.destination_id AND a.destination_type LIKE '%StandaloneDocker'
     JOIN servers s ON s.id = sd.server_id
     WHERE a.id = $1 LIMIT 1`,
    [applicationId]
  );
  return rows[0] ? { serverId: Number(rows[0].server_id) } : null;
}
