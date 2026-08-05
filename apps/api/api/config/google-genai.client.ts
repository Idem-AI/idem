import { GoogleGenAI } from '@google/genai';
import {
  describeGeminiBackend,
  getGeminiBackend,
  isGeminiConfigured,
  resetGeminiBackend,
} from './ai-providers.config';
import logger from './logger';

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

  const backend = getGeminiBackend();

  if (backend.mode === 'ai-studio') {
    if (!backend.apiKey) {
      throw new Error(
        'GEMINI_BACKEND=ai-studio mais GEMINI_API_KEY est absente. ' +
          'Renseignez la clé, ou repassez sur Vertex (GEMINI_BACKEND=vertex).'
      );
    }

    client = new GoogleGenAI({ apiKey: backend.apiKey });
    logger.info(`Client Gemini initialisé — ${describeGeminiBackend()}`);
    return client;
  }

  if (!backend.project) {
    throw new Error(
      'Vertex AI est actif mais GOOGLE_CLOUD_PROJECT est absent. ' +
        'Renseignez le projet Google Cloud qui porte la facturation, ' +
        'ou repassez temporairement sur AI Studio (GEMINI_BACKEND=ai-studio).'
    );
  }

  client = new GoogleGenAI({
    vertexai: true,
    project: backend.project,
    location: backend.location,
    ...(backend.credentials ? { googleAuthOptions: { credentials: backend.credentials } } : {}),
  });

  logger.info(`Client Gemini initialisé — ${describeGeminiBackend()}`);
  return client;
}

/** Réinitialise le client et le backend mémorisés. Réservé aux tests. */
export function resetGoogleGenAIClient(): void {
  client = undefined;
  resetGeminiBackend();
}
