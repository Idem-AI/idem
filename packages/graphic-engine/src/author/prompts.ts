/**
 * CE QUE LIT LE DIRECTEUR — deux écrits courts, qui guident le CHOIX dans le catalogue (aucune page n'est écrite par
 * un modèle depuis la 2.7) :
 *
 *   le LANGAGE VISUEL de la marque   écrit UNE fois par marque, gardé et repris par tous ses livrables ;
 *   le PLAN du document              une idée et une ligne par page (documents de plusieurs pages, crans hauts),
 *                                    précédé de l'EXPLORATION (quatre pistes, le code en retient une).
 */
import type { DocumentType } from '../contracts/common';
import type { SectionRole } from '../contracts/content-model';
import type { FormatDef } from '../design-system/formats';
import type { DesignTokens, DirectionInput } from '../design-system/tokens';

export interface ReferenceComposition {
  description: string;
  /** Les zones du modèle, en % de la toile (photo, titre, prix, logo, bandeau…). */
  zones?: Array<{ role: string; x: number; y: number; w: number; h: number }>;
  /** Ce que la vision a relevé de son allure : fond, alignement, taille et casse du titre, aplats. */
  style?: { background?: string; align?: string; headlineSize?: string; textCase?: string; colorBlocks?: number; photoCrop?: string };
}

export interface DocumentContext {
  documentType: DocumentType;
  /** La page est la COUVERTURE : la consigne laisse la composition entièrement libre (signature du document). */
  cover?: boolean;
  documentLabel?: string;
  locale: string;
  tokens: DesignTokens;
  format: FormatDef;
  direction?: DirectionInput;
  allowDark: boolean;
  /** Ce que l'hôte sait du projet (activité, public), en clair. */
  brief?: string;
  /** Le souhait du client pour la mise en page. */
  layoutNote?: string;
  /** Le modèle du client : la mise en page de chaque page en découle. */
  reference?: ReferenceComposition;
  bindings: 'values' | 'markers';
  /** L'axe de départ tiré par le code (`@idem/design-tools`, plan qualité créative), en une consigne. */
  startingPoint?: string;
  /** La piste d'idée retenue après l'exploration (documents de plusieurs pages). */
  chosenIdea?: string;
}

const DELIVERABLE: Record<DocumentType, string> = {
  'pitch-deck': 'a slide of an investor pitch deck — one idea per slide, read in seconds on a screen',
  'business-plan': 'a page of a printed business plan — read closely by bankers and investors',
  'brand-charter': "a page of the brand's identity guidelines (brand book) — it shows the brand system itself, exactly: the asset it shows (logo, colours, type, pattern, mockups) is the hero, shown whole and large; text is a short caption",
  'business-card': 'one face of a printed business card (85 × 55 mm)',
  flyer: 'a flyer / social-media visual — one message, understood at a glance',
  chart: 'a standalone chart',
  report: 'a page of a printed report',
};

const ROLE_HINT: Partial<Record<SectionRole, string>> = {
  cover: 'the cover',
  opening: 'an opening page',
  closing: 'the closing page',
  data: 'a page carried by its data',
  comparison: 'a comparison',
  process: 'a process',
  specimen: 'a specimen page (exact brand assets)',
  showcase: 'a showcase page',
  visual: 'the whole visual',
  'card-face': 'a card face',
  appendix: 'an appendix page',
};

export function deliverableLine(ctx: DocumentContext): string {
  return `${DELIVERABLE[ctx.documentType]}${ctx.documentLabel ? ` (« ${ctx.documentLabel} »)` : ''}`;
}

export function canvasLine(f: FormatDef): string {
  const size = `${Math.round(f.width)}×${Math.round(f.height)} px${f.mm ? ` (${f.mm.width}×${f.mm.height} mm)` : ''}`;
  if (f.kind === 'flow') return `${size} A4 page that GROWS downward when the content is long (printed; a page break may fall between top-level blocks). Body ${f.base}px, never below ${f.minSize}px.`;
  const safe = f.safe;
  const even = safe.top === safe.left && safe.left === safe.right && safe.right === safe.bottom;
  const zone = even ? `texts and logo ≥ ${safe.top}px from every edge` : `texts and logo inside the safe area: ${safe.top}px from the top, ${safe.bottom}px from the bottom, ${safe.left}px from the left, ${safe.right}px from the right (the platform covers the rest)`;
  return `${size}, FIXED: nothing scrolls. ${f.family === 'card' ? 'Printed card; ' : ''}${zone}; grounds may bleed to the edges. Smallest text ${f.minSize}px; body ${f.base}px.`;
}

/** La fiche de la marque, compacte : ce que l'auteur emploie (le reste des nuances existe sous les mêmes noms). */
export function brandSheet(ctx: DocumentContext): string {
  const t = ctx.tokens;
  const c = t.color;
  const core: Array<[string, string]> = [
    ['brand-primary', c.primary],
    ['brand-secondary', c.secondary],
    ['brand-accent', c.accent],
    ['brand-soft', c.brandSoft],
    ['ground', c.ground],
    ['sunken', c.sunken],
    ['ink', c.ink],
    ['muted', c.muted],
    ['rule', c.rule],
    ['on-brand', c.onBrand],
    ['deep', c.deep],
    ['on-deep', c.onDeep],
  ];
  const logos = Object.entries(t.brand.logos)
    .filter(([k, v]) => typeof v === 'string' && v && k !== 'aspect')
    .map(([k]) => k);
  return [
    `NAME: ${t.brand.name}`,
    `COLOURS: ${core.map(([k, v]) => `${k} ${v}`).join(', ')} (also accent-soft, on-accent, faint, raised, and shades brand-50…950 / accent-50…950)`,
    `FONTS: font-display = ${t.font.display}, font-body = ${t.font.body}`,
    logos.length ? `LOGO variants: ${logos.join(', ')}` : 'LOGO: none (a wordmark of the name is printed instead)',
    t.brand.patterns.length ? `BRAND PATTERN: ${t.brand.patterns.length} tile(s)` : '',
    ctx.allowDark ? 'Dark grounds allowed.' : 'Light grounds (dark only for bands or panels).',
  ]
    .filter(Boolean)
    .join('\n');
}

/** La direction artistique de la charte, brute (pour écrire le langage visuel, ou à défaut de langage). */
export function directionLines(ctx: DocumentContext): string {
  const d = ctx.direction;
  return [
    d?.styleId ? `ART DIRECTION: ${ctx.tokens.style.name}${d.keywords?.length ? ` — ${d.keywords.join(', ')}` : ''}` : d?.keywords?.length ? `KEYWORDS: ${d.keywords.join(', ')}` : '',
    d?.grammar ? `COMPOSITION GRAMMAR of the brand's art direction — every page follows it (signature move, layout recipes, do, never):\n${d.grammar.slice(0, 1400)}` : '',
    d?.imagery ? `IMAGE TREATMENT of the art direction: ${d.imagery.slice(0, 300)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Le langage visuel de la marque (une fois par marque) ─────────────────────────────────────

export function languagePrompt(ctx: DocumentContext): { system: string; user: string } {
  const system = [
    'You are the art director of an African brand. Write its VISUAL LANGUAGE: the short, concrete rules every one of its documents and visuals will apply (pitch decks, business plans, flyers, business cards, guidelines). It must be unmistakably this brand, professional and sober — no decoration for its own sake.',
    'Answer in English with exactly:',
    'LANGUAGE:',
    '- 5 to 8 short lines: colour roles (by their names); typography (display/body, case, weight, scale contrast); grid and margins; the ONE or two graphic devices that are the brand signature (from its guidelines when given); imagery; how the logo is placed.',
  ].join('\n');
  const user = [`BRAND:\n${brandSheet(ctx)}`, directionLines(ctx), ctx.brief ? `ABOUT THE BUSINESS: ${ctx.brief.slice(0, 800)}` : ''].filter(Boolean).join('\n\n');
  return { system, user };
}

export function parseLanguage(raw: string): string | null {
  const text = (raw || '').replace(/```[a-z]*\n?|```/g, '').trim();
  const at = text.search(/LANGUAGE\s*:/i);
  const body = (at >= 0 ? text.slice(at).replace(/^LANGUAGE\s*:\s*/i, '') : text).trim();
  return body.length >= 40 ? body.slice(0, 1400) : null;
}

// ── Le plan du document (documents de plusieurs pages) ─────────────────────────────────────

export interface PlannedPage {
  id: string;
  role?: SectionRole;
  /** Ce que la page doit faire (fourni par l'hôte quand il le sait). */
  purpose?: string;
}

export interface DocumentPlan {
  idea: string;
  /** Une ligne par page, dans l'ordre. */
  pages: string[];
}

export function planPrompt(ctx: DocumentContext, pages: PlannedPage[], language: string | undefined, previous: string[]): { system: string; user: string } {
  const system = [
    `You are the art director of ${deliverableLine(ctx)}, for an African business. Plan the document before its pages are designed one by one: the pages must read as ONE professional family, each page shaped by what it has to show.`,
    'Answer in English with exactly:',
    'IDEA: one sentence — the document’s visual idea within the brand language',
    `PAGE n: one line per page (${pages.length} pages) — what dominates it (a chart, a key figure, a photo, pure type, a table, a diagram…) and how it is organised`,
  ].join('\n');
  const user = [
    `CANVAS: ${canvasLine(ctx.format)}`,
    `BRAND:\n${brandSheet(ctx)}`,
    // Le résumé ET la direction elle-même : le langage résume, la grammaire de composition fait foi.
    [language ? `BRAND VISUAL LANGUAGE:\n${language}` : '', directionLines(ctx)].filter(Boolean).join('\n\n'),
    ctx.brief ? `ABOUT THE BUSINESS: ${ctx.brief.slice(0, 600)}` : '',
    ctx.layoutNote ? `THE CLIENT ASKS FOR THIS LAYOUT: ${ctx.layoutNote.slice(0, 600)}` : '',
    ctx.reference ? `THE CLIENT GAVE A MODEL TO REPRODUCE — each page is organised exactly like it (same zones, hierarchy and proportions); describe the pages accordingly:\n${ctx.reference.description.slice(0, 900)}` : '',
    `PAGES:\n${pages.map((p, i) => `${i + 1}. ${p.id}${p.role ? ` (${p.role})` : ''}${p.purpose ? ` — ${p.purpose.slice(0, 140)}` : ''}`).join('\n').slice(0, 3000)}`,
    // Un modèle fourni n'a pas à s'écarter des documents précédents : il les ressemblera peut-être, c'est voulu.
    previous.length && !ctx.reference ? `DOCUMENTS ALREADY MADE FOR THIS BRAND OR ITS SECTOR (do not repeat their idea):\n${previous.slice(0, 10).join('\n')}` : '',
    !ctx.reference && ctx.chosenIdea ? `THE IDEA CHOSEN FOR THIS DOCUMENT (develop it — IDEA keeps its spirit):\n${ctx.chosenIdea}` : '',
    !ctx.reference && !ctx.chosenIdea && ctx.startingPoint ? ctx.startingPoint : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

// ── L'exploration (plan qualité créative) : quatre pistes avant le plan ─────────────────────

export interface IdeaTrack {
  title: string;
  idea: string;
}

/**
 * Avant le plan, le directeur propose QUATRE pistes qui divergent vraiment (métaphore, composition, rythme, matière),
 * à partir du point de départ tiré par le code. Le code en retient une (la plus éloignée de ce qui a déjà été fait),
 * que le plan développe. Les pistes sont courtes : l'exploration coûte peu, la répétition coûte cher.
 */
export function explorePrompt(ctx: DocumentContext, pages: PlannedPage[], language: string | undefined, previous: string[]): { system: string; user: string } {
  const system = [
    `You are the art director of ${deliverableLine(ctx)}, for an African business. Before planning the document, propose FOUR clearly different visual ideas for it.`,
    'The four ideas must differ in kind, not in wording: each one takes a different metaphor, a different way of composing pages (scale, grid, image, type), a different rhythm across pages and a different material or texture. One of them must start from the STARTING POINT below. None may repeat a document already made.',
    'Every idea stays within the brand (its colours, fonts, logo and visual language), professional and sober — no decoration for its own sake.',
    'Answer in English with exactly four blocks:',
    'TRACK n: <a short title> — <the idea in two sentences: the metaphor and how the pages are composed>',
  ].join('\n');
  const user = [
    `CANVAS: ${canvasLine(ctx.format)}`,
    `BRAND:\n${brandSheet(ctx)}`,
    [language ? `BRAND VISUAL LANGUAGE:\n${language}` : '', directionLines(ctx)].filter(Boolean).join('\n\n'),
    ctx.brief ? `ABOUT THE BUSINESS: ${ctx.brief.slice(0, 600)}` : '',
    `PAGES (${pages.length}): ${pages.map((p) => p.purpose || p.role || p.id).join(' · ').slice(0, 1200)}`,
    ctx.startingPoint ?? '',
    previous.length ? `DOCUMENTS ALREADY MADE FOR THIS BRAND OR ITS SECTOR (never repeat them):\n${previous.slice(0, 10).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

export function parseTracks(raw: string): IdeaTrack[] {
  const text = (raw || '').replace(/```[a-z]*\n?|```/g, '');
  const tracks: IdeaTrack[] = [];
  for (const m of text.matchAll(/^[\s*#>-]*TRACK\s*\d\s*[:.)—–-]\s*(.+?)\s*[—–:-]\s+(.+)$/gim)) {
    const title = m[1].replace(/\*+/g, '').trim();
    const idea = m[2].replace(/\*+/g, '').trim();
    if (idea.length >= 20) tracks.push({ title: title.slice(0, 80), idea: idea.slice(0, 400) });
  }
  return tracks.slice(0, 4);
}

export function parsePlan(raw: string, count: number): DocumentPlan | null {
  const text = (raw || '').replace(/```[a-z]*\n?|```/g, '');
  const idea = text.match(/^[\s*#>-]*IDEA\s*:\s*(.+)$/im)?.[1]?.trim() ?? '';
  const pages: string[] = Array.from({ length: count }, () => '');
  for (const m of text.matchAll(/^[\s*#>-]*PAGE\s*(\d{1,3})\s*[:.)—–-]\s*(.+)$/gim)) {
    const n = Number(m[1]) - 1;
    if (n >= 0 && n < count) pages[n] = m[2].trim().slice(0, 240);
  }
  if (!idea && !pages.some(Boolean)) return null;
  return { idea: idea.slice(0, 300), pages };
}
