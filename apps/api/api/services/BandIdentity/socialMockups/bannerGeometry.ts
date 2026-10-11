/**
 * La géométrie d'une bannière de réseau social : sa zone sûre, en pixels.
 *
 * Une bannière n'est pas un visuel quelconque recadré : chaque réseau pose quelque chose DESSUS
 * (l'avatar de la page, en bas à gauche) et en coupe une partie sur mobile. La zone sûre de
 * chaque format est donc déclarée ici, et c'est tout ce qu'une bannière ajoute à la géométrie
 * d'un visuel ordinaire (`PosterSpec.safe`, dans le moteur partagé) : au-delà de cette zone, une
 * bannière se compose exactement comme un flyer (voir `bannerCompose.ts`).
 */
import type { PosterSpec } from '../../../../../ivision/core/src/visual/poster/poster.types';
import type { CoverFormat } from './library';

/** Les quatre couvertures de profil, la vignette vidéo, et les deux formats génériques du filet de secours. */
export type BannerFormat = CoverFormat | 'thumbnail' | 'post' | 'square';

interface SafeBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Zone où poser ce qui porte du sens, en fractions de la bannière (bords, pas marges).
 *
 * - Facebook : l'avatar mord le bas gauche ; le mobile ne garde que le centre.
 * - LinkedIn et X : le logo ou l'avatar mord le bas gauche sur un quart de la largeur.
 * - YouTube : la zone lisible sur tous les écrans est un bandeau central étroit.
 */
export const BANNER_SAFE: Record<BannerFormat, SafeBox> = {
  'facebook-cover': { left: 0.22, top: 0.16, right: 0.86, bottom: 0.8 },
  'linkedin-cover': { left: 0.3, top: 0.16, right: 0.94, bottom: 0.84 },
  'x-header': { left: 0.32, top: 0.16, right: 0.94, bottom: 0.84 },
  'youtube-banner': { left: 0.24, top: 0.14, right: 0.76, bottom: 0.86 },
  thumbnail: { left: 0.07, top: 0.1, right: 0.93, bottom: 0.9 },
  post: { left: 0.08, top: 0.08, right: 0.92, bottom: 0.92 },
  square: { left: 0.08, top: 0.08, right: 0.92, bottom: 0.92 },
};

/** Formats où quelque chose recouvre le bas gauche : le contenu y est tenu à droite. */
export const AVATAR_ON_LEFT = new Set<BannerFormat>(['linkedin-cover', 'x-header']);

/** Largeur / hauteur de la bannière, rapportées au côté le plus petit. Très étiré au-delà de 4. */
export function aspectOf(width: number, height: number): number {
  return Math.max(width, height) / Math.min(width, height);
}

/** La géométrie d'une bannière : largeur, hauteur, unité, orientation, et sa zone sûre en pixels. */
export function bannerGeometry(format: BannerFormat, width: number, height: number): Pick<PosterSpec, 'width' | 'height' | 'u' | 'orientation' | 'safe'> {
  const box = BANNER_SAFE[format];
  const u = Math.min(width, height) / 100;
  const orientation: PosterSpec['orientation'] = height > width * 1.15 ? 'portrait' : width > height * 1.15 ? 'landscape' : 'square';
  return {
    width,
    height,
    u,
    orientation,
    safe: { left: box.left * width, top: box.top * height, right: (1 - box.right) * width, bottom: (1 - box.bottom) * height },
  };
}

/** La boîte où composer, en pixels. */
export function safeBoxPx(spec: Pick<PosterSpec, 'width' | 'height' | 'safe'>): { x: number; y: number; w: number; h: number } {
  return { x: spec.safe.left, y: spec.safe.top, w: spec.width - spec.safe.left - spec.safe.right, h: spec.height - spec.safe.top - spec.safe.bottom };
}
