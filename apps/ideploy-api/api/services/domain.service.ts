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
import { conflict } from '../utils/errors';
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

/** Slug used as the auto-generated subdomain — same shape as the internal Docker hostname. */
export function subdomainSlug(name: string, uuid: string): string {
  return `${name}-${uuid}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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
