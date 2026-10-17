/**
 * Le moteur de prix, en calcul pur (aucune base, aucun réseau) : ce qui décide d'une vente.
 *
 * Le client paie le PRIX PUBLIC d'iDomain, le même quel que soit le fournisseur. En arrière-plan,
 * chaque fournisseur compatible est chiffré au COÛT TOTAL — prix de l'extension dans sa devise,
 * converti au taux de pilotage, plus sa part d'abonnement revendeur et ses frais fixes — et le
 * moins cher des fournisseurs ADMISSIBLES est retenu. Admissible : actif, en état de marche, sait
 * faire l'opération sur l'extension, nom disponible et non premium, et la vente garde la marge
 * minimale. Jamais de vente à perte, sauf promotion financée (pack, registre, budget voté).
 *
 * Formule du plan économique (§9.2), appliquée à l'envers pour juger une vente :
 *   P_min = (C_fournisseur + C_fixes + C_support) / (1 − f − b − m)
 *   marge = P × (1 − f − b) − C_support − C_fournisseur − C_fixes, admissible si marge ≥ m × P
 * f = frais d'encaissement, b = coussin de change, m = marge minimale.
 */

export interface PricingRules {
  /** f — frais d'encaissement (part du prix). */
  paymentFeeRate: number;
  /** b — coussin de change (part du prix). */
  fxCushionRate: number;
  /** m — marge minimale (part du prix). */
  minMarginRate: number;
  /** Support par commande, en francs. */
  supportCostXaf: number;
  /** Durée pendant laquelle le prix montré reste garanti. */
  priceSessionMinutes: number;
  /** Pénalité de classement d'un fournisseur « dégradé » (en francs, jamais facturée). */
  degradedPenaltyXaf: number;
  /** Durée maximale d'un enregistrement vendu. */
  maxYears: number;
  /** Une vente financée (promotion, pack, forfait Entreprise) peut être à perte : un autre poste la paie. */
  allowLossOnFundedPromotions: boolean;
}

export type Operation = 'register' | 'renew' | 'transfer';

/** Un fournisseur, tel que la base le décrit pour une extension. */
export interface ProviderOffer {
  providerCode: string;
  priority: number;
  enabled: boolean;
  configured: boolean;
  health: 'up' | 'degraded' | 'down' | 'unknown';
  capable: boolean;
  minYears: number;
  maxYears: number;
  currency: string;
  /** Francs pour une unité de la devise (absent : devise sans taux, fournisseur écarté). */
  xafPerUnit: number | null;
  /** Coûts d'UNE année, dans la devise du fournisseur. */
  costs: Partial<Record<'register' | 'renew' | 'transfer', number>>;
  membershipFeeYear: number;
  expectedOperationsYear: number;
  feePerOperation: number;
  /** Réponse en direct du fournisseur (absente : pas interrogé, ou n'a pas répondu). */
  available?: boolean | null;
  premium?: boolean;
  /** Coût annoncé en direct pour CETTE opération et une année : prime sur le coût stocké. */
  liveCost?: number | null;
}

export type ExclusionReason =
  | 'disabled'
  | 'not_configured'
  | 'down'
  | 'not_capable'
  | 'years_out_of_range'
  | 'no_cost'
  | 'no_fx_rate'
  | 'unavailable'
  | 'premium'
  | 'margin_below_minimum';

export interface CostedOffer {
  providerCode: string;
  priority: number;
  /** Coût de l'opération sur la durée, dans la devise du fournisseur (sans les fixes). */
  cost: number | null;
  currency: string;
  /** Coût total en francs : extension + part d'abonnement + frais fixes. */
  totalCostXaf: number | null;
  /** Ce qui reste à IDEM après encaissement, change, support et coût total. */
  marginXaf: number | null;
  admissible: boolean;
  reason?: ExclusionReason;
  /** Coût de classement (coût total + pénalité d'un fournisseur dégradé). */
  rankingCostXaf: number | null;
}

export interface Selection {
  selected: CostedOffer | null;
  second: CostedOffer | null;
  offers: CostedOffer[];
}

/** Coût de l'opération sur `years` ans : la 1ʳᵉ année au prix de l'opération, les suivantes au renouvellement. */
export function operationCost(offer: Pick<ProviderOffer, 'costs' | 'liveCost'>, operation: Operation, years: number): number | null {
  const first = offer.liveCost ?? offer.costs[operation];
  if (first === undefined || first === null) return null;
  if (operation === 'renew') return round4(first * years);
  const renew = offer.costs.renew ?? first;
  return round4(first + renew * Math.max(0, years - 1));
}

export function costOffer(offer: ProviderOffer, operation: Operation, years: number, priceXaf: number, rules: PricingRules, fundedPromotion = false): CostedOffer {
  const base = { providerCode: offer.providerCode, priority: offer.priority, currency: offer.currency };
  const cost = operationCost(offer, operation, years);
  const totalCostXaf =
    cost !== null && offer.xafPerUnit ? Math.round((cost + offer.membershipFeeYear / Math.max(1, offer.expectedOperationsYear) + offer.feePerOperation) * offer.xafPerUnit) : null;
  const marginXaf = totalCostXaf !== null ? Math.round(priceXaf * (1 - rules.paymentFeeRate - rules.fxCushionRate) - rules.supportCostXaf - totalCostXaf) : null;
  const rankingCostXaf = totalCostXaf !== null ? totalCostXaf + (offer.health === 'degraded' ? rules.degradedPenaltyXaf : 0) : null;
  const out = (reason?: ExclusionReason): CostedOffer => ({ ...base, cost, totalCostXaf, marginXaf, rankingCostXaf, admissible: !reason, ...(reason ? { reason } : {}) });

  if (!offer.enabled) return out('disabled');
  if (!offer.configured) return out('not_configured');
  if (offer.health === 'down') return out('down');
  if (!offer.capable) return out('not_capable');
  if (years < offer.minYears || years > offer.maxYears) return out('years_out_of_range');
  if (cost === null) return out('no_cost');
  if (!offer.xafPerUnit) return out('no_fx_rate');
  if (offer.available === false) return out('unavailable');
  if (offer.premium) return out('premium');
  // Une vente FINANCÉE (promotion de registre, budget voté, domaine au coût d'un pack ou du forfait
  // Entreprise) renonce à la marge minimale ; la perte n'est permise que si les règles l'autorisent,
  // parce qu'un autre poste la paie. Sans financement, jamais sous la marge minimale.
  const floor = fundedPromotion ? (rules.allowLossOnFundedPromotions ? -Infinity : 0) : rules.minMarginRate * priceXaf;
  if (marginXaf === null || marginXaf < floor) return out('margin_below_minimum');
  return out();
}

/** Le fournisseur admissible au coût total le plus bas (départage : priorité), et le suivant. */
export function selectProvider(offers: ProviderOffer[], operation: Operation, years: number, priceXaf: number, rules: PricingRules, fundedPromotion = false): Selection {
  const costed = offers.map((o) => costOffer(o, operation, years, priceXaf, rules, fundedPromotion));
  const admissible = costed
    .filter((o) => o.admissible)
    .sort((a, b) => (a.rankingCostXaf ?? Infinity) - (b.rankingCostXaf ?? Infinity) || a.priority - b.priority || a.providerCode.localeCompare(b.providerCode));
  return { selected: admissible[0] ?? null, second: admissible[1] ?? null, offers: costed };
}

/** Le prix plancher d'une extension (P_min), arrondi à la centaine supérieure : la référence de la console. */
export function minimumPriceXaf(totalCostXaf: number, rules: PricingRules): number {
  const denominator = 1 - rules.paymentFeeRate - rules.fxCushionRate - rules.minMarginRate;
  if (denominator <= 0) return Infinity;
  // Le petit epsilon absorbe le flottant : 6 776 / 0,77 vaut 8 800,000…01, pas 8 801.
  return Math.ceil((totalCostXaf + rules.supportCostXaf) / denominator / 100 - 1e-9) * 100;
}

/** Le prix public d'une opération sur `years` ans, à partir d'une ligne de catalogue. */
export function publicPriceXaf(
  catalog: { register_xaf: number | null; renew_xaf: number | null; transfer_xaf: number | null; pack_xaf: number | null },
  operation: Operation,
  years: number,
  options: { atCost?: boolean; promotionXaf?: number | null } = {}
): number | null {
  const renew = catalog.renew_xaf;
  const firstYear =
    options.promotionXaf ?? (operation === 'register' && options.atCost && catalog.pack_xaf ? catalog.pack_xaf : operation === 'register' ? catalog.register_xaf : operation === 'renew' ? renew : catalog.transfer_xaf);
  if (!firstYear) return null;
  if (years <= 1) return firstYear;
  if (!renew) return null;
  return operation === 'renew' ? firstYear * years : firstYear + renew * (years - 1);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export const DEFAULT_RULES: PricingRules = {
  paymentFeeRate: 0.03,
  fxCushionRate: 0.05,
  minMarginRate: 0.15,
  supportCostXaf: 250,
  priceSessionMinutes: 30,
  degradedPenaltyXaf: 300,
  maxYears: 5,
  allowLossOnFundedPromotions: true,
};
