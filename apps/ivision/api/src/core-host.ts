/**
 * iVision, hôte du moteur partagé (`apps/ivision/core`).
 *
 * Mêmes ports que l'hôte IDEM (`apps/api/api/services/ivision/host.ts`), branchés autrement :
 * le stockage est le MinIO d'IDEM (préfixe `ivision/`), les modèles (texte, vision, image,
 * clip, voix) et les crédits passent par la passerelle interne de l'API IDEM. Le core est donc exécuté à l'identique des deux côtés.
 */
import { configureCore } from '../../core/src/runtime/host';
import { setVideoPricingBase } from '../../core/src/video/video.pricing';
import { env } from './config/env';
import logger from './config/logger';
import { storage } from './config/storage';
import { idem } from './services/idem.client';

export function configureCoreForIvision(): void {
  configureCore({
    logger,
    apiBaseUrl: () => env.publicUrl,
    sfxUrl: (name) => `${env.publicUrl}/v1/sfx/${name}`,
    storage,
    analyzeImage: (base64, mimeType, instruction, options) => idem.ai.vision({ base64, mimeType, instruction, options }),
    generateImage: async (prompt, options) => {
      const image = await idem.ai.image({ prompt, size: options.size, tag: options.tag, purpose: options.purpose, model: options.model, fallbackModel: options.fallbackModel });
      return { buffer: Buffer.from(image.base64, 'base64'), mimeType: image.mimeType, model: image.model };
    },
    // Clips et voix off : les modèles d'IDEM (CogVideoX-3, GLM-TTS et son repli), par la passerelle.
    generateVideo: (request) => idem.ai.video(request),
    synthesizeSpeech: async (request) => {
      const speech = await idem.ai.speech(request);
      return { buffer: Buffer.from(speech.base64, 'base64'), mimeType: speech.mimeType, provider: speech.provider, model: speech.model, voice: speech.voice };
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
