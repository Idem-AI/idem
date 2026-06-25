/**
 * CrowdSec deployment — installs/runs the CrowdSec agent container on a server
 * and reports status. Ports the essence of InstallCrowdSecJob /
 * CrowdSecDeploymentService (the agent runs as a Docker container with the
 * AppSec acquisition mounted).
 */
import * as serverService from './server.service';
import { executeRemoteCommand } from '../ssh/ssh';
import { crowdsecDir } from '../utils/paths';

const CONTAINER = 'ideploy-crowdsec';

async function resolve(teamId: number, serverUuid: string) {
  const server = await serverService.getServer(teamId, serverUuid);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found for server');
  return { server, key };
}

export async function install(
  teamId: number,
  serverUuid: string,
  onData?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  const { server, key } = await resolve(teamId, serverUuid);
  const dir = crowdsecDir();
  const script = [
    `mkdir -p ${dir}/config ${dir}/data`,
    `docker rm -f ${CONTAINER} 2>/dev/null || true`,
    `docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy`,
    `docker run -d --name ${CONTAINER} --restart unless-stopped --network ideploy ` +
      `-e COLLECTIONS="crowdsecurity/appsec-virtual-patching crowdsecurity/appsec-generic-rules" ` +
      `-v ${dir}/config:/etc/crowdsec ` +
      `-v ${dir}/data:/var/lib/crowdsec/data ` +
      `crowdsecurity/crowdsec:latest`,
    `sleep 3 && docker exec ${CONTAINER} cscli version`,
  ].join(' && ');

  const r = await executeRemoteCommand(server, key, script, { onData });
  return { success: r.exitCode === 0, output: r.stdout + r.stderr };
}

export async function status(
  teamId: number,
  serverUuid: string
): Promise<{ running: boolean; bouncers: string; raw: string }> {
  const { server, key } = await resolve(teamId, serverUuid);
  const r = await executeRemoteCommand(
    server,
    key,
    `docker inspect --format '{{.State.Status}}' ${CONTAINER} 2>/dev/null || echo absent; ` +
      `docker exec ${CONTAINER} cscli bouncers list 2>/dev/null || true`,
    { noRetry: true }
  );
  return {
    running: r.stdout.includes('running'),
    bouncers: r.stdout,
    raw: r.stdout,
  };
}

/** Register a bouncer and return its API key (for the Traefik bouncer). */
export async function addBouncer(
  teamId: number,
  serverUuid: string,
  name: string
): Promise<{ apiKey: string }> {
  const { server, key } = await resolve(teamId, serverUuid);
  const r = await executeRemoteCommand(
    server,
    key,
    `docker exec ${CONTAINER} cscli bouncers add ${name} -o raw`,
    { noRetry: true }
  );
  return { apiKey: r.stdout.trim() };
}
