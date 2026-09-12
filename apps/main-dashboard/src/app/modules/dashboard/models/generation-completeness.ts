/**
 * Analyse de complétude des documents générés par IA (business plan, pitch
 * deck, charte graphique). La génération étant incrémentale (une section
 * persistée après chaque étape), une interruption laisse des sections
 * manquantes ou vides ; ces helpers permettent de le détecter côté UI et de
 * proposer la reprise ou la régénération ciblée.
 */

/** Noms canoniques des étapes backend — doivent correspondre aux `stepName` de l'API. */
export const BUSINESS_PLAN_SECTION_NAMES = [
  'Cover Page',
  'Company Summary',
  'Opportunity',
  'Target Audience',
  'Products & Services',
  'Marketing & Sales',
  'Financial Plan',
  'Goal Planning',
  'Appendix',
] as const;

export const PITCH_DECK_SECTION_NAMES = [
  'Cover',
  'Problem',
  'Solution',
  'Market',
  'Product',
  'Business Model',
  'Traction',
  'Competition',
  'Team',
  'Financials',
  'Ask',
] as const;

// L'ordre suit celui de la génération : la charte MONTRE d'abord (le signe, ses
// déclinaisons, les couleurs, les polices, la direction artistique, puis les
// supports réels), et RÈGLE ensuite, sur ses deux dernières pages. Les règles
// d'usage étaient auparavant posées à côté de chaque spécimen, ce qui couvrait
// de texte les pages dont la démonstration était tout l'objet.
export const BRANDING_SECTION_NAMES = [
  'Brand Header',
  'Logo Principal',
  // Absente des marques dont le nom EST le logo : un logotype purement
  // typographique n'a pas d'icône, et la charte ne montre pas une page vide.
  'Logomark',
  'Logo Variation Fond Clair',
  'Logo Variation Fond Sombre',
  'Logo Variation Monochrome',
  'Color Palette',
  'Typography',
  'Typeface Hierarchy',
  // Page ajoutée après la typographie : elle décrit la grammaire qui assemble
  // le logo, la palette et les polices, et que tous les autres livrables
  // (visuels, business plan, deck, site) doivent respecter.
  'Direction Artistique',
  // La direction artistique tient désormais sur quatre pages : le parti pris,
  // la grammaire de composition, le traitement de l'image (qui reprend la
  // photographie d'univers, autrefois page à part) et les règles.
  'Art Direction Grammar',
  'Art Direction Imagery',
  'Art Direction Principles',
  'Graphic Patterns',
  'Brand Mockup 1',
  'Brand Mockup 2',
  'Brand Mockup 3',
  'Brand Billboard',
  'Brand Stationery',
  'Social Media Creatives',
  'Social Media Page Banners',
  // Les deux pages d'usage, en fin de charte.
  'Logo Bonnes Pratiques',
  'Usage Couleurs & Typographie',
] as const;

export type SectionCompletionStatus = 'complete' | 'missing' | 'empty' | 'underfilled';

export interface SectionCompletionItem {
  name: string;
  status: SectionCompletionStatus;
}

export interface GenerationCompleteness {
  items: SectionCompletionItem[];
  /** Sections attendues absentes du document. */
  missing: string[];
  /** Sections présentes mais sans contenu exploitable (génération interrompue). */
  empty: string[];
  /** Sections présentes et remplies mais avec sous-remplissage PDF. */
  underfilled: string[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  /** Au moins une section a été générée (permet de distinguer « jamais généré »). */
  hasStarted: boolean;
}

/**
 * En dessous de cette taille, un contenu de section est considéré comme
 * tronqué : les sections générées font systématiquement plusieurs centaines de
 * caractères de markdown/HTML.
 */
const MIN_SECTION_CONTENT_LENGTH = 40;

export function analyzeGenerationCompleteness(
  expectedNames: readonly string[],
  sections: ReadonlyArray<{ name: string; data?: unknown }> | null | undefined,
  underfilledNames?: readonly string[],
): GenerationCompleteness {
  const bySectionName = new Map((sections ?? []).map((section) => [section.name, section]));
  const underfilledSet = new Set(underfilledNames ?? []);

  const items: SectionCompletionItem[] = expectedNames.map((name) => {
    const section = bySectionName.get(name);
    if (!section) {
      return { name, status: 'missing' };
    }
    const data = section.data;
    const hasContent =
      typeof data === 'string'
        ? data.trim().length >= MIN_SECTION_CONTENT_LENGTH
        : data != null;
    if (!hasContent) {
      return { name, status: 'empty' };
    }
    if (underfilledSet.has(name)) {
      return { name, status: 'underfilled' };
    }
    return { name, status: 'complete' };
  });

  const missing = items.filter((i) => i.status === 'missing').map((i) => i.name);
  const empty = items.filter((i) => i.status === 'empty').map((i) => i.name);
  const underfilled = items.filter((i) => i.status === 'underfilled').map((i) => i.name);
  const completedCount = items.filter((i) => i.status === 'complete' || i.status === 'underfilled').length;

  return {
    items,
    missing,
    empty,
    underfilled,
    completedCount,
    totalCount: expectedNames.length,
    isComplete: missing.length === 0 && empty.length === 0,
    hasStarted: (sections?.length ?? 0) > 0,
  };
}
