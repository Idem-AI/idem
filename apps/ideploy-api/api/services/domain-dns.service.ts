/**
 * What to put in DNS for an application's domain, and whether it is there yet.
 *
 * Users of IDEM-managed servers do not know — and cannot look up — the IP of
 * the server their application runs on. For each domain this gives the exact
 * record to create (type, name, value: the server's IP), then reads public DNS
 * and says what is wrong in words they can act on: nothing yet, another IP,
 * Cloudflare's proxy in front, an IPv6 record Let's Encrypt would use instead.
 * It also says whether HTTPS already answers with a valid certificate.
 *
 * Public resolvers (Cloudflare, Google) are asked, not the server's own: the
 * user is told what the world sees, which is what Let's Encrypt sees.
 */
import { Resolver } from 'dns/promises';
import tls from 'tls';
import pool from '../config/db.config';
import { notFound } from '../utils/errors';
import { parseDomain } from '../docker/labels';

export type DnsStatus =
  | 'automatic' // a hostname iDeploy manages itself (sslip.io, the platform domain)
  | 'ok'
  | 'missing'
  | 'wrong_ip'
  | 'proxied'
  | 'ipv6_conflict'
  | 'taken'; // verified first by another application (a shared server answers for both)

export interface DnsRecord {
  type: 'A';
  /** Name as DNS providers ask for it: `@` for the domain itself, else the subdomain part. */
  name: string;
  value: string;
  /** The domain whose DNS zone holds the record (where the user goes to add it). */
  zone: string;
}

export interface DomainCheck {
  domain: string;
  host: string;
  record: DnsRecord | null;
  status: DnsStatus;
  found: { a: string[]; aaaa: string[]; cname: string | null };
  https: { status: 'valid' | 'invalid' | 'unreachable' | 'not_checked'; issuer?: string; expiresAt?: string; error?: string };
}

/** Second-level suffixes under which a zone takes three labels (boutique.co.uk). */
const TWO_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.za', 'org.za', 'com.ng', 'org.ng', 'gov.ng',
  'co.ke', 'or.ke', 'com.gh', 'co.tz', 'co.ug', 'com.cm', 'co.cm', 'com.ci', 'co.ci', 'com.sn', 'com.eg', 'co.ma',
  'com.tn', 'co.rw', 'com.br', 'com.mx', 'co.in', 'co.jp', 'com.cn', 'com.tr', 'co.nz', 'com.sg',
]);

/** The DNS zone a hostname most likely belongs to: `shop.boutique.com` → `boutique.com`. */
export function zoneOf(host: string): string {
  const labels = host.toLowerCase().split('.');
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return labels.slice(TWO_LEVEL_SUFFIXES.has(lastTwo) ? -3 : -2).join('.');
}

export function recordFor(host: string, ip: string): DnsRecord {
  const zone = zoneOf(host);
  const name = host === zone ? '@' : host.slice(0, -(zone.length + 1));
  return { type: 'A', name, value: ip, zone };
}

/** Cloudflare's published ranges: a domain behind its proxy resolves to these. */
const CLOUDFLARE_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
  '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
];

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

export function inCidr(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/');
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
}

export const isCloudflare = (ip: string) => CLOUDFLARE_V4.some((cidr) => inCidr(ip, cidr));

/** Hostnames that need no DNS from the user. */
export function isAutomatic(host: string, platformDomain = process.env.IDEPLOY_PLATFORM_DOMAIN || ''): boolean {
  const h = host.toLowerCase();
  if (/\.(sslip|nip)\.io$/.test(h)) return true;
  return Boolean(platformDomain) && h.endsWith(`.${platformDomain.toLowerCase()}`);
}

/** What the DNS answers mean for this server. */
export function classify(found: DomainCheck['found'], serverIp: string): DnsStatus {
  if (found.a.length === 0) return 'missing';
  if (found.a.some(isCloudflare) && !found.a.includes(serverIp)) return 'proxied';
  if (!found.a.includes(serverIp) || found.a.some((ip) => ip !== serverIp)) return 'wrong_ip';
  // Let's Encrypt prefers IPv6 when there is an AAAA record: one pointing
  // elsewhere makes the certificate fail even with a correct A record.
  if (found.aaaa.length > 0) return 'ipv6_conflict';
  return 'ok';
}

function publicResolver(): Resolver {
  const resolver = new Resolver({ timeout: 3000, tries: 2 });
  resolver.setServers(['1.1.1.1', '8.8.8.8']);
  return resolver;
}

export async function lookup(host: string, resolver = publicResolver()): Promise<DomainCheck['found']> {
  const settle = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [a, aaaa, cname] = await Promise.all([
    settle(resolver.resolve4(host), [] as string[]),
    settle(resolver.resolve6(host), [] as string[]),
    settle(resolver.resolveCname(host).then((c) => c[0] ?? null), null as string | null),
  ]);
  return { a, aaaa, cname };
}

/** Does `host` answer HTTPS with a certificate valid for it? */
export function checkHttps(host: string, timeoutMs = 5000): Promise<DomainCheck['https']> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: timeoutMs, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      const issuer = cert?.issuer?.O || cert?.issuer?.CN;
      const result: DomainCheck['https'] = socket.authorized
        ? { status: 'valid', issuer, expiresAt: cert?.valid_to ? new Date(cert.valid_to).toISOString() : undefined }
        : { status: 'invalid', issuer, error: String(socket.authorizationError ?? 'certificate not trusted') };
      socket.end();
      resolve(result);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ status: 'unreachable', error: 'no answer on port 443' });
    });
    socket.on('error', (err) => resolve({ status: 'unreachable', error: err.message }));
  });
}

/** The public IP of the server an application runs on, and whether IDEM manages it. */
async function applicationServer(teamId: number, appUuid: string): Promise<{ ip: string; name: string; managed: boolean; fqdn: string }> {
  const { rows } = await pool.query(
    `SELECT a.fqdn, s.ip, s.name, COALESCE(s.idem_managed, false) AS managed
       FROM applications a
       JOIN environments e ON e.id = a.environment_id
       JOIN projects p ON p.id = e.project_id
       JOIN standalone_dockers sd ON sd.id = a.destination_id AND a.destination_type LIKE '%StandaloneDocker'
       JOIN servers s ON s.id = sd.server_id
      WHERE a.uuid = $1 AND p.team_id = $2 LIMIT 1`,
    [appUuid, teamId]
  );
  if (!rows[0]) throw notFound('Application');
  return { ip: String(rows[0].ip), name: String(rows[0].name), managed: Boolean(rows[0].managed), fqdn: String(rows[0].fqdn ?? '') };
}

/**
 * The DNS guide for an application: its saved domains, or `domains` (as typed,
 * before saving) when given.
 */
export async function domainGuide(
  teamId: number,
  appUuid: string,
  domains?: string,
  deps: { lookup?: typeof lookup; checkHttps?: typeof checkHttps } = {}
): Promise<{ serverIp: string; serverName: string; managed: boolean; domains: DomainCheck[] }> {
  const server = await applicationServer(teamId, appUuid);
  const look = deps.lookup ?? lookup;
  const https = deps.checkHttps ?? checkHttps;
  const raw = (domains ?? server.fqdn).split(',').map((d) => d.trim()).filter(Boolean).slice(0, 10);
  const seen = new Set<string>();
  const checks: DomainCheck[] = [];
  for (const domain of raw) {
    const host = parseDomain(domain)?.host?.toLowerCase();
    if (!host || seen.has(host)) continue;
    seen.add(host);
    if (isAutomatic(host)) {
      checks.push({ domain, host, record: null, status: 'automatic', found: { a: [], aaaa: [], cname: null }, https: await https(host) });
      continue;
    }
    const found = await look(host);
    const status = classify(found, server.ip);
    checks.push({
      domain,
      host,
      record: recordFor(host, server.ip),
      status,
      found,
      // Only worth a TLS handshake once DNS reaches this server.
      https: status === 'ok' ? await https(host) : { status: 'not_checked' },
    });
  }
  return { serverIp: server.ip, serverName: server.name, managed: server.managed, domains: checks };
}
