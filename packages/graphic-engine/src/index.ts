/**
 * @idem/graphic-engine — le moteur de génération graphique d'IDEM AFRICA.
 *
 * Un PAQUET du monorepo, importé par les applications (API IDEM, API iVision, cœur iVision) : jamais un
 * service contacté par HTTP. Il produit, à partir d'un contenu structuré et de la charte d'un projet, les
 * pages du business plan, de la charte graphique, du pitch deck, les faces des cartes de visite, les
 * visuels (flyers, publications, bannières) et les graphiques.
 *
 *   contenu (ContentModel) → médias → bible du document (directeur) → page écrite en HTML Tailwind (auteur)
 *   → assainie, remplie par le code (textes exacts, graphiques, tableaux), compilée → « s'affiche-t-elle ? »
 *   → RenderResult + trace
 *
 * Aucun gabarit, aucune note esthétique : l'IA conçoit, le code garantit l'exactitude et l'affichage. La jauge de
 * créativité choisit le MODÈLE. L'hôte branche ses ports une fois (`configureGraphicEngine`) : appel d'agent,
 * journaux, traces, mémoire, navigateur partagé, médias.
 */

// ── Contrats (ContentModel, DesignSpec, RenderResult), validation, normalisation, récupération ──
export * from './contracts';
export { looksLikeHtmlPage, salvageHtmlSection } from './contracts/salvage';
export { CONTRACT_VERSIONS, COMPONENT_LIBRARY_VERSION, ENGINE_VERSION } from './version';
export type { ContractName } from './version';

// ── L'hôte ───────────────────────────────────────────────────────────────────────────────────
export { configureGraphicEngine, engineHost } from './host';
export type { AgentCall, AgentProfile, EngineHost, EngineLogger, FingerprintScope } from './host';

// ── Les documents ────────────────────────────────────────────────────────────────────────────
export { ContentError, createDocument, GraphicDocument, GraphicRenderError, renderSingle, repairLimits } from './engine';
export type { DocumentOptions, SectionOutput } from './engine';
export type { ReferenceComposition } from './author/prompts';

// ── Le runtime (Tailwind, primitives) : pour les hôtes qui rendent eux-mêmes un fragment ─────────
export { compileTailwind, isTailwindFragment, restyleFragment, themeColors, withoutCompiledStyle } from './runtime/tailwind';
export { chartHtml } from './runtime/primitives';
export { applyTextEdits, buildContentMap } from './runtime/content-map';

// ── Couleur (outils de la charte : contraste, encre lisible, mélange) ───────────────────────────
export { bestContrast, contrastRatio, ensureContrast, isDeep, mixHex, readableInk, relativeLuminance } from './foundation/color';

// ── Le design system : formats, jetons de la marque, palettes de graphiques, motifs ─────────────
export { contentBox, FORMATS, formatOf, isPrint } from './design-system/formats';
export type { FormatDef, FormatFamily, FormatKind } from './design-system/formats';
export { buildTokens, DEFAULT_STYLE_ID, resolveStyle } from './design-system/tokens';
export type { BrandInput, BrandLogos, BrandPattern, DesignTokens, DirectionInput } from './design-system/tokens';
export { STYLE_DATA } from './design-system/tokens/styles.data';
export { chartPalette, validatePalette } from './design-system/charts/palette';
export { motifCss, styleMotifs } from './design-system/kit/motifs';
export type { MotifName } from './design-system/kit/motifs';

// ── Les rédacteurs de l'hôte : contrat de contenu, consigne de volume, plan de section ───────────
export { BLOCKS_BY_DELIVERABLE, contentContract, volumeDirective, WRITING_RULES } from './agents/content-contract';
export type { ContentContractOptions } from './agents/content-contract';
export { describeSectionPlan, normalizeSectionPlan, sectionPlanContract } from './agents/content-plan';
export type { SectionPlan } from './agents/content-plan';

// ── L'intention des pages, le régime de texte et le planificateur de médias ──────────────────────
export { applyAssets, GENERATION_CAP, iconFor, matchAsset, nativeProvider, planAssets, resolveAssets, subjectWords } from './asset-planner';
export type { AssetContext, AssetProvider, AssetProviders, AssetRegistry, AssetResolution } from './asset-planner';
export { sectionTextLoad, TEXT_BUDGETS, textLoad } from './content/analyze';
export { slideDiet, slideEssentials } from './content/slide-diet';
export type { TextBudgetKind } from './content/analyze';

// ── Export PowerPoint (le HTML reste la source) ──────────────────────────────────────────────────
export { exportPptx } from './export/pptx';
export type { PptxMode, PptxOptions, PptxReport, PptxSlideInput } from './export/pptx';

// ── Navigateur ─────────────────────────────────────────────────────────────────────────────────
export { closeBrowser, configureBrowser, pageDocument, screenshot } from './runtime/browser';
export type { BrowserOptions } from './runtime/browser';

// ── Observabilité ──────────────────────────────────────────────────────────────────────────────
export { summarize } from './observability/traces';
export { recordFromTraces, recordSummary } from './observability/record';
export type { GenerationDecision, GenerationRecord } from './observability/record';
export type { GenerationTrace, TaskName, TaskTrace } from './observability/traces';

// ── Adaptateurs ────────────────────────────────────────────────────────────────────────────────
export { brandFromIdem, logosFromIdem, patternsFromIdem } from './adapters/idem';
export type { IdemBrandingLike, IdemLogoSetLike, IdemPaletteLike } from './adapters/idem';
export { cardFaces, coverContent, sectionFromModel, sectionHtml, systemBlocks, systemSection, visualContent } from './adapters/sections';
export type { SectionFromModelOptions, SectionFromModelResult, VisualCopy } from './adapters/sections';
