/**
 * `monapp.idem.africa` — the address an application published from iCode gets.
 *
 * The name comes from the application's name. When it is taken — by another
 * application, by a record already in the zone, or by one of IDEM's own
 * services — a short id is added: `monapp-k3x9p.idem.africa`. The A record is
 * created at Namecheap, pointing at the server the application runs on; it
 * takes precedence over the `*.idem.africa` wildcard (which points at IDEM's
 * own server).
 *
 * Never blocking: when the platform domain is not configured or Namecheap
 * fails, the caller keeps the automatic address (sslip.io / server wildcard)
 * and the deployment goes on.
 */
import { randomBytes } from 'crypto';
import redis from '../config/redis.config';
import logger from '../config/logger';
import { findConflicts } from './domain.service';
import { DnsHost, getDnsProvider } from './dns/namecheap.client';

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

async function isFree(label: string, domain: string, zoneHosts: DnsHost[]): Promise<boolean> {
  if (RESERVED_LABELS.has(label)) return false;
  if (zoneHosts.some((host) => host.name.toLowerCase() === label)) return false;
  return (await findConflicts([`${label}.${domain}`])).length === 0;
}

/**
 * Reserve `label.domain` for an application and point it at `serverIp`.
 *
 * @returns the hostname (no scheme), or null when the platform domain is off or
 *          the record could not be created — the caller then keeps its
 *          automatic address.
 */
export async function claimPlatformHost(name: string, serverIp: string): Promise<string | null> {
  const provider = getDnsProvider();
  if (!provider) return null;

  try {
    return await withZoneLock(async () => {
      const zone = await provider.getZone();
      // A zone that answers with no record at all is not idem.africa: writing
      // it back would erase everything. Refuse.
      if (zone.hosts.length === 0) throw new Error('The DNS zone came back empty; nothing was written.');

      const base = domainLabel(name);
      let label = base;
      for (let attempt = 0; !(await isFree(label, provider.domain, zone.hosts)); attempt++) {
        if (attempt >= 8) throw new Error(`No free address found for "${base}".`);
        label = `${base.slice(0, 34)}-${shortId()}`;
      }

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

      logger.info('Platform domain claimed', { event: 'dns.claimed', host: `${label}.${provider.domain}`, serverIp });
      return `${label}.${provider.domain}`;
    });
  } catch (error) {
    logger.warn('Platform domain unavailable, keeping the automatic address', {
      event: 'dns.claim_failed',
      name,
      error: (error as Error).message,
    });
    return null;
  }
}
