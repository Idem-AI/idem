/**
 * An application's routes, served from the proxy's file provider.
 *
 * Routers used to be container labels, read only when the container starts:
 * a new domain reached the proxy with the next deployment. They are now
 * `<proxy>/dynamic/routes-<uuid>.yml`, which Traefik watches — saving a domain
 * applies it within a second, without rebuilding or restarting anything. The
 * container keeps only its ownership labels (`traefik.enable=false`,
 * `ideploy.routes=file`); Traefik reaches it by name on the shared network.
 *
 * Only domains whose DNS reaches the application's server are routed
 * (`domain_verifications`). A domain claimed without being owned therefore
 * routes nothing and takes nothing from its owner; and Let's Encrypt is never
 * asked for a certificate it cannot issue.
 */
import YAML from 'yaml';
import pool from '../config/db.config';
import logger from '../config/logger';
import { ApplicationRow, PrivateKeyRow, ServerRow } from '../models/ideploy.types';
import { executeRemoteCommand, shellQuote } from '../ssh/ssh';
import { proxyPath } from '../utils/paths';
import { extractMiddlewareNames, firewallMiddlewareName, hashBasicAuthPassword, parseDomain } from '../docker/labels';
import { LabelContext, loadLabelContext } from './application-labels.service';
import { checkHttps, classify, DnsStatus, isAutomatic, isPlatformHost, lookup, lookupAuthoritative } from './domain-dns.service';

const CERT_RESOLVER = 'letsencrypt';

/**
 * Statuses whose domain is routed: DNS reaches the server (an extra AAAA is
 * only a warning), or the domain is behind Cloudflare's proxy, which forwards
 * to the server — sites already served that way keep working.
 */
export const ROUTABLE: ReadonlySet<DnsStatus> = new Set<DnsStatus>(['ok', 'automatic', 'ipv6_conflict', 'proxied']);

/**
 * Statuses that prove the domain is the claimer's: its DNS names this server.
 * Cloudflare's addresses prove nothing — anyone's proxied domain resolves there.
 */
export const VERIFIED: ReadonlySet<DnsStatus> = new Set<DnsStatus>(['ok', 'automatic', 'ipv6_conflict']);

export function routesFilePath(uuid: string): string {
  return `${proxyPath()}/dynamic/routes-${uuid}.yml`;
}

/** The container's name on the shared network — what generateComposeFile names it. */
export function containerHost(app: Pick<ApplicationRow, 'name' | 'uuid'>): string {
  return `${app.name}-${app.uuid}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

export interface RoutesInput {
  uuid: string;
  /** host:port the proxy forwards to. */
  target: string;
  /** Domains as configured, in order (the first is the primary one). */
  domains: string[];
  /** Hosts allowed to be routed (verified or automatic). */
  routable: ReadonlySet<string>;
  context: Pick<LabelContext, 'forceHttps' | 'gzip' | 'stripPrefix' | 'redirect' | 'hsts' | 'redirectToPrimary' | 'basicAuth' | 'customLabels'>;
}

/** The file's content: routers, their middlewares, one service. */
export function routesFileContent(input: RoutesInput): string {
  const { uuid, context } = input;
  const routers: Record<string, unknown> = {};
  const middlewares: Record<string, unknown> = {};
  const service = `app-${uuid}`;

  const parsed = input.domains
    .map((raw) => parseDomain(raw, context.forceHttps))
    .filter((d): d is NonNullable<ReturnType<typeof parseDomain>> => d !== null);
  const primary = parsed[0];

  // Shared middlewares of this application.
  const gzip = `gzip-${uuid}`;
  const toHttps = `to-https-${uuid}`;
  const hsts = `hsts-${uuid}`;
  const auth = `auth-${uuid}`;
  middlewares[toHttps] = { redirectScheme: { scheme: 'https', permanent: true } };
  if (context.gzip) middlewares[gzip] = { compress: {} };
  if (context.hsts) middlewares[hsts] = { headers: { stsSeconds: 31536000, stsIncludeSubdomains: false, stsPreload: false } };
  if (context.basicAuth) {
    middlewares[auth] = { basicAuth: { users: [`${context.basicAuth.username}:${hashBasicAuthPassword(context.basicAuth.password)}`] } };
  }
  // The user's own middlewares are docker labels: named with their provider.
  const custom = extractMiddlewareNames(context.customLabels).map((m) => (m.includes('@') ? m : `${m}@docker`));

  parsed.forEach((domain, index) => {
    if (!input.routable.has(domain.host)) return;
    const name = `r${index}-${uuid}`;
    const rule = domain.path === '/' ? `Host(\`${domain.host}\`)` : `Host(\`${domain.host}\`) && PathPrefix(\`${domain.path}\`)`;
    const chain: string[] = [];

    // A secondary domain only redirects to the primary one.
    const isSecondary = context.redirectToPrimary && primary && domain.host !== primary.host;
    if (isSecondary) {
      const toPrimary = `to-primary-${index}-${uuid}`;
      middlewares[toPrimary] = {
        redirectRegex: { regex: '^https?://[^/]+(.*)', replacement: `${primary.scheme}://${primary.host}\${1}`, permanent: true },
      };
      chain.push(toPrimary);
    } else {
      if (domain.path !== '/' && context.stripPrefix) {
        const strip = `strip-${index}-${uuid}`;
        middlewares[strip] = { stripPrefix: { prefixes: [domain.path] } };
        chain.push(strip);
      }
      if (context.gzip) chain.push(gzip);
      const isWww = domain.host.startsWith('www.');
      if (context.redirect === 'non-www' && isWww) {
        const n = `to-non-www-${index}-${uuid}`;
        middlewares[n] = { redirectRegex: { regex: '^(http|https)://www\\.(.+)', replacement: '${1}://${2}', permanent: false } };
        chain.push(n);
      }
      if (context.redirect === 'www' && !isWww) {
        const n = `to-www-${index}-${uuid}`;
        middlewares[n] = { redirectRegex: { regex: '^(http|https)://(?:www\\.)?(.+)', replacement: '${1}://www.${2}', permanent: false } };
        chain.push(n);
      }
      if (context.basicAuth) chain.push(auth);
      chain.push(...custom);
      // The firewall chain (firewall-<uuid>.yml) last: it sees the request as served.
      chain.push(firewallMiddlewareName(uuid));
    }

    if (domain.scheme === 'https') {
      routers[`${name}-https`] = {
        entryPoints: ['https'],
        rule,
        service,
        middlewares: context.hsts ? [hsts, ...chain] : chain,
        tls: { certResolver: CERT_RESOLVER },
      };
      routers[`${name}-http`] = context.forceHttps
        ? { entryPoints: ['http'], rule, service, middlewares: [toHttps] }
        : { entryPoints: ['http'], rule, service, middlewares: chain };
    } else {
      routers[`${name}-http`] = { entryPoints: ['http'], rule, service, middlewares: chain };
    }
  });

  if (Object.keys(routers).length === 0) {
    // Nothing routable yet: an empty file, valid for Traefik.
    return YAML.stringify({ http: {} });
  }
  return YAML.stringify({
    http: {
      routers,
      middlewares,
      services: { [service]: { loadBalancer: { servers: [{ url: `http://${input.target}` }] } } },
    },
  });
}

// ── Verification ────────────────────────────────────────────────────

/**
 * Read public DNS for the application's domains and store the result.
 * Returns each host's status. Automatic hostnames need no lookup.
 */
export async function verifyDomains(
  app: Pick<ApplicationRow, 'id' | 'fqdn'>,
  serverIp: string,
  look: typeof lookup = lookup
): Promise<Map<string, DnsStatus>> {
  const hosts = [
    ...new Set(
      (app.fqdn ?? '')
        .split(',')
        .map((d) => parseDomain(d)?.host?.toLowerCase())
        .filter((h): h is string => Boolean(h))
    ),
  ];
  const result = new Map<string, DnsStatus>();
  for (const host of hosts) {
    let status: DnsStatus;
    if (isPlatformHost(host)) {
      // `monapp.idem.africa`: iDeploy writes it, but it is routed (and its certificate asked
      // for) only once the zone itself serves it. Before, Let's Encrypt followed the zone's `*`
      // to IDEM's main server, the challenge failed, Traefik never retried: "not secure".
      const found = classify(await (look === lookup ? lookupAuthoritative : look)(host), serverIp);
      status = found === 'ok' || found === 'ipv6_conflict' ? 'automatic' : found;
    } else {
      status = isAutomatic(host) ? 'automatic' : classify(await look(host), serverIp);
    }
    // On a shared server DNS answers for every application on it: the first
    // to have verified the domain keeps it.
    if (VERIFIED.has(status) && status !== 'automatic') {
      const { rows } = await pool.query(
        `SELECT 1 FROM domain_verifications
          WHERE host = $1 AND application_id <> $2 AND status IN ('ok', 'ipv6_conflict') LIMIT 1`,
        [host, app.id]
      );
      if (rows.length) status = 'taken';
    }
    result.set(host, status);
    await pool.query(
      `INSERT INTO domain_verifications (application_id, host, status, checked_at, verified_at)
       VALUES ($1, $2, $3, now(), CASE WHEN $4 THEN now() END)
       ON CONFLICT (application_id, host) DO UPDATE
         SET status = EXCLUDED.status, checked_at = now(),
             verified_at = CASE WHEN $4 THEN COALESCE(domain_verifications.verified_at, now()) ELSE NULL END`,
      [app.id, host, status, VERIFIED.has(status)]
    );
  }
  // Domains removed from the application are no longer claimed.
  await pool.query('DELETE FROM domain_verifications WHERE application_id = $1 AND NOT (host = ANY($2::text[]))', [app.id, hosts]);
  return result;
}

/** Hosts of the application last found routable, from the stored checks. */
export async function routableHosts(applicationId: number): Promise<Set<string>> {
  const { rows } = await pool.query('SELECT host, status FROM domain_verifications WHERE application_id = $1', [applicationId]);
  return new Set(rows.filter((r) => ROUTABLE.has(r.status as DnsStatus)).map((r) => String(r.host)));
}

// ── Applying ────────────────────────────────────────────────────────

/**
 * Verify the domains, then write the routes file on the server (atomically).
 * `port`: the one the container listens on (defaults to the saved one).
 */
export async function applyRoutes(
  server: ServerRow,
  key: PrivateKeyRow,
  app: ApplicationRow,
  opts: {
    port?: number;
    look?: typeof lookup;
    /**
     * A deployment: wait up to this long for a platform address just written at
     * Namecheap to be served by the zone, so the site is routed on this deployment
     * rather than at the next sweep (5 min). Usually under a minute.
     */
    waitForPlatformDnsMs?: number;
  } = {}
): Promise<{ routed: string[]; waiting: string[] }> {
  const context = await loadLabelContext(app);
  if (!context) throw new Error('No proxy context for this application');
  if (opts.waitForPlatformDnsMs && !opts.look) await waitForPlatformDns(app, server.ip, opts.waitForPlatformDnsMs);
  const statuses = await verifyDomains(app, server.ip, opts.look);
  const routable = new Set([...statuses].filter(([, s]) => ROUTABLE.has(s)).map(([h]) => h));
  const port = context.isStatic ? 80 : opts.port ?? (Number((app.ports_exposes ?? '').split(',')[0]) || 3000);
  const content = routesFileContent({
    uuid: app.uuid,
    target: `${containerHost(app)}:${port}`,
    domains: context.domains,
    routable,
    context,
  });
  const file = routesFilePath(app.uuid);
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  const r = await executeRemoteCommand(
    server,
    key,
    `mkdir -p ${shellQuote(`${proxyPath()}/dynamic`)} && echo '${b64}' | base64 -d > ${shellQuote(`${file}.tmp`)} && ` +
      `mv ${shellQuote(`${file}.tmp`)} ${shellQuote(file)}`,
    { noRetry: true }
  );
  if (r.exitCode !== 0) throw new Error(`Could not write the routes: ${r.stderr.slice(0, 200)}`);
  await pool.query('UPDATE applications SET routes_file_at = COALESCE(routes_file_at, now()) WHERE id = $1', [app.id]);
  return { routed: [...routable], waiting: [...statuses.keys()].filter((h) => !routable.has(h)) };
}

/** Hosts of the application on the platform domain. */
function platformHostsOf(app: Pick<ApplicationRow, 'fqdn'>): string[] {
  return (app.fqdn ?? '')
    .split(',')
    .map((d) => parseDomain(d)?.host?.toLowerCase())
    .filter((h): h is string => Boolean(h) && isPlatformHost(h as string));
}

async function waitForPlatformDns(app: Pick<ApplicationRow, 'fqdn'>, serverIp: string, timeoutMs: number): Promise<void> {
  const hosts = platformHostsOf(app);
  if (hosts.length === 0) return;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const answers = await Promise.all(hosts.map(async (h) => classify(await lookupAuthoritative(h), serverIp)));
    if (answers.every((a) => a === 'ok' || a === 'ipv6_conflict')) return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/**
 * A platform address routed while its certificate had already failed (an
 * application published before this fix): Traefik does not try again by
 * itself, only when the router appears anew. Taken out of the routes for a
 * moment, then put back — once, after a deployment, if HTTPS is still invalid.
 * Never throws.
 */
export async function retryPlatformCertificates(server: ServerRow, key: PrivateKeyRow, app: ApplicationRow, port?: number): Promise<void> {
  try {
    const hosts = platformHostsOf(app);
    if (hosts.length === 0) return;
    // Let's Encrypt usually answers within seconds of the route appearing.
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    const invalid: string[] = [];
    for (const host of hosts) {
      if ((await checkHttps(host)).status === 'invalid') invalid.push(host);
    }
    if (invalid.length === 0) return;
    const routable = await routableHosts(app.id);
    if (!invalid.some((h) => routable.has(h))) return;
    const context = await loadLabelContext(app);
    if (!context) return;
    const target = `${containerHost(app)}:${context.isStatic ? 80 : port ?? (Number((app.ports_exposes ?? '').split(',')[0]) || 3000)}`;
    const write = async (hostsRouted: Set<string>) => {
      const b64 = Buffer.from(routesFileContent({ uuid: app.uuid, target, domains: context.domains, routable: hostsRouted, context }), 'utf8').toString('base64');
      const file = routesFilePath(app.uuid);
      await executeRemoteCommand(server, key, `echo '${b64}' | base64 -d > ${shellQuote(`${file}.tmp`)} && mv ${shellQuote(`${file}.tmp`)} ${shellQuote(file)}`, { noRetry: true });
    };
    await write(new Set([...routable].filter((h) => !invalid.includes(h))));
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await write(routable);
    logger.info('routes.certificate_retried', { event: 'routes.certificate_retried', uuid: app.uuid, hosts: invalid });
  } catch (err) {
    logger.warn('routes.certificate_retry_failed', { uuid: app.uuid, message: (err as Error).message });
  }
}

export async function removeRoutesFile(server: ServerRow, key: PrivateKeyRow, uuid: string): Promise<void> {
  await executeRemoteCommand(server, key, `rm -f ${shellQuote(routesFilePath(uuid))}`, { noRetry: true }).catch((err: Error) =>
    logger.warn('Routes file not removed', { uuid, message: err.message })
  );
}

// ── Periodic check ──────────────────────────────────────────────────

/**
 * Domains still waiting for their DNS are checked again, and routed as soon
 * as it reaches their server; routed ones are re-checked hourly (a domain
 * moved away stops being claimed). At most `limit` applications per run.
 */
export async function sweepDomains(
  applyFor: (applicationId: number) => Promise<void>,
  limit = 50
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT a.id FROM applications a
      WHERE a.routes_file_at IS NOT NULL AND a.fqdn IS NOT NULL AND a.fqdn <> ''
        AND (
          NOT EXISTS (SELECT 1 FROM domain_verifications v WHERE v.application_id = a.id)
          OR EXISTS (SELECT 1 FROM domain_verifications v WHERE v.application_id = a.id
                      AND (v.status NOT IN ('ok', 'automatic', 'ipv6_conflict', 'proxied')
                           OR v.checked_at < now() - interval '1 hour'))
        )
      ORDER BY a.id LIMIT $1`,
    [limit]
  );
  for (const r of rows) {
    await applyFor(Number(r.id)).catch((err) =>
      logger.warn('domains.sweep_failed', { event: 'domains.sweep_failed', applicationId: r.id, error: err })
    );
  }
  return rows.length;
}
