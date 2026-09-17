import { Request, Response } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import {
  DEFAULT_COUNTRY,
  explainFailure,
  getCountry,
  normalizePhone,
} from '../models/payment.model';
import { BillingEngine, BillingInterval } from '../models/billing.model';
import { PaymentCallbackRaw } from '../schemas/payment.schema';
import RedisConnection from '../config/redis.config';
import { creditCost } from '../middleware/billing.middleware';
import { billingService } from '../services/billing.service';
import { betaService } from '../services/billing/beta.service';
import { billingSettingsService } from '../services/billing/billing-settings.service';
import { creditLedgerService } from '../services/billing/credit-ledger.service';
import { entitlementsService } from '../services/billing/entitlements.service';
import { ideploySyncService } from '../services/billing/ideploy-sync.service';
import { paymentCountriesService } from '../services/payments/payment-countries.service';
import { paymentEventsService } from '../services/payments/payment-events.service';
import { paymentReconcilerService } from '../services/payments/payment-reconciler.service';
import { PaymentRefusedError, paymentService } from '../services/payments/payment.service';
import { pawapayClient } from '../services/payments/pawapay.client';
import {
  getSignatureMode,
  isCallbackIpAllowed,
  verifyCallbackSignature,
} from '../services/payments/pawapay-signature';

/**
 * Surface HTTP de la facturation côté utilisateur.
 *
 * Deux régimes cohabitent dans ce fichier, et la différence est structurante :
 *
 *  - les routes **authentifiées** servent l'utilisateur connecté ; elles ne
 *    reçoivent jamais de montant, seulement un code produit ;
 *  - le **webhook** n'est pas authentifié (pawaPay ne peut pas porter notre
 *    session) et se protège autrement : liste blanche d'IP, signature, et
 *    surtout relecture du statut avant toute livraison.
 */

/** Réponse normalisée d'une transaction : jamais de numéro en clair. */
function presentTransaction(transaction: any) {
  return {
    reference: transaction.reference,
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currency,
    amountXaf: transaction.amountXaf,
    country: transaction.country,
    provider: transaction.provider,
    phoneMasked: transaction.phoneMasked,
    label: transaction.intent?.label,
    productCode: transaction.intent?.productCode,
    intentType: transaction.intent?.type,
    authorizationUrl: transaction.authorizationUrl,
    providerTransactionId: transaction.providerTransactionId,
    failure: transaction.failureCode
      ? { code: transaction.failureCode, ...explainFailure(transaction.failureCode) }
      : null,
    fulfilled: transaction.fulfillment?.state === 'done',
    createdAt: transaction.createdAt,
    finalizedAt: transaction.finalizedAt,
  };
}

function handleError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof PaymentRefusedError) {
    res.status(error.httpStatus).json({
      error: error.code,
      message: error.message,
      ...(error.details ?? {}),
    });
    return;
  }

  const message = (error as Error)?.message ?? fallback;
  logger.error(`billing.request_failed: ${message}`, {
    event: 'billing.request_failed',
    stack: (error as Error)?.stack,
  });

  res.status(500).json({ error: 'internal_error', message: fallback });
}

export class BillingController {
  // ============================================
  // CATALOGUE ET DROITS
  // ============================================

  /** Catalogue actif, éventuellement filtré par moteur. */
  getCatalog = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const engine = req.query.engine as BillingEngine | undefined;
      const products = await billingService.listProducts(engine ? { engine } : {});

      res.json({
        currency: 'XAF',
        // Seulement les pays où l'on peut réellement encaisser : tarifés ici
        // ET provisionnés sur le compte pawaPay. Proposer un pays qui échoue au
        // moment de payer est la pire façon de l'apprendre.
        countries: await paymentCountriesService.available(),
        products,
      });
    } catch (error) {
      handleError(res, error, 'Impossible de charger le catalogue.');
    }
  };

  /**
   * Ce à quoi l'utilisateur a droit aujourd'hui : abonnements par moteur,
   * soldes de crédits, passes en cours, projets débloqués.
   */
  getMe = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.uid;

      const [subscriptions, balances, passes, settings] = await Promise.all([
        billingService.getActiveSubscriptions(userId),
        creditLedgerService.getAllBalances(userId),
        billingService.getActivePasses(userId),
        billingSettingsService.get(),
      ]);

      res.json({
        credits: balances,
        subscriptions: subscriptions.map((subscription) => ({
          engine: subscription.engine,
          productCode: subscription.productCode,
          status: subscription.status,
          interval: subscription.interval,
          priceXaf: subscription.priceXaf,
          currentPeriodEnd: subscription.currentPeriodEnd,
          graceEndsAt: subscription.graceEndsAt,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
          bundleId: subscription.bundleId,
          // Un accès offert (bêta) ne doit pas être présenté comme un abonnement
          // payant : l'utilisateur doit savoir qu'il a une date de fin.
          complimentary: subscription.provider === 'beta',
        })),
        passes: passes.map((pass) => ({
          productCode: pass.productCode,
          engine: pass.engine,
          expiresAt: pass.expiresAt,
        })),
        beta: {
          windowOpen: await billingSettingsService.isBetaWindowOpen(),
          endsAt: settings.beta.endsAt,
        },
        enforcement: settings.enforcement,
      });
    } catch (error) {
      handleError(res, error, 'Impossible de charger votre offre.');
    }
  };

  /**
   * Moyens de paiement réellement disponibles dans un pays.
   *
   * Vient de `active-conf` : opérateurs ouverts, logos, bornes de montant.
   * L'afficher évite de proposer un opérateur fermé, donc un échec après
   * saisie du code secret.
   */
  getPaymentMethods = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const countryCode = ((req.query.country as string) || DEFAULT_COUNTRY).toUpperCase();
      const country = getCountry(countryCode);

      if (!country) {
        res.status(400).json({
          error: 'country_not_supported',
          message: 'Le paiement n’est pas encore ouvert dans ce pays.',
        });
        return;
      }

      const conf = await pawapayClient.getActiveConfiguration(country.code);
      const countryConf = conf.countries?.find((entry) => entry.country === country.code);

      const providers = (countryConf?.providers ?? []).flatMap((provider) =>
        provider.currencies
          .filter((currency) => currency.currency === country.currency)
          .map((currency) => {
            const deposit = currency.operationTypes?.DEPOSIT;
            return {
              provider: provider.provider,
              displayName: provider.displayName ?? provider.provider,
              logo: provider.logo,
              currency: currency.currency,
              available: deposit?.status === 'OPERATIONAL',
              minAmount: deposit?.minAmount ? Number(deposit.minAmount) : null,
              maxAmount: deposit?.maxAmount ? Number(deposit.maxAmount) : null,
              authType: deposit?.authType,
              pinPrompt: deposit?.pinPrompt,
              pinPromptRevivable: deposit?.pinPromptRevivable ?? false,
              pinPromptInstructions: deposit?.pinPromptInstructions,
            };
          })
      );

      res.json({ country, providers });
    } catch (error) {
      handleError(res, error, 'Impossible de charger les moyens de paiement.');
    }
  };

  /** Devine l'opérateur d'un numéro pendant la saisie. */
  predictProvider = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const { phoneNumber, country } = req.body ?? {};
      if (!phoneNumber) {
        res.status(400).json({ error: 'missing_phone', message: 'Numéro de téléphone requis.' });
        return;
      }

      const countryConf = getCountry(country ?? DEFAULT_COUNTRY);
      const normalized = normalizePhone(String(phoneNumber), countryConf);

      const prediction = await pawapayClient.predictProvider(normalized);
      res.json(prediction);
    } catch (error) {
      // Un numéro non reconnu n'est pas une panne : le front propose alors le
      // choix manuel de l'opérateur.
      res.status(200).json({ provider: null, country: null, phoneNumber: null });
    }
  };

  // ============================================
  // PAIEMENT
  // ============================================

  /** Prix d'une offre avant paiement, dans la devise du pays. */
  getQuote = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const quote = await paymentService.quote({
        productCode: String(req.query.productCode ?? ''),
        interval: req.query.interval as BillingInterval | undefined,
        country: req.query.country as string | undefined,
        engine: req.query.engine as BillingEngine | undefined,
      });

      res.json({
        productCode: quote.product.code,
        label: quote.label,
        amount: quote.amount,
        currency: quote.currency,
        amountXaf: quote.amountXaf,
        country: quote.country,
        credits: quote.product.credits,
      });
    } catch (error) {
      handleError(res, error, 'Impossible de calculer le prix.');
    }
  };

  /** Lance un paiement Mobile Money. */
  checkout = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const { productCode, phoneNumber } = req.body ?? {};

      if (!productCode || !phoneNumber) {
        res.status(400).json({
          error: 'invalid_request',
          message: 'Offre et numéro de téléphone requis.',
        });
        return;
      }

      const transaction = await paymentService.checkout(req.user!.uid, req.user!.email, {
        productCode: String(productCode),
        engine: req.body.engine,
        projectId: req.body.projectId,
        interval: req.body.interval,
        simulationTier: req.body.simulationTier,
        phoneNumber: String(phoneNumber),
        country: req.body.country,
        provider: req.body.provider,
        idempotencyKey: (req.headers['idempotency-key'] as string) || req.body.idempotencyKey,
        client: {
          app: req.body.app,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      res.status(202).json(presentTransaction(transaction));
    } catch (error) {
      handleError(res, error, 'Le paiement n’a pas pu être lancé.');
    }
  };

  /** Statut d'un paiement — interrogé par l'écran d'attente. */
  getPayment = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const transaction = await paymentService.getByReference(
        String(req.params.reference),
        req.user!.uid
      );

      if (!transaction) {
        res.status(404).json({ error: 'not_found', message: 'Paiement introuvable.' });
        return;
      }

      res.json(presentTransaction(transaction));
    } catch (error) {
      handleError(res, error, 'Impossible de lire ce paiement.');
    }
  };

  listPayments = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const transactions = await paymentService.listForUser(req.user!.uid);
      res.json({ payments: transactions.map(presentTransaction) });
    } catch (error) {
      handleError(res, error, 'Impossible de charger vos paiements.');
    }
  };

  /** Relevé de crédits d'un moteur. */
  getCreditStatement = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const engine = req.query.engine as BillingEngine | undefined;
      const entries = await creditLedgerService.getStatement(req.user!.uid, engine, 100);
      res.json({ entries });
    } catch (error) {
      handleError(res, error, 'Impossible de charger votre relevé.');
    }
  };

  // ============================================
  // CONSOMMATION (services internes authentifiés par l'utilisateur)
  // ============================================

  /**
   * Débite une action facturable demandée par un autre service IDEM.
   *
   * AppGen ne génère pas dans l'API principale : son moteur vit dans
   * `we-dev-next`. Ce service ne peut donc pas passer par le middleware
   * `requireCredits`, et il ne doit surtout pas décider seul — sinon le barème
   * existerait en deux exemplaires, et divergerait.
   *
   * Il relaie donc le jeton de l'utilisateur et demande ici l'autorisation. La
   * règle, le prix et le débit restent au même endroit que pour toutes les
   * autres générations.
   *
   * Deux natures d'actions :
   *  - **la génération initiale** est gratuite mais plafonnée (3/jour en
   *    Découverte, illimitée à partir de Starter) — c'est le cœur du modèle
   *    iCode, « générer est gratuit » ;
   *  - **les modifications** consomment des crédits, au barème du moteur.
   */
  consume = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const { engine, action, projectId } = req.body ?? {};

      if (engine !== 'business' && engine !== 'appgen' && engine !== 'ideploy') {
        res.status(400).json({ error: 'invalid_engine', message: 'Moteur inconnu.' });
        return;
      }
      if (!action || typeof action !== 'string') {
        res.status(400).json({ error: 'invalid_action', message: 'Action requise.' });
        return;
      }

      // Le moteur arrive du corps de requête, donc en `any` : on le fige dans
      // une constante typée après validation, sans quoi chaque lecture des
      // droits se ferait sur un index non vérifié.
      const targetEngine: BillingEngine = engine;

      const enforcement = await billingSettingsService.getEnforcement();
      if (enforcement === 'off') {
        res.json({ allowed: true, cost: 0, enforcement });
        return;
      }

      const entitlements = await entitlementsService.resolve(userId);

      // ── Génération initiale : un quota, pas un débit ────────────────────
      if (action === 'initial_generation') {
        const limit = entitlements.appgen.dailyGenerations;

        if (limit === null) {
          res.json({ allowed: true, cost: 0, unlimited: true, enforcement });
          return;
        }

        const used = await this.countDailyGenerations(userId, enforcement === 'enforce');

        if (used > limit) {
          const plans = await billingService.listProducts({ engine: 'appgen', kind: 'subscription' });
          const starter = plans
            .filter((product) => product.priceXaf > 0)
            .sort((a, b) => a.priceXaf - b.priceXaf)[0];

          logger.info('billing.daily_generation_exceeded', {
            event: 'billing.daily_generation_exceeded',
            used,
            limit,
          });

          if (enforcement === 'log') {
            res.json({ allowed: true, cost: 0, wouldBlock: true, enforcement });
            return;
          }

          res.status(402).json({
            error: 'payment_required',
            message: `Vous avez utilisé vos ${limit} générations offertes du jour. Un abonnement iCode les rend illimitées.`,
            engine: 'appgen',
            action,
            used,
            limit,
            suggestions: starter
              ? [
                  {
                    productCode: starter.code,
                    name: starter.name,
                    priceXaf: starter.priceXaf,
                    credits: starter.credits,
                  },
                ]
              : [],
          });
          return;
        }

        res.json({ allowed: true, cost: 0, used, limit, enforcement });
        return;
      }

      // ── Modifications : au barème du moteur ─────────────────────────────
      const cost = creditCost(targetEngine, action);

      if (enforcement === 'log') {
        const balance = entitlements.engines[targetEngine].credits;

        logger.info('billing.enforcement_shadow', {
          event: 'billing.enforcement_shadow',
          engine: targetEngine,
          action,
          cost,
          balance,
          wouldBlock: balance < cost,
          source: 'consume',
        });
        res.json({ allowed: true, cost, enforcement, wouldBlock: true });
        return;
      }

      const result = await creditLedgerService.debit(userId, targetEngine, cost, {
        action,
        projectId,
        feature: engine,
      });

      await entitlementsService.invalidate(userId);

      if (!result.allowed) {
        const recharges = await billingService.listProducts({ kind: 'recharge' });
        const suggestion = recharges
          .filter((product) => product.credits >= cost - result.balance)
          .sort((a, b) => a.priceXaf - b.priceXaf)[0];

        res.status(402).json({
          error: 'payment_required',
          message: 'Vos crédits iCode ne suffisent pas pour cette action.',
          engine,
          action,
          cost,
          balance: result.balance,
          missing: cost - result.balance,
          suggestions: suggestion
            ? [
                {
                  productCode: suggestion.code,
                  name: suggestion.name,
                  priceXaf: suggestion.priceXaf,
                  credits: suggestion.credits,
                },
              ]
            : [],
        });
        return;
      }

      res.json({ allowed: true, cost, balance: result.balance, enforcement });
    } catch (error) {
      handleError(res, error, 'Contrôle des crédits impossible.');
    }
  };

  /**
   * Générations initiales consommées aujourd'hui.
   *
   * Compteur Redis avec expiration : la donnée ne vaut rien passé minuit, et
   * la garder en base ajouterait une collection pour un usage éphémère.
   *
   * Redis indisponible ⇒ on renvoie 0, donc on autorise. Un quota gratuit
   * n'est pas un contrôle de sécurité : mieux vaut offrir une génération de
   * trop que bloquer un utilisateur parce qu'un cache est tombé.
   */
  private async countDailyGenerations(userId: string, increment: boolean): Promise<number> {
    try {
      const redis = RedisConnection.getInstance();
      const key = `appgen:generations:${userId}:${new Date().toISOString().slice(0, 10)}`;

      if (!increment) {
        const current = await redis.get(key);
        return Number(current ?? 0) + 1;
      }

      const used = await redis.incr(key);
      // Première génération du jour : on pose l'expiration.
      if (used === 1) await redis.expire(key, 24 * 3600);
      return used;
    } catch {
      return 0;
    }
  }

  // ============================================
  // WEBHOOK
  // ============================================

  /**
   * Callback de dépôt pawaPay.
   *
   * Trois règles tiennent cet endpoint :
   *
   *  1. **Persister d'abord.** Le corps brut est écrit en base avant toute
   *     interprétation — un incident de traitement reste rejouable.
   *  2. **Répondre 200 vite.** pawaPay ne réessaie que 15 minutes ; un
   *     traitement lent transformerait une livraison en échec de callback.
   *     L'interprétation part donc en tâche de fond.
   *  3. **Ne rien croire.** Le corps sert à identifier la transaction, pas à
   *     décider : le statut est relu auprès de pawaPay.
   */
  depositCallback = async (req: Request, res: Response): Promise<void> => {
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const ip = req.ip;
    const ipAllowed = isCallbackIpAllowed(ip);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key.toLowerCase()] = value;
    }

    const signature = await verifyCallbackSignature({
      method: req.method,
      authority: String(req.headers.host ?? ''),
      path: req.originalUrl.split('?')[0],
      headers,
      rawBody,
    });

    const record = await PaymentCallbackRaw.create({
      kind: 'deposit',
      depositId: req.body?.depositId,
      body: req.body,
      // Les en-têtes de signature suffisent au diagnostic ; inutile de stocker
      // tout ce que le proxy a ajouté.
      headers: {
        'content-digest': headers['content-digest'],
        'signature-input': headers['signature-input'],
        'signature-date': headers['signature-date'],
        'user-agent': headers['user-agent'],
      },
      ip,
      signature: {
        mode: getSignatureMode(),
        verdict: signature.verdict,
        keyId: signature.keyId,
        error: signature.error,
      },
      ipAllowed,
      receivedAt: new Date(),
    });

    const mode = getSignatureMode();
    const rejected =
      (mode === 'enforce' && signature.verdict !== 'valid' && signature.verdict !== 'skipped') ||
      !ipAllowed;

    if (rejected) {
      paymentEventsService.recordCallback(
        'deposit',
        !ipAllowed ? 'ip_rejected' : 'signature_invalid'
      );

      logger.warn('payment.callback_rejected', {
        event: 'payment.callback_rejected',
        depositId: req.body?.depositId,
        ip,
        ipAllowed,
        verdict: signature.verdict,
        error: signature.error,
      });

      await PaymentCallbackRaw.updateOne(
        { _id: record._id },
        { $set: { processedAt: new Date(), processingError: signature.error ?? 'IP non autorisée' } }
      );

      res.status(403).json({ error: 'rejected' });
      return;
    }

    if (mode === 'log' && signature.verdict === 'invalid') {
      // Mode d'observation : on note sans bloquer, parce que la relecture du
      // statut protège déjà la livraison.
      logger.warn('payment.callback_signature_invalid', {
        event: 'payment.callback_signature_invalid',
        depositId: req.body?.depositId,
        error: signature.error,
      });
    }

    res.status(200).json({ received: true });

    void paymentService
      .handleDepositCallback(String(record._id), req.body ?? {})
      .catch((error: Error) => {
        logger.error(`payment.callback_processing_failed: ${error.message}`, {
          event: 'payment.callback_processing_failed',
          depositId: req.body?.depositId,
          stack: error.stack,
        });
        return PaymentCallbackRaw.updateOne(
          { _id: record._id },
          { $set: { processedAt: new Date(), processingError: error.message } }
        );
      });
  };

  // ============================================
  // ENDPOINTS INTERNES (panel admin)
  // ============================================

  /** Relance la vérification du statut d'un paiement. */
  internalRecheck = async (req: Request, res: Response): Promise<void> => {
    try {
      await paymentReconcilerService.forceRecheck(String(req.params.reference));
      const transaction = await paymentService.getByReference(String(req.params.reference));
      res.json(transaction ? presentTransaction(transaction) : {});
    } catch (error) {
      handleError(res, error, 'Vérification impossible.');
    }
  };

  /**
   * File de propagation vers iDeploy.
   *
   * Le retard de la file est rendu avec la liste : un plan payé qui n'arrive
   * pas dans iDeploy est invisible partout ailleurs, et c'est le client qui
   * s'en aperçoit en premier si personne ne regarde ici.
   */
  internalSyncJobs = async (req: Request, res: Response): Promise<void> => {
    try {
      const [jobs, backlog] = await Promise.all([
        ideploySyncService.list({
          status: req.query.status ? String(req.query.status) : undefined,
          userId: req.query.userId ? String(req.query.userId) : undefined,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
        }),
        ideploySyncService.backlog(),
      ]);

      res.json({ jobs, backlog });
    } catch (error) {
      handleError(res, error, 'Lecture de la file de synchronisation impossible.');
    }
  };

  /**
   * Rejoue une propagation abandonnée.
   *
   * Cas courant : le client a payé iDeploy avant d'avoir ouvert son espace de
   * déploiement, et aucune équipe ne correspondait à son adresse. Une fois le
   * compte créé, on rejoue au lieu de refaire payer.
   */
  internalSyncJobRetry = async (req: Request, res: Response): Promise<void> => {
    try {
      const requeued = await ideploySyncService.retry(String(req.params.jobId));

      if (!requeued) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      res.json({ requeued: true });
    } catch (error) {
      handleError(res, error, 'Rejeu impossible.');
    }
  };

  /** Redemande à pawaPay l'envoi du callback. */
  internalResendCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const transaction = await paymentService.getByReference(String(req.params.reference));
      if (!transaction) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      await pawapayClient.resendDepositCallback(transaction.depositId);
      res.json({ requested: true });
    } catch (error) {
      handleError(res, error, 'Renvoi du callback impossible.');
    }
  };

  /** Rejoue la livraison d'un paiement encaissé. */
  internalFulfill = async (req: Request, res: Response): Promise<void> => {
    try {
      const transaction = await paymentService.getByReference(String(req.params.reference));
      if (!transaction) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      await paymentService.fulfill(transaction.id!);
      const updated = await paymentService.getByReference(String(req.params.reference));
      res.json(updated ? presentTransaction(updated) : {});
    } catch (error) {
      handleError(res, error, 'Livraison impossible.');
    }
  };

  /** Rembourse un paiement. Motif obligatoire. */
  internalRefund = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reason, amount, adminId } = req.body ?? {};

      if (!reason) {
        res.status(400).json({ error: 'missing_reason', message: 'Un motif est obligatoire.' });
        return;
      }

      const transaction = await paymentService.refund(String(req.params.reference), {
        amount,
        adminId,
        reason: String(reason),
      });

      res.json(presentTransaction(transaction));
    } catch (error) {
      handleError(res, error, 'Remboursement impossible.');
    }
  };

  // ============================================
  // BÊTA PREMIUM (panel admin)
  // ============================================

  /**
   * Analyse ou applique un import de liste.
   *
   * `dryRun` par défaut : le panel affiche d'abord ce que contient le fichier
   * — combien d'adresses ont un compte, combien sont en doublon, lesquelles
   * sont invalides — et l'administrateur confirme ensuite.
   */
  internalBetaImport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { rows, dryRun, addedBy } = req.body ?? {};

      if (!Array.isArray(rows)) {
        res.status(400).json({ error: 'invalid_request', message: 'Liste d’adresses attendue.' });
        return;
      }

      if (rows.length > 5000) {
        res.status(413).json({
          error: 'too_many_rows',
          message: 'Importez au maximum 5 000 adresses à la fois.',
        });
        return;
      }

      const report = await betaService.importList(rows, { dryRun: dryRun !== false, addedBy });
      res.json(report);
    } catch (error) {
      handleError(res, error, 'Import impossible.');
    }
  };

  internalBetaList = async (req: Request, res: Response): Promise<void> => {
    try {
      const testers = await betaService.list({
        status: req.query.status as string | undefined,
        search: req.query.search as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ testers });
    } catch (error) {
      handleError(res, error, 'Impossible de charger la liste.');
    }
  };

  internalBetaAdd = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, name, message, addedBy } = req.body ?? {};
      if (!email) {
        res.status(400).json({ error: 'missing_email', message: 'Adresse requise.' });
        return;
      }

      const tester = await betaService.addTester(String(email), { name, message, addedBy });
      res.status(201).json(tester);
    } catch (error) {
      handleError(res, error, 'Ajout impossible.');
    }
  };

  /**
   * Ouvre les droits et envoie l'invitation.
   *
   * Sans `emails`, invite tous ceux dont le compte a été trouvé et qui n'ont
   * pas encore été invités — le geste courant après un import.
   */
  internalBetaInvite = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emails } = req.body ?? {};

      const targets: string[] = Array.isArray(emails)
        ? emails.map(String)
        : (await betaService.list({ status: 'account_found', limit: 500 })).map(
            (tester) => tester.email
          );

      const results = [];
      for (const email of targets) {
        const outcome = await betaService.grantAccess(email);
        results.push({ email, ...outcome });
      }

      res.json({
        invited: results.filter((result) => result.granted).length,
        skipped: results.filter((result) => !result.granted).length,
        results,
      });
    } catch (error) {
      handleError(res, error, 'Invitation impossible.');
    }
  };

  internalBetaRevoke = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, reason, adminId } = req.body ?? {};

      if (!email || !reason) {
        res.status(400).json({
          error: 'invalid_request',
          message: 'Adresse et motif obligatoires.',
        });
        return;
      }

      const revoked = await betaService.revoke(String(email), String(reason), adminId);
      res.json({ revoked });
    } catch (error) {
      handleError(res, error, 'Retrait impossible.');
    }
  };

  // ============================================
  // RÉGLAGES (panel admin)
  // ============================================

  internalGetSettings = async (_req: Request, res: Response): Promise<void> => {
    res.json(await billingSettingsService.get());
  };

  internalUpdateSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const patch = { ...(req.body ?? {}) };
      const updatedBy = patch.updatedBy;
      delete patch.updatedBy;

      // La date de fin arrive en JSON : sans conversion, elle serait comparée
      // comme une chaîne et la bêta ne se fermerait jamais.
      if (patch.beta?.endsAt) patch.beta.endsAt = new Date(patch.beta.endsAt);

      res.json(await billingSettingsService.update(patch, updatedBy));
    } catch (error) {
      handleError(res, error, 'Mise à jour impossible.');
    }
  };

  /** Ajustement manuel de crédits. Motif obligatoire, tracé au grand livre. */
  internalAdjustCredits = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, engine, delta, reason, adminId } = req.body ?? {};

      if (!userId || !engine || typeof delta !== 'number' || !reason) {
        res.status(400).json({
          error: 'invalid_request',
          message: 'userId, engine, delta et reason sont obligatoires.',
        });
        return;
      }

      const balance = await creditLedgerService.adjust(
        String(userId),
        engine as BillingEngine,
        delta,
        String(reason),
        adminId
      );

      await entitlementsService.invalidate(String(userId));
      res.json({ balance });
    } catch (error) {
      handleError(res, error, 'Ajustement impossible.');
    }
  };

  /** Santé de la chaîne d'encaissement, pour le panel admin. */
  internalHealth = async (_req: Request, res: Response): Promise<void> => {
    const configured = pawapayClient.isConfigured();
    const settings = await billingSettingsService.get();

    let wallets: unknown = null;
    let reachable = false;

    if (configured) {
      try {
        wallets = await pawapayClient.getWalletBalances();
        reachable = true;
      } catch {
        reachable = false;
      }
    }

    res.json({
      configured,
      reachable,
      environment: pawapayClient.isProduction() ? 'production' : 'sandbox',
      signatureMode: getSignatureMode(),
      // Par le raccourci, comme `checkout()` : un écran de santé qui afficherait
      // « ouvert » pendant que l'arrêt d'urgence refuse les clients serait pire
      // qu'une absence d'indicateur.
      paymentsEnabled: await billingSettingsService.isPaymentsEnabled(),
      enforcement: settings.enforcement,
      wallets,
    });
  };
}

export const billingController = new BillingController();
export default billingController;
