/**
 * ProviderPricingService — ce que coûte une opération chez chaque fournisseur.
 *
 * Deux sources, dans cet ordre de confiance :
 *   1. la réponse EN DIRECT du fournisseur pour le nom demandé (disponibilité, premium, coût),
 *      interrogée en parallèle et bornée dans le temps — un fournisseur lent ne bloque personne ;
 *   2. le dernier coût relevé (`provider_costs`, synchronisé par le worker ou saisi en console).
 * Chaque devis obtenu est historisé (`provider_price_quotes`).
 */
import { Db, query } from '../../config/db';
import logger from '../../config/logger';
import { registrar } from '../../integrations/registrars';
import { Operation, ProviderOffer } from './engine';
import { PromotionRow } from './catalog.service';

/** Au-delà, un fournisseur est traité comme n'ayant pas répondu (son coût stocké reste utilisable, pas sa disponibilité). */
const LIVE_TIMEOUT_MS = parseInt(process.env.IDOMAIN_LIVE_QUOTE_TIMEOUT_MS || '6000', 10);

interface OfferRow {
  code: string;
  priority: number;
  enabled: boolean;
  currency: string;
  membership_fee_year: string;
  expected_operations_year: number;
  fee_per_operation: string;
  health_status: ProviderOffer['health'];
  can_register: boolean | null;
  can_renew: boolean | null;
  can_transfer: boolean | null;
  supports_promotions: boolean | null;
  min_years: number | null;
  max_years: number | null;
  xaf_per_unit: string | null;
  costs: { operation: Operation; cost: string; currency: string }[] | null;
}

/** Les fournisseurs connus pour une extension, avec leurs coûts d'une année et leur taux de change. */
export async function storedOffers(tld: string, operation: Operation, promotion?: PromotionRow | null, db?: Db): Promise<ProviderOffer[]> {
  const rows = await query<OfferRow>(
    `SELECT p.code, p.priority, p.enabled, p.currency, p.membership_fee_year, p.expected_operations_year, p.fee_per_operation, p.health_status,
            c.can_register, c.can_renew, c.can_transfer, c.supports_promotions, c.min_years, c.max_years,
            fx.xaf_per_unit,
            (SELECT json_agg(json_build_object('operation', pc.operation, 'cost', pc.cost, 'currency', pc.currency))
               FROM provider_costs pc WHERE pc.provider_code = p.code AND pc.tld = $1 AND pc.years = 1) AS costs
       FROM registrar_providers p
       LEFT JOIN provider_capabilities c ON c.provider_code = p.code AND c.tld = $1
       LEFT JOIN fx_rates fx ON fx.currency = p.currency
      ORDER BY p.priority`,
    [tld],
    db
  );
  return rows.map((r) => {
    const costs: ProviderOffer['costs'] = {};
    for (const c of r.costs ?? []) {
      // Un coût saisi dans une autre devise que celle du compte n'est pas comparable : ignoré.
      if (c.currency === r.currency && c.operation !== ('restore' as Operation)) costs[c.operation] = Number(c.cost);
    }
    // Promotion du registre : son coût remplace celui de la 1ʳᵉ année chez les fournisseurs qui la répercutent.
    if (promotion?.funding === 'registry' && promotion.registry_cost && r.supports_promotions && promotion.registry_cost_currency === r.currency) {
      costs[operation] = Number(promotion.registry_cost);
    }
    const capable = operation === 'register' ? r.can_register : operation === 'renew' ? r.can_renew : r.can_transfer;
    return {
      providerCode: r.code,
      priority: r.priority,
      enabled: r.enabled,
      configured: Boolean(registrar(r.code)),
      health: r.health_status,
      capable: Boolean(capable),
      minYears: r.min_years ?? 1,
      maxYears: r.max_years ?? 10,
      currency: r.currency,
      xafPerUnit: r.xaf_per_unit ? Number(r.xaf_per_unit) : null,
      costs,
      membershipFeeYear: Number(r.membership_fee_year),
      expectedOperationsYear: r.expected_operations_year,
      feePerOperation: Number(r.fee_per_operation),
    };
  });
}

/** Les fournisseurs qui méritent une question en direct : ceux qui pourraient être retenus. */
function askable(o: ProviderOffer): boolean {
  return o.enabled && o.configured && o.capable && o.health !== 'down';
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('live_quote_timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * Interroge en parallèle les fournisseurs compatibles pour un lot de noms d'UNE même extension.
 * Renvoie, par nom, les offres complétées de la réponse en direct.
 */
export async function liveOffers(domains: string[], tld: string, operation: Operation, years: number, context: 'search' | 'session' | 'purchase', promotion?: PromotionRow | null): Promise<Map<string, ProviderOffer[]>> {
  const offers = await storedOffers(tld, operation, promotion);
  const answers = await Promise.all(
    offers.map(async (offer) => {
      if (!askable(offer)) return { offer, results: null as Awaited<ReturnType<NonNullable<ReturnType<typeof registrar>>['checkAvailability']>> | null };
      try {
        const results = await withTimeout(registrar(offer.providerCode)!.checkAvailability(domains, operation, years), LIVE_TIMEOUT_MS);
        return { offer, results };
      } catch (error) {
        logger.warn('pricing.live_quote_failed', { event: 'pricing.live_quote_failed', provider: offer.providerCode, tld, context, error });
        return { offer, results: null };
      }
    })
  );

  const byDomain = new Map<string, ProviderOffer[]>();
  for (const domain of domains) byDomain.set(domain, []);
  for (const { offer, results } of answers) {
    for (const domain of domains) {
      const live = results?.find((r) => r.domain === domain);
      byDomain.get(domain)!.push({
        ...offer,
        // Pas de réponse : la disponibilité est inconnue (null), jamais supposée.
        available: live ? live.available : null,
        premium: live?.premium ?? false,
        liveCost: live?.cost !== undefined && live.currency === offer.currency ? live.cost : null,
      });
    }
  }
  return byDomain;
}

export async function recordQuotes(
  domain: string,
  operation: Operation,
  years: number,
  context: 'search' | 'session' | 'purchase',
  costed: { providerCode: string; cost: number | null; currency: string; totalCostXaf: number | null; admissible: boolean; reason?: string }[],
  offers: ProviderOffer[]
): Promise<void> {
  if (!costed.length) return;
  const values: unknown[] = [];
  const rows = costed.map((c, i) => {
    const offer = offers.find((o) => o.providerCode === c.providerCode);
    values.push(c.providerCode, domain, operation, years, offer?.available ?? null, offer?.premium ?? false, c.cost, c.currency, c.totalCostXaf, c.admissible, c.reason ?? null, context);
    const b = i * 12;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12})`;
  });
  try {
    await query(
      `INSERT INTO provider_price_quotes (provider_code, domain_name, operation, years, available, premium, cost, currency, total_cost_xaf, admissible, reason, context) VALUES ${rows.join(', ')}`,
      values
    );
  } catch (error) {
    logger.warn('pricing.quote_record_failed', { event: 'pricing.quote_record_failed', domain, error });
  }
}
