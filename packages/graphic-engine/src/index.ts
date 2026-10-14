/**
 * @idem/graphic-engine — le moteur de génération graphique d'IDEM AFRICA.
 *
 * Un PAQUET du monorepo, importé par les applications (API IDEM, API iVision, cœur iVision) : jamais un
 * service contacté par HTTP. Il produit, à partir d'un contenu structuré et de la charte d'un projet, les
 * pages du business plan, de la charte graphique, du pitch deck, les faces des cartes de visite, les
 * visuels (flyers, publications, bannières) et les graphiques.
 *
 *   contenu (ContentModel) → plan → composition (motifs, diversité, jauge) → DesignSpec
 *   → compilateur HTML/CSS déterministe → mesure et réparation dans Chromium → RenderResult + trace
 *
 * L'hôte branche ses ports une fois (`configureGraphicEngine`) : appel d'agent, vision, journaux, traces,
 * mémoire de diversité, navigateur partagé. Sans port, le moteur fonctionne entièrement — le code décide.
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
export { ContentError, createDocument, GraphicDocument, renderSingle } from './engine';
export type { DocumentOptions, SectionOutput } from './engine';
export type { ReferenceComposition } from './agents/creative-planner';

// ── Couleur (outils de la charte : contraste, encre lisible, mélange) ───────────────────────────
export { bestContrast, contrastRatio, ensureContrast, isDeep, mixHex, readableInk, relativeLuminance } from './foundation/color';

// ── Le design system ─────────────────────────────────────────────────────────────────────────
export { contentBox, FORMATS, formatOf, isPrint } from './design-system/formats';
export type { FormatDef, FormatFamily, FormatKind } from './design-system/formats';
export { buildTokens, DEFAULT_STYLE_ID, resolveStyle } from './design-system/tokens';
export type { BrandInput, BrandLogos, BrandPattern, DesignTokens, DirectionInput } from './design-system/tokens';
export { STYLE_DATA } from './design-system/tokens/styles.data';
export { allComponents, componentById, componentFor } from './design-system/components/registry';
export { allPatterns } from './design-system/patterns/registry';
export { chartPalette, validatePalette } from './design-system/charts/palette';
export { motifCss, styleMotifs } from './design-system/kit/motifs';
export type { MotifName } from './design-system/kit/motifs';

// ── Les rédacteurs de l'hôte : contrat de contenu, consigne de volume, plan de section ───────────
export { BLOCKS_BY_DELIVERABLE, contentContract, volumeDirective, WRITING_RULES } from './agents/content-contract';
export type { ContentContractOptions } from './agents/content-contract';
export { describeSectionPlan, normalizeSectionPlan, sectionPlanContract } from './agents/content-plan';
export type { SectionPlan } from './agents/content-plan';

// ── L'intention des pages et le planificateur de médias ────────────────────────────────────────
export { applyAssets, GENERATION_CAP, iconFor, matchAsset, nativeProvider, planAssets, resolveAssets, subjectWords } from './asset-planner';
export type { AssetContext, AssetProvider, AssetProviders, AssetRegistry, AssetResolution } from './asset-planner';
export { sectionTextLoad, TEXT_BUDGETS, textLoad } from './composition-engine/analyze';
export { slideDiet } from './agents/slide-diet';
export type { TextBudgetKind } from './composition-engine/analyze';

// ── Les profils de la jauge et les politiques d'appel ──────────────────────────────────────────
export { POLICIES, policyFor } from './composition-engine/profiles';
export type { CreativityPolicy } from './composition-engine/profiles';
export { budgetFor, TASK_POLICIES } from './orchestrator/policies';

// ── Le registre de capacités ───────────────────────────────────────────────────────────────────
export { capabilities, CapabilityRegistry } from './capability-registry';
export type { Capability, CapabilityKind, Tier } from './capability-registry';

// ── Qualité et navigateur ──────────────────────────────────────────────────────────────────────
export { closeBrowser, configureBrowser, pageDocument, screenshot } from './quality-engine/browser';
export type { BrowserOptions } from './quality-engine/browser';
export { measureHtml } from './quality-engine/measure';
export type { Measurement } from './quality-engine/measure';

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

// Les bibliothèques de composants et de motifs s'inscrivent elles-mêmes dans leurs registres. Importées ici
// pour qu'une application qui compile le paquet avec elle les compile aussi (les registres les chargent
// paresseusement : ces imports ne changent rien à l'ordre d'évaluation).
import './design-system/components/library';
import './design-system/patterns/library';
