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
 * ── UN ÉTAGE EST UN RÔLE ────────────────────────────────────────────────────
 *
 * XS/M/S ne sont PAS une troisième famille de modèles : ce sont les rôles
 * `mechanical`/`writing`/`reasoning` vus sous l'angle du COÛT et de l'escalade
 * (cf. `TIER_ROLE`, ai.config.ts). Ce fichier portait auparavant sa propre table
 * `MODEL_TIERS` — mêmes trois modèles réécrits à la main, plus un `provider:
 * GLM` en dur et une chaîne de repli recopiée. Trois tables à tenir alignées, et
 * rien pour signaler qu'elles avaient cessé de l'être.
 *
 * Les étages sont désormais RÉSOLUS depuis le registre des fournisseurs. Un
 * changement de modèle se fait à un seul endroit (`ROLE_MODELS`), et chaque
 * étage reste surchargeable par variable d'environnement (`IDEM_TIER_*_MODEL`)
 * pour permuter sans redéploiement.
 */

import {
  DEFAULT_PROVIDER,
  FeatureAIConfig,
  LLMOptions,
  LLMProvider,
  ModelRole,
  ModelTier,
  TIER_ROLE,
} from './ai.config';
import { getProvider, modelForRole, roleOfModel } from './ai-providers.config';

export type { ModelTier };

export interface TierDefinition {
  provider: LLMProvider;
  modelName: string;
  /** Le rôle dont cet étage est le nom. */
  role: ModelRole;
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

/** Traduction inverse — un rôle vers son étage. */
const ROLE_TIER: Record<ModelRole, ModelTier> = {
  mechanical: 'XS',
  writing: 'M',
  reasoning: 'S',
  // Les rôles multimodaux n'ont pas d'étage propre : ils ne participent pas à
  // l'escalade par le coût (on n'escalade pas d'un modèle de vision vers un
  // modèle de raisonnement). Rattachés à M, l'étage neutre.
  vision: 'M',
  image: 'M',
  ocr: 'M',
};

/** Réglages propres à chaque étage — la seule chose qu'un étage ajoute à un rôle. */
const TIER_OPTIONS: Record<ModelTier, { llmOptions: LLMOptions; purpose: string }> = {
  XS: {
    // Températures basses: ces tâches sont déterministes par nature, la
    // créativité n'y est qu'une source de variance.
    //
    // Raisonnement DÉSACTIVÉ (`thinkingBudget: 0`): c'est la définition même de
    // cet étage. Il évitait déjà le tarif « raisonnement » en choisissant un
    // petit modèle, mais continuait à payer des tokens de réflexion — lesquels
    // sont décomptés des 1024 tokens de sortie, au point de tronquer des
    // résumés et des vérifications qui tiennent pourtant en trois lignes.
    llmOptions: { temperature: 0.1, maxOutputTokens: 1024, thinkingBudget: 0 },
    purpose: 'mécanique (résumé, vérification, classification, extraction)',
  },
  M: {
    llmOptions: { temperature: 0.5 },
    purpose: 'rédaction et structuration de contenu',
  },
  S: {
    // Raisonnement COUPÉ, comme aux autres étages (cf. `extraBody` du
    // fournisseur). Il multipliait la latence par trois — une section passait
    // de deux à neuf secondes — pour un gain que la production de contenu ne
    // justifiait pas. Le budget de sortie reste large : un SVG complet ou un
    // tableau financier dépasse facilement les enveloppes courtes.
    llmOptions: { temperature: 0.5, maxOutputTokens: 16000 },
    purpose: 'sections à forte valeur (stratégie, chiffres, création visuelle)',
  },
};

/** Modèle épinglé pour un étage, sans redéploiement. Échappatoire, pas le défaut. */
const TIER_MODEL_ENV: Record<ModelTier, string> = {
  XS: 'IDEM_TIER_XS_MODEL',
  M: 'IDEM_TIER_M_MODEL',
  S: 'IDEM_TIER_S_MODEL',
};

/**
 * Définition d'un étage, résolue à l'APPEL.
 *
 * Paresseuse et non figée à l'import, pour la même raison que le backend Gemini:
 * `loadSecrets()` complète l'environnement APRÈS le chargement des modules, si
 * bien qu'une table constante lisait des variables encore vides.
 */
export function tierDefinition(tier: ModelTier): TierDefinition {
  const role = TIER_ROLE[tier];
  const provider = DEFAULT_PROVIDER;

  return {
    provider,
    modelName: process.env[TIER_MODEL_ENV[tier]] || modelForRole(provider, role) || '',
    role,
    // Le repli appartient au FOURNISSEUR, jamais à l'étage : une chaîne de noms
    // recopiée ici redeviendrait fausse à la première bascule.
    fallbackModels: getProvider(provider).defaultFallbackModels ?? [],
    ...TIER_OPTIONS[tier],
  };
}

/**
 * Les trois étages.
 *
 * Accesseurs plutôt que valeurs : chaque lecture résout l'étage à l'instant où
 * on le demande, donc après le chargement des secrets et après tout changement
 * de `IDEM_TIER_*_MODEL`. `Object.entries`/`values` déclenchent les accesseurs,
 * les appelants existants n'ont rien à changer.
 */
export const MODEL_TIERS: Record<ModelTier, TierDefinition> = {
  get XS() {
    return tierDefinition('XS');
  },
  get M() {
    return tierDefinition('M');
  },
  get S() {
    return tierDefinition('S');
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

/** Fusionne deux jeux de réglages, `extraBody` compris (sinon il serait remplacé). */
function mergeOptions(base?: LLMOptions, over?: LLMOptions): LLMOptions {
  return {
    ...base,
    ...over,
    ...(base?.extraBody || over?.extraBody
      ? { extraBody: { ...base?.extraBody, ...over?.extraBody } }
      : {}),
  };
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
  const definition = tierDefinition(tier);
  return {
    provider: overrides.provider ?? definition.provider,
    modelName: overrides.modelName ?? definition.modelName,
    // Le rôle voyage avec le modèle : c'est lui qui permettra à une bascule de
    // fournisseur de traduire exactement, au lieu de redeviner l'intention.
    role: overrides.modelName ? overrides.role : (overrides.role ?? definition.role),
    fallbackModels: overrides.fallbackModels ?? definition.fallbackModels,
    promptType: overrides.promptType,
    llmOptions: mergeOptions(definition.llmOptions, overrides.llmOptions),
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

  const definition = tierDefinition(config.tier);
  return {
    ...config,
    provider: definition.provider,
    modelName: definition.modelName,
    role: definition.role,
    fallbackModels: config.fallbackModels ?? definition.fallbackModels,
    llmOptions: { ...definition.llmOptions, ...config.llmOptions },
  };
}

/**
 * Étage d'un modèle nommé explicitement dans `ai.config.ts`.
 *
 * Sert au routage inverse: quand une feature impose déjà son modèle, on veut
 * quand même savoir de quel étage elle part pour pouvoir escalader depuis là.
 *
 * UNE SEULE recherche inverse, désormais. Ce fichier en avait une (exacte sur
 * `MODEL_TIERS`, puis `/pro/` et `/lite/`) et le registre des fournisseurs une
 * autre (`roleOfModel`) : deux jeux d'expressions régulières sur les mêmes noms
 * de modèles, qui répondaient déjà différemment hors catalogue. Un étage étant
 * un rôle, il suffit de traduire.
 */
export function tierOfModel(modelName: string): ModelTier {
  return ROLE_TIER[roleOfModel(modelName)];
}
