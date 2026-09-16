import { Request } from 'express';
import admin from 'firebase-admin';

import { SimulationConsent } from '../models/simulation.model';

/**
 * Débit de crédits opéré par `requireCredits` avant la génération.
 *
 * Déclaré ici plutôt que dans le middleware pour éviter un cycle d'imports :
 * le middleware a besoin de `CustomRequest`, l'inverse serait circulaire.
 */
export interface BillingRequestContext {
  engine: 'business' | 'appgen' | 'ideploy';
  /** Livrable facturé, au barème du moteur. */
  action: string;
  cost: number;
  /** Faux en mode observation : le refus a été journalisé, rien n'a été débité. */
  charged: boolean;
  balanceAfter?: number;
  ledgerEntryId?: string;
}

export interface CustomRequest extends Request {
  user?: admin.auth.DecodedIdToken;
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
}
