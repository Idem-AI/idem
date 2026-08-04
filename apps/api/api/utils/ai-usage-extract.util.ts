import { ProviderTokenUsage } from '../models/aiUsage.model';
import { estimateTokensFromText } from '../services/ai-usage.service';

/**
 * Normalisation des métadonnées d'usage renvoyées par les fournisseurs.
 *
 * Chaque SDK expose ses compteurs différemment (Gemini `usageMetadata`, OpenAI
 * `usage`), et certaines passerelles openai-compatible les omettent purement et
 * simplement. On ramène tout à une forme unique, avec repli sur une estimation
 * plutôt qu'un zéro : une consommation invisible est pire qu'approximative.
 */

/** Collecteur passé aux exécuteurs de prompt pour récupérer l'usage réel. */
export interface UsageSink {
  usage?: ProviderTokenUsage;
  /** Modèle effectivement utilisé (peut différer du modèle demandé après repli). */
  modelUsed?: string;
}

/**
 * Extrait l'usage d'une réponse Gemini (`@google/genai`).
 * `cachedContentTokenCount` est inclus dans `promptTokenCount` côté Google : on
 * le remonte à part pour pouvoir le facturer au tarif cache réduit.
 */
export function extractGeminiUsage(result: any): ProviderTokenUsage | undefined {
  const meta = result?.usageMetadata;
  if (!meta) return undefined;

  const inputTokens = Number(meta.promptTokenCount ?? 0);
  // Les modèles "thinking" facturent aussi les tokens de raisonnement, comptés
  // à part de `candidatesTokenCount` : sans eux le coût de sortie est sous-estimé.
  const outputTokens =
    Number(meta.candidatesTokenCount ?? 0) + Number(meta.thoughtsTokenCount ?? 0);

  if (inputTokens === 0 && outputTokens === 0) return undefined;

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens: Number(meta.cachedContentTokenCount ?? 0),
  };
}

/** Extrait l'usage d'une réponse openai-compatible (`chat.completions`). */
export function extractOpenAIUsage(response: any): ProviderTokenUsage | undefined {
  const usage = response?.usage;
  if (!usage) return undefined;

  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);

  if (inputTokens === 0 && outputTokens === 0) return undefined;

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens: Number(usage.prompt_tokens_details?.cached_tokens ?? 0),
  };
}

/**
 * Repli quand le fournisseur n'a rien renvoyé : estimation par longueur de
 * texte, marquée `estimated` pour que le panel admin ne présente pas ces
 * chiffres comme mesurés.
 */
export function estimateUsage(promptText: string, responseText: string): ProviderTokenUsage {
  return {
    inputTokens: estimateTokensFromText(promptText),
    outputTokens: estimateTokensFromText(responseText),
    estimated: true,
  };
}

/** Concatène des messages pour l'estimation de repli. */
export function joinMessagesForEstimate(messages: { content: string }[]): string {
  return messages.map((message) => message.content ?? '').join('\n');
}

/**
 * Additionne plusieurs relevés d'usage — utilisé par les boucles agentiques
 * (function calling) où un seul appel utilisateur déclenche plusieurs tours de
 * modèle qui doivent être facturés ensemble.
 */
export function sumUsage(parts: (ProviderTokenUsage | undefined)[]): ProviderTokenUsage {
  const present = parts.filter((part): part is ProviderTokenUsage => !!part);

  return {
    inputTokens: present.reduce((sum, part) => sum + part.inputTokens, 0),
    outputTokens: present.reduce((sum, part) => sum + part.outputTokens, 0),
    cachedInputTokens: present.reduce((sum, part) => sum + (part.cachedInputTokens ?? 0), 0),
    estimated: present.some((part) => part.estimated),
  };
}
