/**
 * Empreintes stables : un même objet donne toujours la même empreinte, quel que soit l'ordre de
 * ses clés. Elles servent de clés de cache, d'identité d'un DesignSpec et de trace d'un rendu.
 */
import { createHash } from 'crypto';

/** JSON canonique : clés triées, `undefined` omis. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function stableHash(value: unknown, length = 12): string {
  return createHash('sha1').update(canonicalJson(value)).digest('hex').slice(0, length);
}

export function textHash(text: string, length = 12): string {
  return createHash('sha1').update(text).digest('hex').slice(0, length);
}

/** Identifiant court et lisible : `prefix-1a2b3c4d`. */
export function shortId(prefix: string, ...parts: unknown[]): string {
  return `${prefix}-${stableHash(parts, 8)}`;
}
