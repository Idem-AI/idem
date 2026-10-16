import logger from '../../config/logger';
import { usageQuotaRefusalsTotal } from '../../config/metrics';
import { BillingEnforcementMode } from '../../models/billing-settings.model';
import {
  DEFAULT_QUOTA_LIMITS,
  DEFAULT_SPEND_CAPS_USD,
  PLAN_TIER,
  QUOTA_GROUPS,
  QUOTA_GROUP_ENGINE,
  QUOTA_GROUP_LABELS,
  QUOTA_WINDOWS,
  QuotaGroup,
  QuotaRefusal,
  QuotaTier,
  QuotaWindow,
  TIER_RANK,
  UsageQuotaStatus,
  WindowLimits,
  periodEnd,
} from '../../models/usage-quota.model';
import { isSuperUser } from '../../utils/super-user.util';
import { billingService } from '../billing.service';
import { billingSettingsService } from './billing-settings.service';
import { Entitlements, entitlementsService } from './entitlements.service';
import { QuotaReservation, usageCounters } from './usage-counters';

/**
 * Quotas d'usage IA : palier du compte, limites effectives, réservation, refus.
 *
 * Le mode d'application est celui des crédits (`billing_settings.enforcement`) :
 *  - `off`     : rien n'est compté ;
 *  - `log`     : tout est compté, rien n'est refusé, chaque refus qui aurait eu lieu est journalisé et
 *                mesuré (`usage_quota_refusals_total{enforced="false"}`) ;
 *  - `enforce` : la génération au-delà de la limite est refusée en 429, avec ce qui la débloquerait.
 *
 * Une panne de la base des compteurs ne bloque pas la plateforme : les crédits restent le contrôle
 * financier, le quota n'est qu'un garde-fou supplémentaire. On laisse passer en le signalant.
 */

export type QuotaDecision =
  | { allowed: true; reservation?: QuotaReservation }
  | { allowed: false; refusal: QuotaRefusal };

const WINDOW_TEXT: Record<QuotaWindow, { scope: string; reset: string }> = {
  day: { scope: 'aujourd’hui', reset: 'à minuit (UTC)' },
  week: { scope: 'cette semaine', reset: 'lundi' },
  month: { scope: 'ce mois-ci', reset: 'le 1er du mois' },
};

function merge(base: WindowLimits, patch?: Partial<WindowLimits>): WindowLimits {
  if (!patch) return base;
  return {
    day: patch.day !== undefined ? patch.day : base.day,
    week: patch.week !== undefined ? patch.week : base.week,
    month: patch.month !== undefined ? patch.month : base.month,
  };
}

export class UsageQuotaService {
  // ============================================
  // PALIERS ET LIMITES
  // ============================================

  /** Palier d'un compte pour un groupe : l'offre du moteur du groupe, ou la meilleure tous moteurs. */
  tierFor(entitlements: Entitlements, group: QuotaGroup): QuotaTier {
    const engine = QUOTA_GROUP_ENGINE[group];
    const engines = engine ? [engine] : (['business', 'appgen', 'ideploy'] as const);

    let best: QuotaTier = 'free';
    for (const name of engines) {
      const entitlement = entitlements.engines[name];
      if (!entitlement) continue;
      const tier: QuotaTier = entitlement.complimentary ? 'beta' : PLAN_TIER[entitlement.productCode] ?? 'free';
      if (TIER_RANK[tier] > TIER_RANK[best]) best = tier;
    }

    // Le modèle au portefeuille : un forfait, ou un achat récent, ouvre le palier supérieur.
    const offer = entitlements.offer;
    if (offer) {
      const fromOffer: QuotaTier = offer.passes.entreprise ? 'growth' : offer.croissance || offer.createur || offer.recentBuyer ? 'starter' : 'free';
      if (TIER_RANK[fromOffer] > TIER_RANK[best]) best = fromOffer;
    }
    return best;
  }

  async limitsFor(tier: QuotaTier, group: QuotaGroup): Promise<WindowLimits> {
    const overrides = (await billingSettingsService.get()).usageQuotas;
    return merge(DEFAULT_QUOTA_LIMITS[tier][group], overrides?.limits?.[tier]?.[group]);
  }

  async spendCapsFor(tier: QuotaTier): Promise<WindowLimits> {
    const overrides = (await billingSettingsService.get()).usageQuotas;
    return merge(DEFAULT_SPEND_CAPS_USD[tier], overrides?.spendCapsUsd?.[tier]);
  }

  // ============================================
  // RÉSERVATION
  // ============================================

  /**
   * Réserve une génération dans le groupe donné.
   *
   * À appeler AVANT de générer (et avant le débit des crédits) : c'est le seul moment où l'on peut
   * encore refuser proprement. La réservation se rend avec `release` si la génération échoue.
   */
  async reserve(
    userId: string,
    group: QuotaGroup,
    options: { entitlements?: Entitlements; email?: string; mode?: BillingEnforcementMode } = {}
  ): Promise<QuotaDecision> {
    try {
      const mode = options.mode ?? (await billingSettingsService.getEnforcement());
      if (mode === 'off') return { allowed: true };
      if (options.email && isSuperUser(options.email)) return { allowed: true };

      const entitlements = options.entitlements ?? (await entitlementsService.resolve(userId));
      const tier = this.tierFor(entitlements, group);
      const enforce = mode === 'enforce';

      // 1. Le disjoncteur de coût : avant de compter, parce qu'un compte arrêté pour dépense ne doit
      //    pas en plus consommer une place.
      const [caps, spent] = await Promise.all([this.spendCapsFor(tier), usageCounters.spend(userId)]);
      for (const window of QUOTA_WINDOWS) {
        const cap = caps[window];
        if (cap === null || spent[window] < cap) continue;

        const refusal = await this.refusal(group, tier, 'spend', window, cap, spent[window]);
        this.trace(refusal, enforce, userId);
        if (enforce) return { allowed: false, refusal };
        break;
      }

      // 2. Le nombre de générations du groupe.
      const limits = await this.limitsFor(tier, group);
      const outcome = await usageCounters.reserve(userId, group, limits, enforce);

      if (!outcome.ok) {
        const refusal = await this.refusal(group, tier, 'count', outcome.window, outcome.limit, outcome.used);
        this.trace(refusal, true, userId);
        return { allowed: false, refusal };
      }

      if (outcome.observed) {
        const refusal = await this.refusal(group, tier, 'count', outcome.observed.window, outcome.observed.limit, outcome.observed.used);
        this.trace(refusal, false, userId);
      }

      return { allowed: true, reservation: outcome.reservation };
    } catch (error: any) {
      logger.error(`usage_quota.reserve_failed: ${error.message}`, {
        event: 'usage_quota.reserve_failed',
        userId,
        group,
        stack: error.stack,
      });
      return { allowed: true };
    }
  }

  async release(reservation?: QuotaReservation): Promise<void> {
    if (!reservation) return;
    try {
      await usageCounters.release(reservation);
    } catch (error: any) {
      logger.warn(`usage_quota.release_failed: ${error.message}`, { event: 'usage_quota.release_failed', userId: reservation.userId });
    }
  }

  /** Rend une place sans réservation en main (échec signalé par un service de l'écosystème). */
  async releaseCurrent(userId: string, group: QuotaGroup): Promise<void> {
    try {
      await usageCounters.releaseCurrent(userId, group);
    } catch (error: any) {
      logger.warn(`usage_quota.release_failed: ${error.message}`, { event: 'usage_quota.release_failed', userId });
    }
  }

  // ============================================
  // ÉTAT (TABLEAU DE BORD, PANNEAU ADMIN)
  // ============================================

  async status(userId: string): Promise<UsageQuotaStatus> {
    const [entitlements, counts, spent, mode] = await Promise.all([
      entitlementsService.resolve(userId),
      usageCounters.counts(userId),
      usageCounters.spend(userId),
      billingSettingsService.getEnforcement(),
    ]);

    const now = new Date();
    const groups = await Promise.all(
      QUOTA_GROUPS.map(async (group) => {
        const tier = this.tierFor(entitlements, group);
        const limits = await this.limitsFor(tier, group);
        return {
          group,
          label: QUOTA_GROUP_LABELS[group],
          tier,
          windows: QUOTA_WINDOWS.map((window) => {
            const used = counts.get(usageCounters.countKey(group, window, now)) ?? 0;
            const limit = limits[window];
            return {
              window,
              used,
              limit,
              remaining: limit === null ? null : Math.max(0, limit - used),
              resetsAt: periodEnd(window, now).toISOString(),
            };
          }),
        };
      })
    );

    const overallTier = this.tierFor(entitlements, 'assist');
    const caps = await this.spendCapsFor(overallTier);
    const capacity = Object.fromEntries(
      QUOTA_WINDOWS.map((window) => {
        const cap = caps[window];
        return [window, cap ? Math.min(100, Math.round((spent[window] / cap) * 100)) : 0];
      })
    ) as Record<QuotaWindow, number>;

    return { groups, capacity, tier: overallTier, enforcement: mode };
  }

  async reset(userId: string, group?: QuotaGroup): Promise<number> {
    return usageCounters.reset(userId, group);
  }

  // ============================================
  // REFUS
  // ============================================

  private async refusal(
    group: QuotaGroup,
    tier: QuotaTier,
    reason: 'count' | 'spend',
    window: QuotaWindow,
    limit: number | null,
    used: number
  ): Promise<QuotaRefusal> {
    const text = WINDOW_TEXT[window];
    const label = QUOTA_GROUP_LABELS[group].toLowerCase();
    const message =
      reason === 'count'
        ? `Vous avez atteint la limite de ${limit} ${label} ${text.scope}. Elle se renouvelle ${text.reset}.`
        : `La capacité de génération IA de votre offre est atteinte ${text.scope}. Elle se renouvelle ${text.reset}.`;

    return {
      error: 'quota_exceeded',
      message,
      group,
      reason,
      window,
      // Le plafond de coût est un indicateur interne : on ne publie pas de montant en dollars.
      limit: reason === 'count' ? limit : null,
      used: reason === 'count' ? used : 0,
      resetsAt: periodEnd(window).toISOString(),
      tier,
      suggestions: await this.upgradeSuggestions(group, tier),
    };
  }

  /** L'offre du palier au-dessus, dont les limites sont plus larges. */
  private async upgradeSuggestions(group: QuotaGroup, tier: QuotaTier): Promise<QuotaRefusal['suggestions']> {
    try {
      const engine = QUOTA_GROUP_ENGINE[group] ?? 'business';
      const plans = await billingService.listProducts({ engine, kind: 'subscription' });
      const next = plans
        .filter((product) => product.priceXaf > 0 && TIER_RANK[PLAN_TIER[product.code] ?? 'free'] > TIER_RANK[tier])
        .sort((a, b) => a.priceXaf - b.priceXaf)[0];
      return next ? [{ productCode: next.code, name: next.name, priceXaf: next.priceXaf, credits: next.credits }] : [];
    } catch {
      return [];
    }
  }

  private trace(refusal: QuotaRefusal, enforced: boolean, userId: string): void {
    usageQuotaRefusalsTotal.inc({ group: refusal.group, reason: refusal.reason, window: refusal.window, tier: refusal.tier, enforced: String(enforced) });
    logger.info(enforced ? 'usage_quota.refused' : 'usage_quota.shadow_refusal', {
      event: enforced ? 'usage_quota.refused' : 'usage_quota.shadow_refusal',
      userId,
      group: refusal.group,
      reason: refusal.reason,
      window: refusal.window,
      tier: refusal.tier,
      limit: refusal.limit,
      used: refusal.used,
    });
  }
}

export const usageQuotaService = new UsageQuotaService();
export default usageQuotaService;
