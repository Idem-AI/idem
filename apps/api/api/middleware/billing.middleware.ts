import { NextFunction, Response } from 'express';
import logger from '../config/logger';
import { BillingRequestContext, CustomRequest } from '../interfaces/express.interface';
import { BUSINESS_CREDIT_COSTS, BillingEngine } from '../models/billing.model';
import { APPGEN_CREDIT_COSTS } from '../models/plan-limits.model';
import { SimulationOrigin } from '../models/simulation.model';
import { simulationService } from '../services/Simulation/simulation.service';
import { billingService } from '../services/billing.service';
import { paymentService } from '../services/payments/payment.service';
import { billingSettingsService } from '../services/billing/billing-settings.service';
import { creditLedgerService } from '../services/billing/credit-ledger.service';
import { Entitlements, entitlementsService } from '../services/billing/entitlements.service';

/**
 * Application du barème en crédits sur les routes de génération.
 *
 * Trois choix de conception, chacun résolvant un problème concret :
 *
 * **1. On débite AVANT de générer, et on rembourse si ça casse.**
 * L'inverse — générer puis débiter — laisse la porte ouverte aux générations
 * lancées en parallèle par un solde qui ne les couvre pas toutes. Débiter
 * d'abord ferme cette porte ; le remboursement automatique sur réponse en
 * erreur évite de faire payer un livrable jamais reçu.
 *
 * **2. Trois degrés d'application, réglables sans redéploiement.**
 * Brancher le barème d'un coup sur des comptes habitués à 50 générations
 * quotidiennes bloquerait des utilisateurs en production sans qu'on ait la
 * moindre mesure. En mode `log`, chaque refus qui aurait eu lieu est journalisé
 * et compté, sans rien bloquer : on lit les chiffres, puis on passe à
 * `enforce`.
 *
 * **3. Un refus explique quoi faire.**
 * Le 402 porte le coût, le solde et les offres qui débloqueraient l'action —
 * de quoi ouvrir directement la bonne page de paiement, plutôt qu'un message
 * d'erreur qui laisse l'utilisateur chercher.
 */

/** Barèmes par moteur, réunis pour que l'appelant ne cite qu'une action. */
const CREDIT_COSTS: Record<string, Record<string, number>> = {
  business: BUSINESS_CREDIT_COSTS,
  appgen: APPGEN_CREDIT_COSTS,
  ideploy: {},
};

export interface RequireCreditsOptions {
  /** Coût fixe, quand le livrable a un prix unique. */
  cost?: number;
  /**
   * Coût ET libellé calculés à l'exécution, quand le prix dépend de l'état du
   * projet — voir `firstThenRevision`.
   */
  resolve?: (req: CustomRequest) => Promise<{ action: string; cost: number }>;
  /** Exemption conditionnelle, évaluée sur les droits résolus. */
  exempt?: (req: CustomRequest, entitlements: Entitlements) => boolean;
  /**
   * Élément facturé à l'intérieur du projet — l'id de la période, par exemple.
   * Inscrit au relevé, puis relu par `firstThenRevision` pour savoir si CET
   * élément-là a déjà été facturé (et non « un élément de ce projet »).
   */
  element?: (req: CustomRequest) => string | undefined;
}

/**
 * « Plein tarif la première fois, révision ensuite. »
 *
 * Le modèle économique facture des **livrables**, pas des appels au moteur.
 * Générer la charte graphique coûte 60 crédits ; en ajuster les couleurs dix
 * minutes plus tard ne doit pas en coûter 60 de plus, sinon le barème punit
 * l'itération — exactement ce que le produit encourage.
 *
 * Le premier passage sur un projet facture `firstAction` à son prix ; les
 * suivants facturent `repeatAction`, moins cher, et le relevé de l'utilisateur
 * montre la différence.
 */
export function firstThenRevision(
  engine: BillingEngine,
  firstAction: string,
  repeatAction: string,
  /**
   * PORTÉE du « première fois », quand elle est plus fine que le projet.
   *
   * Un livrable dont le projet ne contient qu'un exemplaire (la charte, le
   * business plan) se compte par projet — c'est le défaut. Mais un projet
   * contient autant de PÉRIODES de communication qu'on veut, et chacune est un
   * livrable neuf : sans portée, la deuxième période et les suivantes tombaient
   * au tarif « révision », soit douze mois de planification pour 26 crédits.
   *
   * La valeur renvoyée est inscrite au relevé (`element`) puis relue par
   * `hasChargedAction` — le relevé de l'utilisateur montre donc quelle période
   * a été facturée.
   */
  scope?: (req: CustomRequest) => string | undefined
): (req: CustomRequest) => Promise<{ action: string; cost: number }> {
  return async (req: CustomRequest) => {
    const userId = req.user?.uid;
    const projectId = req.params?.projectId as string | undefined;

    if (!userId || !projectId) {
      return { action: firstAction, cost: creditCost(engine, firstAction) };
    }

    const alreadyCharged = await creditLedgerService.hasChargedAction(
      userId,
      engine,
      firstAction,
      projectId,
      scope?.(req)
    );

    return alreadyCharged
      ? { action: repeatAction, cost: creditCost(engine, repeatAction) }
      : { action: firstAction, cost: creditCost(engine, firstAction) };
  };
}

/** Portée « une période de communication », lue dans l'URL. */
export const planScope = (req: CustomRequest): string | undefined =>
  (req.params?.planId as string | undefined) || undefined;

/**
 * « Inclus la première fois, facturé ensuite. »
 *
 * Pour les étapes qui appartiennent à un livrable déjà payé — les déclinaisons
 * d'un logo font partie des 60 crédits de la charte — mais dont la répétition
 * coûte cher à produire. Le premier passage est inscrit au relevé à zéro
 * crédit (« inclus »), les suivants sont facturés.
 */
export function includedThenRepeat(
  engine: BillingEngine,
  includedAction: string,
  repeatAction: string
): (req: CustomRequest) => Promise<{ action: string; cost: number }> {
  return async (req: CustomRequest) => {
    const userId = req.user?.uid;
    const projectId = req.params?.projectId as string | undefined;

    if (!userId || !projectId) {
      return { action: includedAction, cost: 0 };
    }

    const alreadyUsed = await creditLedgerService.hasChargedAction(
      userId,
      engine,
      includedAction,
      projectId
    );

    return alreadyUsed
      ? { action: repeatAction, cost: creditCost(engine, repeatAction) }
      : { action: includedAction, cost: 0 };
  };
}

/** Coût d'une action, au barème du moteur. */
export function creditCost(engine: BillingEngine, action: string): number {
  const cost = CREDIT_COSTS[engine]?.[action];
  if (cost === undefined) {
    // Une action hors barème coûte le prix d'une révision plutôt que rien :
    // facturer zéro par omission ferait des générations gratuites invisibles.
    logger.warn('billing.unknown_action_cost', {
      event: 'billing.unknown_action_cost',
      engine,
      action,
    });
    return 1;
  }
  return cost;
}

/**
 * Offres qui débloqueraient l'action, de la moins chère à la plus complète.
 *
 * Calculées depuis le catalogue et non codées en dur : un prix ajusté en
 * production doit se refléter dans la proposition faite à l'utilisateur.
 */
async function suggestionsFor(
  engine: BillingEngine,
  missing: number
): Promise<{ productCode: string; name: string; priceXaf: number; credits: number }[]> {
  try {
    const [recharges, plans] = await Promise.all([
      billingService.listProducts({ kind: 'recharge' }),
      billingService.listProducts({ engine, kind: 'subscription' }),
    ]);

    const rechargeOptions = recharges
      .filter((product) => product.credits >= missing)
      .sort((a, b) => a.priceXaf - b.priceXaf)
      .slice(0, 1);

    // Le plan payant le moins cher du moteur : souvent plus avantageux qu'une
    // recharge pour qui revient régulièrement.
    const planOption = plans
      .filter((product) => product.priceXaf > 0 && product.credits >= missing)
      .sort((a, b) => a.priceXaf - b.priceXaf)
      .slice(0, 1);

    return [...rechargeOptions, ...planOption].map((product) => ({
      productCode: product.code,
      name: product.name,
      priceXaf: product.priceXaf,
      credits: product.credits,
    }));
  } catch {
    // Une suggestion manquante ne doit pas transformer un refus propre en 500.
    return [];
  }
}

/**
 * Exige puis réserve les crédits d'une action.
 *
 * À placer après `authenticate` et après les validations d'entrée : inutile de
 * débiter pour une requête qui sera rejetée pour un champ manquant.
 */
export function requireCredits(
  engine: BillingEngine,
  action: string,
  options: RequireCreditsOptions = {}
) {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({
        error: 'authentication_required',
        message: 'Connectez-vous pour utiliser cette fonctionnalité.',
      });
      return;
    }

    try {
      const mode = await billingSettingsService.getEnforcement();
      if (mode === 'off') {
        next();
        return;
      }

      const resolved = options.resolve
        ? await options.resolve(req)
        : { action, cost: options.cost ?? creditCost(engine, action) };

      const chargedAction = resolved.action;
      const cost = Math.max(0, Math.round(resolved.cost));

      // Action incluse dans un livrable déjà payé : rien à débiter, mais on
      // l'inscrit au relevé — sinon l'utilisateur ne verrait pas ce qu'il a
      // obtenu, et l'inclusion se rejouerait indéfiniment.
      if (cost === 0) {
        if (mode === 'enforce') {
          await creditLedgerService.recordIncluded(userId, engine, chargedAction, {
            projectId: (req.params?.projectId as string) ?? undefined,
            feature: engine,
            element: options.element?.(req),
          });
        }
        next();
        return;
      }

      const entitlements = await entitlementsService.resolve(userId);

      if (options.exempt?.(req, entitlements)) {
        next();
        return;
      }

      const balance = entitlements.engines[engine].credits;

      // Mode observation : on mesure ce que l'application coûterait, sans
      // bloquer personne ni toucher aux soldes.
      if (mode === 'log') {
        logger.info('billing.enforcement_shadow', {
          event: 'billing.enforcement_shadow',
          engine,
          action: chargedAction,
          cost,
          balance,
          wouldBlock: balance < cost,
          plan: entitlements.engines[engine].productCode,
        });
        next();
        return;
      }

      const result = await creditLedgerService.debit(userId, engine, cost, {
        action: chargedAction,
        projectId: (req.params?.projectId as string) ?? undefined,
        feature: engine,
        element: options.element?.(req),
      });

      if (!result.allowed) {
        const suggestions = await suggestionsFor(engine, cost - result.balance);

        res.status(402).json({
          error: 'payment_required',
          message:
            engine === 'business'
              ? 'Vos crédits iBusiness ne suffisent pas pour ce livrable.'
              : 'Vos crédits iCode ne suffisent pas pour cette action.',
          engine,
          action: chargedAction,
          cost,
          balance: result.balance,
          missing: cost - result.balance,
          suggestions,
        });
        return;
      }

      const context: BillingRequestContext = {
        engine,
        action: chargedAction,
        cost,
        charged: true,
        balanceAfter: result.balance,
        ledgerEntryId: result.ledgerEntryId,
      };
      req.billing = context;

      // Le solde vient de changer : la prochaine lecture doit le voir.
      await entitlementsService.invalidate(userId);

      /**
       * Contrepassation automatique si la génération échoue.
       *
       * `finish` couvre le cas courant (le contrôleur répond 4xx ou 5xx). Il ne
       * couvre PAS une génération en flux qui commence en 200 puis casse en
       * cours de route : ces routes doivent contrepasser elles-mêmes via
       * `refundRequestCredits(req)`.
       */
      res.on('finish', () => {
        if (res.statusCode < 400 || !req.billing?.charged) return;

        void creditLedgerService
          .refundDebit(userId, engine, cost, {
            action: chargedAction,
            note: `Génération en échec (HTTP ${res.statusCode}) — crédits restitués`,
          })
          .then(() => entitlementsService.invalidate(userId))
          .catch((error: Error) => {
            // Le pire cas : l'utilisateur a payé sans livrable. On le trace
            // fort pour qu'un administrateur puisse régulariser.
            logger.error(`billing.refund_failed: ${error.message}`, {
              event: 'billing.refund_failed',
              userId,
              engine,
              action,
              cost,
            });
          });
      });

      next();
    } catch (error: any) {
      // Une panne du moteur de facturation ne doit pas empêcher de travailler :
      // on laisse passer en le signalant. Perdre quelques crédits vaut mieux
      // que bloquer la plateforme sur une indisponibilité de Redis.
      logger.error(`billing.enforcement_failed: ${error.message}`, {
        event: 'billing.enforcement_failed',
        engine,
        action,
        stack: error.stack,
      });
      next();
    }
  };
}

/**
 * Contrepasse explicitement les crédits réservés pour cette requête.
 *
 * À appeler depuis un contrôleur qui a répondu 200 avant de constater l'échec
 * — typiquement une génération en flux (SSE), où le code HTTP est déjà parti.
 */
export async function refundRequestCredits(req: CustomRequest, reason?: string): Promise<void> {
  const context = req.billing;
  const userId = req.user?.uid;

  if (!context?.charged || !userId) return;

  // Marqué avant l'appel : si `finish` se déclenche entre-temps, il ne
  // remboursera pas une seconde fois.
  req.billing = { ...context, charged: false };

  await creditLedgerService.refundDebit(userId, context.engine, context.cost, {
    action: context.action,
    note: reason ?? 'Génération interrompue — crédits restitués',
  });

  await entitlementsService.invalidate(userId);
}

/**
 * Exige qu'un projet AppGen soit débloqué.
 *
 * Le modèle économique d'iCode tient en une phrase : « générer est gratuit,
 * posséder se paie ». Télécharger le code, l'envoyer sur GitHub ou le déployer
 * sont les actes de possession — ils supposent un Project Pass (999 F) ou un
 * abonnement qui l'inclut.
 *
 * **Le contrôle est ici, pas dans l'interface.** Les boutons grisés côté client
 * sont du confort ; seule cette vérification empêche d'appeler directement
 * l'endpoint. L'identifiant de projet est cherché là où chaque appelant le
 * place — paramètre d'URL, corps, ou en-tête `X-Appgen-Project-Id` — et doit
 * être le MÊME que celui employé à l'achat du pass, sans quoi le pass payé ne
 * débloquerait rien.
 */
export function requireProjectAccess() {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({
        error: 'authentication_required',
        message: 'Connectez-vous pour utiliser cette fonctionnalité.',
      });
      return;
    }

    try {
      const mode = await billingSettingsService.getEnforcement();
      if (mode === 'off') {
        next();
        return;
      }

      const projectId =
        (req.params?.projectId as string) ||
        (req.body?.projectId as string) ||
        (req.headers['x-appgen-project-id'] as string) ||
        (req.body?.draftId as string);

      if (!projectId) {
        // Sans identifiant, la question n'a pas de réponse : bloquer serait
        // arbitraire. On journalise pour que l'appelant fautif se corrige.
        logger.warn('billing.project_access_unknown', {
          event: 'billing.project_access_unknown',
          path: req.originalUrl,
        });
        next();
        return;
      }

      const unlocked = await entitlementsService.hasProjectAccess(userId, projectId);

      if (unlocked) {
        next();
        return;
      }

      if (mode === 'log') {
        logger.info('billing.project_access_shadow', {
          event: 'billing.project_access_shadow',
          projectId,
          wouldBlock: true,
        });
        next();
        return;
      }

      const pass = await billingService.getProduct('appgen-project-pass');

      res.status(402).json({
        error: 'payment_required',
        message:
          'Ce projet n’est pas encore débloqué. Le Project Pass ouvre les modifications, le téléchargement du code, GitHub et le déploiement.',
        engine: 'appgen',
        action: 'project_unlock',
        projectId,
        suggestions: pass
          ? [
              {
                productCode: pass.code,
                name: pass.name,
                priceXaf: pass.priceXaf,
                credits: pass.credits,
              },
            ]
          : [],
      });
    } catch (error: any) {
      logger.error(`billing.project_access_failed: ${error.message}`, {
        event: 'billing.project_access_failed',
      });
      next();
    }
  };
}

/**
 * Exige un paiement pour lancer une simulation.
 *
 * iSimulate est le seul moteur vendu **à l'acte** et non en crédits : une
 * exécution enchaîne six appels LLM, son coût est trop concentré pour tenir
 * dans un forfait mensuel. Un paiement ouvre donc une exécution, et une seule.
 *
 * La réservation est posée ici, avant le lancement, parce que c'est le seul
 * moment où l'on peut encore refuser. Elle laisse un jeton sur la requête que
 * le contrôleur échange contre l'identifiant de l'exécution — ou relâche si
 * celle-ci ne démarre pas.
 */
export function requireSimulationPayment() {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({
        error: 'authentication_required',
        message: 'Connectez-vous pour lancer une simulation.',
      });
      return;
    }

    try {
      const mode = await billingSettingsService.getEnforcement();
      if (mode === 'off') {
        next();
        return;
      }

      const tier = String(req.body?.tier ?? '');
      const entitlements = await entitlementsService.resolve(userId);

      // Bêta premium : la Simulation Approfondie avec rapport est comprise
      // dans l'accès offert pendant la bêta.
      if (entitlements.beta.active) {
        next();
        return;
      }

      const reference = String(req.body?.paymentReference ?? '').trim();

      if (!reference) {
        if (mode === 'log') {
          logger.info('billing.simulation_payment_shadow', {
            event: 'billing.simulation_payment_shadow',
            tier,
            reason: 'missing_reference',
            wouldBlock: true,
          });
          next();
          return;
        }

        res.status(402).json({
          error: 'payment_required',
          message: 'Cette simulation doit être payée avant d’être lancée.',
          engine: 'simulation',
          action: 'simulation_run',
          tier,
          suggestions: await simulationSuggestions(req, tier),
        });
        return;
      }

      const reservation = await paymentService.reserveForSimulation(userId, reference, tier);

      if (!reservation.ok) {
        if (mode === 'log') {
          logger.info('billing.simulation_payment_shadow', {
            event: 'billing.simulation_payment_shadow',
            tier,
            reference,
            reason: reservation.reason,
            wouldBlock: true,
          });
          next();
          return;
        }

        res.status(402).json({
          error: 'payment_required',
          message: SIMULATION_PAYMENT_MESSAGES[reservation.reason ?? 'unknown_payment'],
          engine: 'simulation',
          action: 'simulation_run',
          tier,
          reason: reservation.reason,
          suggestions: await simulationSuggestions(req, tier),
        });
        return;
      }

      req.simulationPayment = { token: reservation.token as string, reference, tier };
      next();
    } catch (error: any) {
      // Même arbitrage qu'ailleurs : une panne de facturation ne bloque pas le
      // travail. Le paiement non consommé reste réutilisable.
      logger.error(`billing.simulation_payment_failed: ${error.message}`, {
        event: 'billing.simulation_payment_failed',
        stack: error.stack,
      });
      next();
    }
  };
}

/** Chaque refus dit à l'utilisateur ce qu'il doit faire, pas seulement que c'est refusé. */
const SIMULATION_PAYMENT_MESSAGES: Record<string, string> = {
  unknown_payment: 'Ce paiement est introuvable. Relancez le règlement pour démarrer la simulation.',
  payment_not_completed:
    'Votre paiement n’est pas encore confirmé. Patientez quelques instants, puis réessayez.',
  payment_already_used:
    'Ce paiement a déjà servi à lancer une simulation. Un nouveau règlement est nécessaire.',
  tier_mismatch: 'Le forfait payé ne correspond pas à celui demandé.',
};

/**
 * L'offre à acheter pour le niveau demandé, lue chez iSimulate.
 *
 * On interroge la tarification plutôt que de tenir ici une seconde table
 * niveau → produit : la correspondance n'existe qu'à un endroit, et le prix
 * proposé tient déjà compte de la remise projet IDEM.
 */
async function simulationSuggestions(
  req: CustomRequest,
  tier: string
): Promise<{ productCode: string; name: string; priceXaf: number; credits: number }[]> {
  try {
    const origin: SimulationOrigin =
      req.body?.origin === 'imported-document' ? 'imported-document' : 'idem-project';
    const pricing = await simulationService.getPricing(origin);
    const plan = pricing.plans.find((candidate) => candidate.tier === tier);
    if (!plan) return [];

    const product = await billingService.getProduct(plan.productCode);

    return [
      {
        productCode: plan.productCode,
        name: product?.name ?? 'Simulation',
        priceXaf: plan.price,
        credits: 0,
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Rattache le paiement réservé à l'exécution qu'il a permis de lancer.
 *
 * À appeler dès que l'exécution a un identifiant : c'est ce qui rend le
 * paiement définitivement consommé et traçable jusqu'à son livrable.
 */
export async function attachSimulationPayment(
  req: CustomRequest,
  simulationId: string
): Promise<void> {
  const reservation = req.simulationPayment;
  if (!reservation) return;

  req.simulationPayment = undefined;

  try {
    await paymentService.attachSimulation(reservation.token, simulationId);
  } catch (error: any) {
    // La simulation tourne déjà : on ne la casse pas pour une écriture de
    // traçabilité. Le jeton restant marque le paiement comme consommé, donc
    // personne n'est lésé — mais un administrateur doit pouvoir le retrouver.
    logger.error(`billing.simulation_attach_failed: ${error.message}`, {
      event: 'billing.simulation_attach_failed',
      reference: reservation.reference,
      simulationId,
    });
  }
}

/** Relâche la réservation quand l'exécution n'a pas démarré : le paiement reste utilisable. */
export async function releaseSimulationPayment(req: CustomRequest): Promise<void> {
  const reservation = req.simulationPayment;
  if (!reservation) return;

  req.simulationPayment = undefined;

  try {
    await paymentService.releaseSimulationReservation(reservation.token);
  } catch (error: any) {
    logger.error(`billing.simulation_release_failed: ${error.message}`, {
      event: 'billing.simulation_release_failed',
      reference: reservation.reference,
    });
  }
}

/**
 * Exige une caractéristique de plan (exports sans filigrane, modèles premium,
 * marque blanche…).
 *
 * `feature` est un chemin dans les droits : `business.unwatermarkedExports`,
 * `appgen.premiumModels`, `business.whiteLabel`.
 */
export function requireFeature(feature: string, message: string) {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;

    if (!userId) {
      res.status(401).json({
        error: 'authentication_required',
        message: 'Connectez-vous pour utiliser cette fonctionnalité.',
      });
      return;
    }

    try {
      const mode = await billingSettingsService.getEnforcement();
      if (mode === 'off') {
        next();
        return;
      }

      const entitlements = await entitlementsService.resolve(userId);
      const [scope, key] = feature.split('.');
      const limits = (entitlements as unknown as Record<string, Record<string, unknown>>)[scope];
      const allowed = Boolean(limits?.[key]);

      if (allowed) {
        next();
        return;
      }

      if (mode === 'log') {
        logger.info('billing.feature_shadow', {
          event: 'billing.feature_shadow',
          feature,
          plan: entitlements.engines[(scope as BillingEngine) ?? 'business']?.productCode,
        });
        next();
        return;
      }

      res.status(402).json({
        error: 'plan_upgrade_required',
        message,
        feature,
        currentPlan: entitlements.engines[(scope as BillingEngine) ?? 'business']?.productCode,
      });
    } catch (error: any) {
      logger.error(`billing.feature_check_failed: ${error.message}`, {
        event: 'billing.feature_check_failed',
        feature,
      });
      next();
    }
  };
}
