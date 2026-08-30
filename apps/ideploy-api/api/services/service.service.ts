/**
 * Service (docker-compose stack) domain service. Ports Coolify's Service model
 * + Start/Stop/Restart/DeleteService actions. A Service stores a raw
 * docker-compose (`docker_compose_raw`) deployed as a stack on its destination
 * server. Team-scoped via environment → project → team.
 */
import { randomUUID } from 'crypto';
import YAML from 'yaml';
import pool from '../config/db.config';
import logger from '../config/logger';
import { ServiceRow, ServerRow, PrivateKeyRow } from '../models/ideploy.types';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';
import { serviceWorkdirFor } from '../utils/paths';
import { resolveCompose, ensureNamedVolumes, applyProxyLabels } from './service-variables.service';
import { getTemplatePort } from './templates.service';

const STANDALONE_DOCKER_MODEL = 'App\\Models\\StandaloneDocker';

function serviceWorkdir(uuid: string): string {
  return serviceWorkdirFor(uuid);
}

function mapService(r: Record<string, unknown>): ServiceRow {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    service_type: (r.service_type as string) ?? null,
    docker_compose_raw: (r.docker_compose_raw as string) ?? null,
    environment_id: Number(r.environment_id),
    destination_id: r.destination_id ? Number(r.destination_id) : null,
    destination_type: (r.destination_type as string) ?? null,
    project_id: r.project_id ? Number(r.project_id) : null,
    created_at: (r.created_at as Date | string | null) ?? null,
    updated_at: (r.updated_at as Date | string | null) ?? null,
    ...(r.status !== undefined ? { status: r.status as ServiceRow['status'] } : {}),
  };
}

/**
 * `running` only when every container is; `exited` only when none are;
 * `partial` for the state that used to be invisible entirely — one crashed
 * container inside an otherwise-healthy stack, indistinguishable from
 * "everything fine" before each container got its own status (see
 * `settleAndSync`). `unknown` is a stack with no containers recorded yet
 * (never started).
 */
export async function listServices(teamId: number, environmentId?: number): Promise<ServiceRow[]> {
  const params: unknown[] = [teamId];
  let sql = `SELECT s.*,
       (SELECT CASE
          WHEN COUNT(*) = 0 THEN 'unknown'
          WHEN COUNT(*) FILTER (WHERE sa.status = 'running') = COUNT(*) THEN 'running'
          WHEN COUNT(*) FILTER (WHERE sa.status = 'running') = 0 THEN 'exited'
          ELSE 'partial'
        END
        FROM service_applications sa WHERE sa.service_id = s.id) AS status
     FROM services s
     JOIN environments e ON e.id = s.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1`;
  if (environmentId) {
    params.push(environmentId);
    sql += ` AND s.environment_id = $2`;
  }
  sql += ' ORDER BY s.name';
  const { rows } = await pool.query(sql, params);
  return rows.map(mapService);
}

export async function getService(teamId: number, uuid: string): Promise<ServiceRow | null> {
  const { rows } = await pool.query(
    `SELECT s.* FROM services s
     JOIN environments e ON e.id = s.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND s.uuid = $2 LIMIT 1`,
    [teamId, uuid]
  );
  return rows[0] ? mapService(rows[0]) : null;
}

/** Sub-resources (containers) discovered from the compose. */
export async function getSubResources(serviceId: number): Promise<{
  applications: Record<string, unknown>[];
  databases: Record<string, unknown>[];
}> {
  const [apps, dbs] = await Promise.all([
    pool.query('SELECT uuid, name, fqdn, status FROM service_applications WHERE service_id = $1', [serviceId]),
    pool.query('SELECT uuid, name, status FROM service_databases WHERE service_id = $1', [serviceId]),
  ]);
  return { applications: apps.rows, databases: dbs.rows };
}

export interface CreateServiceDto {
  name: string;
  environment_id: number;
  destination_id: number;
  docker_compose_raw: string;
  service_type?: string;
  /** The Project this belongs to, resolved server-side — never client-chosen. */
  project_id?: number | null;
}

async function assertEnvironmentInTeam(teamId: number, environmentId: number): Promise<void> {
  const { rows } = await pool.query(
    `SELECT e.id FROM environments e JOIN projects p ON p.id = e.project_id
     WHERE p.team_id = $1 AND e.id = $2 LIMIT 1`,
    [teamId, environmentId]
  );
  if (!rows[0]) throw new Error('Environment not found in current team');
}

export async function createService(teamId: number, dto: CreateServiceDto): Promise<ServiceRow> {
  await assertEnvironmentInTeam(teamId, dto.environment_id);
  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO services
       (uuid, name, service_type, docker_compose_raw, environment_id, destination_id,
        destination_type, project_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), now()) RETURNING *`,
    [
      uuid,
      dto.name,
      dto.service_type ?? 'custom',
      dto.docker_compose_raw,
      dto.environment_id,
      dto.destination_id,
      STANDALONE_DOCKER_MODEL,
      dto.project_id ?? null,
    ]
  );
  const service = mapService(rows[0]);
  await syncSubResources(service);
  return service;
}

/** Parse the compose and (re)create service_applications rows for each service key. */
async function syncSubResources(service: ServiceRow): Promise<void> {
  if (!service.docker_compose_raw) return;
  let parsed: { services?: Record<string, unknown> };
  try {
    parsed = YAML.parse(service.docker_compose_raw) ?? {};
  } catch (err) {
    logger.warn('Could not parse service compose', { uuid: service.uuid, message: (err as Error).message });
    return;
  }
  const keys = Object.keys(parsed.services ?? {});
  await pool.query('DELETE FROM service_applications WHERE service_id = $1', [service.id]);
  for (const key of keys) {
    await pool.query(
      `INSERT INTO service_applications (uuid, name, status, service_id, created_at, updated_at)
       VALUES ($1,$2,'exited',$3, now(), now())`,
      [randomUUID(), key, service.id]
    );
  }
}

export async function deleteService(teamId: number, uuid: string): Promise<boolean> {
  const service = await getService(teamId, uuid);
  if (!service) return false;
  // Best-effort: tear down the stack on the host before deleting the record.
  try {
    await lifecycle(teamId, uuid, 'stop');
  } catch {
    /* ignore */
  }
  await pool.query('DELETE FROM service_applications WHERE service_id = $1', [service.id]);
  await pool.query('DELETE FROM service_databases WHERE service_id = $1', [service.id]);
  await pool.query('DELETE FROM services WHERE id = $1', [service.id]);
  return true;
}

async function resolveServer(teamId: number, destinationId: number) {
  const { rows } = await pool.query('SELECT server_id, network FROM standalone_dockers WHERE id = $1 LIMIT 1', [
    destinationId,
  ]);
  if (!rows[0]) throw new Error('Destination not found');
  const server = await serverService.getServerById(teamId, Number(rows[0].server_id));
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found');
  const network = rows[0].network ? String(rows[0].network) : null;
  return { server, key, network };
}

/**
 * How long after `docker compose up` to wait before trusting a container's
 * status. `up` itself reports success the moment Docker has *started* every
 * container — nothing about whether one immediately crashed (an unresolved
 * required secret, a bad healthcheck) is visible in that exit code, which is
 * exactly the gap that made a broken deploy look identical to a working one.
 */
const SERVICE_SETTLE_MS = 6000;

export async function lifecycle(
  teamId: number,
  uuid: string,
  action: 'start' | 'stop' | 'restart',
  onData?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  const service = await getService(teamId, uuid);
  if (!service) throw new Error('Service not found');
  if (!service.destination_id) throw new Error('Service has no destination');
  const { server, key, network } = await resolveServer(teamId, service.destination_id);

  const workdir = serviceWorkdir(uuid);
  const log = (line: string) => onData?.(line);

  if (action === 'stop') {
    const result = await executeRemoteCommand(server, key, `cd ${workdir} && docker compose down`, { onData });
    // `down` removes the containers outright — nothing left for `compose ps`
    // to report, so "every sub-resource is exited" is simply the true state.
    await pool.query('UPDATE service_applications SET status = $1, updated_at = now() WHERE service_id = $2', [
      'exited',
      service.id,
    ]);
    return { success: result.exitCode === 0, output: result.stdout + result.stderr };
  }

  if (action === 'restart') {
    const result = await executeRemoteCommand(server, key, `cd ${workdir} && docker compose restart`, { onData });
    await settleAndSync(server, key, workdir, service.id, log);
    return { success: result.exitCode === 0, output: result.stdout + result.stderr };
  }

  // start: resolve this template's `SERVICE_*` placeholders into real secrets
  // and a real domain — generated once and persisted, so this is a no-op on
  // every deploy after the first — then deploy the *resolved* compose, never
  // the raw template (which Docker Compose would otherwise fill the blanks
  // of with empty strings).
  await log('Resolving service variables (passwords, domains)…\n');
  const { compose: withVariables, fqdns } = await resolveCompose(
    service.id,
    service.docker_compose_raw ?? '',
    server.id,
    server.ip
  );
  // Coolify's templates rely on its deploy pipeline to auto-declare a named
  // volume's top-level entry; without it Compose refuses the file outright
  // ("undefined volume"), confirmed live against `activepieces`' own
  // `pg-data`/`redis_data` mounts.
  const withVolumes = ensureNamedVolumes(withVariables);
  // A resolved FQDN with no proxy route is unreachable — see
  // `applyProxyLabels`'s own doc comment for why this is not optional. The
  // port comes from the template's own `port` field (Coolify's per-template
  // hint for its primary service); a template that never set one deploys
  // without a route rather than guessing wrong and breaking whatever the
  // container actually listens on.
  const resolvedCompose = applyProxyLabels(
    withVolumes,
    service.uuid,
    fqdns,
    network,
    getTemplatePort(service.service_type ?? '')
  );
  await pool.query('UPDATE services SET docker_compose = $1, updated_at = now() WHERE id = $2', [
    resolvedCompose,
    service.id,
  ]);
  for (const [name, fqdn] of fqdns) {
    await pool.query(
      `UPDATE service_applications SET fqdn = $1, updated_at = now()
       WHERE service_id = $2 AND lower(name) = lower($3)`,
      [`https://${fqdn}`, service.id, name]
    );
  }

  const b64 = Buffer.from(resolvedCompose, 'utf8').toString('base64');
  const cmd = [
    `mkdir -p ${workdir}`,
    `echo '${b64}' | base64 -d > ${workdir}/docker-compose.yml`,
    `docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy`,
    // `down` first: retry-safe. A previous failed attempt's containers (wrong
    // secrets, a since-fixed image tag) must not still be sitting there
    // conflicting with this one.
    `cd ${workdir} && docker compose down --remove-orphans 2>/dev/null; docker compose pull --quiet 2>/dev/null; docker compose up -d --remove-orphans`,
  ].join(' && ');

  const result = await executeRemoteCommand(server, key, cmd, { onData });
  await settleAndSync(server, key, workdir, service.id, log);
  return { success: result.exitCode === 0, output: result.stdout + result.stderr };
}

/**
 * Wait out `SERVICE_SETTLE_MS`, then read each container's *actual* state
 * from `docker compose ps` and write it onto its own `service_applications`
 * row — not one status blanket-applied to every container in the stack,
 * which could not tell "activepieces crashed, postgres and redis are fine"
 * from "everything is fine" or from "everything crashed".
 */
async function settleAndSync(
  server: ServerRow,
  key: PrivateKeyRow,
  workdir: string,
  serviceId: number,
  log: (line: string) => void
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SERVICE_SETTLE_MS));
  log(`\nChecking container status after ${SERVICE_SETTLE_MS / 1000}s…\n`);
  const r = await executeRemoteCommand(
    server,
    key,
    `cd ${workdir} && docker compose ps --format json 2>/dev/null`,
    { noRetry: true }
  );
  const lines = r.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  for (const line of lines) {
    try {
      const container = JSON.parse(line) as { Service?: string; State?: string };
      const name = container.Service;
      if (!name) continue;
      seen.add(name.toLowerCase());
      const state = (container.State ?? 'exited').toLowerCase();
      await pool.query(
        `UPDATE service_applications SET status = $1, updated_at = now()
         WHERE service_id = $2 AND lower(name) = lower($3)`,
        [state, serviceId, name]
      );
      log(`  ${name}: ${state}\n`);
    } catch {
      /* a non-JSON line (a warning `docker compose` printed to stdout) — not a container, skip it */
    }
  }
  // A sub-resource `docker compose ps` never reported (it exited so fast
  // Compose already reaped it, or never started) is not "still whatever it
  // was before" — it is exited, and staying silent about it is how a broken
  // deploy ends up looking identical to a working one.
  if (seen.size > 0) {
    await pool.query(
      `UPDATE service_applications SET status = 'exited', updated_at = now()
       WHERE service_id = $1 AND lower(name) <> ALL($2::text[])`,
      [serviceId, [...seen]]
    );
  }
}
