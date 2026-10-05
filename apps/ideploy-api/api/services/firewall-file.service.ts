/**
 * An application's firewall, applied live through Traefik's file provider.
 *
 * Routers reference one chain, `firewall-<uuid>@file` (docker/labels.ts). Its
 * content — geo-blocking, rate and concurrency limits, the CrowdSec bouncer —
 * is this file, `<proxy>/dynamic/firewall-<uuid>.yml`, which Traefik watches:
 * writing it applies a change within a second, no redeploy. These protections
 * used to be container labels, read only when the container starts: a country
 * saved as blocked kept reaching the site until a redeploy succeeded.
 *
 * The chain always holds a harmless first middleware, so it is valid even when
 * nothing is configured — a router naming a missing middleware serves nothing.
 */
import YAML from 'yaml';
import pool from '../config/db.config';
import logger from '../config/logger';
import { ApplicationRow, PrivateKeyRow, ServerRow } from '../models/ideploy.types';
import { executeRemoteCommand, shellQuote } from '../ssh/ssh';
import { proxyPath } from '../utils/paths';
import { crowdsecPluginConfig, firewallMiddlewareName } from '../docker/labels';
import {
  concurrencyMiddlewareName,
  geoBlockMiddlewareName,
  geoBlockPluginConfig,
  rateLimitMiddlewareName,
} from '../docker/protection';
import { crowdsecMiddlewareName } from '../docker/labels';
import { LabelContext, loadLabelContext } from './application-labels.service';
import { getExecutionKey } from './server.service';

export function firewallFilePath(uuid: string): string {
  return `${proxyPath()}/dynamic/firewall-${uuid}.yml`;
}

type Protections = Pick<LabelContext, 'crowdsec' | 'geoBlock' | 'rateLimit' | 'concurrency'>;

/**
 * The file's content. Order: the checks that decide from the connection alone
 * (country, limits) before the one that may ask CrowdSec.
 */
export function firewallFileContent(uuid: string, p: Protections): string {
  const noop = `firewall-pass-${uuid}`;
  const middlewares: Record<string, unknown> = {
    // A no-op, so the chain is never empty.
    [noop]: { headers: { customRequestHeaders: { 'X-Ideploy-Firewall': '1' } } },
  };
  const chain = [noop];

  if (p.geoBlock && p.geoBlock.blockedCountries.length > 0) {
    middlewares[geoBlockMiddlewareName(uuid)] = { plugin: { geoblock: geoBlockPluginConfig(p.geoBlock) } };
    chain.push(geoBlockMiddlewareName(uuid));
  }
  if (p.concurrency) {
    // Per client address as Traefik sees it: it is the edge, there is no
    // proxy in front whose forwarded header could be trusted.
    middlewares[concurrencyMiddlewareName(uuid)] = { inFlightReq: { amount: p.concurrency.maxInFlight } };
    chain.push(concurrencyMiddlewareName(uuid));
  }
  if (p.rateLimit) {
    // No ipStrategy: the labels used depth=1 (X-Forwarded-For), which made
    // every client share one bucket when the header was absent and let a
    // client escape the limit by sending one.
    middlewares[rateLimitMiddlewareName(uuid)] = {
      rateLimit: {
        average: p.rateLimit.averagePerSecond,
        burst: p.rateLimit.burst ?? Math.max(p.rateLimit.averagePerSecond * 2, 10),
        period: `${p.rateLimit.periodSeconds ?? 1}s`,
      },
    };
    chain.push(rateLimitMiddlewareName(uuid));
  }
  if (p.crowdsec) {
    middlewares[crowdsecMiddlewareName(uuid)] = { plugin: { bouncer: crowdsecPluginConfig(p.crowdsec) } };
    chain.push(crowdsecMiddlewareName(uuid));
  }

  middlewares[firewallMiddlewareName(uuid)] = { chain: { middlewares: chain } };
  return YAML.stringify({ http: { middlewares } });
}

/** The file for an application, from its saved firewall settings. */
export async function resolveFirewallFile(app: ApplicationRow): Promise<string> {
  const context = await loadLabelContext(app);
  return firewallFileContent(app.uuid, {
    crowdsec: context?.crowdsec ?? null,
    geoBlock: context?.geoBlock ?? null,
    rateLimit: context?.rateLimit ?? null,
    concurrency: context?.concurrency ?? null,
  });
}

/** Write the file on the server, atomically (Traefik never reads half a file). */
export async function writeFirewallFile(server: ServerRow, key: PrivateKeyRow, app: ApplicationRow): Promise<void> {
  const content = await resolveFirewallFile(app);
  const file = firewallFilePath(app.uuid);
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const r = await executeRemoteCommand(
    server,
    key,
    `mkdir -p ${shellQuote(`${proxyPath()}/dynamic`)} && echo '${b64}' | base64 -d > ${shellQuote(`${file}.tmp`)} && ` +
      `mv ${shellQuote(`${file}.tmp`)} ${shellQuote(file)}`,
    { noRetry: true }
  );
  if (r.exitCode !== 0) throw new Error(`Could not write the firewall configuration: ${r.stderr.slice(0, 200)}`);
}

export async function removeFirewallFile(server: ServerRow, key: PrivateKeyRow, uuid: string): Promise<void> {
  await executeRemoteCommand(server, key, `rm -f ${shellQuote(firewallFilePath(uuid))}`, { noRetry: true }).catch(
    (err: Error) => logger.warn('Firewall file not removed', { uuid, message: err.message })
  );
}

/**
 * Whether the application's running container already routes through the
 * file chain. Containers started before the chain existed carry the old
 * labels and need one redeploy to pick it up.
 */
export async function containerUsesFirewallFile(server: ServerRow, key: PrivateKeyRow, uuid: string): Promise<boolean> {
  const r = await executeRemoteCommand(
    server,
    key,
    `docker ps -q | xargs -r docker inspect -f '{{json .Config.Labels}}' | grep -c ${shellQuote(`${firewallMiddlewareName(uuid)}@file`)}`,
    { noRetry: true }
  ).catch(() => null);
  return Number(r?.stdout.trim() || 0) > 0;
}

/** The server and key an application runs on, without a team (the worker and Apply both use it). */
export async function applicationServer(appId: number): Promise<{ server: ServerRow; key: PrivateKeyRow } | null> {
  const { rows } = await pool.query(
    `SELECT s.id, s.uuid, s.name, s.description, s.ip, s.port, s.user, s.team_id, s.private_key_id, s.proxy
     FROM applications a
     JOIN standalone_dockers sd ON sd.id = a.destination_id AND a.destination_type LIKE '%StandaloneDocker'
     JOIN servers s ON s.id = sd.server_id
     WHERE a.id = $1 LIMIT 1`,
    [appId]
  );
  const r = rows[0];
  if (!r) return null;
  const server = {
    id: Number(r.id),
    uuid: String(r.uuid),
    name: String(r.name),
    description: (r.description as string) ?? null,
    ip: String(r.ip),
    port: Number(r.port),
    user: String(r.user),
    team_id: Number(r.team_id),
    private_key_id: Number(r.private_key_id),
    proxy: (r.proxy as Record<string, unknown>) ?? null,
  } as ServerRow;
  const key = await getExecutionKey(server);
  return key ? { server, key } : null;
}
