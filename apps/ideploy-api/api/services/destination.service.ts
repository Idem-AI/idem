/**
 * Destination domain service — StandaloneDocker destinations (the Docker
 * network on a server that applications/services deploy into). Ports the core
 * of Coolify's StandaloneDocker model + NewDocker creation (which runs
 * `docker network create`). Team-scoped via the parent server.
 */
import { randomUUID } from 'crypto';
import pool from '../config/db.config';
import { StandaloneDockerRow } from '../models/ideploy.types';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';

function map(r: Record<string, unknown>): StandaloneDockerRow {
  return {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    network: String(r.network),
    server_id: Number(r.server_id),
  };
}

export async function listForServer(
  teamId: number,
  serverUuid: string
): Promise<StandaloneDockerRow[]> {
  const { rows } = await pool.query(
    `SELECT sd.* FROM standalone_dockers sd
     JOIN servers s ON s.id = sd.server_id
     WHERE s.team_id = $1 AND s.uuid = $2 ORDER BY sd.name`,
    [teamId, serverUuid]
  );
  return rows.map(map);
}

export interface CreateDestinationDto {
  name?: string;
  network?: string;
}

/**
 * Create a StandaloneDocker destination on a server and ensure the Docker
 * network exists on the host.
 */
export async function createDestination(
  teamId: number,
  serverUuid: string,
  dto: CreateDestinationDto
): Promise<StandaloneDockerRow> {
  const server = await serverService.getServer(teamId, serverUuid);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found for server');

  const network = dto.network || 'ideploy';
  const uuid = randomUUID();
  const name = dto.name || `${server.name}-${network}`;

  // Create the docker network on the host (idempotent).
  const result = await executeRemoteCommand(
    server,
    key,
    `docker network inspect ${network} >/dev/null 2>&1 || docker network create --attachable ${network}`
  );
  if (result.exitCode !== 0) {
    throw new Error(`Failed to create docker network: ${result.stderr.slice(0, 300)}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO standalone_dockers (uuid, name, network, server_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4, now(), now()) RETURNING *`,
    [uuid, name, network, server.id]
  );
  return map(rows[0]);
}

export async function deleteDestination(teamId: number, uuid: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM standalone_dockers sd
     USING servers s
     WHERE sd.server_id = s.id AND s.team_id = $1 AND sd.uuid = $2`,
    [teamId, uuid]
  );
  return (rowCount ?? 0) > 0;
}
