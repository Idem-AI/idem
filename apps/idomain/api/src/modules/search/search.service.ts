/**
 * La recherche : le nom tapé, sur l'extension tapée ou sur toutes celles en vente, puis quelques
 * variantes quand il est pris. Un prix public unique par extension, le renouvellement à côté.
 */
import { listCatalog } from '../pricing/catalog.service';
import { DomainQuote, publicQuote, quoteDomains } from '../pricing/quote.service';
import { normalizeDomain, suggestionLabels } from '../../utils/domain-name';

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
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return label ? { label, tld: null } : null;
}

export interface SearchResult {
  query: string;
  /** Le nom demandé (sur l'extension tapée, sinon la première en vente). */
  exact: DomainQuote | null;
  /** Le même nom sur les autres extensions en vente. */
  extensions: DomainQuote[];
  /** Des variantes, seulement si le nom demandé n'est pas libre. */
  suggestions: DomainQuote[];
}

export async function searchDomains(query: string, options: { years?: number; atCost?: boolean } = {}): Promise<SearchResult> {
  const parsed = labelOf(query);
  const catalog = await listCatalog();
  if (!parsed || !catalog.length) return { query, exact: null, extensions: [], suggestions: [] };

  const tlds = catalog.map((c) => c.tld);
  const primaryTld = parsed.tld ?? tlds[0];
  const exactName = `${parsed.label}.${primaryTld}`;
  const others = tlds.filter((t) => t !== primaryTld).map((t) => `${parsed.label}.${t}`);

  const quotes = await quoteDomains([exactName, ...others], { ...options, context: 'search', record: (d) => d === exactName });
  const exact = quotes.find((q) => q.domain === exactName) ?? null;

  let suggestions: DomainQuote[] = [];
  if (!exact || exact.state !== 'available') {
    const variants = suggestionLabels(parsed.label)
      .filter((l) => l !== parsed.label)
      .slice(0, 6)
      .map((l) => `${l}.${tlds.includes(primaryTld) ? primaryTld : tlds[0]}`);
    suggestions = (await quoteDomains(variants, { ...options, context: 'search' })).filter((q) => q.state === 'available').slice(0, 4).map(publicQuote);
  }

  return {
    query,
    exact: exact ? publicQuote(exact) : null,
    extensions: quotes.filter((q) => q.domain !== exactName).map(publicQuote),
    suggestions,
  };
}
