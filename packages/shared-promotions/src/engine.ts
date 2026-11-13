import { serviceOfItem } from './items';
import type { PromotionDiscount, PromotionPhase, PromotionScope, PublicPromotion, Promotion } from './model';

/**
 * Le calcul d'une remise, identique côté API (débit) et côté écrans (affichage).
 *
 * Règle de cumul, simple à expliquer :
 *  1. parmi les promotions EXCLUSIVES qui visent l'article, la plus avantageuse s'applique (à
 *     avantage égal, la plus prioritaire) ;
 *  2. les promotions CUMULABLES s'appliquent ensuite, l'une après l'autre, sur ce qui reste ;
 *  3. le prix ne descend jamais sous zéro et reste un nombre entier de francs.
 */

/** Ce dont le calcul a besoin : une promotion publique suffit, une promotion complète aussi. */
export type PricedPromotion = Pick<PublicPromotion, 'id' | 'priority' | 'stackable' | 'discount' | 'scope'>;

export interface AppliedPromotion {
  id: string;
  discountXaf: number;
}

export interface PromoPrice {
  originalXaf: number;
  finalXaf: number;
  discountXaf: number;
  applied: AppliedPromotion[];
  /** Vrai quand le prix tombe à zéro grâce à une promotion. */
  free: boolean;
  /** Vrai si toutes les remises appliquées sont des pourcentages (ou la gratuité). */
  proportional: boolean;
}

export function scopeMatches(scope: PromotionScope, item: string): boolean {
  if (!item) return false;
  if (scope.excludeItems?.includes(item)) return false;
  if (scope.all) return serviceOfItem(item) !== null;
  if (scope.items?.includes(item)) return true;
  const service = serviceOfItem(item);
  return Boolean(service && scope.services?.includes(service));
}

/** Ce que retire une remise d'un prix donné. */
export function discountOf(discount: PromotionDiscount, priceXaf: number): number {
  const price = Math.max(0, Math.round(priceXaf));
  if (price === 0) return 0;
  switch (discount.type) {
    case 'free':
      return price;
    case 'percent': {
      const rate = Math.min(100, Math.max(0, Number(discount.value) || 0));
      return Math.min(price, Math.round((price * rate) / 100));
    }
    case 'fixed':
      return Math.min(price, Math.max(0, Math.round(Number(discount.value) || 0)));
    default:
      return 0;
  }
}

export function priceWithPromotions(promotions: readonly PricedPromotion[], item: string | null, priceXaf: number): PromoPrice {
  const originalXaf = Math.max(0, Math.round(priceXaf));
  const none: PromoPrice = { originalXaf, finalXaf: originalXaf, discountXaf: 0, applied: [], free: false, proportional: true };
  if (!item || originalXaf === 0 || promotions.length === 0) return none;

  const matching = promotions.filter((promotion) => scopeMatches(promotion.scope, item));
  if (matching.length === 0) return none;

  const exclusive = matching
    .filter((promotion) => !promotion.stackable)
    .map((promotion) => ({ promotion, discountXaf: discountOf(promotion.discount, originalXaf) }))
    .filter((entry) => entry.discountXaf > 0)
    .sort((a, b) => b.discountXaf - a.discountXaf || b.promotion.priority - a.promotion.priority);

  const applied: AppliedPromotion[] = [];
  const kinds: PromotionDiscount['type'][] = [];
  let remaining = originalXaf;

  if (exclusive[0]) {
    applied.push({ id: exclusive[0].promotion.id, discountXaf: exclusive[0].discountXaf });
    kinds.push(exclusive[0].promotion.discount.type);
    remaining -= exclusive[0].discountXaf;
  }

  const stackable = matching.filter((promotion) => promotion.stackable).sort((a, b) => b.priority - a.priority);
  for (const promotion of stackable) {
    if (remaining <= 0) break;
    const discountXaf = discountOf(promotion.discount, remaining);
    if (discountXaf <= 0) continue;
    applied.push({ id: promotion.id, discountXaf });
    kinds.push(promotion.discount.type);
    remaining -= discountXaf;
  }

  const finalXaf = Math.max(0, remaining);
  return {
    originalXaf,
    finalXaf,
    discountXaf: originalXaf - finalXaf,
    applied,
    free: applied.length > 0 && finalXaf === 0,
    proportional: kinds.every((kind) => kind !== 'fixed'),
  };
}

/**
 * Un montant en devise locale, remisé dans la même proportion que le prix en F CFA. Une remise fixe
 * (en francs) ne se convertit pas : elle se lit en proportion du prix de référence.
 */
export function localAmountAfter(price: PromoPrice, localAmount: number, decimals = 0): number {
  if (price.free) return 0;
  if (price.originalXaf <= 0 || price.discountXaf <= 0) return localAmount;
  const factor = 10 ** decimals;
  return Math.round(localAmount * (price.finalXaf / price.originalXaf) * factor) / factor;
}

// ── Phase d'une promotion ────────────────────────────────────────────────────

export function isWithinDates(promotion: Pick<Promotion, 'startsAt' | 'endsAt'>, at: Date = new Date()): boolean {
  const start = Date.parse(promotion.startsAt);
  if (Number.isFinite(start) && at.getTime() < start) return false;
  if (promotion.endsAt) {
    const end = Date.parse(promotion.endsAt);
    if (Number.isFinite(end) && at.getTime() >= end) return false;
  }
  return true;
}

/** La phase lue par le panel : l'état posé par l'équipe, croisé avec les dates et les limites. */
export function phaseOf(promotion: Pick<Promotion, 'state' | 'startsAt' | 'endsAt' | 'limits' | 'stats'>, at: Date = new Date()): PromotionPhase {
  if (promotion.state === 'draft') return 'draft';
  if (promotion.state === 'ended') return 'ended';
  if (promotion.state === 'paused') return 'paused';
  if (promotion.endsAt && at.getTime() >= Date.parse(promotion.endsAt)) return 'expired';
  if (at.getTime() < Date.parse(promotion.startsAt)) return 'scheduled';
  const { limits, stats } = promotion;
  if (limits?.total != null && (stats?.redemptions ?? 0) >= limits.total) return 'exhausted';
  if (limits?.budgetXaf != null && (stats?.discountXaf ?? 0) >= limits.budgetXaf) return 'exhausted';
  return 'running';
}

export const PHASE_LABELS: Record<PromotionPhase, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmée',
  running: 'En cours',
  paused: 'En pause',
  ended: 'Terminée',
  expired: 'Expirée',
  exhausted: 'Épuisée',
};

/** Libellé court d'une remise (« Gratuit », « -30 % », « -500 F »). */
export function discountLabel(discount: PromotionDiscount): string {
  if (discount.type === 'free') return 'Gratuit';
  if (discount.type === 'percent') return `-${discount.value} %`;
  return `-${Math.round(discount.value).toLocaleString('fr-FR').replace(/\s/g, ' ')} F`;
}
