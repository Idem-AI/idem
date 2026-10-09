/**
 * IDEM, hôte du moteur partagé iVision (`apps/ivision/core`).
 *
 * Le core contient toute la logique créative (vidéos, et bientôt visuels) ; il demande à son
 * hôte quelques branchements. Ici, ceux d'IDEM : le journal winston, le stockage MinIO, le
 * modèle de vision, la génération d'image, de clip (CogVideoX-3) et de voix (GLM-TTS, repli
 * Gemini TTS) — tous dans glm-media —, le runtime d'agents (étages, escalade, suivi d'usage),
 * la restitution de crédits, et le barème des prix. L'API iVision fait la même chose de son
 * côté (`apps/ivision/api`).
 *
 * Importer ce module suffit (effet de bord idempotent). Tout est paresseux : rien ne se
 * connecte avant le premier appel, donc l'ordre de chargement des secrets est respecté.
 */
import logger from '../../config/logger';
import { BUSINESS_CREDIT_COSTS } from '../../models/billing.model';
import { configureCore, ImageOptions, SpeechRequest, SynthesizedSpeech, VideoClipRequest, VisionOptions } from '../../../../ivision/core/src/runtime/host';
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

/**
 * Les modèles d'image d'IDEM, par finalité. Fond de visuel : ceux du sourcing. Plan d'une
 * vidéo : la famille GLM (GLM-Image, repli CogView-4) dès que sa clé existe — la vidéo anime
 * ensuite cette image avec CogVideoX-3 ; sans clé GLM, Gemini.
 */
export async function idemGenerateImage(prompt: string, options: ImageOptions) {
  const media = await import('../glm-media.service');
  const { getGlmApiKey } = await import('../../config/ai-providers.config');
  const sourcing = AI_CONFIG.communication.imageSourcing;
  if (options.purpose === 'visual-background') {
    return media.generateImage(prompt, { model: options.model || sourcing.imageModel, fallbackModel: options.fallbackModel || sourcing.imageFallbackModel, tag: options.tag, ...(options.size ? { size: options.size } : {}) });
  }
  const videoMedia = AI_CONFIG.communication.videoMedia;
  if (getGlmApiKey()) {
    return media.generateImage(prompt, { provider: 'glm', model: options.model || videoMedia.imageModel, fallbackModel: options.fallbackModel || videoMedia.imageFallbackModel, tag: options.tag, ...(options.size ? { size: options.size } : {}) });
  }
  return media.generateImage(prompt, { provider: 'gemini', size: options.size, tag: options.tag });
}

/** Un clip d'un plan de vidéo : CogVideoX-3 (Z.ai). Partagé avec la passerelle d'iVision. */
export async function idemGenerateVideo(request: VideoClipRequest): Promise<{ url: string; model: string }> {
  const media = await import('../glm-media.service');
  const { url, model } = await media.generateVideo({ prompt: request.prompt, image: request.image, size: request.size, durationSec: request.durationSec, quality: request.quality, tag: request.tag });
  return { url, model };
}

/** Une ligne de voix off : GLM-TTS dans ses langues, Gemini TTS sinon. Partagé avec iVision. */
export async function idemSynthesizeSpeech(request: SpeechRequest): Promise<SynthesizedSpeech> {
  const media = await import('../glm-media.service');
  return media.generateSpeech({ text: request.text, language: request.language, provider: request.provider, voice: request.voice, style: request.style, tag: request.tag });
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
    generateVideo: idemGenerateVideo,
    synthesizeSpeech: idemSynthesizeSpeech,
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
