/**
 * Les formats : une taille de COMPOSITION fixe par format (le code des scènes y travaille), et une
 * sortie qui dépend de la qualité (échelle, cadence). Changer de qualité ne touche jamais au code.
 */
import type { VideoFormat, VideoQuality } from '../contracts/model';

/** Taille de composition (pixels) : celle que reçoit le code des scènes (`ctx.width`, `ctx.height`). */
export const COMPOSITION: Record<VideoFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1920, height: 1080 },
};

export interface FrameSpec {
  /** Taille du fichier rendu (paire : exigence de H.264 en yuv420p). */
  width: number;
  height: number;
  fps: number;
  /** Échelle de sortie appliquée à la composition. */
  scale: number;
  orient: 'portrait' | 'landscape' | 'square';
}

/** Dimensions et cadence d'un format à une qualité donnée. */
export function frameSpec(format: VideoFormat, quality: VideoQuality): FrameSpec {
  const base = COMPOSITION[format] || COMPOSITION.story;
  const scale = quality === 'standard' ? 2 / 3 : 1;
  const even = (n: number) => Math.round((n * scale) / 2) * 2;
  const width = even(base.width);
  const height = even(base.height);
  return {
    width,
    height,
    fps: quality === 'premium' ? 60 : 30,
    scale: width / base.width,
    orient: width > height ? 'landscape' : width === height ? 'square' : 'portrait',
  };
}
