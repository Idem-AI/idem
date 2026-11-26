/**
 * LES LOGOS ET LES ICÔNES D'UN ANCIEN SITE, RENDUS NETS AVANT TOUT USAGE.
 *
 * Le logo d'un vieux site est presque toujours petit, en JPEG, ou déjà agrandi. Il alimentait tel quel la charte
 * (couleurs, déclinaisons vectorisées), l'en-tête du nouveau site, le favicon. On le passe d'abord par
 * `enhanceGraphic` (packages/design-tools/src/graphic-enhance.ts) : agrandi, débarrassé des moustiques, contours
 * reconstruits en vecteur. Une image déjà grande et propre, un SVG ou un format illisible reviennent tels quels.
 * Gratuit : aucun jeton, aucun fournisseur.
 */
import logger from '../../config/logger';
import { enhanceGraphic } from '../../../../../packages/design-tools/src/graphic-enhance';

export interface SharpenedAsset {
  buffer: Buffer;
  mimeType: string;
  /** `true` si le fichier a été refait (sinon, c'est l'original). */
  enhanced: boolean;
  /** Le tracé vectoriel, quand il a été retenu. */
  svg?: string;
}

/** Les logos : un en-tête Retina et l'entrée du vectoriseur de la charte ; les icônes : une icône d'application. */
export const LOGO_SIDE = 1024;
export const ICON_SIDE = 512;

const RASTER = /^image\/(png|jpe?g|webp|avif|tiff|gif)$/i;

export async function sharpenBrandAsset(buffer: Buffer, mimeType: string, kind: 'logo' | 'icon', context: { projectId: string; what: string }): Promise<SharpenedAsset> {
  const original: SharpenedAsset = { buffer, mimeType, enhanced: false };
  if (!RASTER.test(mimeType)) return original;
  try {
    const result = await enhanceGraphic(buffer, { targetSide: kind === 'logo' ? LOGO_SIDE : ICON_SIDE });
    if (!result) return original;
    logger.info('site_import.brand_asset_enhanced', { event: 'site_import.brand_asset_enhanced', projectId: context.projectId, what: context.what, method: result.method, to: `${result.width}x${result.height}`, fidelity: result.fidelity, ms: result.ms });
    return { buffer: result.buffer, mimeType: result.mimeType, enhanced: true, ...(result.svg ? { svg: result.svg } : {}) };
  } catch (error: any) {
    logger.warn('site_import.brand_asset_enhance_failed', { event: 'site_import.brand_asset_enhance_failed', projectId: context.projectId, what: context.what, error: error?.message });
    return original;
  }
}
