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
import { AvailabilityResult, RegistrarError, registrar } from '../../integrations/registrars';
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
 * Au plus, combien de noms partent dans une même question à un fournisseur. Domain Name API
 * vérifie chaque registre l'un après l'autre : 30 noms d'extensions différentes dépassent le délai,
 * 5 répondent en 1 à 2 s.
 */
const LIVE_BATCH = parseInt(process.env.IDOMAIN_LIVE_QUOTE_BATCH || '5', 10);
/**
 * Au plus, combien de questions en vol à la fois chez un même fournisseur, toutes recherches
 * confondues : au-delà, Domain Name API répond 429 (trop de requêtes). Les autres attendent leur tour.
 */
const LIVE_CONCURRENCY = parseInt(process.env.IDOMAIN_LIVE_QUOTE_CONCURRENCY || '3', 10);
/** Une réponse 429 : une seule nouvelle tentative, après cette pause. */
const RATE_LIMIT_RETRY_MS = 1200;

/** Une file par fournisseur, partagée par toutes les recherches du processus. */
const lanes = new Map<string, { active: number; waiting: (() => void)[] }>();

async function inLane<T>(providerCode: string, task: () => Promise<T>): Promise<T> {
  let lane = lanes.get(providerCode);
  if (!lane) lanes.set(providerCode, (lane = { active: 0, waiting: [] }));
  if (lane.active >= LIVE_CONCURRENCY) await new Promise<void>((resolve) => lane!.waiting.push(resolve));
  lane.active++;
  try {
    return await task();
  } finally {
    lane.active--;
    lane.waiting.shift()?.();
  }
}

/** Une question au fournisseur, dans sa file, rejouée une fois s'il répond 429. */
async function askProvider(code: string, batch: string[], operation: Operation, years: number): Promise<AvailabilityResult[]> {
  const adapter = registrar(code)!;
  const once = () => inLane(code, () => withTimeout(adapter.checkAvailability(batch, operation, years), LIVE_TIMEOUT_MS));
  try {
    return await once();
  } catch (error) {
    if (!(error instanceof RegistrarError) || error.status !== 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_MS));
    return once();
  }
}

/**
 * Interroge en parallèle les fournisseurs compatibles pour un lot de noms d'UNE même extension.
 * Renvoie, par nom, les offres complétées de la réponse en direct.
 */
export async function liveOffers(domains: string[], tld: string, operation: Operation, years: number, context: 'search' | 'session' | 'purchase', promotion?: PromotionRow | null): Promise<Map<string, ProviderOffer[]>> {
  return liveOffersMany([{ tld, domains, promotion }], operation, years, context);
}

/**
 * La même chose pour des noms de PLUSIEURS extensions : chaque fournisseur reçoit UNE question pour
 * tous les noms qu'il sait vendre (découpée par lots de `LIVE_BATCH`), au lieu d'une par extension —
 * c'est ce qui permet de vérifier un nom sur tout le catalogue sans multiplier les appels.
 */
export async function liveOffersMany(
  groups: { tld: string; domains: string[]; promotion?: PromotionRow | null }[],
  operation: Operation,
  years: number,
  context: 'search' | 'session' | 'purchase'
): Promise<Map<string, ProviderOffer[]>> {
  const stored = await Promise.all(groups.map(async (g) => ({ ...g, offers: await storedOffers(g.tld, operation, g.promotion) })));

  const toAsk = new Map<string, string[]>();
  for (const g of stored) for (const o of g.offers) if (askable(o)) toAsk.set(o.providerCode, [...(toAsk.get(o.providerCode) ?? []), ...g.domains]);

  // Par fournisseur, ce qu'il a répondu pour chaque nom (absent : pas de réponse, donc inconnu).
  const answers = new Map<string, Map<string, AvailabilityResult>>();
  await Promise.all(
    [...toAsk.entries()].map(async ([code, domains]) => {
      const byName = new Map<string, AvailabilityResult>();
      const batches: string[][] = [];
      for (let i = 0; i < domains.length; i += LIVE_BATCH) batches.push(domains.slice(i, i + LIVE_BATCH));
      await Promise.all(
        batches.map(async (batch) => {
          try {
            for (const r of await askProvider(code, batch, operation, years)) byName.set(r.domain, r);
          } catch (error) {
            logger.warn('pricing.live_quote_failed', { event: 'pricing.live_quote_failed', provider: code, names: batch.length, context, error });
          }
        })
      );
      answers.set(code, byName);
    })
  );

  const byDomain = new Map<string, ProviderOffer[]>();
  for (const g of stored) {
    for (const domain of g.domains) {
      byDomain.set(
        domain,
        g.offers.map((offer) => {
          const live = answers.get(offer.providerCode)?.get(domain);
          return {
            ...offer,
            // Pas de réponse : la disponibilité est inconnue (null), jamais supposée.
            available: live ? live.available : null,
            premium: live?.premium ?? false,
            liveCost: live?.cost !== undefined && live.currency === offer.currency ? live.cost : null,
          };
        })
      );
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
