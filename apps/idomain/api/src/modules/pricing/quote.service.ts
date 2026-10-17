/**
 * ProviderSelectionService — le devis d'un nom : son prix public (catalogue, promotion, prix au
 * coût), sa disponibilité réelle et le fournisseur que le moteur retiendrait.
 *
 * Le client ne voit jamais le fournisseur. Il voit un prix, et un nom « disponible » seulement si
 * un fournisseur ADMISSIBLE vient de le confirmer : un nom qu'on ne pourrait vendre qu'à perte, ou
 * qu'aucun fournisseur n'a pu vérifier, n'est pas proposé à l'achat.
 */
import { activeCatalog, activePromotion, CatalogRow, PromotionRow } from './catalog.service';
import { CostedOffer, Operation, ProviderOffer, publicPriceXaf, selectProvider } from './engine';
import { liveOffers, recordQuotes } from './provider-pricing.service';
import { activeRules } from './rules.service';
import { normalizeDomain } from '../../utils/domain-name';

export type QuoteState =
  /** Disponible et vendable : prix garanti à la demande d'une session. */
  | 'available'
  /** Déjà enregistré (proposer de le connecter s'il est à l'utilisateur). */
  | 'taken'
  /** Nom premium : prix du registre hors grille, non vendu. */
  | 'premium'
  /** Extension que nous ne vendons pas (encore). */
  | 'not_sold'
  /** Disponible chez un fournisseur, mais aucune offre admissible (marge, panne) : jamais vendu à perte. */
  | 'unavailable_now'
  /** Aucun fournisseur n'a pu répondre : à réessayer. */
  | 'unknown';

export interface DomainQuote {
  domain: string;
  tld: string;
  operation: Operation;
  years: number;
  state: QuoteState;
  priceXaf: number | null;
  /** Prix d'un an de renouvellement, annoncé dès la recherche. */
  renewalXaf: number | null;
  atCost: boolean;
  promotion: { id: number; endsAt: Date } | null;
}

/** Ce que seul le serveur voit : le choix du moteur et de quoi l'historiser. */
export interface InternalQuote extends DomainQuote {
  catalogId: number | null;
  rulesId: number;
  selected: CostedOffer | null;
  second: CostedOffer | null;
  offers: CostedOffer[];
}

interface QuoteOptions {
  operation?: Operation;
  years?: number;
  /** Domaine au coût (pack, forfait Entreprise). */
  atCost?: boolean;
  context?: 'search' | 'session' | 'purchase';
  /** Historiser les devis de ces noms (le nom tapé, pas les suggestions). */
  record?: (domain: string) => boolean;
}

export async function quoteDomains(rawDomains: string[], options: QuoteOptions = {}): Promise<InternalQuote[]> {
  const operation = options.operation ?? 'register';
  const { id: rulesId, rules } = await activeRules();
  const years = Math.min(Math.max(1, options.years ?? 1), rules.maxYears);
  const context = options.context ?? 'search';

  const parsed = [...new Set(rawDomains)].map((d) => normalizeDomain(d)).filter((d): d is NonNullable<typeof d> => !!d);
  const byTld = new Map<string, string[]>();
  for (const p of parsed) byTld.set(p.tld, [...(byTld.get(p.tld) ?? []), p.name]);

  const out: InternalQuote[] = [];
  await Promise.all(
    [...byTld.entries()].map(async ([tld, names]) => {
      const catalog = await activeCatalog(tld);
      const promotion = catalog?.on_sale ? await activePromotion(tld, operation) : null;
      if (!catalog || !catalog.on_sale) {
        for (const domain of names) out.push(empty(domain, tld, operation, years, rulesId, 'not_sold'));
        return;
      }
      const offersByDomain = await liveOffers(names, tld, operation, years, context, promotion);
      for (const domain of names) {
        const quote = decide(domain, tld, operation, years, catalog, promotion, offersByDomain.get(domain) ?? [], rules, rulesId, Boolean(options.atCost));
        out.push(quote);
        if (options.record?.(domain)) await recordQuotes(domain, operation, years, context, quote.offers, offersByDomain.get(domain) ?? []);
      }
    })
  );
  // L'ordre demandé (le nom tapé d'abord).
  const order = parsed.map((p) => p.name);
  return out.sort((a, b) => order.indexOf(a.domain) - order.indexOf(b.domain));
}

function decide(
  domain: string,
  tld: string,
  operation: Operation,
  years: number,
  catalog: CatalogRow,
  promotion: PromotionRow | null,
  offers: ProviderOffer[],
  rules: Awaited<ReturnType<typeof activeRules>>['rules'],
  rulesId: number,
  atCost: boolean
): InternalQuote {
  // Un pack ou le forfait Entreprise prime sur une promotion : c'est le prix le plus bas qui s'applique.
  const promoPrice = promotion && !(atCost && catalog.pack_xaf && catalog.pack_xaf <= promotion.price_xaf) ? promotion.price_xaf : null;
  const priceXaf = publicPriceXaf(catalog, operation, years, { atCost, promotionXaf: promoPrice });
  const renewalXaf = catalog.renew_xaf;
  const funded = Boolean(promoPrice) || (atCost && operation === 'register' && Boolean(catalog.pack_xaf));
  const base = {
    domain,
    tld,
    operation,
    years,
    priceXaf,
    renewalXaf,
    atCost: atCost && !promoPrice && operation === 'register' && Boolean(catalog.pack_xaf),
    promotion: promoPrice && promotion ? { id: promotion.id, endsAt: promotion.ends_at } : null,
    catalogId: catalog.id,
    rulesId,
  };
  if (priceXaf === null) return { ...base, state: 'not_sold', selected: null, second: null, offers: [] };

  const selection = selectProvider(offers, operation, years, priceXaf, rules, funded);
  const answered = offers.filter((o) => o.available !== null && o.available !== undefined);
  const premium = answered.some((o) => o.premium);
  // Pour un enregistrement, « pris » chez un fournisseur qui a répondu vaut partout (le registre est unique).
  const taken = operation === 'register' && answered.length > 0 && answered.every((o) => o.available === false);

  let state: QuoteState;
  if (selection.selected && offers.find((o) => o.providerCode === selection.selected!.providerCode)?.available === true) state = 'available';
  else if (operation !== 'register' && selection.selected) state = 'available';
  else if (taken) state = 'taken';
  else if (premium) state = 'premium';
  else if (!answered.length) state = 'unknown';
  else state = 'unavailable_now';

  return { ...base, state, selected: selection.selected, second: selection.second, offers: selection.offers };
}

function empty(domain: string, tld: string, operation: Operation, years: number, rulesId: number, state: QuoteState): InternalQuote {
  return { domain, tld, operation, years, state, priceXaf: null, renewalXaf: null, atCost: false, promotion: null, catalogId: null, rulesId, selected: null, second: null, offers: [] };
}

/**
 * La revalidation AVANT l'achat : disponibilité et coûts relus en direct, chiffrés au prix CONVENU
 * (celui de la session, pas le catalogue du moment). `exclude` : fournisseurs déjà en échec
 * définitif pour cette ligne.
 */
export async function revalidate(
  domain: string,
  tld: string,
  operation: Operation,
  years: number,
  priceXaf: number,
  options: { funded: boolean; exclude?: string[]; promotionId?: number | null }
): Promise<{ selection: ReturnType<typeof selectProvider>; offers: ProviderOffer[]; taken: boolean; rulesId: number }> {
  const { id: rulesId, rules } = await activeRules();
  const promotion = options.promotionId ? await activePromotion(tld, operation) : null;
  const offers = (await liveOffers([domain], tld, operation, years, 'purchase', promotion?.id === options.promotionId ? promotion : null)).get(domain) ?? [];
  const usable = offers.filter((o) => !options.exclude?.includes(o.providerCode));
  const selection = selectProvider(usable, operation, years, priceXaf, rules, options.funded);
  // Pour l'achat, il faut une confirmation EXPLICITE de disponibilité par le fournisseur retenu.
  if (operation === 'register' && selection.selected && usable.find((o) => o.providerCode === selection.selected!.providerCode)?.available !== true) {
    const confirmed = selection.offers
      .filter((o) => o.admissible && usable.find((u) => u.providerCode === o.providerCode)?.available === true)
      .sort((a, b) => (a.rankingCostXaf ?? Infinity) - (b.rankingCostXaf ?? Infinity) || a.priority - b.priority);
    selection.selected = confirmed[0] ?? null;
    selection.second = confirmed[1] ?? null;
  }
  const answered = offers.filter((o) => o.available === true || o.available === false);
  const taken = operation === 'register' && answered.length > 0 && answered.every((o) => o.available === false);
  await recordQuotes(domain, operation, years, 'purchase', selection.offers, usable);
  return { selection, offers: usable, taken, rulesId };
}

/** Ce que le client a le droit de voir d'un devis : jamais le fournisseur, ni le coût, ni la marge. */
export function publicQuote(q: InternalQuote): DomainQuote {
  return {
    domain: q.domain,
    tld: q.tld,
    operation: q.operation,
    years: q.years,
    state: q.state,
    priceXaf: q.state === 'not_sold' ? null : q.priceXaf,
    renewalXaf: q.state === 'not_sold' ? null : q.renewalXaf,
    atCost: q.atCost,
    promotion: q.promotion,
  };
}
