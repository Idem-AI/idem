/**
 * Domain ownership checks.
 *
 * Ports `checkDomainUsage` from the Laravel side. Two resources claiming the same
 * host is not a validation nicety: the proxy resolves the collision arbitrarily,
 * so one application silently starts serving another's traffic — a data-exposure
 * failure that looks like a routing glitch.
 *
 * Comparison is on scheme-less host + path, because `http://x.com` and
 * `https://x.com` are the same claim as far as the proxy is concerned.
 */
import pool from '../config/db.config';
import { conflict, unprocessable } from '../utils/errors';
import { parseDomain } from '../docker/labels';

/** Tables that can hold an `fqdn`, with the label used when reporting a clash. */
const FQDN_OWNERS = [
  { table: 'applications', kind: 'application' },
  { table: 'service_applications', kind: 'service' },
] as const;

export interface DomainClaim {
  /** Normalised `host/path`, the form collisions are judged on. */
  key: string;
  host: string;
  path: string;
}

/** Normalise a domain to what the proxy actually routes on. */
export function toClaim(raw: string): DomainClaim | null {
  const parsed = parseDomain(raw);
  if (!parsed) return null;

  const path = parsed.path === '/' ? '' : parsed.path.replace(/\/+$/, '');
  return {
    key: `${parsed.host.toLowerCase()}${path}`,
    host: parsed.host.toLowerCase(),
    path: path || '/',
  };
}

export interface DomainConflict {
  domain: string;
  usedBy: string;
  kind: string;
}

/**
 * Which of `domains` are already claimed by another resource.
 *
 * `excludeApplicationId` skips the application being edited, so re-saving its own
 * domain is not reported as a conflict with itself.
 */
export async function findConflicts(
  domains: string[],
  excludeApplicationId?: number
): Promise<DomainConflict[]> {
  const claims = domains
    .map((d) => ({ raw: d, claim: toClaim(d) }))
    .filter((entry): entry is { raw: string; claim: DomainClaim } => entry.claim !== null);

  if (claims.length === 0) return [];

  const conflicts: DomainConflict[] = [];

  for (const { table, kind } of FQDN_OWNERS) {
    const exclude = table === 'applications' && excludeApplicationId ? excludeApplicationId : null;
    const { rows } = await pool.query<{ name: string; fqdn: string }>(
      `SELECT name, fqdn FROM ${table}
       WHERE fqdn IS NOT NULL AND fqdn <> ''
         AND ($1::bigint IS NULL OR id <> $1)`,
      [exclude]
    );

    for (const row of rows) {
      // An `fqdn` column may hold several comma-separated domains.
      const owned = new Set(
        row.fqdn
          .split(',')
          .map((d) => toClaim(d)?.key)
          .filter((k): k is string => Boolean(k))
      );

      for (const { raw, claim } of claims) {
        if (owned.has(claim.key)) {
          conflicts.push({ domain: raw, usedBy: row.name, kind });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Raise when any of `domains` is already taken.
 *
 * @throws DomainError DOMAIN_ALREADY_USED naming the domain and its current owner.
 */
export async function assertDomainsAvailable(
  domains: string[],
  excludeApplicationId?: number
): Promise<void> {
  const conflicts = await findConflicts(domains, excludeApplicationId);
  if (conflicts.length === 0) return;

  const described = conflicts
    .map((c) => `${c.domain} (used by the ${c.kind} "${c.usedBy}")`)
    .join(', ');

  throw conflict(
    'DOMAIN_ALREADY_USED',
    `Already in use: ${described}. Two resources cannot share a domain — the proxy would send traffic to whichever answers first.`
  );
}

/**
 * Does this hostname resolve to the server that will serve it?
 *
 * Purely advisory: certificate issuance fails when DNS does not point here, and
 * telling the user before they wait for a timeout is worth a lookup.
 */
export async function resolvesTo(host: string, expectedIp: string): Promise<boolean> {
  const dns = await import('dns/promises');
  try {
    const addresses = await dns.resolve4(host);
    return addresses.includes(expectedIp);
  } catch {
    return false;
  }
}

// ── Auto-generated, DNS-free hostnames ─────────────────────────────
//
// Ports Laravel's `sslip()` / `generateFqdn()`. A deployed resource with no
// domain of its own must still be reachable over HTTPS the moment it starts:
// sslip.io's own nameservers parse the IP straight out of the hostname and
// answer it as the A record, so `{random}.{ip}.sslip.io` resolves publicly
// with zero DNS configuration on our side — and the Traefik labels this
// resource already gets (`docker/labels.ts`) make its ACME resolver issue a
// real Let's Encrypt certificate for it the same way it would for any other
// domain, no special-casing needed there.
//
// Without this, a resource with no domain fell back to `computeAppLink`'s
// `http://localhost:{port}` — correct only when the browser happens to be on
// the same machine as the server, wrong for every real deployment.

/** DNS-free hostname for a server's own IP (IPv6 colons become dashes). */
export function sslipHost(ip: string): string {
  return ip.includes(':') ? `${ip.replace(/:/g, '-')}.sslip.io` : `${ip}.sslip.io`;
}

/** The server's configured wildcard domain, if the operator set one — else null. */
async function getWildcardDomain(serverId: number): Promise<string | null> {
  const { rows } = await pool.query(
    'SELECT wildcard_domain FROM server_settings WHERE server_id = $1 LIMIT 1',
    [serverId]
  );
  const value = (rows[0]?.wildcard_domain as string | null | undefined)?.trim();
  return value ? value.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;
}

/**
 * A working hostname for a resource that was not given one of its own —
 * `{random}.{host}`, where `host` is the server's wildcard domain if
 * configured, otherwise its sslip.io address.
 */
export async function generateFqdn(serverId: number, serverIp: string, random: string): Promise<string> {
  const wildcard = await getWildcardDomain(serverId);
  const host = wildcard || sslipHost(serverIp);
  return `${random}.${host}`;
}

/** Longest DNS label (RFC 1035). A longer one is not a hostname: no resolver, no certificate. */
export const MAX_DNS_LABEL = 63;

/**
 * Slug used as the auto-generated subdomain — same shape as the internal
 * Docker hostname, `<name>-<uuid>`. The uuid alone takes 36 characters, so a
 * name past 26 made a label longer than DNS allows and the application never
 * got a certificate; the name is shortened to fit, the uuid kept whole.
 */
export function subdomainSlug(name: string, uuid: string): string {
  const clean = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  const id = clean(uuid);
  const room = MAX_DNS_LABEL - id.length - 1;
  const base = clean(name).slice(0, Math.max(room, 0)).replace(/-+$/g, '');
  return base ? `${base}-${id}` : id.slice(0, MAX_DNS_LABEL);
}

/** A hostname as DNS accepts it: dot-separated labels of letters, digits and dashes. */
export function isValidHostname(host: string): boolean {
  if (host.length > 253) return false;
  return host
    .split('.')
    .every((label) => label.length > 0 && label.length <= MAX_DNS_LABEL && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label));
}

/** The IPv4 addresses `host` resolves to, or an empty list. */
async function addressesOf(host: string): Promise<string[]> {
  const dns = await import('dns/promises');
  try {
    return await dns.resolve4(host);
  } catch {
    return [];
  }
}

/**
 * Refuse a server wildcard domain whose names do not reach the server.
 *
 * Every application created on the server without a domain of its own gets
 * `<name>-<uuid>.<wildcard>`. A wildcard whose DNS points elsewhere — the
 * platform's own `idem.africa`, whose `*` points at IDEM's main server — gave
 * every one of them an address that reached another machine: no route, no
 * certificate. A random name is resolved, so the `*` record itself is tested.
 *
 * @throws DomainError WILDCARD_INVALID / WILDCARD_DNS_MISMATCH
 */
export async function assertWildcardReaches(wildcard: string, serverIp: string): Promise<void> {
  if (!isValidHostname(wildcard) || !wildcard.includes('.')) {
    throw unprocessable('WILDCARD_INVALID', `"${wildcard}" is not a domain name.`);
  }
  const probe = `ideploy-check-${Math.random().toString(36).slice(2, 10)}.${wildcard}`;
  const addresses = await addressesOf(probe);
  if (!addresses.includes(serverIp)) {
    throw unprocessable(
      'WILDCARD_DNS_MISMATCH',
      addresses.length
        ? `*.${wildcard} points to ${addresses.join(', ')}, not to this server (${serverIp}). ` +
            `Create a DNS record *.${wildcard} → ${serverIp}, or leave the field empty to use automatic addresses.`
        : `*.${wildcard} does not resolve. Create a DNS record *.${wildcard} → ${serverIp} first, ` +
            'or leave the field empty to use automatic addresses.'
    );
  }
}

export interface DomainCheck {
  domain: string;
  host: string;
  /** Whether the host resolves to the application's server. */
  pointsHere: boolean;
  /** What it resolves to instead (empty: it does not resolve). */
  addresses: string[];
}

/**
 * Where each of an application's domains points — shown after a domain is
 * changed, before the user waits for a certificate that cannot be issued.
 */
export async function checkDomains(domains: string[], serverIp: string): Promise<DomainCheck[]> {
  const checks: DomainCheck[] = [];
  for (const domain of domains) {
    const claim = toClaim(domain);
    if (!claim) continue;
    const addresses = await addressesOf(claim.host);
    checks.push({ domain, host: claim.host, pointsHere: addresses.includes(serverIp), addresses });
  }
  return checks;
}

/** The server (id + IP) a Docker destination sits on — needed before the resource it belongs to exists yet. */
export async function getServerForDestination(
  destinationId: number
): Promise<{ id: number; ip: string } | null> {
  const { rows } = await pool.query(
    `SELECT s.id, s.ip
     FROM standalone_dockers sd
     JOIN servers s ON s.id = sd.server_id
     WHERE sd.id = $1 LIMIT 1`,
    [destinationId]
  );
  return rows[0] ? { id: Number(rows[0].id), ip: String(rows[0].ip) } : null;
}
