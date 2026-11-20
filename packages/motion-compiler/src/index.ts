/**
 * `@idem/motion-compiler` — le système de design du film partagé par le moteur vidéo HyperFrames : direction
 * artistique, rôles de couleur et contraste, dégradé des médias, typographie, zones sûres par plateforme, énergie et
 * coutures des scènes. (Avant le 20/11/2026 : aussi le langage de mouvement et le compilateur Motion Canvas, retirés
 * avec ce moteur — voir `design/` seul désormais.)
 */

// ── Système de design du film : direction, couleur, dégradé, typographie, zones sûres, énergie, coutures ─────────
export { DIRECTION_IDS, COLOR_VARIANTS, COLOR_ROLE_NAMES, SEAM_KINDS } from './design/types';
export type { DirectionId, ColorVariant, ColorRoles, SeamKind, Direction4, SeamSpec, GradeParams, FilmDesign, SceneDesign, EaseToken as DesignEaseToken } from './design/types';
export { SAFE_MARGINS, COMPOSITION_SIZE, safeBox, frameInUnits } from './design/safezones';
export type { SafeFormat, SafeBox } from './design/safezones';
export { buildColorRoles, colorRoleChecks, contrastRatio, onColor, hexToRgb, rgbToHex, mixHex, isLight } from './design/color';
export type { BrandPalette } from './design/color';
export { DIRECTIONS, directionOf, directionMenu } from './design/directions';
export type { DirectionPreset } from './design/directions';
export { BASE_DURATIONS, EASE_CURVES, BASE_STAGGER, readTime, cubicBezier, springEase, easeFunction, clampEnergy, OVERLAP, EXIT_RATIO, CLIMAX_PAUSE, BEAT_TOLERANCE } from './design/motion';
export { typeSizes, scaleRatio, fontMetrics, estimateWidth, balanceLines, textBox, BODY_SIZE } from './design/typography';
export { buildFilmDesign, resolveSceneDesign, defaultSceneDesign, designVocabulary, GRID_COLUMNS, GRID_GUTTER } from './design/system';
export type { FilmDesignInput } from './design/system';
export { PRODUCT_SKELETON, SCENE_ROLES, roleOf, energyArc, peakIndex, planSeams, planTransitionCues, snapCutsToBeats, SEAM_OUT_SECONDS, seamOutSeconds } from './design/film';
export type { SceneRole, TransitionCue } from './design/film';
export { gradeColor, gradePixels, buildCube } from './design/grade';
