import { NextFunction, Response } from 'express';
import logger from '../config/logger';
import { CREDIT_VALUE_XAF, envelopeKey } from '../config/generation-budgets';
import { BillingRequestContext, CustomRequest } from '../interfaces/express.interface';
import { BUSINESS_CREDIT_COSTS, BillingEngine } from '../models/billing.model';
import { CreativityLevel, creativityCost, normalizeCreativity } from '../models/creativity.model';
import {
  COMMUNICATION_PRICES,
  DeliverableKey,
  ICODE,
  KIT_CAP_XAF,
  PASSES,
  SIMULATION_PRICES,
  WALLET_ACCOUNT,
  kitCapKey,
  monthlyCapKey,
  simulationOfferForTier,
  topupFor,
} from '../models/offer.model';
import { APPGEN_CREDIT_COSTS } from '../models/plan-limits.model';
import { quotaGroupOf } from '../models/usage-quota.model';
import { CreditLedgerEntry } from '../schemas/billing.schema';
import { billingSettingsService } from '../services/billing/billing-settings.service';
import { creditLedgerService } from '../services/billing/credit-ledger.service';
import { Entitlements, entitlementsService } from '../services/billing/entitlements.service';
import { ActionPolicy, policyFor, regenerationPriceXaf } from '../services/billing/action-policy';
import { ownershipService } from '../services/billing/ownership.service';
import { passService } from '../services/billing/pass.service';
import { usageQuotaService } from '../services/billing/usage-quota.service';
import { walletService } from '../services/billing/wallet.service';
import type { QuotaReservation } from '../services/billing/usage-counters';
import { QuotaRefusal } from '../models/usage-quota.model';
import { setAiUsageContext } from '../utils/ai-usage-context.util';
import { normalizeScope, videoCost } from '../../../ivision/core/src/video/pricing';
import { openGenerationBudget, releaseQuotaOnFailure, releaseRequestQuota, sendQuotaRefusal } from './usage-quota.middleware';

/**
 * Le modèle économique appliqué aux routes de génération : « Créer, Garder, Faire tourner ».
 *
 * Les routes déclarent toujours leur action au barème historique
 * (`requireCredits('business', 'business_plan', …)`). Ce middleware la traduit
 * (`services/billing/action-policy.ts`) et décide, avant de générer :
 *
 *  - **un livrable du Kit** non possédé se génère en ESQUISSE, gratuitement (petits modèles, sans
 *    recherche web) ; possédé, en version finale — elle a été payée au déblocage ;
 *  - **une retouche** est gratuite sur une esquisse, pendant les 30 jours qui suivent l'achat ou
 *    avec le forfait Croissance ; sinon elle se paie, comptée dans le plafond du mois ;
 *  - **un contenu de communication** se paie à l'unité depuis le portefeuille, et ses achats du
 *    mois sont plafonnés au prix du forfait Croissance, qu'ils accordent en l'atteignant ;
 *  - **une aide IA** est gratuite, bornée par les quotas d'usage.
 *
 * Trois principes hérités restent :
 *  1. **On débite AVANT de générer, et on restitue si ça casse** (réponse ≥ 400, ou
 *     `refundRequestCredits` pour un flux qui casse après le 200).
 *  2. **Trois degrés d'application** (`off`, `log`, `enforce`), réglables sans redéploiement.
 *  3. **Un refus explique quoi faire** : le 402 porte le prix, le solde, ce qui manque et la
 *     recharge qui le couvre.
 */

/** Barèmes historiques par moteur, gardés pour les écrans et l'analyse. */
const CREDIT_COSTS: Record<string, Record<string, number>> = {
  business: BUSINESS_CREDIT_COSTS,
  appgen: APPGEN_CREDIT_COSTS,
  ideploy: {},
};

export interface RequireCreditsOptions {
  /** Coût fixe historique (crédits) — ignoré par le nouveau modèle, gardé pour compatibilité. */
  cost?: number;
  /**
   * Action et coût calculés à l'exécution. Le nouveau modèle en lit l'ACTION (un visuel unique
   * ou un carrousel) et, pour la vidéo, le PRIX — calculé en francs par `video/pricing`.
   */
  resolve?: (req: CustomRequest) => Promise<{ action: string; cost: number; note?: string }>;
  /** Exemption conditionnelle, évaluée sur les droits résolus. */
  exempt?: (req: CustomRequest, entitlements: Entitlements) => boolean;
  /** Élément facturé à l'intérieur du projet (une période de communication, une vidéo…). */
  element?: (req: CustomRequest) => string | undefined;
}

// ============================================
// AIDES HÉRITÉES (barème en crédits)
// ============================================

/**
 * « Plein tarif la première fois, révision ensuite » — conservé pour les routes qui le déclarent.
 * Le nouveau modèle ne lit plus que l'action de base : la première fois et les suivantes sont
 * décidées par la possession du livrable (`ownershipService`).
 */
export function firstThenRevision(
  engine: BillingEngine,
  firstAction: string,
  repeatAction: string,
  scope?: (req: CustomRequest) => string | undefined
): (req: CustomRequest) => Promise<{ action: string; cost: number }> {
  return async (req: CustomRequest) => {
    const userId = req.user?.uid;
    const projectId = req.params?.projectId as string | undefined;
    if (!userId || !projectId) return { action: firstAction, cost: creditCost(engine, firstAction) };
    const alreadyCharged = await creditLedgerService.hasChargedAction(userId, engine, firstAction, projectId, scope?.(req));
    return alreadyCharged
      ? { action: repeatAction, cost: creditCost(engine, repeatAction) }
      : { action: firstAction, cost: creditCost(engine, firstAction) };
  };
}

/** Le cran de créativité d'une requête (corps, puis paramètre d'URL pour les flux SSE en GET). */
export function creativityOf(req: CustomRequest): CreativityLevel {
  return normalizeCreativity((req.body as Record<string, unknown> | undefined)?.creativity ?? (req.query as Record<string, unknown> | undefined)?.creativity);
}

/** Le cran appliqué au barème historique (multiplicateur désormais à 1). */
export function withCreativity(
  engine: BillingEngine,
  action: string,
  resolve?: (req: CustomRequest) => Promise<{ action: string; cost: number }>
): (req: CustomRequest) => Promise<{ action: string; cost: number; note: string }> {
  return async (req: CustomRequest) => {
    const base = resolve ? await resolve(req) : { action, cost: creditCost(engine, action) };
    const level = creativityOf(req);
    return { ...base, cost: creativityCost(base.cost, level), note: `creativity:${level}` };
  };
}

/** Portée « une période de communication », lue dans l'URL. */
export const planScope = (req: CustomRequest): string | undefined => (req.params?.planId as string | undefined) || undefined;

/** « Inclus la première fois, facturé ensuite » — conservé pour compatibilité. */
export function includedThenRepeat(
  engine: BillingEngine,
  includedAction: string,
  repeatAction: string
): (req: CustomRequest) => Promise<{ action: string; cost: number }> {
  return async (req: CustomRequest) => {
    const userId = req.user?.uid;
    const projectId = req.params?.projectId as string | undefined;
    if (!userId || !projectId) return { action: includedAction, cost: 0 };
    const alreadyUsed = await creditLedgerService.hasChargedAction(userId, engine, includedAction, projectId);
    return alreadyUsed ? { action: repeatAction, cost: creditCost(engine, repeatAction) } : { action: includedAction, cost: 0 };
  };
}

/** Coût historique d'une action, en crédits (écrans et analyse). */
export function creditCost(engine: BillingEngine, action: string): number {
  const cost = CREDIT_COSTS[engine]?.[action];
  if (cost === undefined) {
    logger.warn('billing.unknown_action_cost', { event: 'billing.unknown_action_cost', engine, action });
    return 1;
  }
  return cost;
}

// ============================================
// REFUS
// ============================================

/** Le corps d'un refus 402 : prix, solde, manque, et la recharge qui le couvre. */
export async function paymentRequiredBody(input: {
  action: string;
  label: string;
  priceXaf: number;
  balanceXaf: number;
  missingXaf: number;
  engine?: string;
  deliverable?: DeliverableKey;
  projectId?: string;
}) {
  return {
    error: 'payment_required',
    message: `Il vous manque ${input.missingXaf} F pour : ${input.label}.`,
    engine: input.engine ?? 'business',
    action: input.action,
    label: input.label,
    priceXaf: input.priceXaf,
    balanceXaf: input.balanceXaf,
    missingXaf: input.missingXaf,
    /** Recharge suggérée : la plus petite qui couvre le manque. */
    topupXaf: topupFor(input.missingXaf),
    deliverable: input.deliverable,
    projectId: input.projectId,
    // Champs historiques, lus par les anciens écrans.
    cost: input.priceXaf,
    balance: input.balanceXaf,
    missing: input.missingXaf,
    suggestions: [],
  };
}

// ============================================
// DÉCISION
// ============================================

interface Decision {
  /** Ce que la génération sera. */
  mode: 'draft' | 'final' | 'signature' | 'paid' | 'included' | 'free';
  priceXaf: number;
  label: string;
  deliverable?: DeliverableKey;
  /** Plafond du débit et forfait accordé quand il est atteint. */
  cap?: { key: string; capXaf: number; grants?: 'croissance' | 'createur' };
  /** Plans filmés par l'IA payés avec cette génération. */
  aiClips?: number;
}

const DAY_MS = 86_400_000;

/** Un contenu « une fois par projet » (stratégie, calendrier, période) a-t-il déjà été payé ? */
async function paidBefore(userId: string, action: string, projectId?: string, element?: string): Promise<Date | null> {
  if (!projectId) return null;
  const filter: Record<string, unknown> = { userId, action, projectId, reason: 'consumption', delta: { $lte: 0 }, engine: { $in: [WALLET_ACCOUNT, 'business'] } };
  if (element) filter.element = element;
  const entry = await CreditLedgerEntry.findOne(filter).sort({ createdAt: -1 }).select('createdAt').lean();
  return entry ? ((entry as { createdAt?: Date }).createdAt ?? new Date()) : null;
}

async function decide(
  req: CustomRequest,
  policy: ActionPolicy,
  action: string,
  options: RequireCreditsOptions,
  entitlements: Entitlements
): Promise<Decision> {
  const userId = req.user!.uid;
  const projectId = req.params?.projectId as string | undefined;
  const beta = entitlements.beta.active;
  const croissance = entitlements.offer.croissance;

  switch (policy.kind) {
    case 'free':
      return { mode: 'free', priceXaf: 0, label: action };

    case 'deliverable': {
      const unlock = beta ? { tier: 'final' as const, unlockedAt: new Date(), finalGeneratedAt: undefined } : projectId ? await ownershipService.get(userId, projectId, policy.deliverable) : null;
      if (!unlock) return { mode: 'draft', priceXaf: 0, label: 'Esquisse', deliverable: policy.deliverable };
      const mode = unlock.tier === 'signature' ? 'signature' : 'final';
      // Une régénération complète d'une version finale déjà produite, hors fenêtre de retouches
      // et hors forfait, coûte la moitié du livrable.
      const regenerating = Boolean(unlock.finalGeneratedAt) && !ownershipService.editWindowOpen(unlock.unlockedAt) && !croissance && !beta;
      if (regenerating) {
        return { mode, priceXaf: regenerationPriceXaf(policy.deliverable), label: 'Nouvelle version complète', deliverable: policy.deliverable };
      }
      return { mode, priceXaf: 0, label: 'Version finale', deliverable: policy.deliverable };
    }

    case 'edit': {
      if (!policy.deliverable) return { mode: 'free', priceXaf: 0, label: action };
      const unlock = beta ? { unlockedAt: new Date() } : projectId ? await ownershipService.get(userId, projectId, policy.deliverable) : null;
      if (!unlock) return { mode: 'draft', priceXaf: 0, label: 'Retouche d’esquisse', deliverable: policy.deliverable };
      if (croissance || ownershipService.editWindowOpen(unlock.unlockedAt)) {
        return { mode: 'included', priceXaf: 0, label: 'Retouche incluse', deliverable: policy.deliverable };
      }
      return {
        mode: 'paid',
        priceXaf: policy.priceXaf,
        label: 'Retouche',
        deliverable: policy.deliverable,
        cap: { key: monthlyCapKey('croissance'), capXaf: PASSES.croissance.monthlyXaf, grants: 'croissance' },
      };
    }

    case 'unit': {
      const resolved = options.resolve ? await options.resolve(req) : { action, cost: 0 };
      const item = (resolved.action in COMMUNICATION_PRICES ? resolved.action : policy.item) as keyof typeof COMMUNICATION_PRICES;
      const aiClips = Math.max(0, Math.min(10, Math.floor(Number((req.body as Record<string, unknown> | undefined)?.aiClips) || 0)));

      let price: number = COMMUNICATION_PRICES[item];
      if (action === 'motion_video') {
        // Création d'une vidéo : le prix suit le périmètre choisi (`video/pricing`, en francs).
        price = videoCost(normalizeScope((req.body as Record<string, unknown> | undefined)?.scope));
      } else if (action === 'motion_video_rerender') {
        // Export : le premier est inclus, les suivants coûtent une fraction du périmètre — calculé
        // par la route avec `video/pricing`, en francs.
        price = Math.max(0, Math.round(resolved.cost));
      }
      const clipsXaf = aiClips * COMMUNICATION_PRICES.ai_clip;

      if (policy.oncePerScope) {
        const element = options.element?.(req);
        const last = await paidBefore(userId, item, projectId, element);
        if (last) {
          if (croissance || Date.now() - last.getTime() < 30 * DAY_MS) return { mode: 'included', priceXaf: 0, label: 'Nouvelle version incluse' };
          price = 100;
        }
      }

      if (croissance || beta) {
        // Le forfait inclut la communication ; les plans filmés par l'IA restent à part.
        return clipsXaf > 0
          ? { mode: 'paid', priceXaf: clipsXaf, label: `${aiClips} plan(s) filmé(s) par l'IA`, aiClips }
          : { mode: 'included', priceXaf: 0, label: 'Inclus dans le forfait', aiClips: 0 };
      }

      return {
        mode: 'paid',
        priceXaf: price + clipsXaf,
        label: labelOf(item, aiClips),
        aiClips,
        // Les plans filmés ne comptent pas dans le plafond : ils sont payés à leur coût réel.
        cap: clipsXaf > 0 ? undefined : { key: monthlyCapKey('croissance'), capXaf: PASSES.croissance.monthlyXaf, grants: 'croissance' },
      };
    }
  }
}

function labelOf(item: keyof typeof COMMUNICATION_PRICES, aiClips: number): string {
  const labels: Record<keyof typeof COMMUNICATION_PRICES, string> = {
    flyer: 'Visuel',
    ai_visual: 'Visuel généré par l’IA',
    carousel: 'Carrousel',
    motion_video: 'Vidéo',
    motion_video_rerender: 'Nouvel export de la vidéo',
    ai_clip: 'Plan filmé par l’IA',
    editorial_calendar: 'Calendrier éditorial',
    communication_plan: 'Période de communication',
    communication_strategy: 'Stratégie de communication',
    short_video: 'Clip vidéo IA',
  };
  return aiClips > 0 ? `${labels[item]} + ${aiClips} plan(s) filmé(s) par l’IA` : labels[item];
}

/** Applique la décision à la génération : mode, cran de créativité, plans filmés autorisés. */
function applyDecision(req: CustomRequest, decision: Decision): void {
  req.offer = { mode: decision.mode, deliverable: decision.deliverable };

  const setCreativity = (level: CreativityLevel) => {
    if (req.body && typeof req.body === 'object') (req.body as Record<string, unknown>).creativity = level;
    if (req.query && typeof req.query === 'object') (req.query as Record<string, unknown>).creativity = level;
  };

  if (decision.mode === 'draft') {
    setAiUsageContext({ generationMode: 'draft' });
    setCreativity('low');
  } else if (decision.mode === 'final') {
    setAiUsageContext({ generationMode: 'final' });
    // Le cran le plus puissant est la version Signature : sans elle, on plafonne à High.
    if (creativityOf(req) === 'ultra' && decision.deliverable !== 'logo_brand') setCreativity('high');
  } else if (decision.mode === 'signature') {
    setAiUsageContext({ generationMode: 'signature' });
    setCreativity('ultra');
  }

  if (decision.aiClips !== undefined) {
    setAiUsageContext({ mediaPolicy: { aiClips: decision.aiClips, aiClipsUsed: 0 } });
  }
}

// ============================================
// LE MIDDLEWARE
// ============================================

/**
 * Applique le modèle économique à une route de génération.
 *
 * À placer après `authenticate` et après les validations d'entrée : inutile de débiter pour une
 * requête qui sera rejetée pour un champ manquant.
 */
export function requireCredits(engine: BillingEngine, action: string, options: RequireCreditsOptions = {}) {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'authentication_required', message: 'Connectez-vous pour utiliser cette fonctionnalité.' });
      return;
    }

    let mode: Awaited<ReturnType<typeof billingSettingsService.getEnforcement>> | undefined;
    try {
      mode = await billingSettingsService.getEnforcement();
      if (mode === 'off') {
        next();
        return;
      }

      const entitlements = await entitlementsService.resolve(userId);
      if (options.exempt?.(req, entitlements)) {
        next();
        return;
      }

      // Quota d'usage du groupe de l'action, avant tout débit.
      const quota = await usageQuotaService.reserve(userId, quotaGroupOf(engine, action), { email: req.user?.email, mode, entitlements });
      if (!quota.allowed) {
        sendQuotaRefusal(res, quota.refusal);
        return;
      }
      req.usageQuota = quota.reservation;
      releaseQuotaOnFailure(req, res);

      const policy = policyFor(engine, action, req.originalUrl || req.path || '');
      const decision = await decide(req, policy, action, options, entitlements);
      applyDecision(req, decision);
      await openGenerationBudget(envelopeKey(engine, action), creativityOf(req), decision.priceXaf);

      const projectId = (req.params?.projectId as string) || undefined;

      // La version finale produite est marquée, pour que l'écran sache qu'elle est à jour.
      if ((decision.mode === 'final' || decision.mode === 'signature') && decision.deliverable && projectId) {
        const deliverable = decision.deliverable;
        res.on('finish', () => {
          if (res.statusCode < 400) void ownershipService.markFinalGenerated(userId, projectId, deliverable).catch(() => undefined);
        });
      }

      if (decision.priceXaf <= 0) {
        next();
        return;
      }

      // Observation : on mesure ce que l'application coûterait, sans bloquer ni débiter.
      if (mode === 'log') {
        logger.info('billing.enforcement_shadow', {
          event: 'billing.enforcement_shadow',
          engine,
          action,
          priceXaf: decision.priceXaf,
          walletXaf: entitlements.offer.walletXaf,
          wouldBlock: entitlements.offer.walletXaf < decision.priceXaf,
        });
        next();
        return;
      }

      const element = options.element?.(req);
      const spend = await walletService.spend(userId, {
        priceXaf: decision.priceXaf,
        label: decision.label,
        action: req.offer?.mode === 'paid' && policy.kind === 'unit' ? policy.item : action,
        projectId,
        element,
        feature: engine,
        cap: decision.cap ? { key: decision.cap.key, capXaf: decision.cap.capXaf } : undefined,
      });

      if (!spend.allowed) {
        res.status(402).json(
          await paymentRequiredBody({
            action,
            label: decision.label,
            priceXaf: spend.dueXaf,
            balanceXaf: spend.balanceXaf,
            missingXaf: spend.missingXaf,
            engine,
            deliverable: decision.deliverable,
            projectId,
          })
        );
        return;
      }

      if (spend.capReached && decision.cap?.grants) await passService.grantFromCap(userId, decision.cap.grants);
      await entitlementsService.invalidate(userId);

      const context: BillingRequestContext = {
        engine,
        action,
        cost: spend.chargedXaf,
        charged: spend.chargedXaf > 0,
        balanceAfter: spend.balanceXaf,
        ledgerEntryId: spend.ledgerEntryId,
        account: WALLET_ACCOUNT,
        capKey: decision.cap?.key,
        aiClipsPaid: decision.aiClips,
      };
      req.billing = context;

      res.on('finish', () => {
        if (res.statusCode >= 400) {
          if (!req.billing?.charged) return;
          void walletService
            .refund(userId, req.billing.cost, { action, capKey: req.billing.capKey, note: `Génération en échec (HTTP ${res.statusCode}) — montant restitué` })
            .then(() => entitlementsService.invalidate(userId))
            .catch((error: Error) => logger.error(`billing.refund_failed: ${error.message}`, { event: 'billing.refund_failed', alert: 'critical', userId, action, cost: req.billing?.cost }));
          return;
        }
        void refundUnusedClips(req).catch(() => undefined);
      });

      next();
    } catch (error: any) {
      logger.error(`billing.enforcement_failed: ${error.message}`, { event: 'billing.enforcement_failed', engine, action, stack: error.stack });
      // En `enforce`, une panne de facturation ne devient pas une génération gratuite.
      if (mode === 'enforce' || mode === undefined) {
        res.status(503).json({ error: 'billing_unavailable', message: 'La facturation est momentanément indisponible. Réessayez dans un instant.' });
        return;
      }
      next();
    }
  };
}

/** Les plans filmés payés mais non générés (repli sur la banque d'images) sont restitués. */
async function refundUnusedClips(req: CustomRequest): Promise<void> {
  const paid = req.billing?.aiClipsPaid ?? 0;
  if (!paid || !req.user?.uid) return;
  const { getAiUsageContext } = await import('../utils/ai-usage-context.util');
  const used = getAiUsageContext()?.mediaPolicy?.aiClipsUsed ?? paid;
  const unused = Math.max(0, paid - used);
  if (unused === 0) return;
  await walletService.refund(req.user.uid, unused * COMMUNICATION_PRICES.ai_clip, { action: 'ai_clip', note: `${unused} plan(s) filmé(s) non générés — montant restitué` });
}

/**
 * Exige la version finale d'un livrable (téléchargement, export, impression).
 *
 * L'esquisse se consulte librement dans IDEM ; c'est le fichier final qu'on emporte qui se paie.
 * Le refus porte de quoi débloquer le livrable en un geste.
 */
export function requireOwnership(deliverable: DeliverableKey) {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;
    const projectId = req.params?.projectId as string | undefined;
    if (!userId || !projectId) {
      next();
      return;
    }
    try {
      const mode = await billingSettingsService.getEnforcement();
      if (mode === 'off') {
        next();
        return;
      }
      const entitlements = await entitlementsService.resolve(userId);
      if (entitlements.beta.active || (await ownershipService.isOwned(userId, projectId, deliverable))) {
        next();
        return;
      }
      if (mode === 'log') {
        logger.info('billing.ownership_shadow', { event: 'billing.ownership_shadow', deliverable, wouldBlock: true });
        next();
        return;
      }
      const status = await ownershipService.status(userId, projectId);
      const offer = status.deliverables.find((d) => d.key === deliverable)!;
      const priceXaf = Math.min(offer.priceXaf, status.kit.remainingXaf || offer.priceXaf);
      res.status(402).json({
        error: 'deliverable_locked',
        message: `Le fichier final de « ${offer.label} » s’obtient avec sa version finale.`,
        deliverable,
        projectId,
        label: offer.label,
        priceXaf,
        kit: status.kit,
        balanceXaf: entitlements.offer.walletXaf,
        missingXaf: Math.max(0, priceXaf - entitlements.offer.walletXaf),
        topupXaf: topupFor(Math.max(0, priceXaf - entitlements.offer.walletXaf)),
      });
    } catch (error: any) {
      logger.error(`billing.ownership_check_failed: ${error.message}`, { event: 'billing.ownership_check_failed', deliverable });
      next();
    }
  };
}

// ============================================
// SERVICES DE L'ÉCOSYSTÈME (iVision, médias iCode)
// ============================================

export type ServiceChargeResult =
  | { status: 'charged'; cost: number; balance: number; ledgerEntryId?: string; reservation?: QuotaReservation }
  /** Rien n'est débité : facturation coupée, observation, inclus dans un forfait, ou gratuit. */
  | { status: 'free'; reason: 'off' | 'shadow' | 'included' | 'degraded'; reservation?: QuotaReservation; /** Modifications iCode prises (à rendre si l'action échoue). */ units?: number }
  | { status: 'refused'; body: Awaited<ReturnType<typeof paymentRequiredBody>> }
  /** Quota d'usage du groupe atteint : à relayer en 429. */
  | { status: 'quota_exceeded'; body: QuotaRefusal };

/**
 * Prix des actions facturées par un SERVICE de l'écosystème, calculés ICI — jamais repris du
 * service appelant. `quantity` multiplie le prix (secondes de vidéo exportées sont déjà dans
 * le prix d'un export vidéo : la quantité est le nombre d'unités demandées).
 */
const SERVICE_ACTIONS: Record<string, { priceXaf: number; label: string; cap?: 'createur'; units?: 'appgen' }> = {
  // iVision : la création est gratuite (signée) ; l'export HD se paie, plafonné au forfait Créateur.
  export_visual: { priceXaf: 100, label: 'Export HD d’un visuel', cap: 'createur' },
  export_video: { priceXaf: 300, label: 'Export HD d’une vidéo', cap: 'createur' },
  ai_clip: { priceXaf: COMMUNICATION_PRICES.ai_clip, label: 'Plan filmé par l’IA' },
  // iCode : une image de site vaut une modification ; un clip, un plan filmé par l'IA.
  site_image: { priceXaf: ICODE.modificationXaf, label: 'Image de site générée', units: 'appgen' },
  site_video: { priceXaf: ICODE.siteVideoXaf, label: 'Clip vidéo de site' },
};

/**
 * Débit d'un service de l'écosystème, au nom d'un utilisateur. Mêmes règles que les routes :
 * mode d'application, quota, plafond Créateur, refus avec recharge suggérée. Une panne de la
 * facturation en mode `enforce` lève `billing_unavailable`.
 *
 * `resolved.cost`, quand il est fourni pour une action inconnue de la table, est lu comme un prix
 * en francs (actions historiques d'iVision : il vaut zéro, la création étant gratuite).
 */
export async function chargeForService(
  userId: string,
  engine: BillingEngine,
  resolved: { action: string; cost: number; note?: string; quantity?: number; priceXaf?: number },
  context: { projectId?: string; element?: string; feature?: string } = {}
): Promise<ServiceChargeResult> {
  let mode: Awaited<ReturnType<typeof billingSettingsService.getEnforcement>> | undefined;
  try {
    mode = await billingSettingsService.getEnforcement();
    if (mode === 'off') return { status: 'free', reason: 'off' };

    const quota = await usageQuotaService.reserve(userId, quotaGroupOf(engine, resolved.action), { mode });
    if (!quota.allowed) return { status: 'quota_exceeded', body: quota.refusal };
    const reservation = quota.reservation;

    const entitlements = await entitlementsService.resolve(userId);
    const known = SERVICE_ACTIONS[resolved.action];
    const quantity = Math.max(1, Math.min(50, Math.floor(resolved.quantity ?? 1)));
    const label = known?.label ?? resolved.note ?? resolved.action;

    // Une image de site se paie d'abord en modifications incluses.
    if (known?.units === 'appgen') {
      const units = await creditLedgerService.debit(userId, 'appgen', quantity, { action: resolved.action, projectId: context.projectId, feature: context.feature ?? engine, note: label });
      if (units.allowed) {
        await entitlementsService.invalidate(userId);
        return { status: 'free', reason: 'included', reservation, units: quantity };
      }
    }

    // L'export iVision est inclus dans Créateur (ou Entreprise, ou bêta).
    if (known?.cap === 'createur' && entitlements.offer.createur) return { status: 'free', reason: 'included', reservation };

    const unitPrice = known ? (resolved.action === 'export_video' && resolved.priceXaf ? resolved.priceXaf : known.priceXaf) : Math.max(0, Math.round(resolved.priceXaf ?? 0));
    const price = unitPrice * quantity;
    if (price <= 0) return { status: 'free', reason: 'included', reservation };

    if (mode === 'log') {
      logger.info('billing.enforcement_shadow', { event: 'billing.enforcement_shadow', engine, action: resolved.action, priceXaf: price, walletXaf: entitlements.offer.walletXaf, wouldBlock: entitlements.offer.walletXaf < price, feature: context.feature });
      return { status: 'free', reason: 'shadow', reservation };
    }

    const cap = known?.cap === 'createur' ? { key: monthlyCapKey('createur'), capXaf: PASSES.createur.monthlyXaf } : undefined;
    const spend = await walletService.spend(userId, { priceXaf: price, label, action: resolved.action, projectId: context.projectId, element: context.element, feature: context.feature ?? engine, cap });
    if (!spend.allowed) {
      await usageQuotaService.release(reservation);
      return {
        status: 'refused',
        body: await paymentRequiredBody({ action: resolved.action, label, priceXaf: spend.dueXaf, balanceXaf: spend.balanceXaf, missingXaf: spend.missingXaf, engine, projectId: context.projectId }),
      };
    }
    if (spend.capReached && cap) await passService.grantFromCap(userId, 'createur');
    await entitlementsService.invalidate(userId);
    return { status: 'charged', cost: spend.chargedXaf, balance: spend.balanceXaf, ledgerEntryId: spend.ledgerEntryId, reservation };
  } catch (error: any) {
    logger.error(`billing.enforcement_failed: ${error.message}`, { event: 'billing.enforcement_failed', engine, action: resolved.action, feature: context.feature, stack: error.stack });
    if (mode === 'enforce' || mode === undefined) throw new Error('billing_unavailable');
    return { status: 'free', reason: 'degraded' };
  }
}

/**
 * Restitue explicitement le débit de cette requête (flux SSE qui casse après le 200), et la place
 * prise dans le quota.
 */
export async function refundRequestCredits(req: CustomRequest, reason?: string): Promise<void> {
  await releaseRequestQuota(req);

  const context = req.billing;
  const userId = req.user?.uid;
  if (!context?.charged || !userId) return;

  // Marqué avant l'appel : si `finish` se déclenche entre-temps, il ne restituera pas une seconde fois.
  req.billing = { ...context, charged: false };

  if (context.account === WALLET_ACCOUNT || !context.account) {
    await walletService.refund(userId, context.cost, { action: context.action, capKey: context.capKey, note: reason ?? 'Génération interrompue — montant restitué' });
  } else {
    await creditLedgerService.refundDebit(userId, context.account, context.cost, { action: context.action, note: reason ?? 'Génération interrompue — crédits restitués' });
  }
  await entitlementsService.invalidate(userId);
}

// ============================================
// iCODE : POSSÉDER UN PROJET
// ============================================

/**
 * Exige qu'un projet iCode soit débloqué (Pass Projet) : télécharger le code, l'envoyer sur
 * GitHub ou le déployer sont les actes de possession. Le contrôle est ici, pas dans l'interface.
 * L'identifiant du projet est cherché là où chaque appelant le place.
 */
export function requireProjectAccess() {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'authentication_required', message: 'Connectez-vous pour utiliser cette fonctionnalité.' });
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
        logger.warn('billing.project_access_unknown', { event: 'billing.project_access_unknown', path: req.originalUrl });
        next();
        return;
      }

      const entitlements = await entitlementsService.resolve(userId);
      if (entitlements.beta.active || (await entitlementsService.hasProjectAccess(userId, projectId))) {
        next();
        return;
      }

      if (mode === 'log') {
        logger.info('billing.project_access_shadow', { event: 'billing.project_access_shadow', projectId, wouldBlock: true });
        next();
        return;
      }

      const vouchers = entitlements.offer.projectPassVouchers;
      const due = vouchers > 0 ? 0 : ICODE.projectPassXaf;
      res.status(402).json({
        error: 'payment_required',
        message:
          vouchers > 0
            ? 'Ce projet n’est pas encore débloqué. Utilisez un de vos Pass Projet prépayés.'
            : 'Ce projet n’est pas encore débloqué. Le Pass Projet (1 000 F) ouvre le code, GitHub, le déploiement et 30 modifications.',
        engine: 'appgen',
        action: 'project_unlock',
        offer: { kind: 'icode_project_pass', projectId },
        projectId,
        priceXaf: due,
        balanceXaf: entitlements.offer.walletXaf,
        missingXaf: Math.max(0, due - entitlements.offer.walletXaf),
        topupXaf: topupFor(Math.max(0, due - entitlements.offer.walletXaf)),
        suggestions: [],
      });
    } catch (error: any) {
      logger.error(`billing.project_access_failed: ${error.message}`, { event: 'billing.project_access_failed' });
      next();
    }
  };
}

// ============================================
// iSIMULATE : PAYÉ À L'ACTE, DEPUIS LE PORTEFEUILLE
// ============================================

/** Prix d'une simulation selon son niveau (`run`, `pack` = simulation + rapport, `report`) et son origine. */
export function simulationPrice(tier: string, fromIdem: boolean): { priceXaf: number; label: string } {
  const pick = (offer: keyof typeof SIMULATION_PRICES) => (fromIdem ? SIMULATION_PRICES[offer].idemXaf : SIMULATION_PRICES[offer].publicXaf);
  if (tier === 'pack') return { priceXaf: pick('run') + pick('report'), label: 'Simulation + rapport pour la banque' };
  if (tier === 'report') return { priceXaf: pick('report'), label: SIMULATION_PRICES.report.label };
  const offer = simulationOfferForTier(tier);
  return { priceXaf: pick(offer), label: SIMULATION_PRICES[offer].label };
}

/**
 * Débite une simulation avant son lancement — le seul moment où l'on peut encore refuser. Le
 * débit est restitué si l'exécution ne démarre pas (`releaseSimulationPayment`).
 */
export function requireSimulationPayment() {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'authentication_required', message: 'Connectez-vous pour lancer une simulation.' });
      return;
    }

    try {
      const mode = await billingSettingsService.getEnforcement();
      if (mode === 'off') {
        next();
        return;
      }

      const tier = String(req.body?.tier ?? 'run');
      const entitlements = await entitlementsService.resolve(userId);

      // Bêta : la simulation est comprise. Croissance : une par trimestre.
      if (entitlements.beta.active || (await includedQuarterlySimulation(userId, entitlements))) {
        next();
        return;
      }

      const fromIdem = req.body?.origin !== 'imported-document';
      const { priceXaf, label } = simulationPrice(tier, fromIdem);

      if (mode === 'log') {
        logger.info('billing.simulation_payment_shadow', { event: 'billing.simulation_payment_shadow', tier, priceXaf, wouldBlock: entitlements.offer.walletXaf < priceXaf });
        next();
        return;
      }

      const projectId = (req.params?.projectId as string) || undefined;
      const spend = await walletService.spend(userId, { priceXaf, label, action: `simulation_${tier}`, projectId, feature: 'simulation' });
      if (!spend.allowed) {
        res.status(402).json({
          ...(await paymentRequiredBody({ action: 'simulation_run', label, priceXaf: spend.dueXaf, balanceXaf: spend.balanceXaf, missingXaf: spend.missingXaf, engine: 'simulation', projectId })),
          tier,
        });
        return;
      }

      await entitlementsService.invalidate(userId);
      req.simulationPayment = { token: spend.ledgerEntryId ?? 'wallet', reference: 'wallet', tier, amountXaf: spend.chargedXaf };
      next();
    } catch (error: any) {
      logger.error(`billing.simulation_payment_failed: ${error.message}`, { event: 'billing.simulation_payment_failed', stack: error.stack });
      next();
    }
  };
}

/** Le forfait Croissance inclut une simulation par trimestre. */
async function includedQuarterlySimulation(userId: string, entitlements: Entitlements): Promise<boolean> {
  if (!entitlements.offer.croissance) return false;
  const since = new Date(Date.now() - 91 * DAY_MS);
  const used = await CreditLedgerEntry.exists({ userId, engine: WALLET_ACCOUNT, action: 'simulation_included', createdAt: { $gte: since } });
  if (used) return false;
  await creditLedgerService.recordIncluded(userId, WALLET_ACCOUNT, 'simulation_included', { note: 'Simulation incluse dans le forfait Croissance (une par trimestre)' });
  return true;
}

/** Rattache le débit à l'exécution qu'il a permis de lancer (traçabilité). */
export async function attachSimulationPayment(req: CustomRequest, simulationId: string): Promise<void> {
  const reservation = req.simulationPayment;
  if (!reservation) return;
  req.simulationPayment = undefined;
  logger.info('billing.simulation_paid', { event: 'billing.simulation_paid', simulationId, tier: reservation.tier, amountXaf: reservation.amountXaf });
}

/** L'exécution n'a pas démarré : le montant revient au portefeuille. */
export async function releaseSimulationPayment(req: CustomRequest): Promise<void> {
  const reservation = req.simulationPayment;
  const userId = req.user?.uid;
  if (!reservation || !userId) return;
  req.simulationPayment = undefined;
  if (!reservation.amountXaf) return;
  try {
    await walletService.refund(userId, reservation.amountXaf, { action: `simulation_${reservation.tier}`, note: 'Simulation non lancée — montant restitué' });
    await entitlementsService.invalidate(userId);
  } catch (error: any) {
    logger.error(`billing.simulation_release_failed: ${error.message}`, { event: 'billing.simulation_release_failed', alert: 'critical', userId });
  }
}

/** Plafond d'un projet, exposé pour les écrans. */
export const KIT = { capXaf: KIT_CAP_XAF, capKey: kitCapKey };
