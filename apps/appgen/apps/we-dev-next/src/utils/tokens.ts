import { aiGenerationsTotal, aiTokensTotal, METRICS_SERVICE } from '../middleware/metrics.js';
import { ChatLogger } from './logger.js';

/**
 * Estimation grossière du nombre de tokens d'un texte.
 *
 * ⚠️ À N'UTILISER QUE pour un garde-fou de taille (décider si un contexte
 * dépasse une limite), JAMAIS pour de la comptabilité : le fournisseur renvoie
 * les compteurs réels et c'est `reportUsage` qui les enregistre.
 *
 * La version précédente comptait chaque groupe d'espaces comme un token entier,
 * ce qui surestimait lourdement du code indenté — précisément le contenu que
 * cette fonction mesure ici. On reste sur une approximation par caractères,
 * corrigée pour le chinois (idéogrammes plus denses en tokens).
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chineseChars = (text.match(/[一-鿿]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

export interface UsageReport {
  model: string;
  /** `builder` ou `chat` — les deux n'ont ni le même volume ni le même coût. */
  mode: string;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  userId?: string | null;
}

/**
 * Enregistre la consommation RÉELLE d'une génération.
 *
 * Remplace `deductUserTokens`, qui était une fonction vide depuis l'origine :
 * le générateur d'applications — probablement le poste le plus consommateur de
 * la plateforme — n'avait donc aucune mesure de son coût, alors que l'API
 * dispose d'un `AiUsageEvent` complet.
 *
 * N'échoue jamais et ne bloque jamais : l'observabilité ne doit ni faire
 * échouer une génération, ni la ralentir.
 */
export function reportUsage(usage: UsageReport): void {
  try {
    const labels = { model: usage.model, mode: usage.mode, service: METRICS_SERVICE };

    if (usage.promptTokens !== undefined) {
      aiTokensTotal.inc({ ...labels, kind: 'input' }, usage.promptTokens);
    }
    if (usage.completionTokens !== undefined) {
      aiTokensTotal.inc({ ...labels, kind: 'output' }, usage.completionTokens);
    }
    aiGenerationsTotal.inc({ ...labels, finish_reason: usage.finishReason ?? 'unknown' });

    ChatLogger.info('USAGE', 'Consommation relevée', {
      model: usage.model,
      mode: usage.mode,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      finishReason: usage.finishReason,
      userId: usage.userId ?? 'anonymous',
    });
  } catch (error) {
    ChatLogger.error('USAGE', 'Relevé de consommation perdu', error);
  }
}
