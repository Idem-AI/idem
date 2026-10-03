/**
 * CrowdSec on a server: install, status, extra bouncers.
 *
 * CrowdSec is provisioned together with the Traefik proxy (proxy.service.ts,
 * `startProxy`): same container name, same volumes, and the machine and bouncer
 * credentials the firewall needs are recorded in `servers.crowdsec_*` there.
 * "Install" therefore runs that same provisioning instead of a second,
 * divergent `docker run`, which used to delete the working container, recreate
 * it elsewhere without its Traefik route, and leave the stored password stale.
 */
import * as serverService from './server.service';
import { isBouncerKey, startProxy } from './proxy.service';
import { executeRemoteCommand } from '../ssh/ssh';
import { unprocessable } from '../utils/errors';

const CONTAINER = 'ideploy-crowdsec';

/** Bouncer names go into a shell command: keep them to a safe alphabet. */
const BOUNCER_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/i;

async function resolve(teamId: number, serverUuid: string) {
  const server = await serverService.getServer(teamId, serverUuid);
  if (!server) throw new Error('Server not found');
  const key = await serverService.getPrivateKey(teamId, server.private_key_id);
  if (!key) throw new Error('Private key not found for server');
  return { server, key };
}

/** Install (or repair) CrowdSec by provisioning the proxy stack it belongs to. */
export async function install(
  teamId: number,
  serverUuid: string,
  onData?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  return startProxy(teamId, serverUuid, onData);
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

/** Register a bouncer and return its API key (for another Traefik bouncer). */
export async function addBouncer(
  teamId: number,
  serverUuid: string,
  name: string
): Promise<{ apiKey: string }> {
  if (!BOUNCER_NAME.test(name)) {
    throw unprocessable('VALIDATION', 'A bouncer name may only contain letters, digits and dashes.');
  }
  const { server, key } = await resolve(teamId, serverUuid);
  const r = await executeRemoteCommand(
    server,
    key,
    `docker exec ${CONTAINER} cscli bouncers add ${name} -o raw`,
    { noRetry: true }
  );
  const apiKey = r.stdout.trim();
  if (r.exitCode !== 0 || !isBouncerKey(apiKey)) {
    throw unprocessable(
      'CROWDSEC_BOUNCER_FAILED',
      `CrowdSec did not register the bouncer: ${(r.stderr || r.stdout).trim().slice(0, 200) || 'no output'}`
    );
  }
  return { apiKey };
}
