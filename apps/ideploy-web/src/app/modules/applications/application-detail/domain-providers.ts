/**
 * Where people buy their domains, and the page where each one keeps its DNS.
 *
 * The guide names the buttons as each provider names them, so a user who has
 * never seen a DNS zone can follow it click by click. The words themselves are
 * in the translations (`applications.domain.providers.<id>`): three steps and
 * the one trap that provider is known for (GoDaddy's parked record, OVHcloud's
 * AAAA, Cloudflare's proxy…).
 */
export interface DnsProvider {
  id: string;
  name: string;
  /** The provider's own DNS management page, opened in a new tab. */
  url: string | null;
}

export const DNS_PROVIDERS: DnsProvider[] = [
  { id: 'godaddy', name: 'GoDaddy', url: 'https://dcc.godaddy.com/control/portfolio' },
  { id: 'namecheap', name: 'Namecheap', url: 'https://ap.www.namecheap.com/domains/list/' },
  { id: 'ovh', name: 'OVHcloud', url: 'https://www.ovh.com/manager/#/web/domain' },
  { id: 'hostinger', name: 'Hostinger', url: 'https://hpanel.hostinger.com/domains' },
  { id: 'cloudflare', name: 'Cloudflare', url: 'https://dash.cloudflare.com' },
  { id: 'lws', name: 'LWS', url: 'https://panel.lws.fr' },
  { id: 'squarespace', name: 'Squarespace', url: 'https://account.squarespace.com/domains' },
  { id: 'other', name: '', url: null },
];

/** Where to buy one, for someone who has none yet. */
export const DOMAIN_SELLERS: { name: string; url: string }[] = [
  { name: 'Namecheap', url: 'https://www.namecheap.com' },
  { name: 'OVHcloud', url: 'https://www.ovhcloud.com/fr/domains/' },
  { name: 'Hostinger', url: 'https://www.hostinger.com/domain-name-search' },
];

/** `boutique.com`, `app.boutique.co.uk` — letters, digits and dashes, at least one dot. */
export const HOSTNAME = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** What was typed, as a bare hostname: no scheme, no path, no port, lowercase. */
export function bareHost(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * A domain bought as is (`boutique.com`, `boutique.co.ke`) rather than a
 * subdomain of one: those are worth serving with `www.` too.
 */
export function isApex(host: string): boolean {
  const labels = host.split('.');
  if (labels.length === 2) return true;
  return labels.length === 3 && /^(co|com|org|net|gov|ac|edu)$/.test(labels[1]);
}
