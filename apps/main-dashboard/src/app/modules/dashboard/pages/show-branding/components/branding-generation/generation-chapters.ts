/**
 * Les chapitres de la charte, tels que la page de génération les raconte.
 *
 * Une page de la charte appartient à un chapitre ; le chapitre donne la
 * PHASE montrée par l'illustration animée (on dessine le logo, on choisit les
 * couleurs…) et regroupe le déroulé. Une page inconnue — ajoutée côté API
 * après cette table — tombe dans « Finitions » plutôt que de disparaître.
 */

export type GenerationPhase =
  | 'logo'
  | 'colors'
  | 'type'
  | 'direction'
  | 'mockups'
  | 'social'
  | 'usage'
  | 'finalize';

export interface GenerationChapter {
  id: GenerationPhase;
  pages: readonly string[];
}

export const GENERATION_CHAPTERS: readonly GenerationChapter[] = [
  {
    id: 'logo',
    pages: [
      'Brand Header',
      'Logo Principal',
      'Logomark',
      'Logo Variation Fond Clair',
      'Logo Variation Fond Sombre',
      'Logo Variation Monochrome',
    ],
  },
  { id: 'colors', pages: ['Color Palette'] },
  { id: 'type', pages: ['Typography', 'Typeface Hierarchy'] },
  {
    id: 'direction',
    pages: [
      'Direction Artistique',
      'Art Direction Grammar',
      'Art Direction Imagery',
      'Art Direction Principles',
      'Graphic Patterns',
    ],
  },
  { id: 'mockups', pages: ['Brand Mockup 1', 'Brand Mockup 2'] },
  { id: 'social', pages: ['Social Media Creatives', 'Social Media Page Banners'] },
  { id: 'usage', pages: ['Logo Bonnes Pratiques', 'Usage Couleurs & Typographie'] },
];

/** Chapitre d'une page ; `usage` (les finitions) pour une page inconnue. */
export function phaseOfPage(name: string): GenerationPhase {
  return GENERATION_CHAPTERS.find((chapter) => chapter.pages.includes(name))?.id ?? 'usage';
}

export type PageStatus = 'pending' | 'active' | 'done';

export interface TimelinePage {
  name: string;
  status: PageStatus;
  /** Rang dans la charte (1-based), pour « Page 7 ». */
  index: number;
}

export interface TimelineChapter {
  id: GenerationPhase;
  pages: TimelinePage[];
  done: number;
  status: PageStatus;
}

/**
 * Le déroulé : les pages attendues, dans l'ordre de la charte, groupées par
 * chapitre et marquées selon le flux. Les pages vues dans le flux mais absentes
 * de la liste attendue sont ajoutées à leur chapitre.
 */
export function buildTimeline(
  expected: readonly string[],
  inProgress: readonly string[],
  completed: readonly string[],
): TimelineChapter[] {
  const known = new Set(expected);
  // Un nom vide (événement incomplet du flux) ne doit pas devenir une page.
  const extra = [...inProgress, ...completed].filter((name) => Boolean(name) && !known.has(name));
  const names = [...expected, ...new Set(extra)];
  const done = new Set(completed);
  const active = new Set(inProgress);

  const chapters = new Map<GenerationPhase, TimelinePage[]>();
  names.forEach((name, position) => {
    const phase = phaseOfPage(name);
    const status: PageStatus = done.has(name) ? 'done' : active.has(name) ? 'active' : 'pending';
    const list = chapters.get(phase) ?? [];
    list.push({ name, status, index: position + 1 });
    chapters.set(phase, list);
  });

  return GENERATION_CHAPTERS.filter((chapter) => chapters.has(chapter.id)).map((chapter) => {
    const pages = chapters.get(chapter.id)!;
    const doneCount = pages.filter((page) => page.status === 'done').length;
    const status: PageStatus =
      doneCount === pages.length
        ? 'done'
        : pages.some((page) => page.status !== 'pending')
          ? 'active'
          : 'pending';
    return { id: chapter.id, pages, done: doneCount, status };
  });
}
