/**
 * Proxy (Traefik) domain service — ports Coolify's Proxy actions
 * (StartProxy / StopProxy / CheckProxy / GetProxyConfiguration) for a server.
 * The proxy runs as the `ideploy-proxy` Docker Compose stack at the server's
 * proxy path; config + lifecycle are driven over SSH.
 */
import pool from '../config/db.config';
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';

const PROXY_PATH = '/data/ideploy/proxy';
const PROXY_CONTAINER = 'ideploy-proxy';

async function resolve(
  teamId: number,
  serverUuid: string
): Promise<{ server: ServerRow; key: PrivateKeyRow }> {
  const server = await serverService.getServer(teamId, serverUuid);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found for server');
  return { server, key };
}

/** The Traefik v3 compose, equivalent to Coolify's GetProxyConfiguration. */
export function buildTraefikCompose(): string {
  return `services:
  traefik:
    container_name: ${PROXY_CONTAINER}
    image: traefik:v3.1
    restart: unless-stopped
    extra_hosts:
      - host.docker.internal:host-gateway
    networks:
      - ideploy
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    healthcheck:
      test: wget -qO- http://localhost:80/ping || exit 1
      interval: 4s
      timeout: 2s
      retries: 5
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ${PROXY_PATH}:/traefik
    command:
      - --ping=true
      - --api.dashboard=true
      - --api.insecure=true
      - --entrypoints.http.address=:80
      - --entrypoints.https.address=:443
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --providers.file.directory=/traefik/dynamic/
      - --providers.file.watch=true
networks:
  ideploy:
    external: true
    name: ideploy
`;
}

export async function getProxyStatus(
  teamId: number,
  serverUuid: string
): Promise<{ status: 'running' | 'stopped' | 'unknown'; raw: string }> {
  const { server, key } = await resolve(teamId, serverUuid);
  const r = await executeRemoteCommand(
    server,
    key,
    `docker inspect --format '{{.State.Status}}' ${PROXY_CONTAINER} 2>/dev/null || echo "absent"`,
    { noRetry: true }
  );
  const out = r.stdout.trim();
  const status = out === 'running' ? 'running' : out === 'absent' ? 'stopped' : 'unknown';
  return { status, raw: out };
}

export async function startProxy(
  teamId: number,
  serverUuid: string,
  onData?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  const { server, key } = await resolve(teamId, serverUuid);
  const compose = buildTraefikCompose();
  const b64 = Buffer.from(compose, 'utf8').toString('base64');

  const script = [
    `mkdir -p ${PROXY_PATH}/dynamic`,
    `echo '${b64}' | base64 -d > ${PROXY_PATH}/docker-compose.yml`,
    `docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy`,
    `cd ${PROXY_PATH} && docker compose pull && docker compose up -d --remove-orphans`,
  ].join(' && ');

  const r = await executeRemoteCommand(server, key, script, { onData });
  await setProxyStatusColumn(server.id, r.exitCode === 0 ? 'running' : 'exited');
  return { success: r.exitCode === 0, output: r.stdout + r.stderr };
}

export async function stopProxy(
  teamId: number,
  serverUuid: string
): Promise<{ success: boolean; output: string }> {
  const { server, key } = await resolve(teamId, serverUuid);
  const r = await executeRemoteCommand(
    server,
    key,
    `docker rm -f ${PROXY_CONTAINER} 2>/dev/null; echo stopped`
  );
  await setProxyStatusColumn(server.id, 'exited');
  return { success: r.exitCode === 0, output: r.stdout + r.stderr };
}

/** Persist the proxy status inside the server's schemaless `proxy` JSON. */
async function setProxyStatusColumn(serverId: number, status: string): Promise<void> {
  await pool.query(
    `UPDATE servers
     SET proxy = jsonb_set(COALESCE(proxy, '{}')::jsonb, '{status}', to_jsonb($1::text), true),
         updated_at = now()
     WHERE id = $2`,
    [status, serverId]
  );
}
