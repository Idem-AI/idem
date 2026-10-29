/**
 * `@idem/motion-compiler` — iVision Motion Compiler (aucune dépendance au moteur : langage et compilateur purs).
 *
 * L'IA écrit un programme d'animation compact (le langage de mouvement, `dsl/`) ; le compilateur
 * (`compiler/`) le traduit en scène Motion Canvas, déterministe et fidèle, avec des garanties d'affichage.
 * L'auteur qui fait écrire ces programmes vit dans le moteur vidéo : `apps/ivision/core/src/video/author/program.author.ts`.
 */
export * from './dsl/types';
export { exprCode, ExprError } from './dsl/expr';
export { parseProgram, validateProgram, normalizeEase, normalizeSfx } from './dsl/validate';
export type { ValidationContext, ValidationResult } from './dsl/validate';
export { compileProgram, programOf, untangle, COMPILER_VERSION, PROGRAM_MARK } from './compiler/compile';
export { DSL_REFERENCE } from './author/reference';
export { PROGRAM_EXAMPLES, pickProgramExamples } from './author/examples';
export type { ProgramExample } from './author/examples';
export { formatProgram } from './author/format';

// ── Compilateur 0.3 : système de design, intention de scène, solveurs ──────────────────────────────────────────────
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
export * from './intent/types';
export { intentJsonSchema, directionJsonSchema } from './intent/schema';
export { parseIntent, validateIntent, levelFor } from './intent/validate';
export type { IntentContext, IntentValidation } from './intent/validate';
export { recipe, needsOf } from './intent/recipes';
export type { Move } from './intent/recipes';
export { lowerIntent } from './intent/lower';
export type { LowerInput, LowerResult } from './intent/lower';
export { solveGeometry, variantChoices, DEFAULT_CHOICE, overlap, area } from './solver/geometry';
export type { Box, Placed, Placement, VariantChoice, SolveMedia, SolveInput } from './solver/geometry';
export { solveTiming } from './solver/time';
export type { TimedBeat, TimeContext, TimeSolution } from './solver/time';
export { findCollisions, resolveCollision, trackOf } from './solver/trajectory';
export { scalePath, expandDevice } from './dsl/macros';
export type { ResolvedIcon } from './dsl/validate';
// ── Le juge déterministe ───────────────────────────────────────────────────────────────────────────────────────────
export { compositionMetrics, pixelMetrics, contrastMetric, motionMetrics, intentAssertions, judge, reportText, DEFAULT_WEIGHTS, GOOD_ENOUGH, fitWeights, agreement, linearScore, judgeWeights, prejudge, placementElements } from './judge';
export type { JudgeElement, JudgeFrame, RasterImage, Assertion, Judgment, ReportLine, Elimination, PairVote, MotionContext } from './judge';
export { SEED_REFERENCES, referenceLibrary, retrieveReferences } from './references/library';
export type { ReferenceScene, ReferenceQuery } from './references/library';
export { gradeColor, gradePixels, buildCube } from './design/grade';
