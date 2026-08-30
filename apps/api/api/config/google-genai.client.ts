import { GoogleGenAI } from '@google/genai';
import {
  describeGeminiBackend,
  getGeminiBackend,
  isGeminiConfigured,
  resetGeminiBackend,
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

  // Vertex réutilise le compte de service Firebase : même projet Google Cloud,
  // donc les mêmes variables. Si Firebase est configuré, Vertex l'est aussi.
  if (!backend.project || !backend.credentials) {
    throw new Error(
      'Vertex AI est actif mais les identifiants Firebase sont incomplets ' +
        '(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). ' +
        "Vertex signe ses appels avec le compte de service Firebase — c'est le " +
        'même projet Google Cloud. Vérifiez ces trois variables, ou repassez ' +
        'temporairement sur AI Studio (GEMINI_BACKEND=ai-studio).'
    );
  }

  client = new GoogleGenAI({
    vertexai: true,
    project: backend.project,
    location: backend.location,
    googleAuthOptions: { credentials: backend.credentials },
  });

  logger.info(`Client Gemini initialisé — ${describeGeminiBackend()}`);
  return client;
}

/** Réinitialise le client et le backend mémorisés. Réservé aux tests. */
export function resetGoogleGenAIClient(): void {
  client = undefined;
  resetGeminiBackend();
}
