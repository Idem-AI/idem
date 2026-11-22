/**
 * La recherche. Aucune extension n'est privilégiée : un nom tapé SANS extension est essayé sur tout
 * le catalogue, lot par lot (`offset`) — le front enchaîne quelques lots, puis la suite à la demande,
 * et montre chaque extension libre dès qu'elle est confirmée. Un nom tapé AVEC son extension est le résultat principal (`exact`), les
 * autres extensions suivent. Les extensions mises en avant passent en premier, puis le reste du
 * catalogue du moins cher au plus cher. Des variantes sont proposées quand le nom exact est pris.
 */
import { CatalogRow, featuredTlds, listCatalog } from '../pricing/catalog.service';
import { DomainQuote, publicQuote, quoteDomains } from '../pricing/quote.service';
import { normalizeDomain, suggestionLabels } from '../../utils/domain-name';

/**
 * Combien d'extensions par lot. Le fournisseur limite le nombre de requêtes (429) et vérifie
 * chaque registre l'un après l'autre : 10 extensions répondent en 1 à 2 s, 30 en 5 s. Le front
 * enchaîne quelques lots tout seul, puis le visiteur demande la suite (« Voir plus d'extensions »).
 */
export const SEARCH_BATCH = 10;

/** Ce qui reste d'une saisie quand on en retire tout ce qui n'est pas un nom. */
function labelOf(query: string): { label: string; tld: string | null } | null {
  const full = normalizeDomain(query);
  if (full) return { label: full.label, tld: full.tld };
  const label = query
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#.]/)[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return label ? { label, tld: null } : null;
}

/** L'ordre d'essai des extensions : mises en avant d'abord, puis du moins cher au plus cher. */
export function rankedTlds(catalog: CatalogRow[]): string[] {
  const featured = featuredTlds(catalog.map((c) => c.tld));
  const rest = catalog
    .filter((c) => !featured.includes(c.tld))
    .sort((a, b) => (a.register_xaf ?? Infinity) - (b.register_xaf ?? Infinity) || a.tld.localeCompare(b.tld))
    .map((c) => c.tld);
  return [...featured, ...rest];
}

export interface SearchResult {
  query: string;
  /** Le nom demandé, seulement si une extension a été tapée (sinon aucune n'est privilégiée). */
  exact: DomainQuote | null;
  /** Le même nom sur un lot d'extensions du catalogue. */
  extensions: DomainQuote[];
  /** Des variantes, seulement si le nom exact n'est pas libre. */
  suggestions: DomainQuote[];
  /** Le lot suivant (`offset`), ou null quand tout le catalogue a été essayé. */
  more: { nextOffset: number | null; total: number };
}

export async function searchDomains(query: string, options: { years?: number; atCost?: boolean; offset?: number } = {}): Promise<SearchResult> {
  const offset = Math.max(0, options.offset ?? 0);
  const parsed = labelOf(query);
  const catalog = await listCatalog();
  if (!parsed || !catalog.length) return { query, exact: null, extensions: [], suggestions: [], more: { nextOffset: null, total: 0 } };

  const ranked = rankedTlds(catalog).filter((t) => t !== parsed.tld);
  const batch = ranked.slice(offset, offset + SEARCH_BATCH);
  const exactName = parsed.tld && offset === 0 ? `${parsed.label}.${parsed.tld}` : null;
  const names = [...(exactName ? [exactName] : []), ...batch.map((t) => `${parsed.label}.${t}`)];

  const quotes = await quoteDomains(names, { years: options.years, atCost: options.atCost, context: 'search', record: (d) => d === exactName });
  const exact = exactName ? quotes.find((q) => q.domain === exactName) ?? null : null;

  // Variantes : sur l'extension tapée, quand ce nom-là est pris (jamais sur une extension imposée).
  let suggestions: DomainQuote[] = [];
  if (exact && exact.state !== 'available' && catalog.some((c) => c.tld === parsed.tld)) {
    const variants = suggestionLabels(parsed.label)
      .filter((l) => l !== parsed.label)
      .slice(0, 6)
      .map((l) => `${l}.${parsed.tld}`);
    suggestions = (await quoteDomains(variants, { years: options.years, atCost: options.atCost, context: 'search' })).filter((q) => q.state === 'available').slice(0, 4).map(publicQuote);
  }

  const next = offset + SEARCH_BATCH;
  return {
    query,
    exact: exact ? publicQuote(exact) : null,
    extensions: quotes.filter((q) => q.domain !== exactName).map(publicQuote),
    suggestions,
    more: { nextOffset: next < ranked.length ? next : null, total: ranked.length },
  };
}
