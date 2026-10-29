/**
 * `@idem/motion` — ce que le code d'une scène peut importer en plus de Motion Canvas.
 *
 * Le contexte (`SceneContext`) et un kit TECHNIQUE (mesures, géométrie, couleurs lisibles, temps
 * de la musique) : aucune mise en page, aucun motif, aucune composition imposée.
 */
export type { SceneContext, SceneMedia, BrandTokens, BrandColors, SfxKind, FilmFormat } from './context';
export * from './helpers';
export { balanceLines } from './lines';
export { beatAt, cubicBezier, designDur, designEase, designSize, designStagger, designWeight, readTime, springEase } from './design';
export type { SceneDesignData, TypeLevel, DurToken, EaseName, StaggerToken } from './design';
export { seamIn, seamOut, seamOutDuration } from './seams';
export type { SeamData, SeamKind, SeamDir } from './seams';
