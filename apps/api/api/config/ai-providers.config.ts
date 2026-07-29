/**
 * Registre central des fournisseurs de modèles IA.
 *
 * Objectif : ajouter/permuter un fournisseur (ou brancher un futur modèle IDEM
 * auto-hébergé) doit se faire ICI en ajoutant une entrée + une variable d'env,
 * SANS toucher au code métier. `prompt.service.ts` lit ce registre pour savoir
 * quel adaptateur utiliser (`gemini` natif ou `openai-compatible`), avec quelle
 * clé/URL, et quelles capacités sont réellement supportées.
 *
 * Deux familles d'adaptateurs suffisent aujourd'hui :
 *   - `gemini`            → SDK @google/genai (grounding Google Search, cache de
 *                           contexte, image/vision, function-calling natif).
 *   - `openai-compatible` → SDK `openai` avec baseURL custom. Couvre OpenAI,
 *                           DeepSeek, GLM (Z.ai), et demain nos modèles maison
 *                           servis par vLLM/TGI/SGLang qui exposent tous cette
 *                           même API.
 */

import { LLMProvider, FeatureAIConfig } from './ai.config';

export type ProviderKind = 'gemini' | 'openai-compatible';

/**
 * Ce qu'un fournisseur sait faire. Sert de garde-fou : on n'aiguille jamais une
 * fonctionnalité vers un fournisseur incapable de la servir (ex: grounding
 * Google Search reste propre à Gemini).
 */
export interface ProviderCapabilities {
  /** Function-calling / boucle agentique (runPromptWithTools). */
  tools: boolean;
  /** Recherche fondée via Google Search (runGroundedResearch). Gemini only. */
  grounding: boolean;
  /** Réponse en flux (runPromptStream). */
  streaming: boolean;
  /** Cache de contexte serveur (caches.create). Gemini only. */
  contextCache: boolean;
  /** Compréhension d'images en entrée. */
  vision: boolean;
  /** Génération d'images. */
  imageGeneration: boolean;
}

export interface ProviderDefinition {
  /** Quelle famille d'adaptateur pilote ce fournisseur. */
  kind: ProviderKind;
  /** Nom de la variable d'environnement contenant la clé API. */
  apiKeyEnv: string;
  /** URL de base (fournisseurs openai-compatible uniquement). */
  baseUrl?: string;
  /** En-têtes additionnels éventuels (ex: routage passerelle). */
  defaultHeaders?: Record<string, string>;
  /** Modèle de repli propre au fournisseur (optionnel). */
  fallbackModel?: string;
  /**
   * Champs de corps supplémentaires ajoutés à CHAQUE requête chat.completions du
   * fournisseur (hors contrat OpenAI standard). Ex: GLM/Z.ai accepte
   * `thinking: { type: 'disabled' }` — indispensable car le raisonnement des
   * modèles GLM consomme le budget `max_tokens` (calibré pour Gemini) et renvoie
   * sinon un `content` vide sur les prompts lourds (logo, SVG…).
   */
  extraBody?: Record<string, unknown>;
  capabilities: ProviderCapabilities;
}

const ALL_CAPABILITIES: ProviderCapabilities = {
  tools: true,
  grounding: true,
  streaming: true,
  contextCache: true,
  vision: true,
  imageGeneration: true,
};

/**
 * Le registre. Ajouter un fournisseur = ajouter une entrée ici + définir sa clé
 * d'env. Rien d'autre à changer côté code.
 */
export const AI_PROVIDERS: Record<LLMProvider, ProviderDefinition> = {
  [LLMProvider.GEMINI]: {
    kind: 'gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    capabilities: { ...ALL_CAPABILITIES },
  },

  // GLM-5.2 (Zhipu / Z.ai) — API OpenAI-compatible. Modèle open-weight (MIT),
  // fort en rédaction et en agentique. Pas de génération d'image ni de grounding
  // Google Search : ces cas restent sur Gemini via les garde-fous de capacité.
  [LLMProvider.GLM]: {
    kind: 'openai-compatible',
    apiKeyEnv: 'GLM_API_KEY',
    // ⚠️ Endpoint OpenAI-compatible de Z.ai = `/api/paas/v4` (et NON `/api/openai/v1`,
    // qui renvoie un faux HTTP 200 `{code:500, msg:"404 NOT_FOUND"}`).
    baseUrl: process.env.GLM_API_URL || 'https://api.z.ai/api/paas/v4',
    fallbackModel: 'glm-4.6',
    // Désactive le raisonnement par défaut : nos budgets de tokens sont calibrés
    // pour Gemini (non-raisonnant) et le "thinking" de GLM les épuise, produisant
    // un content vide. Retirer ceci si on veut activer le raisonnement (en
    // augmentant alors maxOutputTokens en conséquence).
    extraBody: { thinking: { type: 'disabled' } },
    capabilities: {
      tools: true,
      grounding: false,
      streaming: true,
      contextCache: false,
      vision: false,
      imageGeneration: false,
    },
  },

  [LLMProvider.CHATGPT]: {
    kind: 'openai-compatible',
    apiKeyEnv: 'OPENAI_API_KEY',
    // baseUrl omis → défaut du SDK OpenAI (api.openai.com).
    capabilities: {
      tools: true,
      grounding: false,
      streaming: true,
      contextCache: false,
      vision: true,
      imageGeneration: false,
    },
  },

  [LLMProvider.DEEPSEEK]: {
    kind: 'openai-compatible',
    // Historique : la clé DeepSeek transitait par OPENROUTER_API_KEY.
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com',
    capabilities: {
      tools: true,
      grounding: false,
      streaming: true,
      contextCache: false,
      vision: false,
      imageGeneration: false,
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GABARIT — futur modèle IDEM auto-hébergé.
  // Décommenter + ajouter `IDEM = 'IDEM'` à l'enum LLMProvider (ai.config.ts),
  // puis pointer les features voulues dessus. Aucun autre code à écrire :
  //
  // [LLMProvider.IDEM]: {
  //   kind: 'openai-compatible',
  //   apiKeyEnv: 'IDEM_LLM_API_KEY',
  //   baseUrl: process.env.IDEM_LLM_URL, // ex: http://vllm.internal:8000/v1
  //   capabilities: { tools: true, grounding: false, streaming: true,
  //                   contextCache: false, vision: false, imageGeneration: false },
  // },
  // ─────────────────────────────────────────────────────────────────────────
};

/** Retourne la définition d'un fournisseur (throw si inconnu). */
export function getProvider(provider: LLMProvider): ProviderDefinition {
  const def = AI_PROVIDERS[provider];
  if (!def) {
    throw new Error(`Fournisseur IA inconnu dans le registre: ${provider}`);
  }
  return def;
}

/** Indique si un fournisseur supporte une capacité donnée. */
export function providerSupports(
  provider: LLMProvider,
  capability: keyof ProviderCapabilities
): boolean {
  return Boolean(AI_PROVIDERS[provider]?.capabilities[capability]);
}

/**
 * Interrupteur global (test A/B). Si `AI_DEFAULT_PROVIDER` est défini, il
 * remplace le fournisseur (et `AI_DEFAULT_MODEL` le modèle) de TOUTE config qui
 * passe par le choke point texte — permet de faire tourner idem entièrement sur
 * un fournisseur sans éditer chaque feature. Les cas image/grounding ne passent
 * pas par ce chemin et restent donc sur Gemini.
 *
 * Sans variable d'env, renvoie la config inchangée (comportement par défaut).
 */
export function resolveGlobalOverride<T extends Pick<FeatureAIConfig, 'provider' | 'modelName'>>(
  config: T
): T {
  const overrideProvider = process.env.AI_DEFAULT_PROVIDER as LLMProvider | undefined;
  if (!overrideProvider || !AI_PROVIDERS[overrideProvider]) {
    return config;
  }
  const overrideModel = process.env.AI_DEFAULT_MODEL;
  return {
    ...config,
    provider: overrideProvider,
    ...(overrideModel ? { modelName: overrideModel } : {}),
  };
}
