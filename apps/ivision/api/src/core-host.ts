/**
 * iVision, hôte du moteur partagé (`apps/ivision/core`).
 *
 * Mêmes ports que l'hôte IDEM (`apps/api/api/services/ivision/host.ts`), branchés autrement :
 * le stockage est le MinIO d'IDEM (préfixe `ivision/`), les modèles (texte, vision, image,
 * clip, voix) et les crédits passent par la passerelle interne de l'API IDEM. Le core est donc exécuté à l'identique des deux côtés.
 */
import crypto from 'crypto';
import { configureCore } from '../../core/src/runtime/host';
import { setVideoPricingBase } from '../../core/src/video/video.pricing';
import { collection } from './config/db';
import { env } from './config/env';
import logger from './config/logger';
import { storage } from './config/storage';
import { idem } from './services/idem.client';

interface AiCacheDoc {
  _id: string;
  kind: 'speech' | 'vision';
  result: unknown;
  createdAt: Date;
}

const aiCache = () => collection<AiCacheDoc>('ai_cache');
let ttlIndexEnsured = false;

/**
 * Cache générique pour des appels IA DÉTERMINISTES : une même entrée doit produire le même
 * résultat (voix off d'un même texte, classification d'une même image). N'est volontairement PAS
 * utilisé pour `generateImage` : le flux « 3 essais avant repli Pexels » attend des images
 * DIFFÉRENTES pour un même prompt, qu'un cache annulerait.
 */
async function withCache<T>(kind: AiCacheDoc['kind'], keyParts: unknown, compute: () => Promise<T>): Promise<T> {
  const col = aiCache();
  if (!ttlIndexEnsured) {
    ttlIndexEnsured = true;
    col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }).catch((error) =>
      logger.warn('ai_cache.index_failed', { event: 'ai_cache.index_failed', error })
    );
  }
  const key = crypto.createHash('sha256').update(kind).update(JSON.stringify(keyParts)).digest('hex');
  const hit = await col.findOne({ _id: key }).catch(() => null);
  if (hit) return hit.result as T;
  const result = await compute();
  await col.updateOne(
    { _id: key },
    { $set: { kind, result, createdAt: new Date() } },
    { upsert: true }
  ).catch((error) => logger.warn('ai_cache.write_failed', { event: 'ai_cache.write_failed', error }));
  return result;
}

export function configureCoreForIvision(): void {
  configureCore({
    logger,
    apiBaseUrl: () => env.publicUrl,
    sfxUrl: (name) => `${env.publicUrl}/v1/sfx/${name}`,
    storage,
    analyzeImage: (base64, mimeType, instruction, options) =>
      withCache(
        'vision',
        // L'image elle-même est hachée (pas embarquée telle quelle) : la clé reste petite.
        { imageHash: crypto.createHash('sha256').update(base64).digest('hex'), mimeType, instruction, options },
        () => idem.ai.vision({ base64, mimeType, instruction, options })
      ),
    generateImage: async (prompt, options) => {
      const image = await idem.ai.image({ prompt, size: options.size, tag: options.tag, purpose: options.purpose, model: options.model, fallbackModel: options.fallbackModel });
      return { buffer: Buffer.from(image.base64, 'base64'), mimeType: image.mimeType, model: image.model };
    },
    // Clips et voix off : les modèles d'IDEM (Seedance, Kokoro), par la passerelle.
    generateVideo: (request) => idem.ai.video(request),
    synthesizeSpeech: async (request) => {
      const cached = await withCache(
        'speech',
        { text: request.text, language: request.language, style: request.style, tag: request.tag },
        async () => {
          const speech = await idem.ai.speech(request);
          return { base64: speech.base64, mimeType: speech.mimeType, provider: speech.provider, model: speech.model, voice: speech.voice };
        }
      );
      return { buffer: Buffer.from(cached.base64, 'base64'), mimeType: cached.mimeType, provider: cached.provider, model: cached.model, voice: cached.voice };
    },
    // Le runtime d'IDEM ne voit pas la fonction de validation (elle ne voyage pas) : elle est
    // appliquée ici, et une réponse illisible est redemandée une fois — comme l'escalade d'IDEM.
    agentCall: (ctx) => async ({ role, profile, system, user, validate }) => {
      const ask = () => idem.ai.agent({ ...ctx, role, profile, system, user });
      const first = await ask();
      if (!validate || validate(first)) return first;
      return ask();
    },
    refundCredits: async (userId, cost, meta) => {
      await idem.billing.refund({ userId, cost, action: meta.action, note: meta.note });
    },
  });
}

/** Les prix d'IDEM (la vidéo suit la charte) ; relus toutes les 10 minutes. */
export async function syncPricesFromIdem(): Promise<void> {
  try {
    const prices = await idem.billing.prices();
    setVideoPricingBase({ referenceCost: prices.motion_video, minRerender: prices.revision });
  } catch (error) {
    logger.warn('pricing.sync_failed', { event: 'pricing.sync_failed', error });
  }
}
