import mongoose from 'mongoose';
import logger from '../config/logger';
import {
  ALLOWED_INSTALLMENTS,
  ANNUAL_DISCOUNT_RATE,
  BILLING_ENGINES,
  BUNDLE_COMPOSITION,
  BUNDLE_CREDIT_SPLIT,
  BUSINESS_CREDIT_COSTS,
  BillingEngine,
  BillingInterval,
  BillingInvoiceModel,
  BillingProductModel,
  BillingPurchaseModel,
  BillingSubscriptionModel,
  CREDIT_ROLLOVER_MONTHS,
  CreditEntryReason,
  DEFAULT_PRODUCTS,
  MAX_LOYALTY_BONUS_RATE,
  OVERAGE_RATES,
  OverageKind,
  PaymentProvider,
  annualPriceXaf,
  getXafPerUsd,
  xafToUsd,
} from '../models/billing.model';
import {
  BillingInvoice,
  BillingProduct,
  BillingPurchase,
  BillingSubscription,
  CreditLedgerEntry,
} from '../schemas/billing.schema';
import { User } from '../schemas/user.schema';
import { creditLedgerService } from './billing/credit-ledger.service';

/**
 * Moteur de facturation.
 *
 * Transcrit le modèle économique décrit dans `models/billing.model.ts` : trois
 * moteurs à compteurs séparés, prix en F CFA, revenu mêlant abonnements et
 * achats ponctuels.
 *
 * **L'encaissement est branché.** `services/payments/payment.service.ts`
 * appelle `purchase()`, `subscribe()` et `applyRenewalPayment()` une fois le
 * paiement confirmé auprès de pawaPay, en passant l'identifiant de la
 * transaction — ce qui rend la livraison traçable et non rejouable (index
 * unique `one_purchase_per_payment`).
 *
 * Les mouvements de crédits sont délégués à `creditLedgerService` : le solde y
 * est tenu par un compteur atomique, seule façon de rendre le débit juste sous
 * concurrence (voir l'en-tête de ce service).
 */

/** Jour UTC `YYYY-MM-DD`. */
function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function addInterval(start: Date, interval: BillingInterval): Date {
  const end = new Date(start);
  if (interval === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else if (interval === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 100);
  return end;
}

export class BillingService {
  // ============================================
  // CATALOGUE
  // ============================================

  /**
   * Amorce le catalogue depuis `DEFAULT_PRODUCTS`.
   *
   * `$setOnInsert` uniquement : un produit déjà en base n'est JAMAIS écrasé.
   * Un prix ajusté en production ne doit pas être réinitialisé à chaque
   * redémarrage.
   */
  async seedProducts(): Promise<{ created: number; existing: number }> {
    let created = 0;

    for (const product of DEFAULT_PRODUCTS) {
      const result = await BillingProduct.updateOne(
        { code: product.code },
        { $setOnInsert: product },
        { upsert: true }
      );
      if (result.upsertedCount > 0) created += 1;
    }

    const existing = DEFAULT_PRODUCTS.length - created;
    logger.info(`Billing catalogue seeded: ${created} created, ${existing} already present`);
    return { created, existing };
  }

  async listProducts(filters: { engine?: BillingEngine; kind?: string; includeInactive?: boolean } = {}): Promise<BillingProductModel[]> {
    const query: Record<string, any> = {};
    if (filters.engine) query.engine = filters.engine;
    if (filters.kind) query.kind = filters.kind;
    if (!filters.includeInactive) query.isActive = true;

    const products = await BillingProduct.find(query).sort({ sortOrder: 1 }).lean();
    return products.map((product: any) => ({ ...product, id: String(product._id) }));
  }

  async getProduct(code: string): Promise<BillingProductModel | null> {
    const product = await BillingProduct.findOne({ code }).lean();
    return product ? ({ ...product, id: String(product._id) } as BillingProductModel) : null;
  }

  /** Prix effectif d'un produit selon la périodicité choisie (remise annuelle incluse). */
  resolvePriceXaf(product: BillingProductModel, interval: BillingInterval): number {
    if (interval === 'year' && product.interval === 'month') {
      return annualPriceXaf(product.priceXaf);
    }
    return product.priceXaf;
  }

  // ============================================
  // ABONNEMENTS
  // ============================================

  /** Abonnement actif d'un utilisateur sur un moteur donné. */
  async getActiveSubscription(
    userId: string,
    engine: BillingEngine
  ): Promise<BillingSubscriptionModel | null> {
    const subscription = await BillingSubscription.findOne({
      userId,
      engine,
      status: { $in: ['active', 'trialing'] },
    }).lean();

    return subscription
      ? ({ ...subscription, id: String(subscription._id) } as BillingSubscriptionModel)
      : null;
  }

  /** Tous les abonnements actifs d'un utilisateur, un par moteur au plus. */
  async getActiveSubscriptions(userId: string): Promise<BillingSubscriptionModel[]> {
    const subscriptions = await BillingSubscription.find({
      userId,
      status: { $in: ['active', 'trialing'] },
    }).lean();

    return subscriptions.map((s: any) => ({ ...s, id: String(s._id) }));
  }

  /**
   * Souscrit un utilisateur à un produit d'abonnement.
   *
   * L'abonnement précédent SUR LE MÊME MOTEUR est annulé d'abord : l'index
   * partiel unique `one_active_subscription_per_user_engine` refuserait deux
   * abonnements actifs simultanés sur un même moteur. Les autres moteurs ne
   * sont pas touchés — être abonné aux trois est un cas normal.
   */
  async subscribe(
    userId: string,
    productCode: string,
    options: {
      interval?: BillingInterval;
      installments?: number;
      provider?: PaymentProvider;
      providerSubscriptionId?: string;
      providerCustomerId?: string;
      priceOverrideXaf?: number;
      startAt?: Date;
      /** Paiement qui ouvre la période — rend la livraison traçable. */
      paymentTransactionId?: string;
      /** Statut initial : `trialing` pour un accès offert (bêta premium). */
      status?: 'active' | 'trialing';
    } = {}
  ): Promise<BillingSubscriptionModel> {
    const product = await this.getProduct(productCode);
    if (!product) throw new Error(`Unknown billing product: ${productCode}`);

    if (product.kind !== 'subscription' && product.kind !== 'bundle' && product.kind !== 'addon') {
      throw new Error(`Product ${productCode} is not subscribable (kind: ${product.kind})`);
    }

    const interval = options.interval ?? (product.interval === 'one_time' ? 'month' : product.interval);
    const installments = options.installments ?? 1;

    if (!ALLOWED_INSTALLMENTS.includes(installments as any)) {
      throw new Error(`Invalid installments: ${installments}. Allowed: ${ALLOWED_INSTALLMENTS.join(', ')}`);
    }
    if (installments > 1 && interval !== 'year') {
      // Le paiement échelonné n'est proposé que sur l'annuel.
      throw new Error('Installments are only available on annual billing');
    }

    const start = options.startAt ?? new Date();
    const priceXaf = options.priceOverrideXaf ?? this.resolvePriceXaf(product, interval);

    /**
     * Un bundle est vendu comme un produit mais vécu comme trois abonnements.
     *
     * L'ancrer sur `business` — ce que faisait le code précédent — donnait à
     * l'acheteur du Launch Pack ses crédits Business et rien d'autre : ni le
     * plan AppGen, ni le plan iDeploy qu'il venait de payer. On ouvre donc une
     * ligne par moteur, reliées par `bundleId`, et le prix reste porté par la
     * première pour que le MRR compte le bundle une seule fois.
     */
    const composition = BUNDLE_COMPOSITION[productCode];

    if (composition) {
      const bundleId = `${productCode}:${Date.now()}`;
      let head: BillingSubscriptionModel | null = null;

      for (const [index, part] of composition.entries()) {
        const partProduct = await this.getProduct(part.productCode);
        if (!partProduct) {
          logger.error(`Bundle ${productCode} references unknown product ${part.productCode}`);
          continue;
        }

        const line = await this.createSubscriptionLine(userId, partProduct, {
          engine: part.engine,
          // Le prix total sur la première ligne, 0 sur les suivantes.
          priceXaf: index === 0 ? priceXaf : 0,
          interval,
          installments,
          start,
          provider: options.provider ?? 'manual',
          providerSubscriptionId: options.providerSubscriptionId,
          providerCustomerId: options.providerCustomerId,
          paymentTransactionId: options.paymentTransactionId,
          status: options.status ?? 'active',
          bundleId,
          // Le palier utilisateur suit le bundle, pas ses composants.
          subscriptionTier: index === 0 ? product.subscriptionTier : undefined,
        });

        if (index === 0) head = line;
      }

      logger.info(`User ${userId} subscribed to bundle ${productCode} (${priceXaf} XAF / ${interval})`);
      if (!head) throw new Error(`Bundle ${productCode} could not be opened`);
      return head;
    }

    const engine: BillingEngine = product.engine ?? 'business';

    const subscription = await this.createSubscriptionLine(userId, product, {
      engine,
      priceXaf,
      interval,
      installments,
      start,
      provider: options.provider ?? 'manual',
      providerSubscriptionId: options.providerSubscriptionId,
      providerCustomerId: options.providerCustomerId,
      paymentTransactionId: options.paymentTransactionId,
      status: options.status ?? 'active',
      subscriptionTier: product.subscriptionTier,
    });

    logger.info(`User ${userId} subscribed to ${productCode} (${priceXaf} XAF / ${interval})`);
    return subscription;
  }

  /**
   * Ouvre une ligne d'abonnement sur un moteur : annule la précédente (l'index
   * unique refuserait deux lignes actives sur le même moteur), crée la
   * nouvelle et accorde ses crédits.
   */
  private async createSubscriptionLine(
    userId: string,
    product: BillingProductModel,
    params: {
      engine: BillingEngine;
      priceXaf: number;
      interval: BillingInterval;
      installments: number;
      start: Date;
      provider: PaymentProvider;
      providerSubscriptionId?: string;
      providerCustomerId?: string;
      paymentTransactionId?: string;
      status: 'active' | 'trialing';
      bundleId?: string;
      subscriptionTier?: BillingProductModel['subscriptionTier'];
    }
  ): Promise<BillingSubscriptionModel> {
    await this.cancelActiveSubscription(userId, params.engine, 'replaced by a new subscription');

    const subscription = await BillingSubscription.create({
      userId,
      engine: params.engine,
      productCode: product.code,
      status: params.status,
      priceXaf: params.priceXaf,
      interval: params.interval,
      installments: params.installments,
      currentPeriodStart: params.start,
      currentPeriodEnd: addInterval(params.start, params.interval),
      consecutivePeriods: 1,
      provider: params.provider,
      providerSubscriptionId: params.providerSubscriptionId,
      providerCustomerId: params.providerCustomerId,
      paymentTransactionId: params.paymentTransactionId,
      bundleId: params.bundleId,
    });

    if (params.subscriptionTier) {
      // Le palier lu par les quotas de l'API suit le produit souscrit.
      await User.updateOne({ uid: userId }, { $set: { subscription: params.subscriptionTier } });
    }

    await this.grantSubscriptionCredits(userId, product, String(subscription._id), 1);

    return { ...subscription.toObject(), id: String(subscription._id) } as BillingSubscriptionModel;
  }

  /**
   * Applique le paiement d'une période à un abonnement existant.
   *
   * Appelée par l'orchestrateur quand un renouvellement (ou une échéance
   * annuelle) est encaissé : la fenêtre glisse, les crédits de la période sont
   * accordés avec le bonus de fidélité, la facture de la période est marquée
   * payée et la tolérance d'impayé est levée.
   */
  async applyRenewalPayment(
    subscriptionId: string,
    paymentTransactionId: string
  ): Promise<BillingSubscriptionModel | null> {
    const subscription = await BillingSubscription.findById(subscriptionId);
    if (!subscription) return null;

    const product = await this.getProduct(subscription.productCode);
    const periodNumber = (subscription.consecutivePeriods ?? 1) + 1;

    // La nouvelle période part de la fin de l'ancienne quand celle-ci n'est pas
    // encore écoulée (paiement anticipé), sinon de maintenant — un abonné qui
    // règle avec trois jours de retard ne perd pas trois jours.
    const now = new Date();
    const nextStart =
      subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;

    await BillingSubscription.updateOne(
      { _id: subscriptionId },
      {
        $set: {
          status: 'active',
          currentPeriodStart: nextStart,
          currentPeriodEnd: addInterval(nextStart, subscription.interval),
          consecutivePeriods: periodNumber,
          paymentTransactionId,
          provider: 'pawapay',
        },
        $unset: { graceEndsAt: '', lastReminderAt: '' },
      }
    );

    if (product) {
      await this.grantSubscriptionCredits(
        subscription.userId,
        product,
        subscriptionId,
        periodNumber
      );
    }

    // La facture de la période écoulée passe à « payée ». `findOneAndUpdate`
    // et non `updateOne` : seule la plus récente des factures ouvertes est
    // réglée par ce paiement, et `updateOne` ne sait pas trier.
    await BillingInvoice.findOneAndUpdate(
      { subscriptionId, status: { $in: ['open', 'draft'] } },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          provider: 'pawapay',
          paymentTransactionId,
        },
      },
      { sort: { issuedAt: -1 } }
    );

    logger.info(`Subscription ${subscriptionId} renewed (period ${periodNumber})`);

    const updated = await BillingSubscription.findById(subscriptionId).lean();
    return updated ? ({ ...updated, id: String(updated._id) } as BillingSubscriptionModel) : null;
  }

  /**
   * Crédite les crédits d'un abonnement, ventilés par moteur.
   *
   * Les bundles alimentent PLUSIEURS compteurs (Launch Pack = 150 Business +
   * 150 AppGen) : leur total affiché ne suffirait pas à créditer correctement,
   * d'où `BUNDLE_CREDIT_SPLIT`.
   */
  private async grantSubscriptionCredits(
    userId: string,
    product: BillingProductModel,
    subscriptionId: string,
    periodNumber: number
  ): Promise<void> {
    const split = BUNDLE_CREDIT_SPLIT[product.code];

    const grants: { engine: BillingEngine; credits: number }[] = split
      ? BILLING_ENGINES.filter((engine) => (split[engine] ?? 0) > 0).map((engine) => ({
          engine,
          credits: split[engine]!,
        }))
      : product.credits > 0 && product.engine
        ? [{ engine: product.engine, credits: product.credits }]
        : [];

    for (const grant of grants) {
      await this.grantCredits(userId, grant.engine, grant.credits, 'plan_grant', {
        subscriptionId,
        note: `${product.name} — période ${periodNumber}`,
        expiresAt: this.rolloverExpiry(),
      });

      // Bonus de fidélité : progressif avec l'ancienneté, plafonné à +30 %.
      const bonusRate = this.loyaltyBonusRate(periodNumber);
      if (bonusRate > 0) {
        const bonus = Math.round(grant.credits * bonusRate);
        if (bonus > 0) {
          await this.grantCredits(userId, grant.engine, bonus, 'loyalty_bonus', {
            subscriptionId,
            note: `Fidélité +${Math.round(bonusRate * 100)} % (${periodNumber} périodes)`,
            expiresAt: this.rolloverExpiry(),
          });
        }
      }
    }
  }

  /**
   * Taux de bonus de fidélité : +5 % par période consécutive au-delà de la
   * première, plafonné à +30 % (« loyalty bonus: up to +30% credits »).
   */
  loyaltyBonusRate(consecutivePeriods: number): number {
    const rate = Math.max(consecutivePeriods - 1, 0) * 0.05;
    return Math.min(rate, MAX_LOYALTY_BONUS_RATE);
  }

  /** Date de péremption des crédits accordés (report de 2 mois). */
  private rolloverExpiry(from = new Date()): Date {
    const expiry = new Date(from);
    expiry.setUTCMonth(expiry.getUTCMonth() + CREDIT_ROLLOVER_MONTHS);
    return expiry;
  }

  /** Annule l'abonnement actif d'un moteur. Idempotent. */
  async cancelActiveSubscription(
    userId: string,
    engine: BillingEngine,
    reason?: string
  ): Promise<boolean> {
    const result = await BillingSubscription.updateOne(
      { userId, engine, status: { $in: ['active', 'trialing'] } },
      { $set: { status: 'canceled', canceledAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
      logger.info(
        `Canceled ${engine} subscription for ${userId}${reason ? ` (${reason})` : ''}`
      );
      return true;
    }
    return false;
  }

  /**
   * Renouvelle les abonnements échus : facture la période écoulée, fait glisser
   * la fenêtre, recrédite (avec bonus de fidélité) et périme les crédits
   * reportés au-delà de 2 mois.
   *
   * Idempotent grâce à `one_invoice_per_subscription_period` — un rejeu ne
   * double-facture pas.
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
        const product = await this.getProduct(subscription.productCode);

        await this.issueInvoice({
          userId: subscription.userId,
          subscriptionId: String(subscription._id),
          productCode: subscription.productCode,
          kind: product?.kind ?? 'subscription',
          engine: subscription.engine,
          amountXaf: subscription.priceXaf,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          provider: subscription.provider,
        });

        const nextStart = subscription.currentPeriodEnd;
        const periodNumber = (subscription.consecutivePeriods ?? 1) + 1;

        await BillingSubscription.updateOne(
          { _id: subscription._id },
          {
            $set: {
              currentPeriodStart: nextStart,
              currentPeriodEnd: addInterval(nextStart, subscription.interval),
              consecutivePeriods: periodNumber,
            },
          }
        );

        if (product) {
          await this.grantSubscriptionCredits(
            subscription.userId,
            product,
            String(subscription._id),
            periodNumber
          );
        }

        renewed += 1;
      } catch (error: any) {
        // Un abonnement en échec ne bloque pas les suivants.
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
  // ACHATS PONCTUELS
  // ============================================

  /**
   * Enregistre un achat unique (pack, recharge, Project Pass, passe, option) :
   * crée l'achat, crédite le moteur concerné et émet la facture.
   *
   * `engine` doit être fourni pour une recharge, dont le produit ne porte pas
   * de moteur (la même recharge alimente l'un ou l'autre compteur, au choix de
   * l'acheteur).
   */
  async purchase(
    userId: string,
    productCode: string,
    options: {
      engine?: BillingEngine;
      projectId?: string;
      provider?: PaymentProvider;
      providerPaymentId?: string;
      priceOverrideXaf?: number;
      /** Paiement à l'origine de l'achat — index unique : une livraison par paiement. */
      paymentTransactionId?: string;
    } = {}
  ): Promise<BillingPurchaseModel> {
    const product = await this.getProduct(productCode);
    if (!product) throw new Error(`Unknown billing product: ${productCode}`);

    const engine = product.engine ?? options.engine ?? null;
    if (product.credits > 0 && !engine) {
      throw new Error(
        `Product ${productCode} grants credits but no engine was specified — a recharge must target a meter`
      );
    }

    if (product.kind === 'project_pass' && !options.projectId) {
      throw new Error('A Project Pass requires a projectId');
    }

    const priceXaf = options.priceOverrideXaf ?? product.priceXaf;
    const now = new Date();

    const expiresAt = product.validityHours
      ? new Date(now.getTime() + product.validityHours * 3600_000)
      : undefined;

    const purchase = await BillingPurchase.create({
      userId,
      productCode,
      kind: product.kind,
      engine,
      priceXaf,
      creditsGranted: product.credits,
      projectId: options.projectId,
      expiresAt,
      provider: options.provider ?? 'manual',
      providerPaymentId: options.providerPaymentId,
      paymentTransactionId: options.paymentTransactionId,
      day: dayKey(now),
    });

    if (product.credits > 0 && engine) {
      const reason: CreditEntryReason =
        product.kind === 'recharge'
          ? 'recharge'
          : product.kind === 'pack'
            ? 'pack_grant'
            : 'pass_grant';

      await this.grantCredits(userId, engine, product.credits, reason, {
        purchaseId: String(purchase._id),
        note: product.name,
        // Un passe à durée limitée périme avec lui ; sinon report standard.
        expiresAt: expiresAt ?? this.rolloverExpiry(now),
      });
    }

    await this.issueInvoice({
      userId,
      purchaseId: String(purchase._id),
      productCode,
      kind: product.kind,
      engine,
      amountXaf: priceXaf,
      provider: options.provider ?? 'manual',
      paymentTransactionId: options.paymentTransactionId,
      // Un achat encaissé produit une facture déjà payée : elle ne passe pas
      // par l'état « à payer », qui n'aurait duré que le temps d'un aller-retour.
      status: options.paymentTransactionId ? 'paid' : undefined,
    });

    logger.info(`User ${userId} purchased ${productCode} (${priceXaf} XAF)`);
    return { ...purchase.toObject(), id: String(purchase._id) } as BillingPurchaseModel;
  }

  /** Vrai si l'utilisateur a débloqué ce projet AppGen (Project Pass acheté). */
  async hasProjectPass(userId: string, projectId: string): Promise<boolean> {
    const pass = await BillingPurchase.findOne({ userId, projectId, kind: 'project_pass' }).lean();
    return !!pass;
  }

  /** Passes à durée limitée encore valides. */
  async getActivePasses(userId: string): Promise<BillingPurchaseModel[]> {
    const passes = await BillingPurchase.find({
      userId,
      kind: 'day_pass',
      expiresAt: { $gt: new Date() },
    }).lean();

    return passes.map((p: any) => ({ ...p, id: String(p._id) }));
  }

  /** Facture une consommation hors forfait (bande passante, déploiement). */
  async chargeOverage(
    userId: string,
    kind: OverageKind,
    quantity: number,
    options: { provider?: PaymentProvider } = {}
  ): Promise<BillingInvoiceModel | null> {
    if (quantity <= 0) return null;

    const amountXaf = Math.round(OVERAGE_RATES[kind] * quantity);

    return this.issueInvoice({
      userId,
      productCode: `overage-${kind}`,
      kind: 'overage',
      engine: 'ideploy',
      amountXaf,
      provider: options.provider ?? 'manual',
    });
  }

  // ============================================
  // FACTURES
  // ============================================

  /**
   * Émet une facture. Le doublon (même abonnement, même période) est absorbé
   * silencieusement : l'index unique fait foi, et un rejeu de la tâche de
   * renouvellement ne doit pas être une erreur.
   */
  async issueInvoice(params: {
    userId: string;
    subscriptionId?: string;
    purchaseId?: string;
    productCode: string;
    kind: BillingInvoiceModel['kind'];
    engine: BillingEngine | null;
    /** Montant en XAF — devise de référence. */
    amountXaf: number;
    periodStart?: Date;
    periodEnd?: Date;
    provider?: PaymentProvider;
    status?: BillingInvoiceModel['status'];
    paymentTransactionId?: string;
  }): Promise<BillingInvoiceModel | null> {
    const issuedAt = new Date();
    const xafPerUsd = getXafPerUsd();

    try {
      const invoice = await BillingInvoice.create({
        userId: params.userId,
        subscriptionId: params.subscriptionId,
        purchaseId: params.purchaseId,
        productCode: params.productCode,
        kind: params.kind,
        engine: params.engine,
        number: await this.nextInvoiceNumber(issuedAt),
        status: params.status ?? 'open',
        amountXaf: params.amountXaf,
        // Converti à l'émission et figé : le taux bouge, et une facture émise
        // ne doit pas voir son équivalent USD changer rétroactivement.
        amountUsd: xafToUsd(params.amountXaf),
        xafPerUsd,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        day: dayKey(issuedAt),
        issuedAt,
        paidAt: params.status === 'paid' ? issuedAt : undefined,
        provider: params.provider ?? 'manual',
        paymentTransactionId: params.paymentTransactionId,
      });

      logger.info(`Invoice ${invoice.number} issued for ${params.userId}: ${params.amountXaf} XAF`);
      return { ...invoice.toObject(), id: String(invoice._id) } as BillingInvoiceModel;
    } catch (error: any) {
      if (error?.code === 11000) {
        logger.info(
          `Invoice already exists for subscription ${params.subscriptionId} period ${params.periodStart?.toISOString()} — skipping`
        );
        return null;
      }
      throw error;
    }
  }

  /**
   * Numéro séquentiel par mois (`INV-2026-08-000123`), issu d'un compteur
   * atomique. Un `countDocuments` donnerait le même numéro à deux émissions
   * concurrentes, dont la seconde échouerait sur l'index unique.
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

  /**
   * Factures d'un utilisateur, de la plus récente à la plus ancienne.
   *
   * Les brouillons sont écartés : une facture `draft` est un état interne de
   * l'émission, pas un document que le client doit voir apparaître puis
   * disparaître de son historique.
   */
  async listInvoices(userId: string, limit = 100): Promise<BillingInvoiceModel[]> {
    const invoices = await BillingInvoice.find({ userId, status: { $ne: 'draft' } })
      .sort({ issuedAt: -1 })
      .limit(limit)
      .lean();

    return invoices.map((invoice: any) => ({ ...invoice, id: String(invoice._id) }));
  }

  /** Marque une facture payée. Point d'entrée du futur webhook Mobile Money. */
  async markInvoicePaid(
    invoiceId: string,
    options: { paidAt?: Date; providerInvoiceId?: string; provider?: PaymentProvider } = {}
  ): Promise<boolean> {
    const result = await BillingInvoice.updateOne(
      { _id: invoiceId, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          paidAt: options.paidAt ?? new Date(),
          ...(options.providerInvoiceId ? { providerInvoiceId: options.providerInvoiceId } : {}),
          ...(options.provider ? { provider: options.provider } : {}),
        },
      }
    );

    return result.modifiedCount > 0;
  }

  // ============================================
  // CRÉDITS (compteurs séparés par moteur)
  // ============================================

  /**
   * Les mouvements de crédits passent tous par `creditLedgerService`.
   *
   * Ces méthodes restent ici pour les appelants historiques, mais elles ne
   * font que déléguer : le solde vit désormais dans `credit_balances`, où un
   * `$inc` conditionnel garantit qu'un débit concurrent ne peut pas être
   * offert. Le grand livre reste l'historique.
   */
  async getCreditBalance(userId: string, engine: BillingEngine): Promise<number> {
    return creditLedgerService.getBalance(userId, engine);
  }

  /** Soldes des trois compteurs. */
  async getAllCreditBalances(userId: string): Promise<Record<BillingEngine, number>> {
    return creditLedgerService.getAllBalances(userId);
  }

  async grantCredits(
    userId: string,
    engine: BillingEngine,
    amount: number,
    reason: CreditEntryReason,
    options: {
      subscriptionId?: string;
      purchaseId?: string;
      note?: string;
      expiresAt?: Date;
    } = {}
  ): Promise<number> {
    return creditLedgerService.grant(userId, engine, amount, reason, options);
  }

  /**
   * Débite le compteur d'un moteur pour un livrable.
   *
   * Renvoie `{ allowed: false }` sans rien écrire quand le solde est
   * insuffisant : c'est à l'appelant de refuser la génération. Le contrôle de
   * solde et le débit ne forment qu'une seule opération atomique, donc deux
   * générations lancées simultanément sont facturées deux fois — ce qui
   * n'était pas le cas avant.
   */
  async debitCredits(
    userId: string,
    engine: BillingEngine,
    action: string,
    cost: number,
    context: {
      projectId?: string;
      feature?: string;
      element?: string;
      aiUsageEventId?: string;
    } = {}
  ): Promise<{ allowed: boolean; cost: number; balance: number; ledgerEntryId?: string }> {
    return creditLedgerService.debit(userId, engine, cost, { action, ...context });
  }

  /** Débit d'un livrable Business, au barème de la page publique. */
  async debitBusinessAction(
    userId: string,
    action: keyof typeof BUSINESS_CREDIT_COSTS,
    context: { projectId?: string; feature?: string; element?: string; aiUsageEventId?: string } = {}
  ): Promise<{ allowed: boolean; cost: number; balance: number; ledgerEntryId?: string }> {
    return this.debitCredits(userId, 'business', action, BUSINESS_CREDIT_COSTS[action], context);
  }

  /** Relevé de crédits d'un moteur, le plus récent d'abord. */
  async getCreditStatement(
    userId: string,
    engine?: BillingEngine,
    limit = 100
  ): Promise<Record<string, unknown>[]> {
    return creditLedgerService.getStatement(userId, engine, limit);
  }
}

export const billingService = new BillingService();
export default billingService;
