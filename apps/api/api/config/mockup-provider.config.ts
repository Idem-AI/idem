/**
 * Fournisseur des mises en situation de la charte — modifiable À CHAUD.
 *
 * Le choix vit en base (`platform_settings`, document `mockups`) et non dans
 * une variable d'environnement : il se change à tout moment, sans redéploiement
 * ni redémarrage. Il est relu au plus toutes les `CACHE_MS`.
 *
 * Ordre de décision :
 *   1. le document `platform_settings/mockups` → `{ provider: 'gemini' | 'glm' }` ;
 *   2. `IDEM_MOCKUP_PROVIDER` (défaut de déploiement) ;
 *   3. `gemini`.
 * Un fournisseur choisi mais non configuré (clé absente) cède la place à
 * l'autre, avec un avertissement : une charte sans mises en situation serait
 * pire qu'une charte faite par l'autre fournisseur.
 *
 * Changer de fournisseur : `npm run mockups:provider -- gemini|glm`, ou écrire
 * le document directement (Compass, panel d'administration).
 *
 * Seules les mises en situation PRODUIT sont concernées : les mockups de
 * réseaux sociaux et les bannières sont des gabarits HTML, sans IA.
 */

import mongoose from 'mongoose';
import logger from './logger';
import { getGlmApiKey, isGeminiConfigured } from './ai-providers.config';

export type MockupProvider = 'gemini' | 'glm';

export const MOCKUP_PROVIDERS: readonly MockupProvider[] = ['gemini', 'glm'];

const SETTINGS_COLLECTION = 'platform_settings';
const SETTINGS_ID = 'mockups';
const CACHE_MS = 30_000;

let cached: { value: MockupProvider | null; at: number } | null = null;

function parseProvider(value: unknown): MockupProvider | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  return (MOCKUP_PROVIDERS as readonly string[]).includes(normalized)
    ? (normalized as MockupProvider)
    : null;
}

/** Le choix enregistré en base, ou `null` (aucun choix, base injoignable). */
async function readStoredProvider(): Promise<MockupProvider | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  let value: MockupProvider | null = null;
  try {
    if (mongoose.connection.readyState === 1) {
      const doc = await mongoose.connection
        .collection(SETTINGS_COLLECTION)
        .findOne({ _id: SETTINGS_ID } as any);
      value = parseProvider(doc?.provider);
    }
  } catch (error: any) {
    logger.warn(`[MOCKUP] Réglage du fournisseur illisible (${error?.message}) — défaut appliqué`);
  }
  cached = { value, at: Date.now() };
  return value;
}

function isAvailable(provider: MockupProvider): boolean {
  return provider === 'gemini' ? isGeminiConfigured() : Boolean(getGlmApiKey());
}

/** Le fournisseur qui produira les prochaines mises en situation. */
export async function resolveMockupProvider(): Promise<MockupProvider> {
  const wanted =
    (await readStoredProvider()) ?? parseProvider(process.env.IDEM_MOCKUP_PROVIDER) ?? 'gemini';
  if (isAvailable(wanted)) return wanted;

  const other: MockupProvider = wanted === 'gemini' ? 'glm' : 'gemini';
  if (isAvailable(other)) {
    logger.warn(`[MOCKUP] ${wanted} choisi mais non configuré — mises en situation par ${other}`);
    return other;
  }
  return wanted;
}

/** Enregistre le fournisseur ; effectif immédiatement sur cette instance, sous `CACHE_MS` ailleurs. */
export async function setMockupProvider(provider: MockupProvider): Promise<void> {
  await mongoose.connection
    .collection(SETTINGS_COLLECTION)
    .updateOne(
      { _id: SETTINGS_ID } as any,
      { $set: { provider, updatedAt: new Date() } },
      { upsert: true }
    );
  cached = { value: provider, at: Date.now() };
}
