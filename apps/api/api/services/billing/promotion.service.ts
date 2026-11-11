import logger from '../../config/logger';
import { User } from '../../schemas/user.schema';
import {
  Promotion,
  PromotionClaim,
  PromotionDocument,
  PromotionRedemption,
  PromotionUsage,
} from '../../schemas/promotion.schema';
import {
  PROMO_ITEMS,
  PROMO_SERVICE_KEYS,
  itemOfSpend,
  phaseOf,
  priceWithPromotions,
  type PromoPrice,
} from '../../../../../packages/shared-promotions/src';
import type {
  Promotion as PromotionDto,
  PromotionAudience,
  PromotionDiscount,
  PromotionDisplay,
  PromotionLimits,
  PromotionQuotas,
  PromotionScope,
  PublicPromotion,
  WindowLimitsPatch,
} from '../../../../../packages/shared-promotions/src/model';
import { QUOTA_GROUPS, type QuotaGroup, type WindowLimits } from '../../models/usage-quota.model';
import { creditLedgerService } from './credit-ledger.service';
import { campaignQuotaPreset } from './promotion-quotas';

/**
 * Les promotions : campagnes (bêta gratuite, soldes), coupons (codes à saisir), bonus de recharge et
 * crédits du jour. Réglées dans le panel admin (`/billing/internal/promotions`), appliquées ici.
 *
 * **Où elles s'appliquent.** Au seul endroit où l'on débite : `walletService.spend` demande ici le
 * prix remisé, réserve la remise (limites par compte, totale, budget), débite, puis l'inscrit au
 * journal. Le Kit, les forfaits, les packs, iCode, iDeploy, iVision, iSimulate passent tous par là :
 * une promotion « tout » rend vraiment tout gratuit, sans toucher aux prix d'`offer.model.ts`.
 * Les écrans font le même calcul (`@idem/shared-promotions`) pour barrer les prix.
 *
 * **Les limites tiennent à plusieurs.** Le dépassement d'une limite totale ou d'un budget est empêché
 * par un `$inc` conditionnel sur la promotion ; la limite par compte, par un compteur à part. Une
 * remise réservée puis non utilisée (solde insuffisant pour le reste) est rendue.
 *
 * **Fin d'une campagne.** `end()` la clôt immédiatement : le cache de 15 s est vidé sur cette
 * instance, les autres le voient au plus tard 15 s après ; les écrans au plus tard une minute après.
 */

const CACHE_MS = 15_000;
const USER_CACHE_MS = 5 * 60_000;
const CLAIM_CACHE_MS = 60_000;

/** La campagne de la bêta, créée au premier démarrage (puis réglée et close depuis le panel). */
export const BETA_CAMPAIGN_SLUG = 'beta-gratuite-2026';

/** Ce qu'une campagne « tout gratuit » ne couvre pas : ce qui coûte de l'argent réel à IDEM ou se revend. */
export const ALWAYS_PAID_DURING_FREE_BETA = ['idomain.domain', 'pack.lancement_domaine', 'pack.a_plusieurs'];

export interface SpendQuoteInput {
  action: string;
  feature?: string;
  priceXaf: number;
  projectId?: string;
}

export interface PromotionReservation {
  userId: string;
  item: string;
  action: string;
  projectId?: string;
  price: PromoPrice;
}

type Lean = PromotionDocument & { _id: unknown };

function toId(value: unknown): string {
  return String(value);
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export class PromotionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export class PromotionService {
  private cache: { at: number; list: Lean[] } | null = null;
  private users = new Map<string, { at: number; email: string; createdAt: Date | null }>();
  private claims = new Map<string, { at: number; ids: Set<string> }>();

  // ============================================
  // LECTURE (chemin chaud)
  // ============================================

  /** Promotions lancées (ni brouillon ni terminées), en cache court. */
  private async live(): Promise<Lean[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.list;
    try {
      const list = (await Promotion.find({ state: { $in: ['active', 'paused'] } }).lean()) as unknown as Lean[];
      this.cache = { at: Date.now(), list };
      return list;
    } catch (error: any) {
      logger.error(`promotions.load_failed: ${error.message}`, { event: 'promotions.load_failed' });
      return this.cache?.list ?? [];
    }
  }

  invalidate(): void {
    this.cache = null;
  }

  /** En cours à l'instant (dates, état, limites globales). */
  private async running(at = new Date()): Promise<Lean[]> {
    return (await this.live()).filter((promotion) => phaseOf(this.dates(promotion), at) === 'running');
  }

  private dates(promotion: Lean) {
    return {
      state: promotion.state,
      startsAt: iso(promotion.startsAt) ?? new Date(0).toISOString(),
      endsAt: iso(promotion.endsAt),
      limits: promotion.limits ?? {},
      stats: promotion.stats ?? { redemptions: 0, discountXaf: 0, claims: 0, topupBonusXaf: 0, walletCreditXaf: 0 },
    };
  }

  private async userFacts(userId: string): Promise<{ email: string; createdAt: Date | null }> {
    const cached = this.users.get(userId);
    if (cached && Date.now() - cached.at < USER_CACHE_MS) return cached;
    const user = (await User.findOne({ uid: userId }).select('email createdAt').lean().catch(() => null)) as { email?: string; createdAt?: Date } | null;
    const facts = { at: Date.now(), email: (user?.email ?? '').toLowerCase(), createdAt: user?.createdAt ? new Date(user.createdAt) : null };
    if (this.users.size > 5000) this.users.clear();
    this.users.set(userId, facts);
    return facts;
  }

  private async claimedIds(userId: string): Promise<Set<string>> {
    const cached = this.claims.get(userId);
    if (cached && Date.now() - cached.at < CLAIM_CACHE_MS) return cached.ids;
    const rows = await PromotionClaim.find({ userId }).select('promotionId').lean().catch(() => []);
    const ids = new Set(rows.map((row) => row.promotionId));
    if (this.claims.size > 5000) this.claims.clear();
    this.claims.set(userId, { at: Date.now(), ids });
    return ids;
  }

  private audienceAllows(audience: PromotionDocument['audience'] | undefined, userId: string, facts: { email: string; createdAt: Date | null }): boolean {
    if (!audience) return true;
    if (audience.newUsersSince) {
      if (!facts.createdAt || facts.createdAt < new Date(audience.newUsersSince)) return false;
    }
    if (audience.everyone !== false) return true;
    if (audience.userIds?.includes(userId)) return true;
    return Boolean(facts.email && audience.emails?.map((email) => email.toLowerCase()).includes(facts.email));
  }

  /** Les promotions qui s'appliquent à ce compte maintenant (campagnes visées + coupons saisis). */
  async applicableFor(userId: string | null | undefined): Promise<Lean[]> {
    const running = await this.running();
    if (running.length === 0) return [];
    if (!userId) return running.filter((promotion) => promotion.kind === 'campaign' && promotion.audience?.everyone !== false && !promotion.audience?.newUsersSince);

    const [facts, claimed] = await Promise.all([this.userFacts(userId), this.claimedIds(userId)]);
    return running.filter((promotion) => {
      if (promotion.kind === 'coupon' && !claimed.has(toId(promotion._id))) return false;
      return this.audienceAllows(promotion.audience, userId, facts);
    });
  }

  private priced(list: Lean[]) {
    return list.map((promotion) => ({
      id: toId(promotion._id),
      priority: promotion.priority ?? 0,
      stackable: Boolean(promotion.stackable),
      discount: promotion.discount,
      scope: promotion.scope,
    }));
  }

  toPublic(promotion: Lean, claimed = false): PublicPromotion {
    return {
      id: toId(promotion._id),
      slug: promotion.slug,
      name: promotion.name,
      kind: promotion.kind,
      startsAt: iso(promotion.startsAt)!,
      endsAt: iso(promotion.endsAt),
      priority: promotion.priority ?? 0,
      stackable: Boolean(promotion.stackable),
      discount: promotion.discount,
      scope: promotion.scope,
      display: promotion.display,
      topupBonusPercent: promotion.topupBonusPercent || undefined,
      claimed: promotion.kind === 'coupon' ? claimed : undefined,
    };
  }

  /** Ce que les écrans affichent : les promotions qui s'appliqueraient à ce visiteur. */
  async publicSnapshot(userId?: string | null): Promise<{ promotions: PublicPromotion[]; now: string }> {
    const list = await this.applicableFor(userId);
    return { promotions: list.map((promotion) => this.toPublic(promotion, promotion.kind === 'coupon')), now: new Date().toISOString() };
  }

  /** Prix remisé d'un article pour ce compte, sans rien réserver (devis, affichage serveur). */
  async quote(userId: string | null | undefined, item: string | null, priceXaf: number): Promise<PromoPrice> {
    return priceWithPromotions(this.priced(await this.applicableFor(userId)), item, priceXaf);
  }

  /**
   * Vrai si ce débit serait gratuit grâce à une promotion. Sert à NE PAS consommer un droit prépayé
   * (modifications incluses, Pass Projet prépayé) pendant une campagne qui rend l'achat gratuit.
   */
  async wouldBeFree(userId: string, action: string, feature: string | undefined, priceXaf: number): Promise<boolean> {
    const item = itemOfSpend(action, feature);
    if (!item || priceXaf <= 0) return false;
    return (await this.quote(userId, item, priceXaf)).free;
  }

  // ============================================
  // DÉBIT : RÉSERVER, INSCRIRE, RENDRE
  // ============================================

  /**
   * Le prix remisé d'un débit, avec la remise RÉSERVÉE (limites comptées). À suivre de `commit` si le
   * débit passe, de `release` sinon. `null` : aucune promotion ne s'applique.
   */
  async reserveForSpend(userId: string, input: SpendQuoteInput): Promise<PromotionReservation | null> {
    const item = itemOfSpend(input.action, input.feature);
    if (!item || input.priceXaf <= 0) return null;

    let candidates: Lean[];
    try {
      candidates = await this.applicableFor(userId);
    } catch (error: any) {
      logger.error(`promotions.applicable_failed: ${error.message}`, { event: 'promotions.applicable_failed', userId });
      return null;
    }

    // Une promotion dont une limite est atteinte au moment de réserver est écartée, puis on recalcule.
    for (let attempt = 0; attempt < 4 && candidates.length > 0; attempt += 1) {
      const price = priceWithPromotions(this.priced(candidates), item, input.priceXaf);
      if (price.applied.length === 0) return null;

      const taken: { id: string; discountXaf: number }[] = [];
      let refused: string | null = null;
      for (const applied of price.applied) {
        const promotion = candidates.find((entry) => toId(entry._id) === applied.id)!;
        if (await this.take(promotion, userId, applied.discountXaf)) taken.push(applied);
        else {
          refused = applied.id;
          break;
        }
      }
      if (!refused) return { userId, item, action: input.action, projectId: input.projectId, price };

      for (const applied of taken) await this.give(applied.id, userId, applied.discountXaf);
      candidates = candidates.filter((entry) => toId(entry._id) !== refused);
      this.invalidate();
    }
    return null;
  }

  /** Compte une remise (par compte, puis totale/budget). Faux si une limite est atteinte. */
  private async take(promotion: Lean, userId: string, discountXaf: number): Promise<boolean> {
    const id = toId(promotion._id);
    const perUser = promotion.limits?.perUser;
    try {
      if (perUser != null) {
        await PromotionUsage.updateOne({ promotionId: id, userId }, { $setOnInsert: { count: 0, discountXaf: 0 } }, { upsert: true });
        const usage = await PromotionUsage.updateOne({ promotionId: id, userId, count: { $lt: perUser } }, { $inc: { count: 1, discountXaf } });
        if (usage.modifiedCount === 0) return false;
      } else {
        await PromotionUsage.updateOne({ promotionId: id, userId }, { $inc: { count: 1, discountXaf } }, { upsert: true });
      }

      const guards: Record<string, unknown>[] = [];
      if (promotion.limits?.total != null) guards.push({ 'stats.redemptions': { $lt: promotion.limits.total } });
      if (promotion.limits?.budgetXaf != null) guards.push({ $expr: { $lte: [{ $add: ['$stats.discountXaf', discountXaf] }, promotion.limits.budgetXaf] } });
      const global = await Promotion.updateOne({ _id: promotion._id, state: 'active', ...(guards.length ? { $and: guards } : {}) }, { $inc: { 'stats.redemptions': 1, 'stats.discountXaf': discountXaf } });
      if (global.modifiedCount === 0) {
        await PromotionUsage.updateOne({ promotionId: id, userId }, { $inc: { count: -1, discountXaf: -discountXaf } });
        return false;
      }
      return true;
    } catch (error: any) {
      logger.error(`promotions.take_failed: ${error.message}`, { event: 'promotions.take_failed', promotionId: id, userId });
      return false;
    }
  }

  private async give(promotionId: string, userId: string, discountXaf: number): Promise<void> {
    await Promise.all([
      PromotionUsage.updateOne({ promotionId, userId }, { $inc: { count: -1, discountXaf: -discountXaf } }),
      Promotion.updateOne({ _id: promotionId }, { $inc: { 'stats.redemptions': -1, 'stats.discountXaf': -discountXaf } }),
    ]).catch((error) => logger.error('promotions.give_failed', { event: 'promotions.give_failed', promotionId, userId, error }));
  }

  /** Le débit est passé : la remise est inscrite au journal. */
  async commit(reservation: PromotionReservation, paidXaf: number, ledgerEntryId?: string): Promise<void> {
    try {
      await PromotionRedemption.insertMany(
        reservation.price.applied.map((applied) => ({
          promotionId: applied.id,
          userId: reservation.userId,
          kind: 'discount',
          item: reservation.item,
          action: reservation.action,
          projectId: reservation.projectId,
          originalXaf: reservation.price.originalXaf,
          discountXaf: applied.discountXaf,
          paidXaf,
          ledgerEntryId,
        }))
      );
    } catch (error: any) {
      logger.error(`promotions.commit_failed: ${error.message}`, { event: 'promotions.commit_failed', userId: reservation.userId });
    }
  }

  /** Le débit n'a pas eu lieu : la remise réservée est rendue. */
  async release(reservation: PromotionReservation): Promise<void> {
    for (const applied of reservation.price.applied) await this.give(applied.id, reservation.userId, applied.discountXaf);
  }

  // ============================================
  // RECHARGES ET CRÉDITS DU JOUR
  // ============================================

  /** Bonus de recharge des promotions en cours (le plus haut taux), inscrit au journal. */
  async topupBonus(userId: string, amountXaf: number): Promise<{ bonusXaf: number; promotion?: { id: string; name: string } }> {
    try {
      const best = (await this.applicableFor(userId))
        .filter((promotion) => (promotion.topupBonusPercent ?? 0) > 0)
        .sort((a, b) => (b.topupBonusPercent ?? 0) - (a.topupBonusPercent ?? 0))[0];
      if (!best) return { bonusXaf: 0 };
      const bonusXaf = Math.round((amountXaf * Math.min(100, best.topupBonusPercent ?? 0)) / 100);
      if (bonusXaf <= 0) return { bonusXaf: 0 };
      await Promotion.updateOne({ _id: best._id }, { $inc: { 'stats.topupBonusXaf': bonusXaf } });
      await PromotionRedemption.create({ promotionId: toId(best._id), userId, kind: 'topup_bonus', originalXaf: amountXaf, discountXaf: bonusXaf, paidXaf: amountXaf });
      return { bonusXaf, promotion: { id: toId(best._id), name: best.name } };
    } catch (error: any) {
      logger.error(`promotions.topup_bonus_failed: ${error.message}`, { event: 'promotions.topup_bonus_failed', userId });
      return { bonusXaf: 0 };
    }
  }

  /**
   * Crédits du jour accordés par les promotions de ce compte : par groupe, la plus large des
   * limites. `null` : aucune promotion ne règle les quotas.
   */
  async quotaBoost(userId: string): Promise<{ limits: Partial<Record<QuotaGroup, WindowLimitsPatch>>; spendCapsUsd: WindowLimitsPatch } | null> {
    const list = (await this.applicableFor(userId).catch(() => [])).filter((promotion) => promotion.quotas?.enabled);
    if (list.length === 0) return null;
    const widest = (a: number | null | undefined, b: number | null | undefined): number | null | undefined => {
      if (a === undefined) return b;
      if (b === undefined) return a;
      if (a === null || b === null) return null;
      return Math.max(a, b);
    };
    const limits: Partial<Record<QuotaGroup, WindowLimitsPatch>> = {};
    const spendCapsUsd: WindowLimitsPatch = {};
    for (const promotion of list) {
      for (const group of QUOTA_GROUPS) {
        const patch = promotion.quotas?.limits?.[group];
        if (!patch) continue;
        const current = (limits[group] ??= {});
        for (const window of ['day', 'week', 'month'] as const) {
          if (window in patch) current[window] = widest(current[window], patch[window]);
        }
      }
      for (const window of ['day', 'week', 'month'] as const) {
        const caps = promotion.quotas?.spendCapsUsd;
        if (caps && window in caps) spendCapsUsd[window] = widest(spendCapsUsd[window], caps[window]);
      }
    }
    return { limits, spendCapsUsd };
  }

  /**
   * Les limites d'un compte, élargies par ses promotions : on garde la plus large des deux, jamais
   * moins que l'offre du compte. Dans une campagne, « sans limite » sur la semaine ou le mois veut
   * dire qu'elle n'est bornée que par jour.
   */
  static widen(base: WindowLimits, patch?: WindowLimitsPatch): WindowLimits {
    if (!patch) return base;
    const pick = (window: 'day' | 'week' | 'month'): number | null => {
      if (!(window in patch)) return base[window];
      const value = patch[window];
      if (value === null || value === undefined) return null;
      return base[window] === null ? null : Math.max(base[window]!, value);
    };
    return { day: pick('day'), week: pick('week'), month: pick('month') };
  }

  // ============================================
  // COUPONS
  // ============================================

  /** Saisie d'un code promo : il s'appliquera aux achats visés, et peut verser des francs tout de suite. */
  async claim(userId: string, rawCode: string): Promise<{ promotion: PublicPromotion; walletCreditXaf: number; message: string }> {
    const code = normalizeCode(rawCode);
    if (!code) throw new PromotionError(400, 'invalid_code', 'Saisissez un code.');
    const promotion = (await Promotion.findOne({ kind: 'coupon', code }).lean()) as unknown as Lean | null;
    if (!promotion) throw new PromotionError(404, 'unknown_code', 'Ce code est introuvable. Vérifiez-le et réessayez.');

    const phase = phaseOf(this.dates(promotion));
    if (phase === 'scheduled') throw new PromotionError(409, 'not_started', 'Ce code n’est pas encore valable.');
    if (phase !== 'running') throw new PromotionError(410, 'expired', 'Ce code n’est plus valable.');
    if (!this.audienceAllows(promotion.audience, userId, await this.userFacts(userId))) {
      throw new PromotionError(403, 'not_eligible', 'Ce code n’est pas valable pour votre compte.');
    }

    const id = toId(promotion._id);
    if (await PromotionClaim.exists({ promotionId: id, userId })) {
      throw new PromotionError(409, 'already_claimed', 'Vous avez déjà utilisé ce code.');
    }

    const claimsLimit = promotion.limits?.claims;
    const counted = await Promotion.updateOne(
      { _id: promotion._id, state: 'active', ...(claimsLimit != null ? { 'stats.claims': { $lt: claimsLimit } } : {}) },
      { $inc: { 'stats.claims': 1 } }
    );
    if (counted.modifiedCount === 0) throw new PromotionError(410, 'exhausted', 'Ce code a déjà été utilisé autant de fois que prévu.');

    const walletCreditXaf = Math.max(0, Math.round(promotion.walletCreditXaf ?? 0));
    try {
      await PromotionClaim.create({ promotionId: id, userId, code, walletCreditXaf });
    } catch (error: any) {
      await Promotion.updateOne({ _id: promotion._id }, { $inc: { 'stats.claims': -1 } });
      if (error?.code === 11000) throw new PromotionError(409, 'already_claimed', 'Vous avez déjà utilisé ce code.');
      throw error;
    }

    if (walletCreditXaf > 0) {
      await creditLedgerService.grant(userId, 'wallet', walletCreditXaf, 'bonus', { note: `Code promo ${code} (+${walletCreditXaf} F)` });
      await Promotion.updateOne({ _id: promotion._id }, { $inc: { 'stats.walletCreditXaf': walletCreditXaf } });
      await PromotionRedemption.create({ promotionId: id, userId, kind: 'wallet_credit', originalXaf: 0, discountXaf: walletCreditXaf, paidXaf: 0 });
    }
    this.claims.delete(userId);
    logger.info('promotions.claimed', { event: 'promotions.claimed', userId, promotionId: id, walletCreditXaf });

    const parts: string[] = [];
    if (promotion.discount && promotion.discount.type) parts.push(`« ${promotion.name} » s’applique à vos prochains achats`);
    if (walletCreditXaf > 0) parts.push(`${walletCreditXaf} F ajoutés à votre portefeuille`);
    return { promotion: this.toPublic(promotion, true), walletCreditXaf, message: `${parts.join(' et ')}.` };
  }

  /** Les coupons saisis par un compte (écran du portefeuille). */
  async claimsOf(userId: string): Promise<PublicPromotion[]> {
    const rows = await PromotionClaim.find({ userId }).lean();
    if (rows.length === 0) return [];
    const promotions = (await Promotion.find({ _id: { $in: rows.map((row) => row.promotionId) } }).lean()) as unknown as Lean[];
    return promotions.map((promotion) => this.toPublic(promotion, true));
  }

  // ============================================
  // PANEL ADMIN
  // ============================================

  toDto(promotion: Lean): PromotionDto & { phase: string } {
    const dto: PromotionDto = {
      ...this.toPublic(promotion),
      description: promotion.description,
      state: promotion.state,
      code: promotion.code ?? null,
      audience: { ...promotion.audience, newUsersSince: iso(promotion.audience?.newUsersSince ?? null) },
      limits: promotion.limits ?? {},
      quotas: promotion.quotas ?? null,
      walletCreditXaf: promotion.walletCreditXaf ?? 0,
      topupBonusPercent: promotion.topupBonusPercent ?? 0,
      stats: promotion.stats,
      createdAt: iso(promotion.createdAt) ?? undefined,
      updatedAt: iso(promotion.updatedAt) ?? undefined,
      createdBy: promotion.createdBy,
      updatedBy: promotion.updatedBy,
      endedAt: iso(promotion.endedAt ?? null),
      endedBy: promotion.endedBy ?? null,
      endReason: promotion.endReason ?? null,
    };
    delete (dto as Partial<PublicPromotion>).claimed;
    return { ...dto, phase: phaseOf(this.dates(promotion)) };
  }

  async list(): Promise<ReturnType<PromotionService['toDto']>[]> {
    const rows = (await Promotion.find({}).sort({ createdAt: -1 }).lean()) as unknown as Lean[];
    return rows.map((row) => this.toDto(row));
  }

  async get(id: string): Promise<{ promotion: ReturnType<PromotionService['toDto']>; recent: unknown[]; byItem: unknown[]; users: number }> {
    const row = (await Promotion.findById(id).lean()) as unknown as Lean | null;
    if (!row) throw new PromotionError(404, 'not_found', 'Promotion introuvable.');
    const [recent, byItem, users] = await Promise.all([
      PromotionRedemption.find({ promotionId: id }).sort({ createdAt: -1 }).limit(50).lean(),
      PromotionRedemption.aggregate([
        { $match: { promotionId: id, kind: 'discount', released: { $ne: true } } },
        { $group: { _id: '$item', count: { $sum: 1 }, discountXaf: { $sum: '$discountXaf' }, paidXaf: { $sum: '$paidXaf' } } },
        { $sort: { discountXaf: -1 } },
      ]),
      PromotionUsage.countDocuments({ promotionId: id, count: { $gt: 0 } }),
    ]);
    return {
      promotion: this.toDto(row),
      recent,
      byItem: byItem.map((entry) => ({ item: entry._id, label: PROMO_ITEMS[entry._id]?.label ?? entry._id, count: entry.count, discountXaf: entry.discountXaf, paidXaf: entry.paidXaf })),
      users,
    };
  }

  async create(input: Record<string, unknown>, by?: string): Promise<ReturnType<PromotionService['toDto']>> {
    const data = sanitize(input, null);
    if (!data.slug) data.slug = await this.freeSlug(String(data.name ?? 'promotion'));
    try {
      const created = await Promotion.create({ ...data, createdBy: by, updatedBy: by, stats: { redemptions: 0, discountXaf: 0, claims: 0, topupBonusXaf: 0, walletCreditXaf: 0 } });
      this.invalidate();
      logger.info('promotions.created', { event: 'promotions.created', promotionId: toId(created._id), by, kind: data.kind });
      return this.toDto(created.toObject() as unknown as Lean);
    } catch (error: any) {
      if (error?.code === 11000) throw new PromotionError(409, 'duplicate', 'Ce code ou cet identifiant est déjà utilisé par une autre promotion.');
      throw error;
    }
  }

  async update(id: string, input: Record<string, unknown>, by?: string): Promise<ReturnType<PromotionService['toDto']>> {
    const current = (await Promotion.findById(id).lean()) as unknown as Lean | null;
    if (!current) throw new PromotionError(404, 'not_found', 'Promotion introuvable.');
    if (current.state === 'ended') throw new PromotionError(409, 'ended', 'Une promotion terminée ne se modifie plus. Dupliquez-la pour relancer une offre.');
    const data = sanitize(input, current);
    delete data.slug;
    try {
      const updated = (await Promotion.findByIdAndUpdate(id, { $set: { ...data, updatedBy: by } }, { new: true }).lean()) as unknown as Lean;
      this.invalidate();
      logger.info('promotions.updated', { event: 'promotions.updated', promotionId: id, by, fields: Object.keys(data) });
      return this.toDto(updated);
    } catch (error: any) {
      if (error?.code === 11000) throw new PromotionError(409, 'duplicate', 'Ce code est déjà utilisé par une autre promotion.');
      throw error;
    }
  }

  /** Lancer, mettre en pause, reprendre. */
  async setState(id: string, state: 'active' | 'paused', by?: string): Promise<ReturnType<PromotionService['toDto']>> {
    const current = (await Promotion.findById(id).lean()) as unknown as Lean | null;
    if (!current) throw new PromotionError(404, 'not_found', 'Promotion introuvable.');
    if (current.state === 'ended') throw new PromotionError(409, 'ended', 'Une promotion terminée ne se relance pas. Dupliquez-la.');
    const updated = (await Promotion.findByIdAndUpdate(id, { $set: { state, updatedBy: by } }, { new: true }).lean()) as unknown as Lean;
    this.invalidate();
    logger.info('promotions.state', { event: 'promotions.state', promotionId: id, state, by });
    return this.toDto(updated);
  }

  /** Met fin à une promotion, tout de suite. Les remises déjà accordées restent acquises. */
  async end(id: string, by?: string, reason?: string): Promise<ReturnType<PromotionService['toDto']>> {
    const now = new Date();
    const updated = (await Promotion.findOneAndUpdate(
      { _id: id, state: { $ne: 'ended' } },
      { $set: { state: 'ended', endedAt: now, endedBy: by ?? null, endReason: reason ?? null, updatedBy: by } },
      { new: true }
    ).lean()) as unknown as Lean | null;
    if (!updated) throw new PromotionError(404, 'not_found', 'Promotion introuvable ou déjà terminée.');
    this.invalidate();
    logger.info('promotions.ended', { event: 'promotions.ended', promotionId: id, by, reason });
    return this.toDto(updated);
  }

  /** Copie (brouillon) d'une promotion, pour relancer une offre terminée. */
  async duplicate(id: string, by?: string): Promise<ReturnType<PromotionService['toDto']>> {
    const source = (await Promotion.findById(id).lean()) as unknown as Lean | null;
    if (!source) throw new PromotionError(404, 'not_found', 'Promotion introuvable.');
    const copy = this.toDto(source);
    return this.create(
      {
        ...copy,
        name: `${copy.name} (copie)`,
        slug: undefined,
        state: 'draft',
        code: copy.code ? `${copy.code}2` : null,
        startsAt: new Date().toISOString(),
        endsAt: null,
      },
      by
    );
  }

  /** Seul un brouillon s'efface : une promotion lancée a un historique. */
  async remove(id: string): Promise<void> {
    const removed = await Promotion.deleteOne({ _id: id, state: 'draft' });
    if (removed.deletedCount === 0) throw new PromotionError(409, 'not_draft', 'Seul un brouillon peut être supprimé. Mettez fin à la promotion à la place.');
    this.invalidate();
  }

  /** Vue d'ensemble du panel : ce que coûtent les promotions en cours. */
  async overview(): Promise<Record<string, unknown>> {
    const rows = (await Promotion.find({}).lean()) as unknown as Lean[];
    const running = rows.filter((row) => phaseOf(this.dates(row)) === 'running');
    const since = new Date(Date.now() - 86_400_000);
    const lastDay = await PromotionRedemption.aggregate([
      { $match: { createdAt: { $gte: since }, released: { $ne: true } } },
      { $group: { _id: null, count: { $sum: 1 }, discountXaf: { $sum: '$discountXaf' }, users: { $addToSet: '$userId' } } },
    ]);
    return {
      total: rows.length,
      running: running.length,
      freeCampaignRunning: running.some((row) => row.kind === 'campaign' && row.discount?.type === 'free' && row.scope?.all),
      discountXafAllTime: rows.reduce((sum, row) => sum + (row.stats?.discountXaf ?? 0), 0),
      last24h: { redemptions: lastDay[0]?.count ?? 0, discountXaf: lastDay[0]?.discountXaf ?? 0, users: lastDay[0]?.users?.length ?? 0 },
    };
  }

  /** Les articles, familles et groupes de quotas proposés par le formulaire du panel. */
  catalog(): Record<string, unknown> {
    return {
      services: PROMO_SERVICE_KEYS,
      items: Object.entries(PROMO_ITEMS).map(([key, item]) => ({ key, ...item })),
      quotaGroups: QUOTA_GROUPS,
      alwaysPaidDuringFreeBeta: ALWAYS_PAID_DURING_FREE_BETA,
    };
  }

  quotaPreset(timesPerDay: number): ReturnType<typeof campaignQuotaPreset> {
    return campaignQuotaPreset(timesPerDay);
  }

  /**
   * La bêta gratuite, créée une seule fois (au premier démarrage qui ne la trouve pas). Ensuite elle
   * se règle et se termine dans le panel ; elle n'est jamais recréée (une promotion lancée ne
   * s'efface pas, elle se termine).
   */
  async ensureDefaults(): Promise<void> {
    try {
      if (await Promotion.exists({ slug: BETA_CAMPAIGN_SLUG })) return;
      const preset = campaignQuotaPreset(5);
      await Promotion.create({
        slug: BETA_CAMPAIGN_SLUG,
        name: 'Bêta gratuite',
        description: 'Pendant la bêta, tous les services et packs sont gratuits ; seuls les crédits du jour (5 tours complets de la plateforme) bornent l’usage.',
        kind: 'campaign',
        state: 'active',
        startsAt: new Date(),
        endsAt: null,
        priority: 100,
        stackable: false,
        discount: { type: 'free', value: 0 },
        scope: { all: true, services: [], items: [], excludeItems: ALWAYS_PAID_DURING_FREE_BETA },
        audience: { everyone: true, newUsersSince: null, emails: [], userIds: [] },
        limits: { perUser: null, total: null, budgetXaf: null, claims: null },
        display: {
          banner: true,
          title: 'Bêta gratuite : ',
          message: 'pendant la bêta, tout est gratuit sur IDEM, packs et forfaits compris. Seule limite : vos crédits du jour.',
          strikethrough: true,
          badge: 'Bêta',
        },
        quotas: { enabled: true, timesPerDay: preset.timesPerDay, limits: preset.limits, spendCapsUsd: preset.spendCapsUsd },
        stats: { redemptions: 0, discountXaf: 0, claims: 0, topupBonusXaf: 0, walletCreditXaf: 0 },
        createdBy: 'system',
      });
      this.invalidate();
      logger.info('promotions.beta_campaign_created', { event: 'promotions.beta_campaign_created' });
    } catch (error: any) {
      logger.error(`promotions.ensure_defaults_failed: ${error.message}`, { event: 'promotions.ensure_defaults_failed' });
    }
  }

  private async freeSlug(name: string): Promise<string> {
    const base =
      name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48) || 'promotion';
    let slug = base;
    for (let n = 2; await Promotion.exists({ slug }); n += 1) slug = `${base}-${n}`;
    return slug;
  }
}

// ============================================
// VALIDATION DU FORMULAIRE DU PANEL
// ============================================

export function normalizeCode(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function limit(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function date(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function strings(value: unknown, allowed?: (entry: string) => boolean, max = 500): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry).trim()).filter((entry) => entry && (!allowed || allowed(entry))))].slice(0, max);
}

function windows(value: unknown): WindowLimitsPatch {
  const source = (value ?? {}) as Record<string, unknown>;
  const patch: WindowLimitsPatch = {};
  for (const window of ['day', 'week', 'month'] as const) {
    if (window in source) patch[window] = limit(source[window]);
  }
  return patch;
}

/**
 * Le formulaire du panel, réduit à des valeurs sûres. Une remise « gratuit » ou supérieure au prix
 * ne pose pas de problème (le prix ne descend pas sous zéro) ; une portée vide, si : elle est refusée.
 */
function sanitize(input: Record<string, unknown>, current: Lean | null): Record<string, any> {
  const get = <K extends keyof PromotionDocument>(key: K): unknown => (key in input ? input[key] : current?.[key]);
  const out: Record<string, any> = {};

  const name = String(get('name') ?? '').trim().slice(0, 120);
  if (!name) throw new PromotionError(400, 'name_required', 'Donnez un nom à la promotion.');
  out.name = name;
  out.description = String(get('description') ?? '').slice(0, 2000);

  const kind = get('kind') === 'coupon' ? 'coupon' : 'campaign';
  out.kind = kind;
  const code = normalizeCode(get('code'));
  if (kind === 'coupon' && code.length < 3) throw new PromotionError(400, 'code_required', 'Un coupon a besoin d’un code d’au moins 3 caractères (lettres, chiffres, - ou _).');
  out.code = kind === 'coupon' ? code : null;

  if (input.slug) out.slug = normalizeCode(input.slug).toLowerCase();
  const state = String(get('state') ?? 'draft');
  out.state = ['draft', 'active', 'paused'].includes(state) ? state : current?.state ?? 'draft';

  const startsAt = date(get('startsAt')) ?? current?.startsAt ?? new Date();
  const endsAt = 'endsAt' in input ? date(input.endsAt) : (current?.endsAt ?? null);
  if (endsAt && endsAt <= startsAt) throw new PromotionError(400, 'bad_dates', 'La fin doit venir après le début.');
  out.startsAt = startsAt;
  out.endsAt = endsAt;

  out.priority = Math.round(num(get('priority'), 0, -1000, 1000));
  out.stackable = bool(get('stackable'), false);

  const discount = (get('discount') ?? {}) as Partial<PromotionDiscount>;
  const type = ['free', 'percent', 'fixed'].includes(String(discount.type)) ? (discount.type as PromotionDiscount['type']) : 'percent';
  const value = type === 'free' ? 0 : type === 'percent' ? num(discount.value, 0, 0, 100) : Math.round(num(discount.value, 0, 0, 10_000_000));
  out.discount = { type, value };

  const scope = (get('scope') ?? {}) as Partial<PromotionScope>;
  out.scope = {
    all: bool(scope.all, false),
    services: strings(scope.services, (entry) => (PROMO_SERVICE_KEYS as string[]).includes(entry)),
    items: strings(scope.items, (entry) => entry in PROMO_ITEMS),
    excludeItems: strings(scope.excludeItems, (entry) => entry in PROMO_ITEMS),
  };
  const discountsSomething = type === 'free' || value > 0;
  const hasScope = out.scope.all || out.scope.services.length > 0 || out.scope.items.length > 0;
  const topupBonusPercent = num(get('topupBonusPercent'), 0, 0, 100);
  const walletCreditXaf = Math.round(num(get('walletCreditXaf'), 0, 0, 1_000_000));
  const quotasInput = get('quotas') as Partial<PromotionQuotas> | null | undefined;
  if (discountsSomething && !hasScope && topupBonusPercent === 0 && walletCreditXaf === 0 && !quotasInput?.enabled) {
    throw new PromotionError(400, 'empty_scope', 'Choisissez sur quoi porte la remise : tout, une famille de services ou des articles.');
  }
  out.topupBonusPercent = topupBonusPercent;
  out.walletCreditXaf = kind === 'coupon' ? walletCreditXaf : 0;

  const audience = (get('audience') ?? {}) as Partial<PromotionAudience> & { newUsersSince?: unknown };
  out.audience = {
    everyone: bool(audience.everyone, true),
    newUsersSince: date(audience.newUsersSince),
    emails: strings(audience.emails, (entry) => entry.includes('@'), 5000).map((entry) => entry.toLowerCase()),
    userIds: strings(audience.userIds, undefined, 5000),
  };

  const limits = (get('limits') ?? {}) as Partial<PromotionLimits>;
  out.limits = { perUser: limit(limits.perUser), total: limit(limits.total), budgetXaf: limit(limits.budgetXaf), claims: limit(limits.claims) };

  const display = (get('display') ?? {}) as Partial<PromotionDisplay>;
  out.display = {
    banner: bool(display.banner, false),
    title: String(display.title ?? '').slice(0, 80),
    message: String(display.message ?? '').slice(0, 280),
    strikethrough: bool(display.strikethrough, true),
    badge: String(display.badge ?? '').slice(0, 24),
  };

  if (quotasInput && quotasInput.enabled) {
    const groups: Record<string, WindowLimitsPatch> = {};
    for (const group of QUOTA_GROUPS) {
      const patch = quotasInput.limits?.[group];
      if (patch) groups[group] = windows(patch);
    }
    out.quotas = { enabled: true, timesPerDay: limit(quotasInput.timesPerDay), limits: groups, spendCapsUsd: windows(quotasInput.spendCapsUsd) };
  } else {
    out.quotas = null;
  }
  return out;
}

export const promotionService = new PromotionService();
export default promotionService;
