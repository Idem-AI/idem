import { Request } from 'express';
import admin from 'firebase-admin';

import { SimulationConsent } from '../models/simulation.model';

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
}
