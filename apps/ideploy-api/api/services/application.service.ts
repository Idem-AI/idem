/**
 * Application domain service. Team-scoped via environment → project → team.
 * Ports the core of Coolify's Application model for the vertical slice
 * (create / list / get / env vars). Deployment lives in deployment.service.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
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
    status: (r.status as string) ?? null,
  };
}

/**
 * Public URL to open the app: the FQDN if set, else the first published host
 * port (local dev) as http://localhost:<port>. Null if not exposed yet.
 */
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

export async function listApplications(teamId: number, environmentId?: number): Promise<ApplicationRow[]> {
  const params: unknown[] = [teamId];
  let sql = `SELECT a.* FROM applications a
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
  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO applications
       (uuid, name, description, git_repository, git_branch, git_commit_sha,
        build_pack, ports_exposes, fqdn, environment_id, destination_id, destination_type,
        status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'HEAD',$6,$7,$8,$9,$10,$11,'exited', now(), now())
     RETURNING *`,
    [
      uuid,
      dto.name,
      dto.description ?? null,
      dto.git_repository,
      dto.git_branch ?? 'main',
      dto.build_pack ?? 'nixpacks',
      dto.ports_exposes ?? '3000',
      dto.fqdn ?? null,
      dto.environment_id,
      dto.destination_id ?? null,
      dto.destination_type ?? null,
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
