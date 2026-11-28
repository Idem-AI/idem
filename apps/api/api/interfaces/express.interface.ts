import { Request } from 'express';
import type { IdemAuthUser } from '../services/identity/identity.service';

import { SimulationConsent } from '../models/simulation.model';

/**
 * Débit de crédits opéré par `requireCredits` avant la génération.
 *
 * Déclaré ici plutôt que dans le middleware pour éviter un cycle d'imports :
 * le middleware a besoin de `CustomRequest`, l'inverse serait circulaire.
 */
export interface BillingRequestContext {
  engine: 'business' | 'appgen' | 'ideploy';
  /** Compte débité : le portefeuille en francs, ou un compte historique. */
  account?: import('../models/offer.model').LedgerAccount;
  /** Plafond auquel le débit se rattache, repris à la restitution. */
  capKey?: string;
  /** Plans filmés par l'IA payés avec cette génération (les non utilisés sont restitués). */
  aiClipsPaid?: number;
  /** Livrable facturé, au barème du moteur. */
  action: string;
  cost: number;
  /** Faux en mode observation : le refus a été journalisé, rien n'a été débité. */
  charged: boolean;
  balanceAfter?: number;
  ledgerEntryId?: string;
}

export interface CustomRequest extends Request {
  /** Identité vérifiée par `authenticate`. */
  user?: IdemAuthUser;
  /**
   * La personne réellement connectée, quand elle agit sur le projet d'un autre
   * en tant que membre de son équipe : `user.uid` est alors le propriétaire
   * (voir `middleware/project-access.middleware.ts`).
   */
  actor?: { uid: string; email?: string };
  /** Les droits du membre sur le projet visé, posés avec `actor`. */
  projectAccess?: import('../../../../packages/shared-models/src/projects/project-access.model').ProjectAccess;
  /** Resolved UI language ('en' | 'fr'), set by languageMiddleware. */
  language?: string;
  policyWarning?: {
    requiresFinalization: boolean;
    finalizeEndpoint: string;
  };
  /** Accord validé par `requireSimulationConsent`, à enregistrer avec l'exécution. */
  simulationConsent?: SimulationConsent;
  /** Crédits réservés pour cette requête ; contrepassés si la génération échoue. */
  billing?: BillingRequestContext;
  /**
   * Paiement réservé pour une exécution de simulation.
   *
   * iSimulate se paie à l'acte : le jeton est posé avant le lancement puis
   * échangé contre l'identifiant de l'exécution, ou relâché si elle ne démarre
   * pas. Sans cet aller-retour, un lancement raté consommerait le paiement.
   */
  simulationPayment?: { token: string; reference: string; tier: string; amountXaf?: number };
  /**
   * Places réservées dans les quotas d'usage pour cette génération : rendues
   * si elle échoue, comme les crédits (`models/usage-quota.model.ts`).
   */
  usageQuota?: import('../services/billing/usage-counters').QuotaReservation;
  /** Ce que la facturation a décidé pour cette génération (esquisse, version finale…). */
  offer?: {
    mode: 'draft' | 'final' | 'signature' | 'paid' | 'included' | 'free';
    deliverable?: import('../models/offer.model').DeliverableKey;
  };
}
