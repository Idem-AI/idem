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

export const BRANDING_SECTION_NAMES = [
  'Brand Header',
  'Logo Principal',
  'Logo Variation Fond Clair',
  'Logo Variation Fond Sombre',
  'Logo Variation Monochrome',
  'Logo Bonnes Pratiques',
  'Color Palette',
  'Typography',
  'Brand Mockup 1',
  'Brand Mockup 2',
  'Brand Mockup 3',
] as const;

export type SectionCompletionStatus = 'complete' | 'missing' | 'empty';

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
): GenerationCompleteness {
  const bySectionName = new Map((sections ?? []).map((section) => [section.name, section]));

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
    return { name, status: hasContent ? 'complete' : 'empty' };
  });

  const missing = items.filter((i) => i.status === 'missing').map((i) => i.name);
  const empty = items.filter((i) => i.status === 'empty').map((i) => i.name);
  const completedCount = items.length - missing.length - empty.length;

  return {
    items,
    missing,
    empty,
    completedCount,
    totalCount: expectedNames.length,
    isComplete: missing.length === 0 && empty.length === 0,
    hasStarted: (sections?.length ?? 0) > 0,
  };
}
