import mongoose from 'mongoose';
import logger from '../config/logger';
import {
  BillingInvoiceModel,
  BillingPlanCode,
  BillingPlanModel,
  BillingSubscriptionModel,
  CREDIT_COSTS,
  CreditEntryReason,
  CreditedAction,
  DEFAULT_PLANS,
} from '../models/billing.model';
import {
  BillingInvoice,
  BillingPlan,
  BillingSubscription,
  CreditLedgerEntry,
} from '../schemas/billing.schema';
import { User } from '../schemas/user.schema';

/**
 * Moteur de facturation.
 *
 * Aucun prestataire de paiement n'est encore branché : les abonnements et les
 * factures sont créés en mode `manual`. Tout ce qui précède l'encaissement est
 * en revanche fonctionnel — catalogue, souscription, octroi et consommation de
 * crédits, émission de factures périodiques — pour que le panel admin puisse
 * déjà mesurer le chiffre d'affaires et le comparer au coût des tokens.
 *
 * Point d'entrée d'une future intégration : `provider` / `providerInvoiceId` /
 * `providerSubscriptionId`, et `markInvoicePaid()` appelé par un webhook.
 */

/** Jour UTC `YYYY-MM-DD`. */
function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Fin de période à partir d'un début et d'un intervalle. */
function addInterval(start: Date, interval: BillingSubscriptionModel['interval']): Date {
  const end = new Date(start);
  if (interval === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else if (interval === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  // `one_time` : pas de renouvellement, on borne loin pour ne jamais expirer.
  else end.setUTCFullYear(end.getUTCFullYear() + 100);
  return end;
}

export class BillingService {
  /**
   * Amorce le catalogue depuis `DEFAULT_PLANS` (aligné sur la landing page).
   *
   * `$setOnInsert` uniquement : un plan déjà en base n'est JAMAIS écrasé — un
   * prix négocié ou corrigé en production ne doit pas être réinitialisé à
   * chaque redémarrage.
   */
  async seedPlans(): Promise<{ created: number; existing: number }> {
    let created = 0;

    for (const plan of DEFAULT_PLANS) {
      const result = await BillingPlan.updateOne(
        { code: plan.code },
        { $setOnInsert: plan },
        { upsert: true }
      );
      if (result.upsertedCount > 0) created += 1;
    }

    const existing = DEFAULT_PLANS.length - created;
    logger.info(`Billing plans seeded: ${created} created, ${existing} already present`);
    return { created, existing };
  }

  async listPlans(includeInactive = false): Promise<BillingPlanModel[]> {
    const filter = includeInactive ? {} : { isActive: true };
    const plans = await BillingPlan.find(filter).sort({ sortOrder: 1 }).lean();
    return plans.map((plan: any) => ({ ...plan, id: String(plan._id) }));
  }

  async getPlan(code: BillingPlanCode): Promise<BillingPlanModel | null> {
    const plan = await BillingPlan.findOne({ code }).lean();
    return plan ? ({ ...plan, id: String(plan._id) } as BillingPlanModel) : null;
  }

  // ============================================
  // ABONNEMENTS
  // ============================================

  /** Abonnement actif d'un utilisateur, s'il en a un. */
  async getActiveSubscription(userId: string): Promise<BillingSubscriptionModel | null> {
    const subscription = await BillingSubscription.findOne({
      userId,
      status: { $in: ['active', 'trialing'] },
    }).lean();

    return subscription
      ? ({ ...subscription, id: String(subscription._id) } as BillingSubscriptionModel)
      : null;
  }

  /**
   * Souscrit un utilisateur à un plan.
   *
   * L'abonnement précédent est annulé avant la création du nouveau : l'index
   * partiel unique `one_active_subscription_per_user` refuserait deux
   * abonnements actifs simultanés — c'est voulu, il protège contre une double
   * facturation en cas de requêtes concurrentes.
   *
   * Écrit aussi `users.subscription` (le champ que l'API lit pour les quotas) et
   * crédite les crédits du plan, dans une transaction quand le déploiement
   * MongoDB le permet.
   */
  async subscribe(
    userId: string,
    planCode: BillingPlanCode,
    options: {
      provider?: BillingSubscriptionModel['provider'];
      providerSubscriptionId?: string;
      providerCustomerId?: string;
      priceOverride?: number;
      startAt?: Date;
    } = {}
  ): Promise<BillingSubscriptionModel> {
    const plan = await this.getPlan(planCode);
    if (!plan) throw new Error(`Unknown billing plan: ${planCode}`);

    const start = options.startAt ?? new Date();
    const price = options.priceOverride ?? plan.price;

    await this.cancelActiveSubscription(userId, 'replaced by a new subscription');

    const subscription = await BillingSubscription.create({
      userId,
      planCode,
      status: 'active',
      price,
      currency: plan.currency,
      interval: plan.interval,
      currentPeriodStart: start,
      currentPeriodEnd: addInterval(start, plan.interval),
      provider: options.provider ?? 'manual',
      providerSubscriptionId: options.providerSubscriptionId,
      providerCustomerId: options.providerCustomerId,
    });

    // Le palier lu par les quotas de l'API suit le plan commercial.
    await User.updateOne({ uid: userId }, { $set: { subscription: plan.subscriptionTier } });

    if (plan.creditsPerPeriod > 0) {
      await this.grantCredits(userId, plan.creditsPerPeriod, 'plan_grant', {
        subscriptionId: String(subscription._id),
        note: `Plan ${plan.name}`,
      });
    }

    logger.info(`User ${userId} subscribed to plan ${planCode} (${price} ${plan.currency})`);
    return { ...subscription.toObject(), id: String(subscription._id) } as BillingSubscriptionModel;
  }

  /** Annule l'abonnement actif, s'il existe. Idempotent. */
  async cancelActiveSubscription(userId: string, reason?: string): Promise<boolean> {
    const result = await BillingSubscription.updateOne(
      { userId, status: { $in: ['active', 'trialing'] } },
      { $set: { status: 'canceled', canceledAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Canceled active subscription for ${userId}${reason ? ` (${reason})` : ''}`);
      return true;
    }
    return false;
  }

  /**
   * Renouvelle les abonnements arrivés à échéance : facture la période écoulée,
   * fait glisser la fenêtre et recrédite les crédits du plan.
   *
   * Conçu pour être appelé par une tâche planifiée. Idempotent grâce à l'index
   * unique `one_invoice_per_subscription_period` : un rejeu ne double-facture
   * pas.
   */
  async renewDueSubscriptions(now = new Date()): Promise<{ renewed: number; failed: number }> {
    const due = await BillingSubscription.find({
      status: 'active',
      interval: { $in: ['month', 'year'] },
      currentPeriodEnd: { $lte: now },
    }).lean();

    let renewed = 0;
    let failed = 0;

    for (const subscription of due) {
      try {
        await this.issueInvoice({
          userId: subscription.userId,
          subscriptionId: String(subscription._id),
          planCode: subscription.planCode,
          amount: subscription.price,
          currency: subscription.currency,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          provider: subscription.provider,
        });

        const nextStart = subscription.currentPeriodEnd;
        await BillingSubscription.updateOne(
          { _id: subscription._id },
          {
            $set: {
              currentPeriodStart: nextStart,
              currentPeriodEnd: addInterval(nextStart, subscription.interval),
            },
          }
        );

        const plan = await this.getPlan(subscription.planCode);
        if (plan && plan.creditsPerPeriod > 0) {
          await this.grantCredits(subscription.userId, plan.creditsPerPeriod, 'plan_grant', {
            subscriptionId: String(subscription._id),
            note: `Renouvellement ${plan.name}`,
          });
        }

        renewed += 1;
      } catch (error: any) {
        // Un abonnement en échec ne doit pas bloquer les suivants.
        failed += 1;
        logger.error(
          `Failed to renew subscription ${subscription._id} for ${subscription.userId}: ${error.message}`
        );
      }
    }

    if (due.length > 0) {
      logger.info(`Subscription renewal: ${renewed} renewed, ${failed} failed`);
    }
    return { renewed, failed };
  }

  // ============================================
  // FACTURES
  // ============================================

  /**
   * Émet une facture. Le doublon (même abonnement, même période) est absorbé
   * silencieusement : l'index unique en base fait foi, et un rejeu de la tâche
   * de renouvellement ne doit pas être une erreur.
   */
  async issueInvoice(params: {
    userId: string;
    subscriptionId?: string;
    planCode: BillingPlanCode;
    amount: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
    provider?: BillingInvoiceModel['provider'];
    /** Taux vers USD ; 1 si le montant est déjà en USD. */
    fxRateToUsd?: number;
    status?: BillingInvoiceModel['status'];
  }): Promise<BillingInvoiceModel | null> {
    const fxRateToUsd = params.fxRateToUsd ?? 1;
    const issuedAt = new Date();

    try {
      const invoice = await BillingInvoice.create({
        userId: params.userId,
        subscriptionId: params.subscriptionId,
        planCode: params.planCode,
        number: await this.nextInvoiceNumber(issuedAt),
        status: params.status ?? 'open',
        amount: params.amount,
        currency: params.currency,
        amountUsd: Math.round(params.amount * fxRateToUsd * 100) / 100,
        fxRateToUsd,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        day: dayKey(issuedAt),
        issuedAt,
        provider: params.provider ?? 'manual',
      });

      logger.info(
        `Invoice ${invoice.number} issued for ${params.userId}: ${params.amount} ${params.currency}`
      );
      return { ...invoice.toObject(), id: String(invoice._id) } as BillingInvoiceModel;
    } catch (error: any) {
      if (error?.code === 11000) {
        logger.info(
          `Invoice already exists for subscription ${params.subscriptionId} period ${params.periodStart.toISOString()} — skipping`
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Numéro de facture séquentiel par mois (`INV-2026-08-000123`).
   *
   * Dérivé d'un compteur atomique dédié plutôt que d'un `countDocuments` :
   * deux émissions concurrentes obtiendraient sinon le même numéro et la
   * seconde échouerait sur l'index unique.
   */
  private async nextInvoiceNumber(at: Date): Promise<string> {
    const prefix = `INV-${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;

    const counter = await mongoose.connection.collection('billing_counters').findOneAndUpdate(
      { _id: prefix as any },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    const seq = (counter as any)?.seq ?? (counter as any)?.value?.seq ?? 1;
    return `${prefix}-${String(seq).padStart(6, '0')}`;
  }

  /** Marque une facture payée. Point d'entrée d'un futur webhook prestataire. */
  async markInvoicePaid(
    invoiceId: string,
    options: { paidAt?: Date; providerInvoiceId?: string } = {}
  ): Promise<boolean> {
    const result = await BillingInvoice.updateOne(
      { _id: invoiceId, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          paidAt: options.paidAt ?? new Date(),
          ...(options.providerInvoiceId
            ? { providerInvoiceId: options.providerInvoiceId }
            : {}),
        },
      }
    );

    return result.modifiedCount > 0;
  }

  // ============================================
  // CRÉDITS
  // ============================================

  /**
   * Solde de crédits d'un utilisateur.
   *
   * Lu depuis la DERNIÈRE écriture du grand livre (`balanceAfter`) plutôt que
   * par une somme de tous les `delta` : O(1) au lieu de O(n) sur un livre qui ne
   * fait que grandir.
   */
  async getCreditBalance(userId: string): Promise<number> {
    const last = await CreditLedgerEntry.findOne({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .select('balanceAfter')
      .lean();

    return last?.balanceAfter ?? 0;
  }

  /** Crédite un utilisateur (octroi de plan, bonus, geste commercial). */
  async grantCredits(
    userId: string,
    amount: number,
    reason: Extract<CreditEntryReason, 'plan_grant' | 'signup_bonus' | 'manual_adjustment' | 'refund'>,
    options: { subscriptionId?: string; note?: string } = {}
  ): Promise<number> {
    if (amount <= 0) throw new Error('Credit grant must be positive');

    return this.appendLedgerEntry(userId, amount, reason, options);
  }

  /**
   * Débite les crédits d'une action facturable.
   *
   * Renvoie `{ allowed: false }` sans écrire quand le solde est insuffisant :
   * c'est à l'appelant de refuser la génération. Le débit N'EST PAS bloquant
   * aujourd'hui — aucun appelant ne l'invoque encore, l'offre créditée n'étant
   * pas activée. Le brancher consistera à appeler cette méthode avant la
   * génération et à propager `allowed`.
   */
  async debitCredits(
    userId: string,
    action: CreditedAction,
    context: { projectId?: string; feature?: string; element?: string; aiUsageEventId?: string } = {}
  ): Promise<{ allowed: boolean; cost: number; balance: number }> {
    const cost = CREDIT_COSTS[action];
    const balance = await this.getCreditBalance(userId);

    if (balance < cost) {
      logger.warn(
        `Insufficient credits for ${userId}: needs ${cost} for "${action}", has ${balance}`
      );
      return { allowed: false, cost, balance };
    }

    const newBalance = await this.appendLedgerEntry(userId, -cost, 'consumption', {
      action,
      ...context,
    });

    return { allowed: true, cost, balance: newBalance };
  }

  /**
   * Ajoute une écriture au grand livre et renvoie le nouveau solde.
   *
   * Le solde est relu juste avant l'écriture : deux débits concurrents peuvent
   * donc calculer le même `balanceAfter`. C'est accepté pour l'instant (le
   * débit n'est pas encore branché) ; à l'activation, cette méthode devra
   * passer par une transaction ou par un compteur atomique sur l'utilisateur.
   */
  private async appendLedgerEntry(
    userId: string,
    delta: number,
    reason: CreditEntryReason,
    extra: Partial<{
      action: CreditedAction;
      projectId: string;
      feature: string;
      element: string;
      aiUsageEventId: string;
      subscriptionId: string;
      note: string;
    }> = {}
  ): Promise<number> {
    const balanceAfter = (await this.getCreditBalance(userId)) + delta;

    await CreditLedgerEntry.create({
      userId,
      delta,
      balanceAfter,
      reason,
      day: dayKey(),
      ...extra,
    });

    return balanceAfter;
  }

  /** Relevé de crédits d'un utilisateur, le plus récent d'abord. */
  async getCreditStatement(userId: string, limit = 100): Promise<any[]> {
    return CreditLedgerEntry.find({ userId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .lean();
  }
}

export const billingService = new BillingService();
export default billingService;
