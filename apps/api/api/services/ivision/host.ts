/**
 * IDEM, hôte du moteur partagé iVision (`apps/ivision/core`).
 *
 * Le core contient toute la logique créative (vidéos, et bientôt visuels) ; il demande à son
 * hôte quelques branchements. Ici, ceux d'IDEM : le journal winston, le stockage MinIO, le
 * modèle de vision et la génération d'image (glm-media), le client Google GenAI (Veo), le
 * runtime d'agents (étages, escalade, suivi d'usage), la restitution de crédits, et le
 * barème des prix. L'API iVision fait la même chose de son côté (`apps/ivision/api`).
 *
 * Importer ce module suffit (effet de bord idempotent). Tout est paresseux : rien ne se
 * connecte avant le premier appel, donc l'ordre de chargement des secrets est respecté.
 */
import logger from '../../config/logger';
import { BUSINESS_CREDIT_COSTS } from '../../models/billing.model';
import { configureCore, ImageOptions, VisionOptions } from '../../../../ivision/core/src/runtime/host';
import { AI_CONFIG } from '../../config/ai.config';
import { setVideoPricingBase } from '../../../../ivision/core/src/video/video.pricing';
import { apiBaseUrl } from '../Communication/visualUrl';
import { runtimeCall } from '../creativity/orchestrator';

let configured = false;

/**
 * Les modèles de vision d'IDEM, par finalité. L'analyse d'une photo de visuel garde son modèle,
 * son repli et son budget (`AI_CONFIG.communication.imageSourcing`) ; le reste prend le modèle
 * de vision par défaut. Partagé avec la passerelle interne d'iVision : les deux hôtes du moteur
 * appellent exactement les mêmes modèles.
 */
export async function idemAnalyzeImage(base64: string, mimeType: string, instruction: string, options: VisionOptions = {}): Promise<string> {
  const media = await import('../glm-media.service');
  if (!media.isGlmConfigured()) throw new Error('vision_unavailable');
  const sourcing = AI_CONFIG.communication.imageSourcing;
  const { purpose, ...rest } = options;
  return media.analyzeImage(
    base64,
    mimeType,
    instruction,
    purpose === 'visual-analysis' ? { model: sourcing.visionModel, fallbackModel: sourcing.visionFallbackModel, maxOutputTokens: sourcing.visionMaxOutputTokens, ...rest } : rest
  );
}

/** Les modèles d'image d'IDEM, par finalité (fond de visuel : ceux du sourcing ; image de vidéo : Gemini). */
export async function idemGenerateImage(prompt: string, options: ImageOptions) {
  const media = await import('../glm-media.service');
  const sourcing = AI_CONFIG.communication.imageSourcing;
  if (options.purpose === 'visual-background') {
    return media.generateImage(prompt, { model: options.model || sourcing.imageModel, fallbackModel: options.fallbackModel || sourcing.imageFallbackModel, tag: options.tag, ...(options.size ? { size: options.size } : {}) });
  }
  return media.generateImage(prompt, { provider: 'gemini', size: options.size, tag: options.tag, ...(options.model ? { model: options.model } : {}) });
}

export function configureIvisionCoreForIdem(): void {
  if (configured) return;
  configured = true;
  let storage: any;
  const lazyStorage = () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    if (!storage) storage = new (require('../storage.service').StorageService)();
    return storage;
  };
  configureCore({
    logger,
    apiBaseUrl,
    sfxUrl: (name) => `${apiBaseUrl()}/project/communication/sfx/${name}`,
    storage: { uploadFile: (content, fileName, folder, contentType) => lazyStorage().uploadFile(content, fileName, folder, contentType) },
    analyzeImage: idemAnalyzeImage,
    generateImage: idemGenerateImage,
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    googleGenAI: () => require('../../config/google-genai.client').getGoogleGenAIClient(),
    agentCall: (ctx) => runtimeCall(ctx),
    refundCredits: async (userId, cost, meta) => {
      const { creditLedgerService } = await import('../billing/credit-ledger.service');
      const { entitlementsService } = await import('../billing/entitlements.service');
      await creditLedgerService.refundDebit(userId, 'business', cost, meta);
      await entitlementsService.invalidate(userId);
    },
  });
  // Les prix : ceux du barème d'IDEM (la vidéo suit la charte), dans IDEM comme dans iVision.
  setVideoPricingBase({ referenceCost: BUSINESS_CREDIT_COSTS.motion_video, minRerender: BUSINESS_CREDIT_COSTS.revision });
}

configureIvisionCoreForIdem();
