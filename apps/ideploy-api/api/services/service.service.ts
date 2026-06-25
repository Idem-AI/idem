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
import { ServiceRow } from '../models/ideploy.types';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';
import { serviceWorkdirFor } from '../utils/paths';

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
  };
}

export async function listServices(teamId: number, environmentId?: number): Promise<ServiceRow[]> {
  const params: unknown[] = [teamId];
  let sql = `SELECT s.* FROM services s
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
    `INSERT INTO services (uuid, name, service_type, docker_compose_raw, environment_id, destination_id, destination_type, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now(), now()) RETURNING *`,
    [
      uuid,
      dto.name,
      dto.service_type ?? 'custom',
      dto.docker_compose_raw,
      dto.environment_id,
      dto.destination_id,
      STANDALONE_DOCKER_MODEL,
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
  const { rows } = await pool.query('SELECT server_id FROM standalone_dockers WHERE id = $1 LIMIT 1', [
    destinationId,
  ]);
  if (!rows[0]) throw new Error('Destination not found');
  const server = await serverService.getServerById(teamId, Number(rows[0].server_id));
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found');
  return { server, key };
}

export async function lifecycle(
  teamId: number,
  uuid: string,
  action: 'start' | 'stop' | 'restart',
  onData?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  const service = await getService(teamId, uuid);
  if (!service) throw new Error('Service not found');
  if (!service.destination_id) throw new Error('Service has no destination');
  const { server, key } = await resolveServer(teamId, service.destination_id);

  const workdir = serviceWorkdir(uuid);
  let cmd: string;
  if (action === 'stop') {
    cmd = `cd ${workdir} && docker compose down`;
  } else if (action === 'restart') {
    cmd = `cd ${workdir} && docker compose restart`;
  } else {
    const b64 = Buffer.from(service.docker_compose_raw ?? '', 'utf8').toString('base64');
    cmd = [
      `mkdir -p ${workdir}`,
      `echo '${b64}' | base64 -d > ${workdir}/docker-compose.yml`,
      `docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy`,
      `cd ${workdir} && docker compose pull --quiet 2>/dev/null; docker compose up -d --remove-orphans`,
    ].join(' && ');
  }

  const result = await executeRemoteCommand(server, key, cmd, { onData });
  await setStatus(service.id, result.exitCode === 0 && action !== 'stop' ? 'running' : 'exited');
  return { success: result.exitCode === 0, output: result.stdout + result.stderr };
}

async function setStatus(serviceId: number, status: string): Promise<void> {
  await pool.query('UPDATE service_applications SET status = $1 WHERE service_id = $2', [status, serviceId]);
}
