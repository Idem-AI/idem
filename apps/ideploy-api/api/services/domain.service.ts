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
