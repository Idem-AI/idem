import { GoogleGenAI } from '@google/genai';
import {
  describeGeminiBackend,
  getGeminiBackend,
  isGeminiConfigured,
} from './ai-providers.config';
import logger from './logger';
import { installFetchDiagnostics } from '../utils/fetch-diagnostics';

/**
 * Fabrique unique du client Gemini.
 *
 * Ce fichier ne DÉCIDE de rien : il exécute ce que déclare le bloc « Backend
 * Gemini » de `ai-providers.config.ts` (mode, projet, région, authentification).
 * Aucune lecture de `process.env` ici — c'est ce qui garantit qu'une bascule
 * d'infrastructure se joue dans la configuration seule.
 *
 * Tous les services demandent leur client ici. Construire un `GoogleGenAI`
 * ailleurs ferait repartir cet appel-là sur un autre backend sans qu'aucun
 * signal ne l'indique.
 */

// Ré-export : les appelants n'ont besoin que de ce module.
export { describeGeminiBackend, getGeminiBackend, isGeminiConfigured };

let client: GoogleGenAI | undefined;

/**
 * Client partagé, construit à la première utilisation.
 *
 * Lève une erreur explicite si la configuration est incomplète : mieux vaut un
 * message clair au premier appel qu'une 401 opaque renvoyée par l'API.
 */
export function getGoogleGenAIClient(): GoogleGenAI {
  if (client) {
    return client;
  }

  // Le SDK écrase `error.cause` avant de propager un échec réseau : sans cette
  // sonde, un « fetch failed » reste indiscernable d'un DNS mort, d'un refus de
  // connexion ou d'un délai d'établissement dépassé.
  installFetchDiagnostics();

  const backend = getGeminiBackend();

  if (!backend.apiKey) {
    throw new Error(
      'GEMINI_API_KEY est absente. ' +
        'Renseignez la clé dans votre .env ou dans Infisical.'
    );
  }

  client = new GoogleGenAI({ apiKey: backend.apiKey });
  logger.info(`Client Gemini initialisé — ${describeGeminiBackend()}`);
  return client;
}
