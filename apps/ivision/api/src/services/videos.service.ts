/**
 * Les VIDÉOS d'iVision : le service vidéo du moteur partagé (`core/src/video`), le même
 * qu'IDEM, sur les marques d'iVision. Création (avec ou sans vidéo modèle), retouches gratuites,
 * aperçu, export MP4 : mêmes étapes, mêmes prix, même rendu.
 */
import { normalizeCreativity } from '../../../core/src/creativity/levels';
import { MotionVideoService, VideoProgressListener } from '../../../core/src/video/motionVideo.service';
import type { MotionVideo, VideoMediaAsset, VideoType } from '../../../core/src/video/video.model';
import { normalizeScope } from '../../../core/src/video/video.pricing';
import { VIDEO_TYPES } from '../../../core/src/video/video.model';
import { IvisionVideoStore } from '../stores/video.store';
import type { ChatOptions } from '../models';
import type { ReferenceBlueprint } from '../../../core/src/reference/reference.analyzer';

export const motionVideos = new MotionVideoService(new IvisionVideoStore());

/** Le périmètre demandé (durée, formats, qualité) : bornes du moteur, défauts d'IDEM. */
export function scopeOf(options: ChatOptions) {
  return normalizeScope({ durationSec: options.durationSec, formats: options.formats, quality: options.quality });
}

export async function createVideo(
  userId: string,
  brandId: string,
  input: { text: string; details?: string; options: ChatOptions; media: VideoMediaAsset[]; reference?: ReferenceBlueprint & { id: string }; language?: string },
  paid: number,
  onProgress: VideoProgressListener
): Promise<MotionVideo> {
  const clean = input.text.replace(/\s+/g, ' ').trim();
  // La demande complète, quand elle dit plus que le message (ton, public, consignes).
  const full = (input.details || '').replace(/\s+/g, ' ').trim();
  const extra = full && full !== clean ? full : clean.slice(400);
  const type = input.options.type === 'auto' || VIDEO_TYPES.includes(input.options.type as VideoType) ? (input.options.type as VideoType | 'auto') : undefined;
  return motionVideos.createVideo(
    userId,
    brandId,
    {
      // Le message (400 signes) porte l'idée ; la suite de la demande devient le détail.
      brief: { message: clean.slice(0, 400), details: extra ? extra.slice(0, 800) : undefined, musicMood: (input.options.musicMood as never) || 'auto', media: input.media, sfx: input.options.sfx !== false, voice: input.options.voice === true },
      scope: scopeOf(input.options),
      type,
      language: input.language,
      creativity: normalizeCreativity(input.options.creativity),
      ...(input.reference ? { reference: input.reference } : {}),
    },
    paid,
    onProgress
  );
}
