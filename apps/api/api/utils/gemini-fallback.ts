import logger from '../config/logger';
import { describeError, isTransientNetworkError, withRetry } from './retry';

/**
 * Check if the error thrown by Gemini represents a "high demand", "rate limit", "overloaded", or "resource exhausted" error.
 */
export function isGeminiOverloadedError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode || error.code;

  const hasOverloadKeywords =
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('resource exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('exhausted') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('service unavailable');

  const hasOverloadStatus =
    status === 429 ||
    status === 503 ||
    status === '429' ||
    status === '503' ||
    status === 'RESOURCE_EXHAUSTED';

  return hasOverloadKeywords || hasOverloadStatus;
}

/**
 * Executes a primary function that makes a Gemini call.
 * If it fails, automatically catches the error, logs a warning, and executes
 * the fallback function.
 *
 * Chaque branche est rejouée par `withRetry` sur panne RÉSEAU (`fetch failed`,
 * `ECONNRESET`, timeout de connexion…): ces échecs sont temporels, et basculer
 * de modèle n'y change rien puisque c'est la connexion elle-même qui manque.
 * Le modèle primaire a donc 3 chances AVANT que le repli n'entre en jeu, et le
 * repli 3 chances à son tour.
 *
 * Une saturation (429/503) ou une erreur déterministe (404, 400) n'est PAS
 * rejouée: on bascule immédiatement sur le repli, qui est la seule réponse
 * utile — Google sature modèle par modèle.
 *
 * ⚠️ Réservé aux appels qui ne passent PAS par `PromptService.runPrompt`
 * (génération d'image, vision, boucle agentique, grounding). `runPrompt` porte
 * déjà sa propre chaîne `fallbackModels` avec réessai: l'y ajouter créerait un
 * repli imbriqué dans un repli, et multiplierait les appels par deux.
 */
export async function withGeminiFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  modelName: string,
  fallbackModelName: string
): Promise<T> {
  try {
    return await withRetry(primaryFn, { label: `gemini/${modelName}` });
  } catch (error: any) {
    logger.warn(
      `Gemini model "${modelName}" failed (Error: ${describeError(error)}). Attempting fallback to "${fallbackModelName}"...`,
      { error: describeError(error), transient: isTransientNetworkError(error) }
    );
    try {
      return await withRetry(fallbackFn, { label: `gemini/${fallbackModelName} (repli)` });
    } catch (fallbackError: any) {
      logger.error(
        `Fallback model "${fallbackModelName}" also failed: ${describeError(fallbackError)}`,
        { error: fallbackError }
      );
      throw fallbackError;
    }
  }
}
