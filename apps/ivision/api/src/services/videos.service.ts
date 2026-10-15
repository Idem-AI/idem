/**
 * Les VIDÉOS d'iVision : le service vidéo du moteur partagé (`core/src/video`), le même
 * qu'IDEM, sur les marques d'iVision. Création (avec ou sans vidéo modèle), retouches gratuites,
 * aperçu, export MP4 : mêmes étapes, mêmes prix, même rendu.
 */
import { normalizeCreativity } from '../../../core/src/creativity/levels';
import { MotionVideoService, VideoProgressListener } from '../../../core/src/video/motionVideo.service';
import type { MotionVideo, VideoMediaAsset, VideoType } from '../../../core/src/video/contracts/model';
import { normalizeScope } from '../../../core/src/video/pricing';
import { VIDEO_TYPES } from '../../../core/src/video/contracts/model';
import { IvisionVideoStore } from '../stores/video.store';
import type { ChatOptions } from '../models';
import type { ReferenceBlueprint } from '../../../core/src/reference/reference.analyzer';
import { MAX_REQUEST_CHARS, parseRequest, requestMessage } from '../../../core/src/video/request/request';

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
  // La demande EN ENTIER (lignes gardées : le scénario, ses scènes, ses textes) — le moteur la lit.
  const request = (input.details || input.text).replace(/\r\n?/g, '\n').trim().slice(0, MAX_REQUEST_CHARS);
  const clean = input.text.replace(/\s+/g, ' ').trim();
  // Le message : l'intention en une phrase (l'objectif d'un script, pas ses 400 premiers signes).
  const message = request.length > 400 ? requestMessage(parseRequest(request), request) : clean.slice(0, 400);
  const full = request.replace(/\s+/g, ' ').trim();
  const extra = full && full !== clean ? full : clean.slice(400);
  const type = input.options.type === 'auto' || VIDEO_TYPES.includes(input.options.type as VideoType) ? (input.options.type as VideoType | 'auto') : undefined;
  return motionVideos.createVideo(
    userId,
    brandId,
    {
      // Le message porte l'idée ; le détail en garde un résumé (anciens appels) ; `request` est la demande entière.
      brief: { message, details: extra ? extra.slice(0, 800) : undefined, request, musicMood: (input.options.musicMood as never) || 'auto', media: input.media, sfx: input.options.sfx !== false, voice: input.options.voice === true },
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
