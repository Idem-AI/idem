/**
 * Routeur de modèles à étages — le levier prix nº1 de la plateforme.
 *
 * Le constat: la majorité des appels IA d'IDEM ne sont pas de la rédaction, ce
 * sont des tâches MÉCANIQUES (résumer une section produite, vérifier un format,
 * classer une intention, extraire des chiffres). Les faire tourner sur le même
 * modèle que la rédaction stratégique revient à payer le prix fort pour du
 * travail que le plus petit modèle fait aussi bien.
 *
 * Trois étages, et un seul principe: on tente au plus bas, on n'escalade que si
 * le résultat ÉCHOUE un contrôle (cf. `quality-gate.ts`). Le volume est donc
 * majoritairement servi au tarif bas, avec la qualité du tarif haut là où elle
 * change quelque chose.
 *
 *   XS — mécanique   : résumé, digest, vérification, classification, extraction.
 *   M  — rédaction   : le défaut, production de contenu.
 *   S  — raisonnement: stratégie, plan financier, concept de logo, SVG.
 *
 * Chaque étage est surchargeable par variable d'environnement (IDEM_TIER_*_MODEL)
 * pour permuter un modèle sans redéploiement de code, comme le fait déjà le
 * registre de fournisseurs.
 */

import {
  FeatureAIConfig,
  LLMOptions,
  LLMProvider,
  ModelTier,
  TEXT_FALLBACK_MODELS,
} from './ai.config';

export type { ModelTier };

export interface TierDefinition {
  provider: LLMProvider;
  modelName: string;
  fallbackModels: string[];
  /** Réglages par défaut de l'étage (une section peut toujours les écraser). */
  llmOptions?: LLMOptions;
  /** À quoi sert cet étage — sert de documentation ET de log. */
  purpose: string;
}

/**
 * Ordre d'escalade. `next(tier)` renvoie l'étage supérieur, ou `undefined` au
 * sommet: on ne réessaie jamais indéfiniment, l'escalade est bornée par
 * construction.
 */
const ESCALATION: Record<ModelTier, ModelTier | undefined> = {
  XS: 'M',
  M: 'S',
  S: undefined,
};

export const MODEL_TIERS: Record<ModelTier, TierDefinition> = {
  XS: {
    provider: LLMProvider.GEMINI,
    modelName: process.env.IDEM_TIER_XS_MODEL || 'gemini-2.5-flash',
    fallbackModels: TEXT_FALLBACK_MODELS,
    // Températures basses: ces tâches sont déterministes par nature, la
    // créativité n'y est qu'une source de variance.
    llmOptions: { temperature: 0.1, maxOutputTokens: 1024 },
    purpose: 'mécanique (résumé, vérification, classification, extraction)',
  },
  M: {
    provider: LLMProvider.GEMINI,
    modelName: process.env.IDEM_TIER_M_MODEL || 'gemini-3-flash-preview',
    fallbackModels: TEXT_FALLBACK_MODELS,
    llmOptions: { temperature: 0.5 },
    purpose: 'rédaction et structuration de contenu',
  },
  S: {
    provider: LLMProvider.GEMINI,
    modelName: process.env.IDEM_TIER_S_MODEL || 'gemini-3.1-pro-preview',
    fallbackModels: TEXT_FALLBACK_MODELS,
    llmOptions: { temperature: 0.5 },
    purpose: 'raisonnement (stratégie, chiffres, création visuelle)',
  },
};

/**
 * Nature d'une tâche IA. C'est la seule chose qu'un service métier doit savoir
 * déclarer: le choix du modèle n'est plus dispersé dans le code applicatif.
 */
export type TaskKind =
  | 'digest' // résumer une section déjà produite
  | 'verify' // contrôler une sortie
  | 'repair' // corriger une sortie signalée
  | 'classify' // router une intention
  | 'extract' // sortir des données structurées d'un texte
  | 'draft' // rédiger une section standard
  | 'strategy' // rédiger une section à forte valeur (synthèse, financier)
  | 'creative'; // production visuelle (SVG, HTML de marque)

const TIER_BY_TASK: Record<TaskKind, ModelTier> = {
  digest: 'XS',
  verify: 'XS',
  repair: 'XS',
  classify: 'XS',
  extract: 'XS',
  draft: 'M',
  strategy: 'S',
  creative: 'S',
};

export function tierForTask(task: TaskKind): ModelTier {
  return TIER_BY_TASK[task];
}

/** Étage immédiatement supérieur, ou `undefined` si on est déjà au sommet. */
export function nextTier(tier: ModelTier): ModelTier | undefined {
  return ESCALATION[tier];
}

/**
 * Traduit un étage en `FeatureAIConfig` — le format que comprend déjà tout le
 * reste du code (resolveSectionConfig, GenericService, PromptService).
 *
 * `overrides` permet à une section de garder ses réglages propres (budget de
 * tokens d'une section lourde, température d'un slide créatif) tout en profitant
 * du routage: seul le MODÈLE vient de l'étage.
 */
export function tierConfig(
  tier: ModelTier,
  overrides: Partial<FeatureAIConfig> = {}
): FeatureAIConfig {
  const definition = MODEL_TIERS[tier];
  return {
    provider: overrides.provider ?? definition.provider,
    modelName: overrides.modelName ?? definition.modelName,
    fallbackModels: overrides.fallbackModels ?? definition.fallbackModels,
    promptType: overrides.promptType,
    llmOptions: {
      ...definition.llmOptions,
      ...overrides.llmOptions,
      ...(definition.llmOptions?.extraBody || overrides.llmOptions?.extraBody
        ? {
            extraBody: {
              ...definition.llmOptions?.extraBody,
              ...overrides.llmOptions?.extraBody,
            },
          }
        : {}),
    },
  };
}

/**
 * Traduit le `tier` d'une config résolue en modèle concret.
 *
 * C'est le seul endroit où un étage devient un nom de modèle côté génération de
 * sections. Une section qui déclare explicitement `modelName` garde la main:
 * l'étage est une commodité, jamais une contrainte.
 */
export function applyTier(config: FeatureAIConfig): FeatureAIConfig {
  if (!config.tier) return config;

  const definition = MODEL_TIERS[config.tier];
  return {
    ...config,
    provider: definition.provider,
    modelName: definition.modelName,
    fallbackModels: config.fallbackModels ?? definition.fallbackModels,
    llmOptions: { ...definition.llmOptions, ...config.llmOptions },
  };
}

/**
 * Étage d'un modèle nommé explicitement dans `ai.config.ts`.
 *
 * Sert au routage inverse: quand une feature impose déjà son modèle, on veut
 * quand même savoir de quel étage elle part pour pouvoir escalader depuis là.
 * Un modèle inconnu est considéré comme M (l'étage de rédaction par défaut).
 */
export function tierOfModel(modelName: string): ModelTier {
  const entries = Object.entries(MODEL_TIERS) as [ModelTier, TierDefinition][];
  const exact = entries.find(([, definition]) => definition.modelName === modelName);
  if (exact) return exact[0];
  if (/pro/i.test(modelName)) return 'S';
  if (/lite/i.test(modelName)) return 'XS';
  return 'M';
}
