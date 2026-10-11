/**
 * Registre du fournisseur de modèles IA : OpenRouter.
 *
 * Une seule famille d'adaptateur — `openai-compatible` (SDK `openai` avec une
 * `baseURL`). Le jour où les modèles sont servis par nos propres machines
 * (vLLM, SGLang, TGI exposent la même API), il suffit de pointer
 * `OPENROUTER_BASE_URL` vers elles : rien d'autre à changer dans le code métier.
 *
 * Les features déclarent un RÔLE (`mechanical`, `writing`, `reasoning`, `vision`,
 * `image`, `ocr`) ; ce fichier le traduit en modèle OpenRouter, avec la
 * surcharge à chaud de `ai-runtime.config.ts`.
 */

import {
  LLMProvider,
  FeatureAIConfig,
  ModelRole,
} from './ai.config';
import {
  OPENROUTER_BASE_URL,
  OPENROUTER_DEFAULT_ROLES,
  OPENROUTER_FALLBACK_MODELS,
  getOpenRouterApiKey,
  isAllowedOpenRouterModel,
  openRouterHeaders,
  openRouterRouting,
  resolveOpenRouterModel,
} from './openrouter.config';
import { runtimeModelFor } from './ai-runtime.config';
import logger from './logger';

export type ProviderKind = 'openai-compatible';

/** Réexporté pour les importateurs historiques : le rôle est défini dans `ai.config.ts`. */
export type { ModelRole };

/** Ce qu'un fournisseur sait faire. Garde-fou : on n'aiguille pas vers l'incapable. */
export interface ProviderCapabilities {
  /** Function-calling / boucle agentique (runPromptWithTools). */
  tools: boolean;
  /** Recherche fondée sur le web (runGroundedResearch). */
  grounding: boolean;
  /** Réponse en flux (runPromptStream). */
  streaming: boolean;
  /** Compréhension d'images en entrée. */
  vision: boolean;
  /** Génération d'images. */
  imageGeneration: boolean;
}

export interface ProviderDefinition {
  kind: ProviderKind;
  /** Nom de la variable d'environnement contenant la clé API. */
  apiKeyEnv: string;
  /** URL de base. */
  baseUrl?: string;
  /** En-têtes additionnels (attribution OpenRouter). */
  defaultHeaders?: Record<string, string>;
  /**
   * Appels simultanés supportés AVANT que la file d'attente ne coûte plus que la
   * vague économisée. Surchargeable par `IDEM_MAX_PARALLEL_STEPS`, qui sert à
   * balayer les valeurs et retenir la meilleure.
   */
  concurrency?: number;
  /** Modèle servant chaque RÔLE (résolu à chaque lecture par `getProvider`). */
  models?: Partial<Record<ModelRole, string>>;
  /**
   * Chaîne de repli appliquée aux appels qui n'en déclarent aucune. Propriété du
   * FOURNISSEUR : un 429 ne perd pas l'étape.
   */
  defaultFallbackModels?: string[];
  /**
   * Champs de corps ajoutés à CHAQUE requête chat.completions. Le raisonnement
   * est coupé par défaut : il se décompte du budget de sortie et vide la réponse
   * sur les prompts lourds. L'étage S le rallume explicitement (model-router.ts).
   */
  extraBody?: Record<string, unknown>;
  capabilities: ProviderCapabilities;
}

/**
 * Traduit l'intention de raisonnement du corps dans le langage d'OpenRouter.
 *
 * Les features disent `thinking: { type: 'disabled' | 'enabled' }` ; OpenRouter
 * unifie tous ses modèles sous `reasoning: { enabled }`. Envoyer `thinking` à un
 * modèle Qwen est au mieux ignoré — et le raisonnement continue alors de
 * consommer le budget de sortie.
 */
export function translateReasoning<T extends Record<string, any>>(body: T): T {
  if (!body.thinking) return body;
  const { thinking, ...rest } = body;
  return { ...rest, reasoning: { enabled: thinking?.type === 'enabled' } } as unknown as T;
}

/**
 * Le modèle sait-il RÉELLEMENT ne pas raisonner ?
 *
 * Les variantes « thinking » (Qwen `-thinking`, DeepSeek R1) raisonnent TOUJOURS :
 * leur envoyer la coupure est au mieux ignoré, et leur réponse revient vide quand
 * le budget est consommé par la réflexion. Aucune n'est affectée à un rôle par
 * défaut ; elles restent employables section par section.
 */
export function canSuppressThinking(modelName: string): boolean {
  return !/-thinking|deepseek-r1/i.test(modelName);
}

const ALL_CAPABILITIES: ProviderCapabilities = {
  tools: true,
  // Recherche web par le plugin `web` d'OpenRouter (cf. `runGroundedResearch`).
  grounding: true,
  streaming: true,
  vision: true,
  imageGeneration: true,
};

/** Le registre. */
export const AI_PROVIDERS: Record<LLMProvider, ProviderDefinition> = {
  [LLMProvider.OPENROUTER]: {
    kind: 'openai-compatible',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseUrl: OPENROUTER_BASE_URL(),
    defaultHeaders: openRouterHeaders(),
    // Plancher : `getProvider` résout les modèles à l'appel (base > env > défaut)
    // et `roleOfModel` reconnaît ainsi les modèles par défaut.
    models: { ...OPENROUTER_DEFAULT_ROLES },
    defaultFallbackModels: OPENROUTER_FALLBACK_MODELS,
    concurrency: Number(process.env.IDEM_OPENROUTER_CONCURRENCY ?? 4),
    // Raisonnement coupé par défaut. Routage : hébergeurs qui ne conservent pas
    // les requêtes (`data_collection: deny`).
    extraBody: { thinking: { type: 'disabled' }, ...openRouterRouting() },
    capabilities: { ...ALL_CAPABILITIES },
  },
};

/** Retourne la définition du fournisseur (throw si inconnu), modèles résolus à chaud. */
export function getProvider(provider: LLMProvider): ProviderDefinition {
  const def = AI_PROVIDERS[provider];
  if (!def) {
    throw new Error(`Fournisseur IA inconnu dans le registre: ${provider}`);
  }

  // Modèle d'un rôle : base (`platform_settings/ai`, changement à chaud), puis
  // `IDEM_OPENROUTER_<ROLE>_MODEL`, puis le défaut. Une valeur refusée par la
  // liste blanche est ignorée avec un avertissement.
  const models = {} as Record<ModelRole, string>;
  for (const role of Object.keys(OPENROUTER_DEFAULT_ROLES) as ModelRole[]) {
    const hot = runtimeModelFor(role);
    models[role] =
      hot && isAllowedOpenRouterModel(hot)
        ? hot
        : resolveOpenRouterModel(role, (message) => logger.warn(`[OPENROUTER] ${message}`));
  }
  return { ...def, models };
}

/** Indique si le fournisseur supporte une capacité donnée. */
export function providerSupports(
  provider: LLMProvider,
  capability: keyof ProviderCapabilities
): boolean {
  return AI_PROVIDERS[provider] ? Boolean(AI_PROVIDERS[provider].capabilities[capability]) : false;
}

/** Le fournisseur a-t-il de quoi répondre (clé présente) ? */
export function isProviderConfigured(provider: LLMProvider): boolean {
  return AI_PROVIDERS[provider] ? Boolean(getOpenRouterApiKey()) : false;
}

/**
 * Rôle d'un modèle, quel que soit l'endroit qui le déclare.
 *
 * ⚠️ REPLI, plus le chemin nominal. Une configuration issue de `feature()` ou du
 * routeur PORTE son rôle : c'est celui-là qu'il faut lire. Cette fonction ne sert
 * qu'aux modèles arrivés sans intention déclarée — un nom épinglé à la main, un
 * repli — et elle devine. Un modèle inconnu est traité comme `writing` : le défaut
 * le moins surprenant.
 */
export function roleOfModel(modelName: string): ModelRole {
  const needle = (modelName || '').toLowerCase();

  for (const definition of Object.values(AI_PROVIDERS)) {
    for (const [role, name] of Object.entries(definition.models ?? {})) {
      if (name && name.toLowerCase() === needle) return role as ModelRole;
    }
  }

  if (/flux|image/.test(needle)) return 'image';
  if (/ocr/.test(needle)) return 'ocr';
  if (/-vl\b|vision/.test(needle)) return 'vision';
  if (/\bpro\b|max|397b|2\.4t/.test(needle)) return 'reasoning';
  if (/flash|mini|lite|9b/.test(needle)) return 'mechanical';
  return 'writing';
}

/** Modèle servant un rôle chez un fournisseur, ou `undefined` s'il n'en a pas. */
export function modelForRole(provider: LLMProvider, role: ModelRole): string | undefined {
  return getProvider(provider).models?.[role];
}

/**
 * Applique le choix de modèle À CHAUD à une configuration de feature.
 *
 * Une feature porte le modèle que son RÔLE désignait à la construction de
 * `ai.config.ts`. Si l'exploitant a changé le modèle de ce rôle depuis
 * (`npm run ai:models -- --model writing=…`), la configuration est retraduite ici,
 * à chaque appel, sans redémarrage. Un nom de modèle épinglé à la main
 * (`modelName` de section, `AI_OVERRIDES`) n'est jamais touché.
 */
export function resolveGlobalOverride<
  T extends Pick<FeatureAIConfig, 'provider' | 'modelName'> & { role?: ModelRole },
>(config: T): T {
  if (!config.role) return config;

  const pinnedByRole = config.modelName === OPENROUTER_DEFAULT_ROLES[config.role];
  const current = modelForRole(LLMProvider.OPENROUTER, config.role);

  if (pinnedByRole && current && current !== config.modelName) {
    return { ...config, provider: LLMProvider.OPENROUTER, modelName: current };
  }
  return config;
}

/** Appels simultanés autorisés. `IDEM_MAX_PARALLEL_STEPS` reste prioritaire. */
export function resolveConcurrency(): number {
  const forced = Number(process.env.IDEM_MAX_PARALLEL_STEPS);
  if (Number.isFinite(forced) && forced >= 1) return Math.floor(forced);

  const declared = AI_PROVIDERS[LLMProvider.OPENROUTER].concurrency;
  return Number.isFinite(declared) && (declared as number) >= 1 ? Math.floor(declared as number) : 3;
}
