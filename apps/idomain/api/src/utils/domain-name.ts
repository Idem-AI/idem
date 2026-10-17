/**
 * Les noms de domaine tels qu'iDomain les manipule : en minuscules, en ASCII (un nom accentué
 * devient sa forme punycode `xn--…`), sans `www.`, sans protocole ni chemin.
 */
import { domainToASCII } from 'url';

/** Suffixes de second niveau sous lesquels un nom compte trois étiquettes (`boutique.co.cm`). */
const TWO_LEVEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'com.au', 'co.za', 'org.za', 'com.ng', 'org.ng', 'co.ke', 'or.ke', 'com.gh', 'co.tz', 'co.ug',
  'com.cm', 'co.cm', 'com.ci', 'co.ci', 'com.sn', 'com.eg', 'co.ma', 'com.tn', 'co.rw', 'com.br', 'co.in', 'co.nz',
]);

export interface ParsedDomain {
  /** `ma-boutique.africa` */
  name: string;
  /** `ma-boutique` */
  label: string;
  /** `africa` (ou `co.cm`) */
  tld: string;
}

/** Ce que l'utilisateur a tapé (`https://www.Ma-Boutique.africa/contact`) → un nom propre, ou null. */
export function normalizeDomain(input: string): ParsedDomain | null {
  let raw = String(input || '').trim().toLowerCase();
  raw = raw.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/\.$/, '').replace(/^www\./, '');
  if (!raw || raw.length > 253) return null;
  const ascii = domainToASCII(raw);
  if (!ascii) return null;
  const labels = ascii.split('.');
  if (labels.length < 2 || !labels.every(isLabel)) return null;
  const lastTwo = labels.slice(-2).join('.');
  const tldParts = TWO_LEVEL_SUFFIXES.has(lastTwo) && labels.length >= 3 ? 2 : 1;
  // On vend des noms enregistrables : `ma-boutique.africa`, pas `shop.ma-boutique.africa`.
  if (labels.length !== tldParts + 1) return null;
  const tld = labels.slice(-tldParts).join('.');
  if (!/^[a-z]{2,24}$|^[a-z]{2,10}\.[a-z]{2,10}$|^xn--[a-z0-9-]{2,59}$/.test(tld)) return null;
  return { name: ascii, label: labels[0], tld };
}

/** Un nom d'hôte quelconque (sous-domaine compris), pour connecter un domaine externe. */
export function normalizeHost(input: string): string | null {
  let raw = String(input || '').trim().toLowerCase();
  raw = raw.replace(/^[a-z]+:\/\//, '').split(/[/?#:]/)[0].replace(/\.$/, '');
  const ascii = raw ? domainToASCII(raw) : '';
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split('.');
  return labels.length >= 2 && labels.every(isLabel) && /^[a-z]{2,}|^xn--/.test(labels[labels.length - 1]) ? ascii : null;
}

/** La zone DNS d'un hôte : `www.boutique.com` → `boutique.com`. */
export function zoneOf(host: string): string {
  const labels = host.toLowerCase().split('.');
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return labels.slice(TWO_LEVEL_SUFFIXES.has(lastTwo) ? -3 : -2).join('.');
}

/** Le nom relatif d'un hôte dans sa zone : `www.boutique.com` → `www`, l'apex → `@`. */
export function relativeTo(host: string, zone: string): string {
  return host === zone ? '@' : host.endsWith(`.${zone}`) ? host.slice(0, -(zone.length + 1)) : host;
}

function isLabel(label: string): boolean {
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(label);
}

/** Variantes proposées quand le nom voulu est pris, ou pour élargir la recherche. */
export function suggestionLabels(label: string): string[] {
  const out = new Set<string>([label]);
  if (label.length <= 50) {
    for (const prefix of ['mon', 'ma', 'le', 'my']) out.add(`${prefix}${label}`);
    for (const suffix of ['africa', 'pro', 'shop', 'online', 'hq']) out.add(`${label}${suffix}`);
    if (!label.includes('-') && label.length > 6) out.add(`${label.slice(0, Math.ceil(label.length / 2))}-${label.slice(Math.ceil(label.length / 2))}`);
  }
  return [...out].filter((l) => isLabel(l));
}
