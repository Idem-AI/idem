/**
 * JOINDRE UN SITE, quel que soit le résolveur de la machine (21/11/2026).
 *
 * Le scan et le relevé ouvraient le site dans Chrome après une seule question au résolveur du système. Quand il
 * répondait « inconnu » — box d'un poste local, DNS d'un hébergeur, cache négatif — la refonte s'arrêtait sur
 * « adresse privée ou inconnue » pour un site bien en ligne (eknumerik.org : inconnu de la box, connu des serveurs DNS).
 *
 *   1. le nom est résolu de façon tolérante (`resolveHost` : système → DNS direct → résolveurs publics) ;
 *   2. la variante avec ou sans `www` est résolue aussi : un site redirige souvent de l'une vers l'autre, et l'une des
 *      deux peut manquer ;
 *   3. les noms que le système ne connaît pas sont ÉPINGLÉS dans Chrome (`--host-resolver-rules`) sur l'adresse
 *      trouvée : la navigation et ses redirections suivent sans redemander au système ;
 *   4. une adresse privée reste refusée, par quelque voie qu'elle arrive.
 */
import net from 'net';
import { allowedHosts, isPrivateAddress, resolveHost } from '../render/network-guard';

export type SiteReach =
  | { ok: true; url: string; chromeArgs: string[]; pinned: string[] }
  | { ok: false; reason: 'not_found' | 'private' | 'invalid'; host: string };

/** L'autre forme du nom : `www.x.cm` ↔ `x.cm` (jamais pour une adresse IP ni un nom à un seul point… sauf l'apex). */
function variantOf(host: string): string | null {
  if (net.isIP(host)) return null;
  if (host.startsWith('www.')) return host.slice(4).includes('.') ? host.slice(4) : null;
  return `www.${host}`;
}

export async function reachSite(rawUrl: string): Promise<SiteReach> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid', host: rawUrl };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  // Les hôtes explicitement autorisés (stockage, API, `RENDER_ALLOWED_HOSTS`, sites d'essai locaux) passent tels quels.
  if (allowedHosts().has(host)) return { ok: true, url: url.toString(), chromeArgs: [], pinned: [] };
  const variant = variantOf(host);
  const [main, other] = await Promise.all([resolveHost(host), variant ? resolveHost(variant) : Promise.resolve(null)]);

  const publicOf = (addresses: string[]) => addresses.filter((a) => !isPrivateAddress(a));
  const usable = (r: { addresses: string[] } | null) => !!r && r.addresses.length > 0 && publicOf(r.addresses).length === r.addresses.length;

  const rules: string[] = [];
  const pinned: string[] = [];
  for (const [name, resolved] of [[host, main], [variant, other]] as const) {
    if (!name || !resolved || resolved.via === 'system' || !usable(resolved)) continue;
    // IPv4 d'abord : la plupart des postes et des conteneurs n'ont pas de route IPv6.
    const address = resolved.addresses.find((a) => net.isIPv4(a)) ?? resolved.addresses[0];
    rules.push(`MAP ${name} ${net.isIPv6(address) ? `[${address}]` : address}`);
    pinned.push(`${name}→${address} (${resolved.via})`);
  }
  const chromeArgs = rules.length ? [`--host-resolver-rules=${rules.join(', ')}`] : [];

  if (usable(main)) return { ok: true, url: url.toString(), chromeArgs, pinned };
  if (variant && usable(other)) {
    url.hostname = variant;
    return { ok: true, url: url.toString(), chromeArgs, pinned };
  }
  const anyPrivate = [main, other].some((r) => r && r.addresses.length && publicOf(r.addresses).length < r.addresses.length);
  return { ok: false, reason: anyPrivate ? 'private' : 'not_found', host };
}

/** Le message d'un site injoignable, en mots simples et exacts (jamais « privée ou inconnue » à la fois). */
export function unreachableMessage(reach: Extract<SiteReach, { ok: false }>): string {
  if (reach.reason === 'private') return `${reach.host} pointe vers une adresse de réseau privé : un site public est nécessaire.`;
  if (reach.reason === 'invalid') return `Adresse illisible : ${reach.host}.`;
  return `Le nom de domaine ${reach.host} n’existe pas (aucun serveur DNS ne le connaît, avec ou sans « www ») : vérifiez son orthographe.`;
}
