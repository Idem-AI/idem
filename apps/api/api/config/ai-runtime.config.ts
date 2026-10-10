/**
 * Fournisseur IA modifiable À CHAUD.
 *
 * Basculer GEMINI ↔ GLM ↔ OPENROUTER ne demande ni redéploiement ni redémarrage :
 * le choix vit en base (`platform_settings`, document `ai`), comme celui des mises
 * en situation de la charte (cf. mockup-provider.config.ts), et chaque instance le
 * relit toutes les `REFRESH_MS`.
 *
 * Ordre de décision, du plus fort au plus faible :
 *   1. le document `platform_settings/ai`            — le réglage d'exploitation ;
 *   2. `AI_DEFAULT_PROVIDER` / `IDEM_MEDIA_PROVIDER` — le défaut de déploiement ;
 *   3. la configuration des features (GLM).
 *
 * Document :
 *   {
 *     provider: 'GEMINI' | 'GLM' | 'OPENROUTER',   // texte, vision, OCR
 *     media:    'gemini' | 'glm' | 'openrouter',   // image ; absent = suit `provider`
 *     models:   { writing: 'qwen/…', image: 'black-forest-labs/…' }  // OpenRouter, par rôle
 *   }
 *
 * Lecture SYNCHRONE depuis un instantané mémoire : `resolveGlobalOverride` est
 * appelé au point de passage de chaque génération et ne peut pas attendre la
 * base. L'instantané est rafraîchi en arrière-plan ; une écriture le met à jour
 * immédiatement sur l'instance qui la fait.
 *
 * Changer de fournisseur : `npm run ai:provider -- openrouter`, ou écrire le
 * document (Compass, panel d'administration).
 */

import mongoose from 'mongoose';
import logger from './logger';
import { LLMProvider, MODEL_ROLES, ModelRole } from './ai.config';

export type MediaProviderName = 'glm' | 'gemini' | 'openrouter';

export interface AiRuntimeSettings {
  provider?: LLMProvider;
  media?: MediaProviderName;
  /** Modèles OpenRouter par rôle — surcharge `IDEM_OPENROUTER_<ROLE>_MODEL`. */
  models?: Partial<Record<ModelRole, string>>;
}

const SETTINGS_COLLECTION = 'platform_settings';
const SETTINGS_ID = 'ai';
const REFRESH_MS = 15_000;

export const MEDIA_PROVIDERS: readonly MediaProviderName[] = ['glm', 'gemini', 'openrouter'];

let snapshot: AiRuntimeSettings = {};
let timer: NodeJS.Timeout | undefined;

function parseSettings(doc: any): AiRuntimeSettings {
  const settings: AiRuntimeSettings = {};

  const provider = String(doc?.provider ?? '').trim().toUpperCase();
  if ((Object.values(LLMProvider) as string[]).includes(provider)) {
    settings.provider = provider as LLMProvider;
  }

  const media = String(doc?.media ?? '').trim().toLowerCase();
  if ((MEDIA_PROVIDERS as readonly string[]).includes(media)) {
    settings.media = media as MediaProviderName;
  }

  if (doc?.models && typeof doc.models === 'object') {
    const models: Partial<Record<ModelRole, string>> = {};
    for (const role of MODEL_ROLES) {
      const value = typeof doc.models[role] === 'string' ? doc.models[role].trim() : '';
      if (value) models[role] = value;
    }
    if (Object.keys(models).length > 0) settings.models = models;
  }

  return settings;
}

/** Relit le document. Base injoignable : l'instantané précédent est conservé. */
export async function refreshAiRuntime(): Promise<AiRuntimeSettings> {
  try {
    if (mongoose.connection.readyState === 1) {
      const doc = await mongoose.connection
        .collection(SETTINGS_COLLECTION)
        .findOne({ _id: SETTINGS_ID } as any);
      const next = parseSettings(doc);
      if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
        logger.info(`[AI] Réglage du fournisseur mis à jour : ${JSON.stringify(next)}`);
      }
      snapshot = next;
    }
  } catch (error: any) {
    logger.warn(`[AI] Réglage du fournisseur illisible (${error?.message}) — instantané conservé`);
  }
  return snapshot;
}

/** Démarre la relecture périodique. Idempotent ; ne retient pas le processus. */
export function startAiRuntimeSync(): void {
  if (timer) return;
  void refreshAiRuntime();
  timer = setInterval(() => void refreshAiRuntime(), REFRESH_MS);
  timer.unref();
}

export function getAiRuntime(): Readonly<AiRuntimeSettings> {
  return snapshot;
}

/** Fournisseur texte en vigueur : base, puis `AI_DEFAULT_PROVIDER`. */
export function activeProvider(): LLMProvider | undefined {
  if (snapshot.provider) return snapshot.provider;
  const env = (process.env.AI_DEFAULT_PROVIDER ?? '').trim().toUpperCase();
  return (Object.values(LLMProvider) as string[]).includes(env) ? (env as LLMProvider) : undefined;
}

/** Fournisseur média demandé (avant vérification des clés), ou `undefined` pour « suivre le texte ». */
export function requestedMedia(): MediaProviderName | undefined {
  if (snapshot.media) return snapshot.media;
  const env = (process.env.IDEM_MEDIA_PROVIDER ?? '').trim().toLowerCase();
  return (MEDIA_PROVIDERS as readonly string[]).includes(env) ? (env as MediaProviderName) : undefined;
}

/** Modèle OpenRouter choisi à chaud pour un rôle. */
export function runtimeModelFor(role: ModelRole): string | undefined {
  return snapshot.models?.[role];
}

/** Fusionne un réglage dans le document ; `null` retire un champ. Effectif ici tout de suite. */
export async function setAiRuntime(patch: {
  provider?: LLMProvider | null;
  media?: MediaProviderName | null;
  models?: Partial<Record<ModelRole, string | null>>;
}): Promise<AiRuntimeSettings> {
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  const $unset: Record<string, ''> = {};

  if (patch.provider !== undefined) {
    patch.provider === null ? ($unset.provider = '') : ($set.provider = patch.provider);
  }
  if (patch.media !== undefined) {
    patch.media === null ? ($unset.media = '') : ($set.media = patch.media);
  }
  for (const [role, model] of Object.entries(patch.models ?? {})) {
    if (!(MODEL_ROLES as readonly string[]).includes(role)) continue;
    model ? ($set[`models.${role}`] = model) : ($unset[`models.${role}`] = '');
  }

  await mongoose.connection.collection(SETTINGS_COLLECTION).updateOne(
    { _id: SETTINGS_ID } as any,
    { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
    { upsert: true }
  );
  return refreshAiRuntime();
}
