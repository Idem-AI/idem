/**
 * Choix des modèles OpenRouter modifiable À CHAUD.
 *
 * Changer le modèle d'un rôle (Qwen ↔ DeepSeek, une taille de Qwen…) ne demande
 * ni redéploiement ni redémarrage : le choix vit en base (`platform_settings`,
 * document `ai`), et chaque instance le relit toutes les `REFRESH_MS`.
 *
 * Ordre de décision, du plus fort au plus faible :
 *   1. le document `platform_settings/ai`           — le réglage d'exploitation ;
 *   2. `IDEM_OPENROUTER_<ROLE>_MODEL`               — le défaut de déploiement ;
 *   3. `OPENROUTER_DEFAULT_ROLES`                   — le défaut du code.
 *
 * Document :  { models: { writing: 'qwen/…', image: 'black-forest-labs/…' } }
 * Seuls les modèles de la liste blanche (`openrouter.config.ts`) sont acceptés.
 *
 * Lecture SYNCHRONE depuis un instantané mémoire : la résolution du modèle est
 * appelée au point de passage de chaque génération et ne peut pas attendre la
 * base. L'instantané est rafraîchi en arrière-plan ; une écriture le met à jour
 * immédiatement sur l'instance qui la fait.
 *
 * Changer un modèle : `npm run ai:models -- --model writing=qwen/qwen3.5-27b`.
 */

import mongoose from 'mongoose';
import logger from './logger';
import { MODEL_ROLES, ModelRole } from './ai.config';

export interface AiRuntimeSettings {
  /** Modèles OpenRouter par rôle. */
  models?: Partial<Record<ModelRole, string>>;
  /**
   * Où partent les générations par sorte : `openrouter` ou `idem-ml` (cf. `ai-backend.config.ts`). Prime sur
   * `IDEM_AI_BACKEND`. Document : `{ backend: { text: 'idem-ml', image: 'openrouter', logo: 'idem-ml' } }`.
   */
  backend?: Partial<Record<BackendKind, string>>;
}

/** Les sortes d'appel que nos machines peuvent servir (miroir de `SELF_HOSTABLE_KINDS`, sans import circulaire). */
export const BACKEND_KINDS = ['text', 'image', 'video', 'logo'] as const;
export type BackendKind = (typeof BACKEND_KINDS)[number];
const BACKEND_VALUES = ['openrouter', 'idem-ml'];

const SETTINGS_COLLECTION = 'platform_settings';
const SETTINGS_ID = 'ai';
const REFRESH_MS = 15_000;

let snapshot: AiRuntimeSettings = {};
let timer: NodeJS.Timeout | undefined;

function parseSettings(doc: any): AiRuntimeSettings {
  const models: Partial<Record<ModelRole, string>> = {};
  if (doc?.models && typeof doc.models === 'object') {
    for (const role of MODEL_ROLES) {
      const value = typeof doc.models[role] === 'string' ? doc.models[role].trim() : '';
      if (value) models[role] = value;
    }
  }
  const backend: Partial<Record<BackendKind, string>> = {};
  if (doc?.backend && typeof doc.backend === 'object') {
    for (const kind of BACKEND_KINDS) {
      const value = typeof doc.backend[kind] === 'string' ? doc.backend[kind].trim().toLowerCase() : '';
      if (BACKEND_VALUES.includes(value)) backend[kind] = value;
    }
  }
  return {
    ...(Object.keys(models).length > 0 ? { models } : {}),
    ...(Object.keys(backend).length > 0 ? { backend } : {}),
  };
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
        logger.info(`[AI] Choix des modèles mis à jour : ${JSON.stringify(next)}`);
      }
      snapshot = next;
    }
  } catch (error: any) {
    logger.warn(`[AI] Choix des modèles illisible (${error?.message}) — instantané conservé`);
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

/** Modèle choisi à chaud pour un rôle. */
export function runtimeModelFor(role: ModelRole): string | undefined {
  return snapshot.models?.[role];
}

/** Fusionne des modèles dans le document ; `null` retire un rôle. Effectif ici tout de suite. */
export async function setAiRuntime(patch: {
  models?: Partial<Record<ModelRole, string | null>>;
  backend?: Partial<Record<BackendKind, string | null>>;
}): Promise<AiRuntimeSettings> {
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  const $unset: Record<string, ''> = {};

  for (const [role, model] of Object.entries(patch.models ?? {})) {
    if (!(MODEL_ROLES as readonly string[]).includes(role)) continue;
    model ? ($set[`models.${role}`] = model) : ($unset[`models.${role}`] = '');
  }
  for (const [kind, value] of Object.entries(patch.backend ?? {})) {
    if (!(BACKEND_KINDS as readonly string[]).includes(kind)) continue;
    value && BACKEND_VALUES.includes(value) ? ($set[`backend.${kind}`] = value) : ($unset[`backend.${kind}`] = '');
  }

  await mongoose.connection.collection(SETTINGS_COLLECTION).updateOne(
    { _id: SETTINGS_ID } as any,
    { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
    { upsert: true }
  );
  return refreshAiRuntime();
}
