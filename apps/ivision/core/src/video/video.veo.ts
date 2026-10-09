/**
 * Génération d'un clip vidéo par Gemini Veo — le dernier recours.
 *
 * Utilisé seulement quand une scène « vidéo » n'a ni clip importé ni clip
 * Pexels correspondant. Plafonné à UN clip par vidéo motion design : c'est la
 * seule étape réellement coûteuse du module.
 *
 * Modèle : `VIDEO_VEO_MODEL` (défaut `veo-3.1-fast-generate-preview` ;
 * `veo-3.1-lite-generate-preview` pour réduire le coût).
 */
import fs from 'fs';
import logger from '../runtime/logger';
import { requirePort } from '../runtime/host';

export const DEFAULT_VEO_MODEL = 'veo-3.1-fast-generate-preview';

export interface VeoRequest {
  prompt: string;
  aspectRatio: '9:16' | '16:9';
  durationSec?: 4 | 6 | 8;
  /** Délai maximal d'attente (Veo répond en 1 à 3 minutes). */
  timeoutMs?: number;
  model?: string;
}

const NEGATIVE =
  'text, captions, subtitles, watermark, logo, letters, distorted faces, extra fingers, low quality, blurry, jittery camera';

/** Génère un clip et l'écrit dans `outFile` (MP4). */
export async function generateVeoClip(req: VeoRequest, outFile: string): Promise<{ model: string; outFile: string }> {
  // Le client Google GenAI vient de l'hôte (clés et backend Vertex/AI Studio : configuration de l'API).
  const ai: any = requirePort('googleGenAI')();
  const model = req.model || process.env.VIDEO_VEO_MODEL || DEFAULT_VEO_MODEL;
  const started = Date.now();
  let operation = await ai.models.generateVideos({
    model,
    prompt: `${req.prompt}. Cinematic, natural light, smooth slow camera movement, no text on screen.`,
    config: {
      aspectRatio: req.aspectRatio,
      numberOfVideos: 1,
      durationSeconds: req.durationSec ?? 8,
      negativePrompt: NEGATIVE,
    },
  });
  const timeout = req.timeoutMs ?? 6 * 60 * 1000;
  while (!operation.done) {
    if (Date.now() - started > timeout) throw new Error('veo_timeout');
    await new Promise((r) => setTimeout(r, 8000));
    operation = await ai.operations.getVideosOperation({ operation });
  }
  if (operation.error) throw new Error(`veo_failed: ${JSON.stringify(operation.error).slice(0, 200)}`);
  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) throw new Error('veo_empty (filtré par la modération ?)');

  if (video.videoBytes) {
    fs.writeFileSync(outFile, Buffer.from(video.videoBytes, 'base64'));
  } else {
    await ai.files.download({ file: video, downloadPath: outFile });
    // Le téléchargement du SDK peut rendre la main avant la fin de l'écriture.
    for (let i = 0; i < 50 && (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0); i++) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  logger.info('video.veo.generated', { model, seconds: Math.round((Date.now() - started) / 1000) });
  return { model, outFile };
}
