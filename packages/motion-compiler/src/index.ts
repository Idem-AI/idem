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
