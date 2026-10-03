/**
 * DNS of the platform domain (idem.africa), hosted at Namecheap.
 *
 * ⚠️ Namecheap's API has no "add one record": `namecheap.domains.dns.setHosts`
 * REPLACES THE WHOLE ZONE with the list it is given. Every write is therefore
 * read → add → write the complete list back, under a lock, and refuses to write
 * at all when the read did not return a believable zone. Losing a record here
 * means taking down a site or the mail of idem.africa.
 *
 * Behind a small `DnsProvider` interface, like the SSH executor: the logic that
 * decides names is tested against an in-memory provider, never the real zone.
 */
import logger from '../../config/logger';

export interface DnsHost {
  name: string; // "@", "www", "monapp"
  type: string; // A, AAAA, CNAME, MX, TXT, CAA, …
  address: string;
  mxPref: string;
  ttl: string;
}

export interface DnsZone {
  hosts: DnsHost[];
  /** Mail setting of the domain — must be sent back unchanged or mail can break. */
  emailType: string;
}

export interface DnsProvider {
  readonly domain: string;
  getZone(): Promise<DnsZone>;
  setZone(zone: DnsZone): Promise<void>;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (value: string): string =>
  value.replace(/&(amp|lt|gt|quot|apos);/g, (_m, name: string) => ENTITIES[name]);

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of tag.matchAll(/([A-Za-z]+)="([^"]*)"/g)) out[match[1]] = decode(match[2]);
  return out;
}

/**
 * The message of an error answer. `<Error\b` alone would also match the
 * `<Errors>` wrapper and return a tag instead of the sentence.
 */
function namecheapError(xml: string): string | undefined {
  return xml.match(/<Error(?:\s[^>]*)?>([^<]*)<\/Error>/i)?.[1]?.trim() || undefined;
}

/** Parse a `getHosts` answer; throws with Namecheap's own message on an error answer. */
export function parseGetHosts(xml: string): DnsZone {
  if (!/<ApiResponse[^>]*Status="OK"/i.test(xml)) {
    const error = namecheapError(xml);
    throw new Error(`Namecheap refused the request: ${error ? decode(error) : 'unknown error'}`);
  }
  const result = xml.match(/<DomainDNSGetHostsResult[^>]*>/i)?.[0] ?? '';
  const emailType = attributes(result).EmailType || 'NONE';
  const hosts: DnsHost[] = [];
  for (const tag of xml.match(/<host\s[^>]*\/?>/gi) ?? []) {
    const a = attributes(tag);
    if (!a.Name || !a.Type) continue;
    hosts.push({ name: a.Name, type: a.Type.toUpperCase(), address: a.Address ?? '', mxPref: a.MXPref ?? '10', ttl: a.TTL ?? '1800' });
  }
  return { hosts, emailType };
}

/** The form fields of a `setHosts` call: every host, numbered from 1, and the mail setting. */
export function setHostsParams(zone: DnsZone): Record<string, string> {
  const params: Record<string, string> = { EmailType: zone.emailType };
  zone.hosts.forEach((host, index) => {
    const n = index + 1;
    params[`HostName${n}`] = host.name;
    params[`RecordType${n}`] = host.type;
    params[`Address${n}`] = host.address;
    params[`MXPref${n}`] = host.mxPref || '10';
    params[`TTL${n}`] = host.ttl || '1800';
  });
  return params;
}

export interface NamecheapConfig {
  apiUser: string;
  apiKey: string;
  userName: string;
  clientIp: string;
  domain: string;
  sandbox: boolean;
}

export class NamecheapDnsProvider implements DnsProvider {
  readonly domain: string;
  private readonly sld: string;
  private readonly tld: string;

  constructor(
    private readonly config: NamecheapConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.domain = config.domain.toLowerCase();
    const dot = this.domain.indexOf('.');
    this.sld = this.domain.slice(0, dot);
    this.tld = this.domain.slice(dot + 1);
  }

  private endpoint(): string {
    return this.config.sandbox
      ? 'https://api.sandbox.namecheap.com/xml.response'
      : 'https://api.namecheap.com/xml.response';
  }

  private base(command: string): Record<string, string> {
    return {
      ApiUser: this.config.apiUser,
      ApiKey: this.config.apiKey,
      UserName: this.config.userName,
      ClientIp: this.config.clientIp,
      Command: command,
      SLD: this.sld,
      TLD: this.tld,
    };
  }

  async getZone(): Promise<DnsZone> {
    const query = new URLSearchParams(this.base('namecheap.domains.dns.getHosts'));
    const response = await this.fetchImpl(`${this.endpoint()}?${query}`);
    return parseGetHosts(await response.text());
  }

  async setZone(zone: DnsZone): Promise<void> {
    const body = new URLSearchParams({ ...this.base('namecheap.domains.dns.setHosts'), ...setHostsParams(zone) });
    const response = await this.fetchImpl(this.endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const xml = await response.text();
    if (!/<ApiResponse[^>]*Status="OK"/i.test(xml) || !/IsSuccess="true"/i.test(xml)) {
      const error = namecheapError(xml);
      throw new Error(`Namecheap did not save the zone: ${error ? decode(error) : 'unknown error'}`);
    }
  }
}

// ── Active provider (real one from the environment, or a test double) ──────

let active: DnsProvider | null | undefined;

/** The provider configured by the environment, or null when the platform domain is off. */
function fromEnvironment(): DnsProvider | null {
  const domain = process.env.IDEPLOY_PLATFORM_DOMAIN?.trim();
  const apiUser = process.env.NAMECHEAP_API_USER?.trim();
  const apiKey = process.env.NAMECHEAP_API_KEY?.trim();
  const clientIp = process.env.NAMECHEAP_CLIENT_IP?.trim();
  if (!domain || !apiUser || !apiKey || !clientIp) return null;
  return new NamecheapDnsProvider({
    domain,
    apiUser,
    apiKey,
    clientIp,
    userName: process.env.NAMECHEAP_USERNAME?.trim() || apiUser,
    sandbox: process.env.NAMECHEAP_SANDBOX === 'true',
  });
}

export function getDnsProvider(): DnsProvider | null {
  if (active === undefined) {
    active = fromEnvironment();
    if (!active) logger.info('Platform domain disabled: IDEPLOY_PLATFORM_DOMAIN / NAMECHEAP_* not set');
  }
  return active;
}

/** Tests: register an in-memory provider (or null to switch the feature off). */
export function setDnsProvider(provider: DnsProvider | null): void {
  active = provider;
}

/** Tests: go back to reading the environment. */
export function resetDnsProvider(): void {
  active = undefined;
}
