import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../config/logger';
import {
  BillingEngine,
  BillingInterval,
  BillingProductModel,
  annualPriceXaf,
} from '../../models/billing.model';
import {
  DEFAULT_COUNTRY,
  NOT_FOUND_GRACE_MS,
  POLL_DEADLINE_MS,
  PaymentClientApp,
  PaymentIntent,
  PaymentStatus,
  PaymentTransactionModel,
  buildCustomerMessage,
  convertFromXaf,
  explainFailure,
  formatAmountForPawapay,
  getCountry,
  isFinalPaymentStatus,
  mapPawapayStatus,
  maskPhone,
  nextPollDelayMs,
  normalizePhone,
} from '../../models/payment.model';
import { BillingSubscription } from '../../schemas/billing.schema';
import { PaymentTransaction, PaymentCallbackRaw } from '../../schemas/payment.schema';
import { User } from '../../schemas/user.schema';
import { encryptValue, hashValue } from '../../utils/crypto.util';
import { getTraceContext } from '../../utils/trace.util';
import { billingService } from '../billing.service';
import { billingSettingsService } from '../billing/billing-settings.service';
import { entitlementsService } from '../billing/entitlements.service';
import { ideploySyncService } from '../billing/ideploy-sync.service';
import { transactionalEmailService } from '../email/email.service';
import { firstNameOf } from '../email/email-layout';
import { paymentFailed, paymentReceipt } from '../email/templates';
import { paymentEventsService } from './payment-events.service';
import {
  ActiveConfOperationType,
  DepositStatusData,
  PawapayError,
  pawapayClient,
} from './pawapay.client';

/**
 * Orchestrateur d'encaissement.
 *
 * Il tient la promesse centrale du système : **rien n'est livré sans une
 * confirmation relue auprès de pawaPay, et rien n'est livré deux fois.**
 *
 * L'ordre des opérations n'est pas négociable :
 *
 *   1. persister la transaction (avec son `depositId`) ;
 *   2. seulement ensuite appeler pawaPay ;
 *   3. ne conclure qu'à partir d'un `GET /deposits/{id}` ;
 *   4. livrer sous verrou, une seule fois ;
 *   5. tout tracer, à chaque étape.
 *
 * Les erreurs se répartissent en deux familles, traitées différemment :
 *  - **déterminées** (rejet, échec) : statut final, message clair, fin ;
 *  - **indéterminées** (timeout, 5xx) : aucune conclusion, on programme une
 *    relecture. C'est la famille qui fait perdre de l'argent quand on la
 *    traite comme la première.
 */

/** Au-delà, on cesse de retenter la livraison et on alerte. */
const MAX_FULFILL_ATTEMPTS = 5;

export interface CheckoutInput {
  productCode: string;
  /** Compteur visé — obligatoire pour une recharge, qui ne porte pas de moteur. */
  engine?: BillingEngine;
  projectId?: string;
  interval?: BillingInterval;
  simulationTier?: string;
  /** Numéro tel que saisi : le nettoyage est fait ici. */
  phoneNumber: string;
  country?: string;
  /** Opérateur imposé ; sinon déduit du numéro. */
  provider?: string;
  idempotencyKey?: string;
  client?: { app?: PaymentClientApp; ip?: string; userAgent?: string };
}

export interface QuoteResult {
  product: BillingProductModel;
  amountXaf: number;
  amount: number;
  currency: string;
  country: string;
  label: string;
}

/** Erreur métier destinée à l'utilisateur, avec un code exploitable par le front. */
export class PaymentRefusedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus = 400,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PaymentRefusedError';
  }
}

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export class PaymentService {
  // ============================================
  // DEVIS
  // ============================================

  /**
   * Prix d'un produit, calculé **côté serveur**.
   *
   * Le client n'envoie jamais de montant : il envoie un code produit. C'est la
   * seule protection qui tienne contre un paiement de 1 F pour un plan à
   * 24 999 F.
   */
  async quote(input: {
    productCode: string;
    interval?: BillingInterval;
    country?: string;
    engine?: BillingEngine;
  }): Promise<QuoteResult> {
    const product = await billingService.getProduct(input.productCode);
    if (!product || !product.isActive) {
      throw new PaymentRefusedError('unknown_product', 'Cette offre n’est pas disponible.', 404);
    }

    const country = getCountry(input.country ?? DEFAULT_COUNTRY);
    if (!country) {
      throw new PaymentRefusedError(
        'country_not_supported',
        'Le paiement n’est pas encore ouvert dans ce pays.',
        400
      );
    }

    const settings = await billingSettingsService.get();
    if (settings.enabledCountries.length > 0 && !settings.enabledCountries.includes(country.code)) {
      throw new PaymentRefusedError(
        'country_not_supported',
        'Le paiement n’est pas encore ouvert dans ce pays.',
        400
      );
    }

    const interval = input.interval ?? (product.interval === 'one_time' ? 'one_time' : product.interval);
    const amountXaf =
      interval === 'year' && product.interval === 'month'
        ? annualPriceXaf(product.priceXaf)
        : product.priceXaf;

    if (amountXaf <= 0) {
      throw new PaymentRefusedError(
        'free_product',
        'Cette offre est gratuite : aucun paiement n’est nécessaire.',
        400
      );
    }

    return {
      product,
      amountXaf,
      amount: convertFromXaf(amountXaf, country.currency),
      currency: country.currency,
      country: country.code,
      label: product.name,
    };
  }

  // ============================================
  // LANCEMENT D'UN PAIEMENT
  // ============================================

  async checkout(
    userId: string,
    userEmail: string | undefined,
    input: CheckoutInput
  ): Promise<PaymentTransactionModel> {
    const settings = await billingSettingsService.get();
    if (!settings.paymentsEnabled) {
      throw new PaymentRefusedError(
        'payments_disabled',
        'Les paiements sont momentanément suspendus. Réessayez plus tard.',
        503
      );
    }
    if (!pawapayClient.isConfigured()) {
      throw new PaymentRefusedError(
        'payments_unavailable',
        'Le service de paiement est indisponible.',
        503
      );
    }

    const quote = await this.quote(input);
    const country = getCountry(quote.country)!;

    // Un Project Pass déjà payé ne se revend pas : l'index le refuserait, mais
    // le dire ici évite à l'utilisateur de saisir son code pour rien.
    if (input.projectId && quote.product.kind === 'project_pass') {
      const owned = await billingService.hasProjectPass(userId, input.projectId);
      if (owned) {
        throw new PaymentRefusedError(
          'already_owned',
          'Ce projet est déjà débloqué.',
          409
        );
      }
    }

    const phone = normalizePhone(input.phoneNumber, country);
    const { provider, phoneNumber } = await this.resolveProvider(phone, input.provider, country.code);
    const operation = await this.assertProviderUsable(country.code, provider, quote);

    const intent = this.buildIntent(input, quote);

    const existing = input.idempotencyKey
      ? await PaymentTransaction.findOne({ userId, idempotencyKey: input.idempotencyKey }).lean()
      : null;
    if (existing) {
      // Double-clic ou reprise réseau côté client : on rend la transaction
      // déjà créée plutôt que d'en lancer une seconde.
      return this.toModel(existing);
    }

    const depositId = uuidv4();
    const reference = await this.nextReference();

    let transaction;
    try {
      transaction = await PaymentTransaction.create({
        reference,
        depositId,
        userId,
        userEmail,
        intent,
        amount: quote.amount,
        currency: quote.currency,
        amountXaf: quote.amountXaf,
        country: country.code,
        provider,
        phoneMasked: maskPhone(phoneNumber),
        phoneHash: hashValue(phoneNumber),
        phoneEncrypted: encryptValue(phoneNumber, 'idem-payment-phone'),
        status: 'CREATED',
        fulfillment: { state: 'pending', attempts: 0 },
        polling: { count: 0, nextPollAt: null },
        idempotencyKey: input.idempotencyKey,
        requestId: getTraceContext()?.requestId,
        client: input.client,
        day: dayKey(),
      });
    } catch (error: any) {
      if (error?.code === 11000 && input.idempotencyKey) {
        const concurrent = await PaymentTransaction.findOne({
          userId,
          idempotencyKey: input.idempotencyKey,
        }).lean();
        if (concurrent) return this.toModel(concurrent);
      }
      throw error;
    }

    const transactionId = String(transaction._id);

    await paymentEventsService.record({
      transactionId,
      depositId,
      type: 'created',
      source: 'api',
      message: `Paiement ${reference} créé : ${quote.label} — ${quote.amount} ${quote.currency}`,
      data: { productCode: quote.product.code, amountXaf: quote.amountXaf, provider },
      logFields: { reference, provider, amountXaf: quote.amountXaf },
    });

    paymentEventsService.markInitiated({ provider, country: country.code, intent });

    return this.submitDeposit(transaction, quote, phoneNumber, operation);
  }

  /**
   * Soumet le dépôt à pawaPay et enregistre l'issue.
   *
   * Une erreur indéterminée ne fait PAS échouer l'appel : la transaction reste
   * en `CREATED` avec une relecture programmée, et l'utilisateur voit un écran
   * d'attente. Échouer ici alors que le débit est peut-être parti serait le
   * pire des deux mondes.
   */
  private async submitDeposit(
    transaction: any,
    quote: QuoteResult,
    phoneNumber: string,
    operation: ActiveConfOperationType
  ): Promise<PaymentTransactionModel> {
    const transactionId = String(transaction._id);
    const decimals = operation.decimalsInAmount === 'TWO_PLACES' ? 2 : 0;

    const request = {
      depositId: transaction.depositId,
      amount: formatAmountForPawapay(quote.amount, decimals),
      currency: quote.currency,
      payer: {
        type: 'MMO' as const,
        accountDetails: { phoneNumber, provider: transaction.provider },
      },
      customerMessage: buildCustomerMessage(quote.label),
      clientReferenceId: transaction.reference,
      metadata: [
        { userId: String(transaction.userId) },
        { productCode: quote.product.code },
        { reference: transaction.reference },
      ],
    };

    await paymentEventsService.record({
      transactionId,
      depositId: transaction.depositId,
      type: 'pawapay_request',
      source: 'api',
      message: `Dépôt soumis à pawaPay (${transaction.provider})`,
      data: { amount: request.amount, currency: request.currency, provider: transaction.provider },
      logFields: { reference: transaction.reference },
    });

    try {
      const response = await pawapayClient.initiateDeposit(request);

      if (response.status === 'REJECTED') {
        const code = response.failureReason?.failureCode;
        await this.finalize(transaction, {
          status: 'REJECTED',
          failureCode: code,
          failureMessage: response.failureReason?.failureMessage,
          source: 'api',
        });

        return this.toModel(await PaymentTransaction.findById(transactionId).lean());
      }

      const status = mapPawapayStatus(response.status);

      await PaymentTransaction.updateOne(
        { _id: transactionId },
        {
          $set: {
            status,
            pawapayStatus: response.status,
            'polling.nextPollAt': new Date(Date.now() + nextPollDelayMs(0)),
          },
        }
      );

      await paymentEventsService.record({
        transactionId,
        depositId: transaction.depositId,
        type: 'pawapay_response',
        source: 'api',
        message:
          response.status === 'DUPLICATE_IGNORED'
            ? 'pawaPay connaissait déjà ce dépôt (reprise) — suivi du statut'
            : 'Dépôt accepté : l’abonné doit valider sur son téléphone',
        data: { status: response.status },
        logFields: { reference: transaction.reference, status },
      });
    } catch (error: unknown) {
      await this.handleSubmitError(transaction, error);
    }

    return this.toModel(await PaymentTransaction.findById(transactionId).lean());
  }

  /** Traduit une erreur d'initiation en état de transaction. */
  private async handleSubmitError(transaction: any, error: unknown): Promise<void> {
    const transactionId = String(transaction._id);
    const pawapayError = error instanceof PawapayError ? error : null;

    if (pawapayError && !pawapayError.options.indeterminate) {
      await this.finalize(transaction, {
        status: 'REJECTED',
        failureCode: pawapayError.options.failureCode ?? 'UNKNOWN_ERROR',
        failureMessage: pawapayError.message,
        source: 'api',
      });
      return;
    }

    // Issue inconnue : surtout ne rien conclure. La transaction reste en
    // `CREATED`, le réconciliateur ira demander à pawaPay ce qu'il en est.
    await PaymentTransaction.updateOne(
      { _id: transactionId },
      { $set: { 'polling.nextPollAt': new Date(Date.now() + 15_000) } }
    );

    await paymentEventsService.record({
      transactionId,
      depositId: transaction.depositId,
      type: 'pawapay_error',
      source: 'api',
      level: 'warn',
      message:
        'Réponse de pawaPay non parvenue : issue inconnue, vérification programmée dans 15 s',
      httpStatus: pawapayError?.options.httpStatus,
      durationMs: pawapayError?.options.durationMs,
      data: { error: (error as Error).message },
      logFields: { reference: transaction.reference },
    });
  }

  // ============================================
  // OPÉRATEUR ET DISPONIBILITÉ
  // ============================================

  /**
   * Détermine l'opérateur d'un numéro et sa forme canonique.
   *
   * `predict-provider` est appelé même quand le client propose un opérateur :
   * il renvoie le MSISDN normalisé, que l'API attend, et corrige une saisie
   * approximative. Son indisponibilité ne bloque pas le paiement si le client
   * a précisé l'opérateur.
   */
  private async resolveProvider(
    phone: string,
    requested: string | undefined,
    country: string
  ): Promise<{ provider: string; phoneNumber: string }> {
    try {
      const prediction = await pawapayClient.predictProvider(phone);

      if (prediction.country && prediction.country !== country) {
        throw new PaymentRefusedError(
          'country_mismatch',
          `Ce numéro appartient à un autre pays (${prediction.country}).`,
          400
        );
      }

      return {
        provider: requested || prediction.provider,
        phoneNumber: prediction.phoneNumber || phone,
      };
    } catch (error) {
      if (error instanceof PaymentRefusedError) throw error;

      if (requested) return { provider: requested, phoneNumber: phone };

      throw new PaymentRefusedError(
        'provider_undetermined',
        'Impossible de reconnaître l’opérateur de ce numéro. Choisissez-le manuellement.',
        400
      );
    }
  }

  /**
   * Vérifie auprès de pawaPay que l'opérateur accepte ce paiement maintenant.
   *
   * Contrôler ici plutôt que de laisser le dépôt être rejeté change ce que voit
   * l'utilisateur : « Orange Money est momentanément indisponible » avant de
   * saisir son code, plutôt qu'un échec après l'avoir saisi.
   */
  private async assertProviderUsable(
    country: string,
    provider: string,
    quote: QuoteResult
  ): Promise<ActiveConfOperationType> {
    let operation: ActiveConfOperationType | undefined;

    try {
      const conf = await pawapayClient.getActiveConfiguration(country);
      const countryConf = conf.countries?.find((entry) => entry.country === country);
      const providerConf = countryConf?.providers?.find((entry) => entry.provider === provider);
      const currencyConf = providerConf?.currencies?.find(
        (entry) => entry.currency === quote.currency
      );
      operation = currencyConf?.operationTypes?.DEPOSIT;
    } catch {
      // Configuration inaccessible : on laisse passer plutôt que de bloquer une
      // vente sur une panne d'un point d'accès auxiliaire. pawaPay rejettera
      // proprement si l'opérateur est réellement fermé.
      return {} as ActiveConfOperationType;
    }

    if (!operation) {
      throw new PaymentRefusedError(
        'provider_unavailable',
        'Cet opérateur n’accepte pas ce paiement.',
        400
      );
    }

    if (operation.status && operation.status !== 'OPERATIONAL') {
      throw new PaymentRefusedError(
        'provider_closed',
        'Cet opérateur Mobile Money est momentanément indisponible. Réessayez dans quelques minutes ou choisissez un autre opérateur.',
        503
      );
    }

    const min = operation.minAmount ? Number(operation.minAmount) : undefined;
    const max = operation.maxAmount ? Number(operation.maxAmount) : undefined;

    if ((min !== undefined && quote.amount < min) || (max !== undefined && quote.amount > max)) {
      throw new PaymentRefusedError(
        'amount_out_of_bounds',
        `Cet opérateur n’accepte que les montants entre ${min ?? 0} et ${max ?? '∞'} ${quote.currency}.`,
        400,
        { min, max }
      );
    }

    return operation;
  }

  // ============================================
  // SUIVI DE STATUT
  // ============================================

  /**
   * Relit le statut auprès de pawaPay et applique le résultat.
   *
   * Seul point du système autorisé à faire passer une transaction à
   * `COMPLETED`. Les callbacks ne font que déclencher cet appel.
   */
  async pollTransaction(transactionId: string, source: 'api' | 'reconciler' | 'callback' | 'admin' = 'reconciler'): Promise<PaymentTransactionModel | null> {
    const transaction = await PaymentTransaction.findById(transactionId);
    if (!transaction) return null;
    if (isFinalPaymentStatus(transaction.status as PaymentStatus)) {
      return this.toModel(transaction.toObject());
    }

    const startedAt = Date.now();

    try {
      const response = await pawapayClient.getDeposit(transaction.depositId);
      const durationMs = Date.now() - startedAt;

      if (response.status === 'NOT_FOUND') {
        await this.handleNotFound(transaction, source, durationMs);
        return this.toModel(await PaymentTransaction.findById(transactionId).lean());
      }

      await this.applyStatusData(transaction, response.data!, source, durationMs);
      return this.toModel(await PaymentTransaction.findById(transactionId).lean());
    } catch (error: unknown) {
      const pawapayError = error instanceof PawapayError ? error : null;

      await this.scheduleNextPoll(transaction);
      await paymentEventsService.record({
        transactionId,
        depositId: transaction.depositId,
        type: 'pawapay_error',
        source,
        level: 'warn',
        message: 'Relecture du statut impossible, nouvelle tentative programmée',
        httpStatus: pawapayError?.options.httpStatus,
        data: { error: (error as Error).message },
        logFields: { reference: transaction.reference },
      });

      return this.toModel(transaction.toObject());
    }
  }

  /**
   * Applique le statut renvoyé par pawaPay.
   *
   * Le passage à `COMPLETED` déclenche la livraison ; toute autre issue finale
   * enregistre une explication lisible. Un statut intermédiaire ne fait que
   * décaler la prochaine relecture.
   */
  private async applyStatusData(
    transaction: any,
    data: DepositStatusData,
    source: 'api' | 'reconciler' | 'callback' | 'admin',
    durationMs?: number
  ): Promise<void> {
    const transactionId = String(transaction._id);
    const status = mapPawapayStatus(data.status);
    const changed = status !== transaction.status;

    await paymentEventsService.record({
      transactionId,
      depositId: transaction.depositId,
      type: 'status_polled',
      source,
      message: `Statut pawaPay : ${data.status}`,
      durationMs,
      data: { status: data.status, providerTransactionId: data.providerTransactionId },
      logFields: { reference: transaction.reference, status },
    });

    if (!changed && !isFinalPaymentStatus(status)) {
      await this.scheduleNextPoll(transaction);
      return;
    }

    if (isFinalPaymentStatus(status)) {
      await this.finalize(transaction, {
        status,
        failureCode: data.failureReason?.failureCode,
        failureMessage: data.failureReason?.failureMessage,
        providerTransactionId: data.providerTransactionId,
        source,
      });
      return;
    }

    await PaymentTransaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          status,
          pawapayStatus: data.status,
          ...(data.providerTransactionId
            ? { providerTransactionId: data.providerTransactionId }
            : {}),
        },
      }
    );

    await this.scheduleNextPoll(transaction);

    await paymentEventsService.record({
      transactionId,
      depositId: transaction.depositId,
      type: 'status_changed',
      source,
      message: `Transaction passée à ${status}`,
      logFields: { reference: transaction.reference, status },
    });
  }

  /**
   * `NOT_FOUND` : pawaPay ne connaît pas ce dépôt.
   *
   * Immédiatement après l'initiation, cela veut simplement dire « pas encore
   * propagé ». Passé le délai de grâce, cela veut dire que la demande n'est
   * jamais partie — et là seulement on peut conclure, comme le demande la
   * documentation.
   */
  private async handleNotFound(
    transaction: any,
    source: 'api' | 'reconciler' | 'callback' | 'admin',
    durationMs: number
  ): Promise<void> {
    const createdAt = transaction.createdAt?.getTime() ?? Date.now();
    const age = Date.now() - createdAt;

    if (age < NOT_FOUND_GRACE_MS) {
      await this.scheduleNextPoll(transaction);
      await paymentEventsService.record({
        transactionId: String(transaction._id),
        depositId: transaction.depositId,
        type: 'status_polled',
        source,
        message: 'pawaPay ne connaît pas encore ce dépôt — nouvelle vérification programmée',
        durationMs,
        logFields: { reference: transaction.reference, ageMs: age },
      });
      return;
    }

    await this.finalize(transaction, {
      status: 'NOT_FOUND',
      failureCode: 'UNKNOWN_ERROR',
      failureMessage: 'La demande de paiement n’est jamais parvenue à l’opérateur.',
      source,
    });
  }

  /** Programme la prochaine relecture, ou déclare la transaction expirée. */
  private async scheduleNextPoll(transaction: any): Promise<void> {
    const createdAt = transaction.createdAt?.getTime() ?? Date.now();

    if (Date.now() - createdAt > POLL_DEADLINE_MS) {
      await this.finalize(transaction, {
        status: 'EXPIRED',
        failureMessage: 'Aucune confirmation reçue dans les 24 heures.',
        source: 'reconciler',
      });
      return;
    }

    const count = (transaction.polling?.count ?? 0) + 1;

    await PaymentTransaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          'polling.count': count,
          'polling.lastAt': new Date(),
          'polling.nextPollAt': new Date(Date.now() + nextPollDelayMs(count)),
        },
      }
    );
  }

  /**
   * Fige une transaction dans un statut final.
   *
   * Un `COMPLETED` enchaîne sur la livraison. Les autres statuts traduisent le
   * code d'échec en message utilisable — l'abonné doit lire « solde
   * insuffisant », pas `INSUFFICIENT_BALANCE`.
   */
  private async finalize(
    transaction: any,
    result: {
      status: PaymentStatus;
      failureCode?: string;
      failureMessage?: string;
      providerTransactionId?: string;
      source: 'api' | 'reconciler' | 'callback' | 'admin';
    }
  ): Promise<void> {
    const transactionId = String(transaction._id);
    const explanation = result.status === 'COMPLETED' ? null : explainFailure(result.failureCode);

    // Filtre sur le statut courant : deux chemins (callback et réconciliateur)
    // peuvent finaliser en même temps, un seul doit produire l'effet.
    const updated = await PaymentTransaction.findOneAndUpdate(
      { _id: transactionId, status: { $nin: ['COMPLETED', 'FAILED', 'REJECTED', 'NOT_FOUND', 'EXPIRED'] } },
      {
        $set: {
          status: result.status,
          pawapayStatus: result.status,
          failureCode: result.failureCode,
          failureMessage: explanation?.message ?? result.failureMessage,
          ...(result.providerTransactionId
            ? { providerTransactionId: result.providerTransactionId }
            : {}),
          finalizedAt: new Date(),
          'polling.nextPollAt': null,
        },
      },
      { new: true }
    );

    if (!updated) return; // Déjà finalisée par l'autre chemin.

    const model = this.toModel(updated.toObject());

    await paymentEventsService.record({
      transactionId,
      depositId: transaction.depositId,
      type: 'status_changed',
      source: result.source,
      level: result.status === 'COMPLETED' ? 'info' : 'warn',
      message:
        result.status === 'COMPLETED'
          ? `Paiement encaissé : ${model.amount} ${model.currency}`
          : `Paiement ${result.status.toLowerCase()} — ${explanation?.message ?? 'sans détail'}`,
      data: {
        failureCode: result.failureCode,
        providerFailureMessage: result.failureMessage,
      },
      logFields: {
        reference: model.reference,
        status: result.status,
        failureCode: result.failureCode,
      },
    });

    paymentEventsService.markFinal(model, updated.createdAt ?? new Date());

    if (result.status === 'COMPLETED') {
      await this.fulfill(transactionId);
      return;
    }

    // Un échec silencieux laisserait l'utilisateur devant un écran d'attente
    // qu'il a peut-être déjà quitté : on explique par e-mail ce qui s'est passé.
    void this.sendFailureNotice(model);
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================

  /** Reçu de paiement. N'échoue jamais bruyamment : l'argent est déjà encaissé. */
  private async sendReceipt(transaction: PaymentTransactionModel): Promise<void> {
    try {
      const user = await this.recipientOf(transaction);
      if (!user?.email) return;

      const product = await billingService.getProduct(transaction.intent.productCode);

      const message = paymentReceipt({
        firstName: firstNameOf(user.displayName, user.email),
        reference: transaction.reference,
        label: transaction.intent.label,
        amountXaf: transaction.amountXaf,
        provider: transaction.provider,
        providerTransactionId: transaction.providerTransactionId,
        paidAt: transaction.finalizedAt ?? new Date(),
        credits: product?.credits,
        engine: transaction.intent.engine,
      });

      const result = await transactionalEmailService.send({
        to: user.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        template: 'payment.receipt',
        relatedType: 'payment',
        relatedId: transaction.reference,
        userId: transaction.userId,
      });

      if (result.sent) {
        await paymentEventsService.record({
          transactionId: transaction.id!,
          depositId: transaction.depositId,
          type: 'email_sent',
          source: 'system',
          message: 'Reçu de paiement envoyé',
          logFields: { reference: transaction.reference },
        });
      }
    } catch (error: any) {
      logger.error(`payment.receipt_failed: ${error.message}`, {
        event: 'payment.receipt_failed',
        reference: transaction.reference,
      });
    }
  }

  /** Explication d'un échec, avec un lien pour réessayer. */
  private async sendFailureNotice(transaction: PaymentTransactionModel): Promise<void> {
    try {
      const user = await this.recipientOf(transaction);
      if (!user?.email) return;

      const explanation = explainFailure(transaction.failureCode);
      const dashboard = process.env.IDEM_FRONTEND_URL || 'https://console.idem.africa';

      const message = paymentFailed({
        firstName: firstNameOf(user.displayName, user.email),
        reference: transaction.reference,
        label: transaction.intent.label,
        amountXaf: transaction.amountXaf,
        reason: explanation.message,
        hint: explanation.hint,
        retryUrl: explanation.retryable
          ? `${dashboard}/billing/checkout?product=${encodeURIComponent(transaction.intent.productCode)}`
          : undefined,
      });

      await transactionalEmailService.send({
        to: user.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        template: 'payment.failed',
        relatedType: 'payment',
        relatedId: transaction.reference,
        userId: transaction.userId,
      });
    } catch (error: any) {
      logger.error(`payment.failure_notice_failed: ${error.message}`, {
        event: 'payment.failure_notice_failed',
        reference: transaction.reference,
      });
    }
  }

  /**
   * Destinataire d'un message lié à un paiement.
   *
   * L'adresse figée sur la transaction fait foi : c'est celle du moment de
   * l'achat. Le nom, lui, est relu — il peut avoir été complété depuis.
   */
  private async recipientOf(
    transaction: PaymentTransactionModel
  ): Promise<{ email?: string; displayName?: string } | null> {
    const user = await User.findOne({ uid: transaction.userId })
      .select('email displayName')
      .lean();

    if (!user) return transaction.userEmail ? { email: transaction.userEmail } : null;

    return {
      email: transaction.userEmail ?? user.email,
      displayName: user.displayName,
    };
  }

  // ============================================
  // LIVRAISON
  // ============================================

  /**
   * Livre la contrepartie d'un paiement encaissé.
   *
   * Le verrou est la mise à jour conditionnelle `pending → in_progress` :
   * atomique, donc un seul appelant entre, quel que soit le nombre de callbacks
   * ou de relectures simultanés. En cas d'échec, l'état repasse à `failed` avec
   * le motif, et le réconciliateur réessaiera — un client qui a payé finit
   * toujours par être servi, ou l'incident devient visible.
   */
  async fulfill(transactionId: string): Promise<void> {
    const claimed = await PaymentTransaction.findOneAndUpdate(
      {
        _id: transactionId,
        status: 'COMPLETED',
        'fulfillment.state': { $in: ['pending', 'failed'] },
      },
      { $set: { 'fulfillment.state': 'in_progress' }, $inc: { 'fulfillment.attempts': 1 } },
      { new: true }
    );

    if (!claimed) return;

    const transaction = this.toModel(claimed.toObject());

    await paymentEventsService.record({
      transactionId,
      depositId: transaction.depositId,
      type: 'fulfillment_started',
      source: 'system',
      message: `Livraison de « ${transaction.intent.label} »`,
      logFields: { reference: transaction.reference, intent: transaction.intent.type },
    });

    try {
      const outcome = await this.deliver(transaction);

      await PaymentTransaction.updateOne(
        { _id: transactionId },
        {
          $set: {
            'fulfillment.state': 'done',
            'fulfillment.at': new Date(),
            'fulfillment.error': null,
            ...(outcome.purchaseId ? { 'fulfillment.purchaseId': outcome.purchaseId } : {}),
            ...(outcome.subscriptionId
              ? { 'fulfillment.subscriptionId': outcome.subscriptionId }
              : {}),
            ...(outcome.invoiceId ? { 'fulfillment.invoiceId': outcome.invoiceId } : {}),
          },
        }
      );

      await paymentEventsService.record({
        transactionId,
        depositId: transaction.depositId,
        type: 'fulfilled',
        source: 'system',
        message: outcome.message,
        data: outcome,
        logFields: { reference: transaction.reference },
      });

      // Les droits viennent de changer : la prochaine lecture doit les voir,
      // sinon l'utilisateur revient sur son tableau de bord et n'y trouve pas
      // ce qu'il vient de payer.
      await entitlementsService.invalidate(transaction.userId);

      // iDeploy est dans une autre base : le plan y est propagé par une file
      // qui réessaie, jamais en ligne directe — voir `ideploy-sync.service`.
      await this.syncIDeploy(transaction, outcome.subscriptionId);

      // Le reçu part après la livraison : promettre des crédits avant de les
      // avoir accordés serait le seul ordre vraiment fautif.
      void this.sendReceipt(transaction);
    } catch (error: any) {
      await PaymentTransaction.updateOne(
        { _id: transactionId },
        { $set: { 'fulfillment.state': 'failed', 'fulfillment.error': error.message } }
      );

      paymentEventsService.markFulfillmentFailure(transaction.intent.type);

      await paymentEventsService.record({
        transactionId,
        depositId: transaction.depositId,
        type: 'fulfillment_failed',
        source: 'system',
        level: 'error',
        message: `Livraison en échec : ${error.message}`,
        data: { attempts: (transaction.fulfillment.attempts ?? 0) + 1 },
        logFields: { reference: transaction.reference, intent: transaction.intent.type },
      });
    }
  }

  /** Aiguille vers la contrepartie correspondant à l'intention. */
  /**
   * Inscrit la propagation du plan vers iDeploy, quand le produit le concerne.
   *
   * Ne lève jamais : la livraison est déjà faite et payée. Un échec ici doit
   * laisser une trace à rejouer, pas annuler ce qui a fonctionné.
   */
  private async syncIDeploy(
    transaction: PaymentTransactionModel,
    subscriptionId?: string
  ): Promise<void> {
    try {
      const { productCode } = transaction.intent;
      const plan = ideploySyncService.planForProduct(productCode);
      const deployCredits = ideploySyncService.deployCreditsForProduct(productCode);

      if (!plan && !deployCredits) return;

      // Les deux bases n'ont pas d'identifiant commun : l'e-mail est le seul
      // lien entre un compte IDEM et une équipe iDeploy.
      const user = await User.findOne({ uid: transaction.userId }).lean();
      if (!user?.email) return;

      if (deployCredits) {
        // Un pack de déploiements ne change pas le plan : on écrit celui que
        // le client a déjà, sans quoi l'achat le ferait redescendre.
        const entitlements = await entitlementsService.resolve(transaction.userId);
        const current =
          ideploySyncService.planForProduct(entitlements.engines.ideploy?.productCode) ?? 'hobby';

        await ideploySyncService.enqueueDeployCredits({
          userId: transaction.userId,
          email: user.email,
          plan: current,
          credits: deployCredits,
          reference: transaction.reference,
        });
        return;
      }

      // L'échéance vient de l'abonnement qui vient d'être créé ou renouvelé :
      // c'est elle qui décide de la date à laquelle iDeploy doit couper.
      const subscription = subscriptionId
        ? await BillingSubscription.findById(subscriptionId).lean()
        : null;

      await ideploySyncService.enqueue({
        userId: transaction.userId,
        email: user.email,
        plan: plan as string,
        startedAt: subscription?.currentPeriodStart ?? new Date(),
        expiresAt: subscription?.currentPeriodEnd ?? null,
        reference: transaction.reference,
      });
    } catch (error: any) {
      logger.error(`payment.ideploy_sync_failed: ${error.message}`, {
        event: 'payment.ideploy_sync_failed',
        reference: transaction.reference,
        userId: transaction.userId,
      });
    }
  }

  private async deliver(transaction: PaymentTransactionModel): Promise<{
    message: string;
    purchaseId?: string;
    subscriptionId?: string;
    invoiceId?: string;
  }> {
    const { intent } = transaction;
    const transactionId = transaction.id!;

    switch (intent.type) {
      case 'purchase': {
        const purchase = await billingService.purchase(transaction.userId, intent.productCode, {
          engine: intent.engine ?? undefined,
          projectId: intent.projectId,
          provider: 'pawapay',
          providerPaymentId: transaction.depositId,
          paymentTransactionId: transactionId,
        });
        return { message: `Achat livré : ${intent.label}`, purchaseId: purchase.id };
      }

      case 'subscription': {
        const subscription = await billingService.subscribe(transaction.userId, intent.productCode, {
          interval: intent.interval,
          provider: 'pawapay',
          paymentTransactionId: transactionId,
        });
        return { message: `Abonnement activé : ${intent.label}`, subscriptionId: subscription.id };
      }

      case 'renewal':
      case 'installment': {
        const subscription = await billingService.applyRenewalPayment(
          intent.subscriptionId!,
          transactionId
        );
        return {
          message: `Période renouvelée : ${intent.label}`,
          subscriptionId: subscription?.id,
        };
      }

      case 'simulation': {
        // La simulation n'est pas « livrée » ici : le paiement ouvre un droit
        // que l'utilisateur consomme en lançant son exécution. Le lien se fait
        // par `fulfillment.consumedBySimulationId`, qui empêche de lancer deux
        // simulations avec un seul paiement.
        const invoice = await billingService.issueInvoice({
          userId: transaction.userId,
          productCode: intent.productCode,
          kind: 'pack',
          engine: null,
          amountXaf: transaction.amountXaf,
          provider: 'pawapay',
          status: 'paid',
          paymentTransactionId: transactionId,
        });
        return { message: `Simulation débloquée : ${intent.label}`, invoiceId: invoice?.id };
      }

      default:
        throw new Error(`Intention de paiement inconnue : ${intent.type}`);
    }
  }

  // ============================================
  // CALLBACKS
  // ============================================

  /**
   * Traite un callback de dépôt déjà persisté sous sa forme brute.
   *
   * Le corps du callback n'est jamais cru sur parole : il sert uniquement à
   * savoir QUELLE transaction relire. C'est ce qui rend l'endpoint sûr même
   * avec la signature désactivée, et ce qui absorbe les rejeux — relire deux
   * fois un statut n'a aucun effet de bord.
   */
  async handleDepositCallback(rawId: string, body: Record<string, any>): Promise<void> {
    const depositId = body?.depositId;

    if (!depositId) {
      paymentEventsService.recordCallback('deposit', 'malformed');
      await PaymentCallbackRaw.updateOne(
        { _id: rawId },
        { $set: { processedAt: new Date(), processingError: 'depositId absent' } }
      );
      return;
    }

    const transaction = await PaymentTransaction.findOne({ depositId });

    if (!transaction) {
      // Peut arriver légitimement : callback d'un dépôt créé par un autre
      // environnement pointant sur la même URL. On le garde en base — c'est
      // exactement ce que la trace brute permet de diagnostiquer.
      paymentEventsService.recordCallback('deposit', 'unknown_deposit');
      await PaymentCallbackRaw.updateOne(
        { _id: rawId },
        { $set: { processedAt: new Date(), processingError: 'depositId inconnu' } }
      );
      logger.warn('payment.callback_unknown_deposit', {
        event: 'payment.callback_unknown_deposit',
        depositId,
      });
      return;
    }

    const transactionId = String(transaction._id);

    await paymentEventsService.record({
      transactionId,
      depositId,
      type: 'callback_received',
      source: 'callback',
      message: `Callback reçu (${body.status ?? 'sans statut'}) — relecture du statut`,
      data: { status: body.status, failureReason: body.failureReason },
      logFields: { reference: transaction.reference },
    });

    if (isFinalPaymentStatus(transaction.status as PaymentStatus)) {
      // Rejeu d'un callback déjà traité : on le note et on s'arrête. C'est
      // l'idempotence exigée par pawaPay.
      paymentEventsService.recordCallback('deposit', 'duplicate');
      await PaymentCallbackRaw.updateOne({ _id: rawId }, { $set: { processedAt: new Date() } });

      // Une livraison restée en échec mérite une nouvelle tentative, même sur
      // un callback en double.
      if (transaction.status === 'COMPLETED' && transaction.fulfillment?.state === 'failed') {
        await this.fulfill(transactionId);
      }
      return;
    }

    paymentEventsService.recordCallback('deposit', 'accepted');
    await this.pollTransaction(transactionId, 'callback');
    await PaymentCallbackRaw.updateOne({ _id: rawId }, { $set: { processedAt: new Date() } });
  }

  // ============================================
  // SIMULATION (facturée à l'acte)
  // ============================================

  /**
   * Réserve un paiement pour une exécution de simulation.
   *
   * iSimulate est le seul moteur vendu à l'acte : un paiement ouvre **une**
   * exécution, et une seule. Vérifier puis lancer laisserait une fenêtre où
   * deux requêtes simultanées passeraient toutes deux le contrôle — deux
   * simulations coûteuses pour un seul encaissement.
   *
   * La réservation est donc atomique : la mise à jour ne réussit que si le
   * paiement n'est pas déjà consommé. Elle se fait en deux temps parce que
   * l'identifiant de la simulation n'existe pas encore à cet instant :
   * on pose un jeton, puis on l'échange contre l'identifiant réel — ou on le
   * relâche si le lancement échoue.
   */
  async reserveForSimulation(
    userId: string,
    reference: string,
    tier: string
  ): Promise<{ ok: boolean; token?: string; reason?: string }> {
    const token = `reserved:${uuidv4()}`;

    const reserved = await PaymentTransaction.findOneAndUpdate(
      {
        reference,
        userId,
        status: 'COMPLETED',
        'intent.type': 'simulation',
        'fulfillment.consumedBySimulationId': { $exists: false },
      },
      { $set: { 'fulfillment.consumedBySimulationId': token } },
      { new: true }
    );

    if (!reserved) {
      // On distingue les trois refus possibles : l'utilisateur doit savoir
      // s'il doit payer, attendre, ou nous écrire.
      const existing = await PaymentTransaction.findOne({ reference, userId }).lean();

      if (!existing) return { ok: false, reason: 'unknown_payment' };
      if (existing.status !== 'COMPLETED') return { ok: false, reason: 'payment_not_completed' };
      return { ok: false, reason: 'payment_already_used' };
    }

    // Le niveau payé doit être celui demandé : on ne lance pas un Pack avec le
    // paiement d'un rapport seul.
    if (reserved.intent?.simulationTier && reserved.intent.simulationTier !== tier) {
      await this.releaseSimulationReservation(token);
      return { ok: false, reason: 'tier_mismatch' };
    }

    await paymentEventsService.record({
      transactionId: String(reserved._id),
      depositId: reserved.depositId,
      type: 'admin_action',
      source: 'api',
      message: `Paiement réservé pour une simulation (${tier})`,
      logFields: { reference, tier },
    });

    return { ok: true, token };
  }

  /** Échange le jeton de réservation contre l'identifiant réel de l'exécution. */
  async attachSimulation(token: string, simulationId: string): Promise<void> {
    await PaymentTransaction.updateOne(
      { 'fulfillment.consumedBySimulationId': token },
      { $set: { 'fulfillment.consumedBySimulationId': simulationId } }
    );
  }

  /** Relâche une réservation dont le lancement n'a pas abouti. */
  async releaseSimulationReservation(token: string): Promise<void> {
    await PaymentTransaction.updateOne(
      { 'fulfillment.consumedBySimulationId': token },
      { $unset: { 'fulfillment.consumedBySimulationId': '' } }
    );
  }

  // ============================================
  // REMBOURSEMENT
  // ============================================

  /**
   * Rembourse un paiement encaissé.
   *
   * Réservé à une action d'administration : un remboursement est une décision,
   * pas un bouton libre-service. Le motif et l'auteur sont conservés sur la
   * transaction.
   */
  async refund(
    reference: string,
    options: { amount?: number; adminId?: string; reason: string }
  ): Promise<PaymentTransactionModel> {
    const transaction = await PaymentTransaction.findOne({ reference });
    if (!transaction) throw new PaymentRefusedError('not_found', 'Paiement introuvable.', 404);

    if (transaction.status !== 'COMPLETED') {
      throw new PaymentRefusedError(
        'not_refundable',
        'Seul un paiement encaissé peut être remboursé.',
        409
      );
    }
    if (transaction.refund?.refundId) {
      throw new PaymentRefusedError('already_refunded', 'Ce paiement a déjà été remboursé.', 409);
    }

    const transactionId = String(transaction._id);
    const refundId = uuidv4();
    const amount = options.amount ?? transaction.amount;

    await paymentEventsService.record({
      transactionId,
      depositId: transaction.depositId,
      type: 'refund_requested',
      source: 'admin',
      level: 'warn',
      message: `Remboursement demandé (${amount} ${transaction.currency}) — ${options.reason}`,
      data: { adminId: options.adminId, amount },
      logFields: { reference, adminId: options.adminId },
    });

    const response = await pawapayClient.initiateRefund({
      refundId,
      depositId: transaction.depositId,
      amount: formatAmountForPawapay(amount, transaction.currency === 'XAF' ? 0 : 2),
      currency: transaction.currency,
      clientReferenceId: reference,
    });

    const accepted = response.status !== 'REJECTED';

    await PaymentTransaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          refund: {
            refundId,
            status: response.status,
            amount,
            requestedBy: options.adminId,
            reason: options.reason,
            at: new Date(),
          },
        },
      }
    );

    await paymentEventsService.record({
      transactionId,
      depositId: transaction.depositId,
      type: accepted ? 'refund_completed' : 'refund_failed',
      source: 'admin',
      level: accepted ? 'info' : 'error',
      message: accepted
        ? 'Remboursement accepté par pawaPay'
        : `Remboursement refusé : ${response.failureReason?.failureMessage ?? 'sans détail'}`,
      data: { refundId, status: response.status, failureReason: response.failureReason },
      logFields: { reference },
    });

    return this.toModel(await PaymentTransaction.findById(transactionId).lean());
  }

  // ============================================
  // LECTURE
  // ============================================

  async getByReference(reference: string, userId?: string): Promise<PaymentTransactionModel | null> {
    const filter: Record<string, unknown> = { reference };
    if (userId) filter.userId = userId;

    const transaction = await PaymentTransaction.findOne(filter).lean();
    return transaction ? this.toModel(transaction) : null;
  }

  async listForUser(userId: string, limit = 50): Promise<PaymentTransactionModel[]> {
    const transactions = await PaymentTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .lean();

    return transactions.map((transaction) => this.toModel(transaction));
  }

  // ============================================
  // OUTILS
  // ============================================

  private buildIntent(input: CheckoutInput, quote: QuoteResult): PaymentIntent {
    const kind = quote.product.kind;

    const type: PaymentIntent['type'] = input.simulationTier
      ? 'simulation'
      : kind === 'subscription' || kind === 'bundle' || kind === 'addon'
        ? 'subscription'
        : 'purchase';

    return {
      type,
      productCode: quote.product.code,
      engine: quote.product.engine ?? input.engine ?? null,
      projectId: input.projectId,
      interval: input.interval,
      simulationTier: input.simulationTier,
      label: quote.label,
    };
  }

  /**
   * Référence lisible `PAY-2026-09-000123`.
   *
   * Même compteur atomique que les numéros de facture : un `countDocuments`
   * donnerait la même référence à deux paiements simultanés.
   */
  private async nextReference(at = new Date()): Promise<string> {
    const prefix = `PAY-${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;

    const counter = await mongoose.connection.collection('billing_counters').findOneAndUpdate(
      { _id: prefix as any },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );

    const seq = (counter as any)?.seq ?? (counter as any)?.value?.seq ?? 1;
    return `${prefix}-${String(seq).padStart(6, '0')}`;
  }

  private toModel(document: any): PaymentTransactionModel {
    return { ...document, id: String(document._id) } as PaymentTransactionModel;
  }
}

export const paymentService = new PaymentService();
export default paymentService;
export { MAX_FULFILL_ATTEMPTS };
