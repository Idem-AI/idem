/**
 * Server domain service — CRUD + SSH validation + Docker install.
 * Ports the relevant bits of Coolify's Server model, ValidateServer and
 * InstallDocker actions. Team-scoped: every query is constrained to the
 * caller's current team.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import logger from '../config/logger';
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';
import { executeRemoteCommand, testConnection } from '../ssh/ssh';

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
}

export async function createServer(teamId: number, dto: CreateServerDto): Promise<ServerRow> {
  const uuid = randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO servers (uuid, name, description, ip, port, "user", team_id, private_key_id, proxy, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}', now(), now()) RETURNING *`,
    [
      uuid,
      dto.name,
      dto.description ?? null,
      dto.ip,
      dto.port ?? 22,
      dto.user ?? 'root',
      teamId,
      dto.private_key_id,
    ]
  );
  logger.info('Server created', { teamId, uuid, ip: dto.ip });
  return mapServer(rows[0]);
}

export async function deleteServer(teamId: number, uuid: string): Promise<boolean> {
  const { rowCount } = await pool.query('DELETE FROM servers WHERE team_id = $1 AND uuid = $2', [
    teamId,
    uuid,
  ]);
  return (rowCount ?? 0) > 0;
}

/** Validate connectivity + detect Docker. Ports ValidateServer. */
export async function validateServer(
  teamId: number,
  uuid: string
): Promise<{ reachable: boolean; dockerInstalled: boolean; output: string }> {
  const server = await getServer(teamId, uuid);
  if (!server) throw new Error('Server not found');
  const key = await getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found for server');

  const conn = await testConnection(server, key);
  if (!conn.ok) {
    return { reachable: false, dockerInstalled: false, output: conn.output };
  }

  const docker = await executeRemoteCommand(
    server,
    key,
    'docker version --format "{{.Server.Version}}" 2>/dev/null || echo "NO_DOCKER"',
    { noRetry: true }
  );
  const dockerInstalled = !docker.stdout.includes('NO_DOCKER') && docker.exitCode === 0;
  return { reachable: true, dockerInstalled, output: docker.stdout.trim() };
}

/** Install Docker on the server. Ports InstallDocker (streams output). */
export async function installDocker(
  teamId: number,
  uuid: string,
  onData?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  const server = await getServer(teamId, uuid);
  if (!server) throw new Error('Server not found');
  const key = await getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found for server');

  const script = 'curl -fsSL https://get.docker.com | sh && docker version';
  const result = await executeRemoteCommand(server, key, script, {
    onData: (chunk) => onData?.(chunk),
  });
  return { success: result.exitCode === 0, output: result.stdout + result.stderr };
}
