/**
 * LE MOTEUR DE LOGOS — API publique.
 *
 *   ir/          le contrat (Logo IR, schéma Zod, patch ciblé) — indépendant du modèle IA
 *   kernel/      géométrie (Paper.js), typographie (OpenType.js), polices — derrière des interfaces
 *   render/      couches, générateurs, composition, variantes, SVG (SVGO)
 *   raster/      aperçus PNG (resvg-js) et mesures de pixels
 *   validate/    validation technique + visuelle, empreintes, auto-amélioration
 *   planner/     exploration déterministe (sans token) : briefs → documents candidats
 *   agent/       directeur, auteur, jury, critique — la méthode monte avec le cran de la jauge
 *   export/      livrable : SVG, variantes, PNG, logo.json, ZIP
 *
 * Aucune dépendance à React, au navigateur ni à la base : Node seul. Les seuls branchements de
 * l'hôte sont les polices (`FontProvider`), l'appel de modèle (`AgentCall`) et la vision.
 */
export * from './ir/logo.schema';
export * from './ir/patch';
export * from './kernel/geometry';
export { PaperGeometryKernel, defaultKernel } from './kernel/paper.kernel';
export { diskFontProvider, fileFontProvider, idemFontProvider } from './kernel/fontProviders';
export type { EngineFont, FontProvider } from './kernel/typography';
export { buildLogo, LogoSession, applyOverrides } from './render/build';
export type { BuildOptions, BuildResult, RenderedLogo, RenderSpec } from './render/build';
export { renderVariants, idemVariations, ensureStandardVariants } from './render/variants';
export { listGenerators, getGenerator, describeGenerator } from './render/generators';
export { optimizeSvg } from './render/svg';
export { defaultRasterizer, renderPng, setRasterizer } from './raster/rasterizer';
export { assessLogo, summarizeDefects, ACCEPT_SCORE } from './validate/assess';
export type { QualityReport } from './validate/assess';
export { validateSvgTechnical } from './validate/technical';
export { fingerprintOf, fingerprintDistance, LOGO_SIMILARITY } from './validate/fingerprint';
export type { LogoFingerprint } from './validate/fingerprint';
export { produceLogo } from './pipeline';
export type { ProducedLogo } from './pipeline';
export { planLogos, buildPool, selectDistinct } from './planner/planner';
export type { PlanInput, PlannedLogo } from './planner/planner';
export { inkPalette, traitsOf } from './planner/brief';
export type { PlanBrief, CharterPalette, LogoKind } from './planner/brief';
export { designLogos, EXPLORATION, DRAFTS } from './agent/agent';
export type { AgentInput, AgentResult, AgentDeps } from './agent/agent';
export { exportLogoPackage, zipExport, readLogoJson } from './export/package';
