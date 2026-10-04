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
import { bouncerStaticFlags } from '../docker/labels';
import { geoBlockStaticFlags } from '../docker/protection';
import { sslipHost } from './domain.service';
import { encryptString, tryDecryptString } from '../utils/laravel-crypto';
import logger from '../config/logger';

import { proxyPath } from '../utils/paths';
const PROXY_PATH = proxyPath();
const PROXY_CONTAINER = 'ideploy-proxy';
const CROWDSEC_CONTAINER = 'ideploy-crowdsec';

/**
 * The admin subdomain CrowdSec's Local API is reached through from wherever
 * ideploy-api itself runs — which is not necessarily this server. Routed
 * through Traefik (TLS, already deployed) rather than a published host port:
 * no new raw port on the server's public interface, and CrowdSec's own
 * `X-Api-Key`/machine-JWT checks are what actually gate access once a request
 * arrives, same trust model as any other keyed webhook endpoint.
 */
export function crowdsecAdminHost(serverIp: string): string {
  return `crowdsec-admin.${sslipHost(serverIp)}`;
}

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

/**
 * Plugins the proxy must know about before any application's labels can use
 * them.
 *
 * A dynamic label referencing `plugin.bouncer` or `plugin.geoblock` means
 * nothing to a Traefik instance that was never told the plugin exists — that
 * declaration only happens here, in the static command, not in a per-application
 * label. Declared unconditionally, for every server: the proxy is shared across
 * tenants, plugins load once at start-up, and gating this on one tenant's
 * firewall setting would mean restarting a shared proxy the moment anyone
 * enables it.
 */
function pluginCommandFlags(): string {
  return [...bouncerStaticFlags(), ...geoBlockStaticFlags()].map((flag) => `      - ${flag}`).join('\n');
}

/**
 * The Traefik v3 compose, equivalent to Coolify's GetProxyConfiguration.
 *
 * Also declares the `crowdsec` service, on the same network and started
 * alongside it: the Traefik bouncer plugin (loaded via `pluginCommandFlags`
 * below) and every application's `crowdsec-*` middleware are inert labels
 * pointing at nothing without a live CrowdSec to consult, and the two are
 * meant to be provisioned as one unit rather than as a proxy that sometimes
 * has a firewall behind it and sometimes does not.
 *
 * `serverIp` names the admin route CrowdSec's Local API answers on for
 * ideploy-api's own management calls (`crowdsec-lapi.client.ts`) — omitted
 * only by the configuration-preview endpoint, which has no specific server in
 * mind; every real deployment (`startProxy`) always has one.
 */
export function buildTraefikCompose(serverIp?: string): string {
  const adminHost = crowdsecAdminHost(serverIp || 'YOUR_SERVER_IP');
  return `services:
  traefik:
    container_name: ${PROXY_CONTAINER}
    # Tracks the v3 line rather than a hard-pinned patch: Traefik's Docker
    # provider does not honour DOCKER_API_VERSION the way the Docker CLI
    # does (confirmed — setting it changed nothing), so its only real fix
    # against a newer daemon is a Traefik build with a newer bundled Docker
    # client. A pinned old patch silently rots as the Docker Engine API moves
    # on; this stays current with it. If a specific point release is ever
    # needed for reproducibility, pin it here instead — deliberately, not by
    # forgetting to bump this comment's date.
    image: traefik:v3
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
      # ping defaults to Traefik's internal API entrypoint (port 8080, from
      # --api.insecure), not the http one — while the healthcheck above
      # curls port 80. Without this the two never agree and the container
      # reports unhealthy forever despite serving traffic just fine. Matches
      # the Laravel side's own Traefik command.
      - --ping.entrypoint=http
      - --api.dashboard=true
      - --api.insecure=true
      - --entrypoints.http.address=:80
      - --entrypoints.https.address=:443
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --providers.file.directory=/traefik/dynamic/
      - --providers.file.watch=true
      # Every application's Traefik labels ask for tls.certresolver=letsencrypt
      # (docker/labels.ts's CERT_RESOLVER) — a router naming a resolver that
      # was never declared here just logs "nonexistent certificate resolver"
      # and serves no certificate at all, silently. This is what actually
      # defines it: HTTP-01 challenge, answered on the http entrypoint, state
      # kept in acme.json on the same bind-mounted volume as everything else
      # here so a container recreate doesn't re-request every certificate.
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=http
      - --certificatesresolvers.letsencrypt.acme.storage=/traefik/acme.json
${pluginCommandFlags()}
  crowdsec:
    container_name: ${CROWDSEC_CONTAINER}
    # Local API only — this container never watches logs itself (COLLECTIONS
    # left at the image default, i.e. none), because nothing here relies on
    # CrowdSec's own scenario-based detection yet. What it does today is serve
    # as the shared decision store: our own rules ban/unban addresses through
    # it (POST/DELETE /v1/alerts, /v1/decisions — see crowdsec-lapi.client.ts),
    # and every application's bouncer middleware asks it "is this address
    # banned" on each request. Both need it running; neither needs it parsing
    # anything.
    image: crowdsecurity/crowdsec:latest
    restart: unless-stopped
    networks:
      - ideploy
    volumes:
      - ${PROXY_PATH}/crowdsec/data:/var/lib/crowdsec/data
      - ${PROXY_PATH}/crowdsec/config:/etc/crowdsec
    healthcheck:
      test: ["CMD", "cscli", "lapi", "status"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 20s
    labels:
      - traefik.enable=true
      - traefik.http.routers.ideploy-crowdsec.rule=Host(\`${adminHost}\`)
      - traefik.http.routers.ideploy-crowdsec.entrypoints=https
      - traefik.http.routers.ideploy-crowdsec.tls.certresolver=letsencrypt
      - traefik.http.services.ideploy-crowdsec.loadbalancer.server.port=8080
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

/**
 * Shell step that frees the proxy's container names from containers this
 * Compose project does not own.
 *
 * The former "Install CrowdSec" created `ideploy-crowdsec` with a plain
 * `docker run`, outside the proxy's Compose project. Compose then refuses to
 * create its own container under the same name, and every later
 * `startProxy` failed on that conflict. A container whose Compose working
 * directory is not this project's is removed so Compose can create its own;
 * the proxy's own containers are left alone, and their data lives in bind
 * mounts either way.
 */
export function releaseForeignContainers(projectDir: string = PROXY_PATH): string {
  return [PROXY_CONTAINER, CROWDSEC_CONTAINER]
    .map(
      (name) =>
        `{ owner=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' ${name} 2>/dev/null) ` +
        `&& [ "$owner" != "${projectDir}" ] && echo "Removing ${name}, not managed by the proxy project" && docker rm -f ${name} >/dev/null; true; }`
    )
    .join(' && ');
}

export async function startProxy(
  teamId: number,
  serverUuid: string,
  onData?: (chunk: string) => void
): Promise<{ success: boolean; output: string }> {
  const { server, key } = await resolve(teamId, serverUuid);
  const compose = buildTraefikCompose(server.ip);
  const b64 = Buffer.from(compose, 'utf8').toString('base64');

  const script = [
    `mkdir -p ${PROXY_PATH}/dynamic ${PROXY_PATH}/crowdsec/data ${PROXY_PATH}/crowdsec/config`,
    `echo '${b64}' | base64 -d > ${PROXY_PATH}/docker-compose.yml`,
    `docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy`,
    `cd ${PROXY_PATH} && docker compose pull`,
    // After the pull, so a failed download never leaves the server without a proxy.
    releaseForeignContainers(),
    `docker compose up -d --remove-orphans`,
  ].join(' && ');

  const r = await executeRemoteCommand(server, key, script, { onData });
  await setProxyStatusColumn(server.id, r.exitCode === 0 ? 'running' : 'exited');

  if (r.exitCode === 0) {
    await ensureCrowdSecCredentials(server, key, onData);
  }

  return { success: r.exitCode === 0, output: r.stdout + r.stderr };
}

/**
 * First-run bootstrap for the CrowdSec container just started above: capture
 * the machine credentials it auto-generates on its own (`local_api_credentials.yaml`,
 * written once and persisted in the bind-mounted config volume from then on)
 * and register the one bouncer every application on this server shares.
 *
 * Idempotent and safe to call on every `startProxy`, not just the first —
 * both steps are skipped once `servers.crowdsec_*` already holds a value, so
 * a proxy restart never tries to re-register a bouncer name CrowdSec already
 * has (it would just error) or overwrite a working machine password.
 */
async function ensureCrowdSecCredentials(
  server: ServerRow,
  key: PrivateKeyRow,
  onData?: (chunk: string) => void
): Promise<void> {
  const { rows } = await pool.query(
    'SELECT crowdsec_bouncer_key, crowdsec_api_key FROM servers WHERE id = $1',
    [server.id]
  );
  const existing = rows[0] as { crowdsec_bouncer_key: string | null; crowdsec_api_key: string | null } | undefined;
  if (existing?.crowdsec_bouncer_key && existing?.crowdsec_api_key) {
    // Already provisioned — just confirm it is still answering.
    await markCrowdSecAvailability(server);
    return;
  }

  const waitScript = [
    // CrowdSec's healthcheck (cscli lapi status) needs the LAPI listening,
    // which needs the machine credentials file it writes on its own first
    // boot — give it real time before deciding it never came up.
    `for i in $(seq 1 30); do docker exec ${CROWDSEC_CONTAINER} test -f /etc/crowdsec/local_api_credentials.yaml && break; sleep 2; done`,
    `docker exec ${CROWDSEC_CONTAINER} cat /etc/crowdsec/local_api_credentials.yaml`,
  ].join(' && ');
  const creds = await executeRemoteCommand(server, key, waitScript, { onData, noRetry: true });
  const { machineId, password } = parseMachineCredentials(creds.stdout);

  if (!password) {
    logger.warn('CrowdSec did not produce machine credentials in time', {
      serverUuid: server.uuid,
      output: creds.stdout + creds.stderr,
    });
    return;
  }

  // A name unique per server, not per application: CrowdSec's decisions are
  // address-scoped and shared across every application the bouncer plugin is
  // attached to on this one server — one bouncer identity is the correct
  // model, not one per app (see firewall-enforcement.service.ts).
  // A key CrowdSec has already shown once cannot be shown again, so when the
  // name already exists (a previous run that failed half-way) a fresh suffixed
  // name is registered instead of storing nothing. Only output that has the
  // shape of a key is kept: an error message must never be saved as a key.
  let bouncerKey: string | null = null;
  for (const bouncerName of [`ideploy-${server.uuid}`, `ideploy-${server.uuid}-${Date.now()}`]) {
    const bouncer = await executeRemoteCommand(
      server,
      key,
      `docker exec ${CROWDSEC_CONTAINER} cscli bouncers add ${bouncerName} -o raw`,
      { onData, noRetry: true }
    );
    const candidate = bouncer.stdout.trim();
    if (bouncer.exitCode === 0 && isBouncerKey(candidate)) {
      bouncerKey = candidate;
      break;
    }
  }
  if (!bouncerKey) {
    logger.warn('CrowdSec bouncer could not be registered', { serverUuid: server.uuid });
  }

  await pool.query(
    `UPDATE servers
     SET crowdsec_api_key = $2,
         crowdsec_bouncer_key = COALESCE($3, crowdsec_bouncer_key),
         crowdsec_lapi_url = $4,
         crowdsec_machine_id = $5,
         crowdsec_installed = true,
         crowdsec_available = true,
         updated_at = now()
     WHERE id = $1`,
    [
      server.id,
      encryptString(password),
      bouncerKey ? encryptString(bouncerKey) : null,
      `https://${crowdsecAdminHost(server.ip)}`,
      machineId,
    ]
  );
  logger.info('CrowdSec provisioned', { serverUuid: server.uuid, bouncerRegistered: Boolean(bouncerKey) });
}

/** Re-probes an already-provisioned CrowdSec and records whether it is still up. */
async function markCrowdSecAvailability(server: ServerRow): Promise<void> {
  try {
    const { getServerCrowdSecClient } = await import('./firewall-enforcement.service');
    const client = await getServerCrowdSecClient(server.id);
    const health = await client?.health();
    await pool.query('UPDATE servers SET crowdsec_available = $2, updated_at = now() WHERE id = $1', [
      server.id,
      Boolean(health?.reachable && health.authorized),
    ]);
  } catch {
    // Best-effort — a failed probe should not fail the proxy start it rides on.
  }
}

/**
 * The machine login and password from CrowdSec's `local_api_credentials.yaml`.
 *
 * The login is whatever name CrowdSec generated — usually "localhost", but not
 * always, and logging in under a guessed name fails with a valid password.
 */
export function parseMachineCredentials(yaml: string): { machineId: string; password: string | undefined } {
  return {
    machineId: /^\s*login:\s*(\S+)/m.exec(yaml)?.[1] ?? 'localhost',
    password: /^\s*password:\s*(\S+)/m.exec(yaml)?.[1],
  };
}

/**
 * Whether `cscli bouncers add -o raw` printed a key rather than an error.
 * An error message stored as a key would make every bouncer lookup fail.
 */
export function isBouncerKey(output: string): boolean {
  return /^[A-Za-z0-9+/=_-]{16,}$/.test(output);
}

export interface CrowdSecCredentials {
  lapiUrl: string;
  /** Machine login ("localhost" for servers provisioned before it was recorded). */
  machineId: string;
  machinePassword: string;
  bouncerKey: string | null;
  serverIp: string;
}

/** Decrypted CrowdSec credentials for a server, or null if never provisioned. */
export async function getCrowdSecCredentials(
  serverId: number
): Promise<CrowdSecCredentials | null> {
  const { rows } = await pool.query(
    'SELECT ip, crowdsec_lapi_url, crowdsec_api_key, crowdsec_bouncer_key, crowdsec_machine_id FROM servers WHERE id = $1',
    [serverId]
  );
  const r = rows[0] as
    | {
        ip: string;
        crowdsec_lapi_url: string | null;
        crowdsec_api_key: string | null;
        crowdsec_bouncer_key: string | null;
        crowdsec_machine_id: string | null;
      }
    | undefined;
  if (!r?.crowdsec_lapi_url || !r.crowdsec_api_key) return null;
  const machinePassword = tryDecryptString(r.crowdsec_api_key);
  if (!machinePassword) return null;
  return {
    lapiUrl: r.crowdsec_lapi_url,
    machineId: r.crowdsec_machine_id || 'localhost',
    machinePassword,
    bouncerKey: tryDecryptString(r.crowdsec_bouncer_key),
    serverIp: r.ip,
  };
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
  // Also records `type: 'traefik'` — the only proxy this ever starts — so
  // application-labels.service.ts's `toProxyType` reads an honest value
  // instead of relying on its own "nothing sets this, so default to Traefik"
  // fallback. Written on every status change (not just the first), so a
  // server proxied before this line existed gets it the next time its proxy
  // is touched, with no migration needed.
  await pool.query(
    `UPDATE servers
     SET proxy = jsonb_set(
                   jsonb_set(COALESCE(proxy, '{}')::jsonb, '{status}', to_jsonb($1::text), true),
                   '{type}', to_jsonb('traefik'::text), true
                 ),
         updated_at = now()
     WHERE id = $2`,
    [status, serverId]
  );
}
