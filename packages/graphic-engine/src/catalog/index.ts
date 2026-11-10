/** Le catalogue de gabarits du moteur graphique (registre en ligne, graphe, assemblage, choix par le modèle). */
export * from './types';
export { catalog, refreshCatalog, resetCatalog, ensureHtml, buildCatalog, readTemplatesDir, verifyManifest, canonicalJson, engineSupports, hardcodedWords, unsafeReasons, catalogOverrides } from './registry';
export { assemblePage, pageUnits, assignUnits, genericComponent } from './assemble';
export { brandTraits, shortlist, rankSkins, comboFingerprint, newCatalogState } from './graph';
export type { BrandTraits, Candidate, CatalogState, PageFacts } from './graph';
export { BUILTIN_NODES } from './builtin';
