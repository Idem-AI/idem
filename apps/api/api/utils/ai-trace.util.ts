import logger from '../config/logger';

/**
 * Journalise un événement de décision IA (appel d'outil, tour agentique,
 * requête Chronicle, vérification de cohérence...). Ces événements sont
 * automatiquement enrichis (requestId/userId/projectId, cf. config/logger.ts)
 * et redirigés vers `logs/ai-trace.log` en plus des logs applicatifs normaux
 * — voir apps/api/docs/TRACING.md pour les suivre en temps réel.
 *
 * Convention: `event` est un nom pointé namespacé ("ai.tool_call",
 * "chronicle.query", "coherence.verdict", "advisor.intent"...).
 */
export function logAIEvent(event: string, meta: Record<string, unknown> = {}): void {
  logger.info(event, { event, ...meta });
}

const MAX_PREVIEW_CHARS = 500;

/** Aperçu compact d'une valeur arbitraire pour les logs (jamais le payload complet). */
export function previewValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return String(value);
  }
  if (serialized === undefined) return 'undefined';
  return serialized.length > MAX_PREVIEW_CHARS
    ? `${serialized.slice(0, MAX_PREVIEW_CHARS)}…(${serialized.length} caractères)`
    : serialized;
}
