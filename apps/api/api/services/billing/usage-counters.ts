import logger from '../../config/logger';
import { QUOTA_WINDOWS, QuotaGroup, QuotaWindow, WindowLimits, periodEnd, periodKey } from '../../models/usage-quota.model';
import { UsageQuotaCounter } from '../../schemas/usageQuota.schema';

/**
 * Compteurs bruts des quotas d'usage : réserver une place, la rendre, cumuler un
 * coût. Volontairement sans aucune dépendance vers la facturation : le journal
 * de consommation IA (`ai-usage.service`) l'appelle à chaque appel de modèle,
 * et il est chargé bien avant le moteur de paiement.
 *
 * La logique (paliers, limites, refus, offres) vit dans `usage-quota.service`.
 */

/** Une semaine de grâce après la fin de période avant la purge par l'index TTL. */
const RETENTION_MS = 7 * 86_400_000;

const groupScope = (group: QuotaGroup) => `group:${group}`;
const SPEND_SCOPE = 'spend';

function windowKey(window: QuotaWindow, at: Date): string {
  return `${window}:${periodKey(window, at)}`;
}

function expiry(window: QuotaWindow, at: Date): Date {
  return new Date(periodEnd(window, at).getTime() + RETENTION_MS);
}

function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number })?.code === 11000;
}

/** Ce qui a été réservé pour une génération : de quoi le rendre si elle échoue. */
export interface QuotaReservation {
  userId: string;
  group: QuotaGroup;
  /** Clés de période effectivement incrémentées. */
  keys: string[];
}

export type ReserveOutcome =
  | { ok: true; reservation: QuotaReservation }
  | { ok: false; window: QuotaWindow; used: number; limit: number };

/**
 * Incrémente le compteur d'une période si, et seulement si, la limite n'est pas atteinte.
 *
 * `findOneAndUpdate` avec `count < limite` dans le filtre : atomique sur un document unique, donc juste
 * sous concurrence. Le document absent est créé par l'upsert ; présent et plein, l'upsert tente une
 * insertion qui heurte l'index unique — c'est le refus. Deux créations simultanées produisent aussi une
 * collision : on rejoue alors une fois, le document existant tranche.
 */
async function incrementBelow(userId: string, scope: string, key: string, limit: number, expiresAt: Date): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const updated = await UsageQuotaCounter.findOneAndUpdate(
        { userId, scope, periodKey: key, count: { $lt: limit } },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt, costUsd: 0 } },
        { upsert: true, new: true }
      ).lean();
      return Boolean(updated);
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      // Plein (le filtre n'a pas pris) ou course à la création : on relit.
      const existing = await UsageQuotaCounter.findOne({ userId, scope, periodKey: key }).select('count').lean();
      if (existing && existing.count >= limit) return false;
    }
  }
  return false;
}

async function incrementAlways(userId: string, scope: string, key: string, expiresAt: Date): Promise<number> {
  const updated = await UsageQuotaCounter.findOneAndUpdate(
    { userId, scope, periodKey: key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt, costUsd: 0 } },
    { upsert: true, new: true }
  ).lean();
  return updated?.count ?? 1;
}

export class UsageCounters {
  /**
   * Réserve une place dans chaque fenêtre limitée d'un groupe.
   *
   * Tout ou rien : si la semaine est pleine, la place déjà prise sur le jour est rendue. En mode
   * observation (`enforce: false`), on compte sans jamais refuser — c'est ce qui permet de lire la
   * consommation réelle avant de bloquer qui que ce soit.
   */
  async reserve(
    userId: string,
    group: QuotaGroup,
    limits: WindowLimits,
    enforce: boolean,
    at = new Date()
  ): Promise<ReserveOutcome & { observed?: { window: QuotaWindow; used: number; limit: number } }> {
    const scope = groupScope(group);
    const taken: string[] = [];
    let observed: { window: QuotaWindow; used: number; limit: number } | undefined;

    for (const window of QUOTA_WINDOWS) {
      const key = windowKey(window, at);
      const limit = limits[window];

      if (limit === null || !enforce) {
        const used = await incrementAlways(userId, scope, key, expiry(window, at));
        taken.push(key);
        if (limit !== null && used > limit && !observed) observed = { window, used: used - 1, limit };
        continue;
      }

      const ok = await incrementBelow(userId, scope, key, limit, expiry(window, at));
      if (!ok) {
        await this.release({ userId, group, keys: taken });
        const current = await UsageQuotaCounter.findOne({ userId, scope, periodKey: key }).select('count').lean();
        return { ok: false, window, used: current?.count ?? limit, limit };
      }
      taken.push(key);
    }

    return { ok: true, reservation: { userId, group, keys: taken }, observed };
  }

  /** Rend les places d'une réservation (génération en échec). Ne descend jamais sous zéro. */
  async release(reservation: QuotaReservation): Promise<void> {
    if (!reservation.keys.length) return;
    await UsageQuotaCounter.updateMany(
      { userId: reservation.userId, scope: groupScope(reservation.group), periodKey: { $in: reservation.keys }, count: { $gt: 0 } },
      { $inc: { count: -1 } }
    );
  }

  /**
   * Rend une place de la période en cours, sans réservation en main.
   *
   * Pour un service de l'écosystème (iVision, médias iCode) qui signale l'échec après coup : il
   * connaît l'action remboursée, pas les clés réservées. La génération et son remboursement tombent
   * presque toujours dans la même période.
   */
  async releaseCurrent(userId: string, group: QuotaGroup, at = new Date()): Promise<void> {
    await this.release({ userId, group, keys: QUOTA_WINDOWS.map((window) => windowKey(window, at)) });
  }

  /** Cumule le coût IA d'un appel sur les trois fenêtres. N'échoue jamais : c'est de l'observabilité. */
  async recordSpend(userId: string, usd: number, at = new Date()): Promise<void> {
    if (!userId || !(usd > 0)) return;
    try {
      await Promise.all(
        QUOTA_WINDOWS.map((window) =>
          UsageQuotaCounter.updateOne(
            { userId, scope: SPEND_SCOPE, periodKey: windowKey(window, at) },
            { $inc: { costUsd: usd }, $setOnInsert: { expiresAt: expiry(window, at), count: 0 } },
            { upsert: true }
          )
        )
      );
    } catch (error: any) {
      if (isDuplicateKey(error)) {
        // Course à la création du document : le second appel l'a créé, on rejoue l'incrément.
        await this.recordSpend(userId, usd, at).catch(() => undefined);
        return;
      }
      logger.warn(`usage_quota.spend_record_failed: ${error.message}`, { event: 'usage_quota.spend_record_failed', userId });
    }
  }

  /** Coût IA engagé par fenêtre, en dollars. */
  async spend(userId: string, at = new Date()): Promise<Record<QuotaWindow, number>> {
    const keys = QUOTA_WINDOWS.map((window) => windowKey(window, at));
    const docs = await UsageQuotaCounter.find({ userId, scope: SPEND_SCOPE, periodKey: { $in: keys } }).select('periodKey costUsd').lean();
    const byKey = new Map(docs.map((doc) => [doc.periodKey, doc.costUsd ?? 0]));
    return Object.fromEntries(QUOTA_WINDOWS.map((window) => [window, byKey.get(windowKey(window, at)) ?? 0])) as Record<QuotaWindow, number>;
  }

  /** Générations comptées par groupe et fenêtre, sur la période en cours. */
  async counts(userId: string, at = new Date()): Promise<Map<string, number>> {
    const keys = QUOTA_WINDOWS.map((window) => windowKey(window, at));
    const docs = await UsageQuotaCounter.find({ userId, scope: { $ne: SPEND_SCOPE }, periodKey: { $in: keys } }).select('scope periodKey count').lean();
    return new Map(docs.map((doc) => [`${doc.scope}|${doc.periodKey}`, doc.count ?? 0]));
  }

  countKey(group: QuotaGroup, window: QuotaWindow, at = new Date()): string {
    return `${groupScope(group)}|${windowKey(window, at)}`;
  }

  /**
   * Remise à zéro par l'administration (geste commercial, incident). Le cumul de dépense IA
   * est conservé : c'est un garde-fou de coût, pas une limite commerciale.
   */
  async reset(userId: string, group?: QuotaGroup): Promise<number> {
    const filter: Record<string, unknown> = { userId, scope: group ? groupScope(group) : { $ne: SPEND_SCOPE } };
    const result = await UsageQuotaCounter.deleteMany(filter);
    return result.deletedCount ?? 0;
  }
}

export const usageCounters = new UsageCounters();
