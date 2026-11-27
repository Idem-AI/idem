/**
 * `monapp.ideploy.site` — the free address every application gets.
 *
 * The domain is written in the code (`config/platform-domain.config.ts`), never
 * read from the environment. The name comes from the application's name. When
 * it is taken — by another application, by a record already in the zone, or
 * by one of IDEM's own services — a short id is added: `monapp-k3x9p`. The
 * owner can then choose another free name (`renamePlatformHost`, the
 * « Personnaliser l'adresse » of iDeploy and iCode). The A record is created at
 * Namecheap, pointing at the server the application runs on.
 *
 * Applications created before the move still have `*.idem.africa` addresses:
 * `domain-migration.service.ts` moves them at startup, keeping their name.
 *
 * Never blocking: when Namecheap is not configured or fails, the caller keeps
 * the automatic address (sslip.io / server wildcard) and the deployment goes on.
 */
import { randomBytes } from 'crypto';
import redis from '../config/redis.config';
import logger from '../config/logger';
import { findConflicts } from './domain.service';
import { PLATFORM_DOMAIN, isOnLegacyPlatformDomain, isOnPlatformDomain } from '../config/platform-domain.config';
import { DnsHost, DnsProvider, getDnsProvider } from './dns/namecheap.client';

/**
 * Labels that belong to IDEM itself, or that nobody should get as their
 * application's address. A record already in the zone is refused too (see
 * `allocate`); this list covers the names that matter even before they exist.
 */
export const RESERVED_LABELS = new Set([
  'www', 'api', 'app', 'apps', 'console', 'dashboard', 'admin', 'auth', 'login', 'account',
  'appgen', 'icode', 'ideploy', 'ideploy-api', 'simulator', 'simulation', 'chart', 'diagen',
  'landing', 'docs', 'blog', 'help', 'support', 'status', 'grafana', 'loki', 'metrics', 'soketi',
  'realtime', 'ws', 'cdn', 'static', 'assets', 'media', 'files', 'storage', 's3', 'minio',
  'mail', 'smtp', 'imap', 'pop', 'webmail', 'mx', 'ns', 'ns1', 'ns2', 'ftp', 'vpn', 'git',
  'staging', 'dev', 'test', 'demo', 'beta', 'preview', 'idem', 'billing', 'pay', 'checkout',
  'ivision', 'idomain', 'communication', 'business', 'finance', 'builders', 'idem-admin', 'panel',
]);

const LOCK_KEY = 'ideploy:platform-domain:lock';
const LOCK_TTL_MS = 60_000;
const LOCK_WAIT_MS = 45_000;
const RECORD_TTL = '300';

/** An application name as a DNS label: lowercase letters, digits and dashes. */
export function domainLabel(name: string): string {
  const label = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return label || 'app';
}

/** A short random suffix — lowercase letters and digits, readable in an address. */
function shortId(): string {
  return randomBytes(6).toString('base64').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5).padEnd(5, '0');
}

async function withZoneLock<T>(work: () => Promise<T>): Promise<T> {
  const token = randomBytes(12).toString('hex');
  const started = Date.now();
  while (!(await redis.set(LOCK_KEY, token, 'PX', LOCK_TTL_MS, 'NX'))) {
    if (Date.now() - started > LOCK_WAIT_MS) throw new Error('The DNS zone is busy; try again in a moment.');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  try {
    return await work();
  } finally {
    // Only release our own lock (it may have expired and been taken since).
    if ((await redis.get(LOCK_KEY)) === token) await redis.del(LOCK_KEY);
  }
}

async function isFree(label: string, domain: string, zoneHosts: DnsHost[], excludeApplicationId?: number): Promise<boolean> {
  if (RESERVED_LABELS.has(label)) return false;
  if (zoneHosts.some((host) => host.name.toLowerCase() === label)) return false;
  return (await findConflicts([`${label}.${domain}`], excludeApplicationId)).length === 0;
}

/** Why a name typed by the owner cannot be their address. */
export type LabelRefusal = 'invalid' | 'reserved' | 'taken' | 'unavailable';

/**
 * A name typed by the owner, as a label — or null when it is not one: 3 to 40
 * lowercase letters, digits and dashes, no dash at either end. Accents are
 * removed and spaces become dashes (« Boutique Amara » → boutique-amara), like
 * the automatic name; anything else is refused rather than silently changed.
 */
export function ownerLabel(input: string): string | null {
  const raw = input
    .trim()
    .toLowerCase()
    .replace(new RegExp(`\\.${PLATFORM_DOMAIN.replace('.', '\\.')}$`), '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '-');
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/.test(raw) || raw.includes('--')) return null;
  return raw;
}

/** Is `label.ideploy.site` free for this application? Read-only; its own current name counts as free. */
export async function checkPlatformLabel(
  input: string,
  applicationId?: number,
  currentHost?: string | null
): Promise<{ label: string | null; host: string | null; available: boolean; reason?: LabelRefusal }> {
  const label = ownerLabel(input);
  if (!label) return { label: null, host: null, available: false, reason: 'invalid' };
  const host = `${label}.${PLATFORM_DOMAIN}`;
  if (RESERVED_LABELS.has(label)) return { label, host, available: false, reason: 'reserved' };
  if (currentHost && currentHost.toLowerCase() === host) return { label, host, available: true };
  const provider = getDnsProvider();
  if (!provider) return { label, host, available: false, reason: 'unavailable' };
  try {
    const zone = await provider.getZone();
    if (zone.hosts.length === 0) return { label, host, available: false, reason: 'unavailable' };
    const free = await isFree(label, provider.domain, zone.hosts, applicationId);
    return free ? { label, host, available: true } : { label, host, available: false, reason: 'taken' };
  } catch {
    return { label, host, available: false, reason: 'unavailable' };
  }
}

/** Write one more A record, read the zone back, and say loudly when it is not what was expected. */
async function addRecord(provider: DnsProvider, zone: { hosts: DnsHost[]; emailType: string }, label: string, serverIp: string): Promise<void> {
  const before = zone.hosts.length;
  await provider.setZone({
    emailType: zone.emailType,
    hosts: [...zone.hosts, { name: label, type: 'A', address: serverIp, mxPref: '10', ttl: RECORD_TTL }],
  });

  // Read back: every record still there, plus ours. Anything else is
  // reported loudly — the zone is shared with the whole platform.
  const after = await provider.getZone();
  const ours = after.hosts.some((h) => h.name === label && h.type === 'A' && h.address === serverIp);
  if (!ours || after.hosts.length !== before + 1) {
    logger.error('Platform domain: zone not as expected after write', {
      event: 'dns.zone_mismatch',
      before,
      after: after.hosts.length,
      label,
      alert: 'critical',
    });
    if (!ours) throw new Error('The DNS record was not saved.');
  }
}

/**
 * Reserve `label.ideploy.site` for an application and point it at `serverIp`.
 *
 * The label is the application's name, or `opts.label` when given (the name an
 * address had before the migration). Taken, a short id is added — unless
 * `opts.exact`, where null is returned instead (a name the owner chose: never
 * replaced by another one behind their back).
 *
 * @returns the hostname (no scheme), or null when the platform domain is off or
 *          the record could not be created — the caller then keeps its
 *          automatic address.
 */
export async function claimPlatformHost(
  name: string,
  serverIp: string,
  opts: { label?: string; exact?: boolean; excludeApplicationId?: number } = {}
): Promise<string | null> {
  const provider = getDnsProvider();
  if (!provider) return null;

  try {
    return await withZoneLock(async () => {
      const zone = await provider.getZone();
      // A zone that answers with no record at all is not ideploy.site: writing
      // it back would erase everything. Refuse.
      if (zone.hosts.length === 0) throw new Error('The DNS zone came back empty; nothing was written.');

      const base = opts.label ?? domainLabel(name);
      let label = base;
      for (let attempt = 0; !(await isFree(label, provider.domain, zone.hosts, opts.excludeApplicationId)); attempt++) {
        if (opts.exact) return null;
        if (attempt >= 8) throw new Error(`No free address found for "${base}".`);
        label = `${base.slice(0, 34)}-${shortId()}`;
      }

      await addRecord(provider, zone, label, serverIp);
      logger.info('Platform domain claimed', { event: 'dns.claimed', host: `${label}.${provider.domain}`, serverIp });
      return `${label}.${provider.domain}`;
    });
  } catch (error) {
    logger.warn('Platform domain unavailable, keeping the automatic address', {
      event: 'dns.claim_failed',
      name,
      // Pas sous la clé `error` : le logger la réserve aux objets Error et
      // n'affichait alors qu'un « Error: » vide.
      reason: (error as Error).message,
    });
    return null;
  }
}

/**
 * Give back the platform address of a deleted application: remove its A
 * record from the zone.
 *
 * Records used to stay forever — the zone filled up, and the name stayed taken
 * for the next application that wanted it. Only an A record under the platform
 * domain, outside the reserved names and no longer used by any resource, is
 * removed; the same read-back as `claimPlatformHost` guards the shared zone.
 * Never throws: a deletion must not fail on DNS.
 */
export async function releasePlatformHost(host: string, provider: DnsProvider | null = getDnsProvider()): Promise<boolean> {
  if (!provider) return false;

  const lower = host.toLowerCase();
  const suffix = `.${provider.domain.toLowerCase()}`;
  if (!lower.endsWith(suffix)) return false;
  const label = lower.slice(0, -suffix.length);
  if (!label || label.includes('.') || RESERVED_LABELS.has(label)) return false;

  try {
    // Still served by another application or service: not ours to remove.
    if ((await findConflicts([lower])).length > 0) return false;

    return await withZoneLock(async () => {
      const zone = await provider.getZone();
      if (zone.hosts.length === 0) throw new Error('The DNS zone came back empty; nothing was written.');

      const remaining = zone.hosts.filter((h) => !(h.name.toLowerCase() === label && h.type === 'A'));
      if (remaining.length === zone.hosts.length) return false;

      await provider.setZone({ emailType: zone.emailType, hosts: remaining });

      const after = await provider.getZone();
      if (after.hosts.length !== remaining.length || after.hosts.some((h) => h.name.toLowerCase() === label && h.type === 'A')) {
        logger.error('Platform domain: zone not as expected after release', {
          event: 'dns.zone_mismatch',
          expected: remaining.length,
          after: after.hosts.length,
          label,
          alert: 'critical',
        });
      }
      logger.info('Platform domain released', { event: 'dns.released', host: lower });
      return true;
    });
  } catch (error) {
    logger.warn('Platform domain could not be released', {
      event: 'dns.release_failed',
      host: lower,
      reason: (error as Error).message,
    });
    return false;
  }
}

/**
 * The owner chooses the name of their free address: `buni-k3x9p.ideploy.site`
 * becomes `buni.ideploy.site`.
 *
 * The new record is written first and takes the old one's place in `fqdn`
 * (first stays first: it is the address shown and opened); the old record is
 * removed after. A name taken meanwhile is refused, never replaced by another.
 *
 * @returns the new `fqdn`, or the refusal.
 */
export async function renamePlatformHost(
  app: { id: number; name: string; fqdn: string | null },
  input: string,
  serverIp: string
): Promise<{ ok: true; host: string; previous: string | null; fqdn: string } | { ok: false; reason: LabelRefusal }> {
  const hosts = (app.fqdn ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const hostOf = (part: string) => part.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
  const index = hosts.findIndex((part) => {
    const host = hostOf(part);
    return isOnPlatformDomain(host) || isOnLegacyPlatformDomain(host);
  });
  const previous = index >= 0 ? hostOf(hosts[index]) : null;

  const check = await checkPlatformLabel(input, app.id, previous);
  if (!check.available || !check.label || !check.host) return { ok: false, reason: check.reason ?? 'invalid' };
  if (previous === check.host) return { ok: true, host: check.host, previous, fqdn: app.fqdn ?? '' };

  const claimed = await claimPlatformHost(app.name, serverIp, { label: check.label, exact: true, excludeApplicationId: app.id });
  if (!claimed) return { ok: false, reason: getDnsProvider() ? 'taken' : 'unavailable' };

  const next = [...hosts];
  if (index >= 0) next[index] = `https://${claimed}`;
  else next.unshift(`https://${claimed}`);
  const fqdn = next.join(',');
  // The old name is given back once nothing serves it any more (`releasePlatformHost` checks).
  return { ok: true, host: claimed, previous, fqdn };
}
