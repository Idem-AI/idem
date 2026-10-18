/**
 * CE QUE LIT L'IA — trois écrivains, du plus durable au plus local :
 *
 *   le LANGAGE VISUEL de la marque   écrit UNE fois par marque (directeur), gardé et repris par tous ses
 *                                    livrables : c'est l'identité appliquée, pas un document ;
 *   le PLAN du document              une idée et une ligne par page (directeur, documents de plusieurs pages) ;
 *   la PAGE                          le HTML Tailwind (auteur), une page par appel.
 *
 * Aucun gabarit, aucun catalogue de mises en page : le modèle invente. Le contexte est COMPACT et le même à tous
 * les crans (la jauge choisit le modèle) : la consigne SYSTÈME ne change pas d'une page à l'autre (le fournisseur
 * peut la garder en cache), le reste — la fiche de la marque, son langage, le plan, les outils dont CETTE page a
 * besoin, la matière avec ses clés — part dans le message.
 *
 * Le niveau attendu est celui d'un document professionnel : la hiérarchie fait le travail, la décoration n'est
 * permise que lorsqu'elle porte la marque. C'est une consigne d'écriture, jamais un contrôle.
 */
import type { DocumentType } from '../contracts/common';
import type { SectionContent, SectionRole } from '../contracts/content-model';
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
}

const DELIVERABLE: Record<DocumentType, string> = {
  'pitch-deck': 'a slide of an investor pitch deck — one idea per slide, read in seconds on a screen',
  'business-plan': 'a page of a printed business plan — read closely by bankers and investors',
  'brand-charter': "a page of the brand's identity guidelines (brand book) — clean like a specimen sheet: the asset it shows (logo, colours, type, pattern, mockups) is the hero, very large; text is a short caption",
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
function directionLines(ctx: DocumentContext): string {
  const d = ctx.direction;
  return [
    d?.styleId ? `ART DIRECTION: ${ctx.tokens.style.name}${d.keywords?.length ? ` — ${d.keywords.join(', ')}` : ''}` : d?.keywords?.length ? `KEYWORDS: ${d.keywords.join(', ')}` : '',
    d?.grammar ? `COMPOSITION GRAMMAR (from the brand guidelines):\n${d.grammar.slice(0, 1400)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Un visuel réseau/couverture/graphique est une toile UNIQUE : le logo n'y « se répète » jamais,
 * il doit juste s'y voir. `flyer` et `chart` sont les seuls types sur une toile pleine résolution
 * (jusqu'à 1080-2560 px) ; les documents paginés (pitch-deck, business-plan, report) répètent au
 * contraire un petit repère sur chaque page/diapositive, où 36px reste juste.
 */
const SINGLE_CANVAS_DOCS: DocumentType[] = ['flyer', 'chart'];

/**
 * Le repère logo, en px CSS, pour les TOOLS de cette page : constant pour un document/diapositive
 * répété(e), sinon proportionnel à la toile. Sans cela, un visuel carré de 1080 px recevait le même
 * « 36px » qu'une page A4 ou une diapositive, et le logo y paraissait minuscule (retour utilisateur,
 * 2026-10-18).
 */
function logoSizePx(ctx: DocumentContext): number {
  if (!SINGLE_CANVAS_DOCS.includes(ctx.documentType)) return 36;
  return Math.max(28, Math.round(ctx.format.base * 2.6));
}

/** Comment le logo se place : repère discret répété sur un document paginé, présence lisible sur une toile unique. */
function logoPlacementLine(ctx: DocumentContext): string {
  if (ctx.documentType === 'business-card' || ctx.documentType === 'brand-charter') return ''; // leur propre consigne couvre déjà le logo
  if (!SINGLE_CANVAS_DOCS.includes(ctx.documentType)) {
    return '- The logo sits in the SAME place on every page (the one the brand language gives), small, with clear space — never on or against a title or text.';
  }
  return '- The logo is clearly legible at the size given in TOOLS for this canvas — present, with clear space, but never the focal element and never on or against a title or text. Do not shrink it further than that size.';
}

function professionalLines(ctx: DocumentContext): string {
  return [
    'PROFESSIONAL STANDARD — a business document, designed by a senior studio. Sober and essential, whatever the brand style:',
    '- One focal element per page. The rest is quiet: white space, alignment, a few sizes.',
    '- At most ONE graphic device per page (a rule, a band, a corner of pattern), even if the brand language asks for collage, layers or shadows. None on a page that shows a brand asset (logo, palette, type, pattern, mockups, photos). No drop shadows, no rotations, no stacked squares.',
    '- Nothing ever overlaps a text: shapes, images and panels sit beside or behind it with full contrast, never across it.',
    '- Each image once on a page; never repeat the same picture.',
    '- Hierarchy does the work: size, weight, spacing and alignment on a clear grid. Generous, consistent margins.',
    '- Decoration only when it carries the brand (its logo, its pattern, the graphic devices of its visual language). Never random circles, blobs, glows, gradients, drop shadows, emojis, ornaments, tilted text or filler shapes.',
    '- Few type sizes, the brand fonts only. Colour with intent: mostly ground and ink, brand colours for emphasis and structure.',
    '- Data is shown plainly: charts and tables large enough to read, one highlighted message at most.',
    logoPlacementLine(ctx),
    '- No giant faded numerals or watermark words. Numbering (01, 02) only for a real sequence of steps.',
    '- Images: only the image keys of the CONTENT list. No image key, no image zone — never leave an empty frame for a picture.',
    '- Show the essential: the CONTENT and nothing else. Never invent example tiles, sample swatches, placeholder boxes ("space reserved for…"), device frames around images, badges, check marks or extra labels.',
    '- Everything fits inside the canvas: nothing cut by the edge; keep a safe margin.',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Le langage visuel de la marque (une fois par marque) ─────────────────────────────────────

export function languagePrompt(ctx: DocumentContext): { system: string; user: string } {
  const system = [
    'You are the art director of an African brand. Write its VISUAL LANGUAGE: the short, concrete rules every one of its documents and visuals will apply (pitch decks, business plans, flyers, business cards, guidelines). It must be unmistakably this brand, professional and SOBER: translate even an expressive style (collage, maximalism…) into restrained, essential rules — one signature device used sparingly, no decoration for its own sake.',
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
    language ? `BRAND VISUAL LANGUAGE:\n${language}` : directionLines(ctx),
    ctx.brief ? `ABOUT THE BUSINESS: ${ctx.brief.slice(0, 600)}` : '',
    ctx.layoutNote ? `THE CLIENT ASKS FOR THIS LAYOUT: ${ctx.layoutNote.slice(0, 600)}` : '',
    ctx.reference ? `THE CLIENT GAVE A MODEL TO REPRODUCE — each page is organised exactly like it (same zones, hierarchy and proportions); describe the pages accordingly:\n${ctx.reference.description.slice(0, 900)}` : '',
    `PAGES:\n${pages.map((p, i) => `${i + 1}. ${p.id}${p.role ? ` (${p.role})` : ''}${p.purpose ? ` — ${p.purpose.slice(0, 140)}` : ''}`).join('\n').slice(0, 3000)}`,
    // Un modèle fourni n'a pas à s'écarter des documents précédents : il les ressemblera peut-être, c'est voulu.
    previous.length && !ctx.reference ? `DOCUMENTS ALREADY MADE FOR THIS BRAND (do not repeat their idea):\n${previous.slice(0, 3).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
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

// ── L'auteur ───────────────────────────────────────────────────────────────────────────────

const TAILWIND_SHEET = [
  'TAILWIND v4 — the ONLY way to style. Classes only; never <style>, never style="", never scripts.',
  '- Colours by their brand names: bg-brand-primary, text-ink, text-muted, bg-brand-soft, border-rule, text-on-brand; opacity bg-brand-primary/15.',
  '- Fonts font-display / font-body; font-medium…font-black, uppercase, tracking-[0.12em], leading-[1.1].',
  '- Exact sizes in px or %: text-[44px], w-[420px], h-[38%], p-[48px], gap-[24px].',
  '- Layout: flex, grid grid-cols-12 col-span-7, items-end, justify-between, absolute inset-0, z-10, overflow-hidden; border-t-[2px], rounded-[12px].',
  '- Photos: <img src="{{key}}" alt="" class="h-full w-full object-cover">.',
  '- Style children from a parent: [&_li]:mb-[8px], [&_th]:bg-brand-primary.',
  '- Not available: md:/lg:/hover:/dark: prefixes, external images, fonts or links.',
  '- Compact HTML: no wrapper or class that changes nothing.',
].join('\n');

const FIXED_EXAMPLE = `<div class="grid h-full w-full grid-cols-12 gap-[32px] bg-ground p-[64px]">
  <div class="col-span-5 flex flex-col justify-end border-l-[4px] border-brand-primary pl-[24px]">
    <p class="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-primary">{{kicker}}</p>
    <h2 class="mt-[12px] font-display text-[52px] font-bold leading-[1.04] text-ink">{{title}}</h2>
    <p class="mt-[16px] text-[18px] leading-[1.5] text-muted">{{lede}}</p>
  </div>
  <div class="col-span-7 flex items-center"><idem-chart data-block="b2" class="w-full text-ink"></idem-chart></div>
</div>`;

const FLOW_EXAMPLE = `<header class="border-b-[2px] border-brand-primary pb-[12px]">
  <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">{{kicker}}</p>
  <h2 class="mt-[6px] font-display text-[30px] font-bold leading-[1.1] text-ink">{{title}}</h2>
</header>
<p class="mt-[16px] max-w-[85%] text-[15px] leading-[1.6] text-ink">{{lede}}</p>
<section class="mt-[22px] grid grid-cols-3 gap-[16px]">
  <div class="border-t-[2px] border-rule pt-[10px]"><p class="font-display text-[28px] font-bold text-brand-primary">{{b1.items.0.value}}</p><p class="text-[12px] text-muted">{{b1.items.0.label}}</p></div>
</section>`;

/** La consigne de l'auteur : la même pour toutes les pages d'un même support (le fournisseur la garde en cache). */
export function authorSystem(ctx: DocumentContext): string {
  const flow = ctx.format.kind === 'flow';
  return [
    `You design ${deliverableLine(ctx)} by writing its HTML with Tailwind classes. Invent the composition from the content; no template exists.`,
    flow
      ? 'OUTPUT: one ```html block, the page fragment only. It goes inside an A4 page box (210 mm wide, 12 mm padding, ground colour, body font) that grows downward. Write a SEQUENCE of top-level blocks (header, then each part) — the printer splits pages between them (data-keep-together on a block that must stay whole). No absolute positioning except for the brand pattern.'
      : 'OUTPUT: one ```html block, the page fragment only. It goes inside the page box, which is exactly the canvas (no padding). Your top element fills it (class="h-full w-full …").',
    '',
    professionalLines(ctx),
    '',
    TAILWIND_SHEET,
    '',
    'CONTENT — every visible word comes from the CONTENT list: write {{key}} where its text goes. Never retype, translate, shorten or invent a text. Show every key (exact data blocks complete, in order). You may add only non-verbal elements (rules, the brand devices, icons that match the meaning of their text, numbering of real steps).',
    ctx.documentType === 'business-card'
      ? 'A BUSINESS CARD shows only the essential. Front: the logo, large, centred or on the grid, with at most the tagline. Back: the name, the role and the contact lines in ONE aligned column, the logo small. No icons, no shapes, no pattern band, no QR code, no invented text; generous margins.'
      : '',
    ctx.bindings === 'markers' ? 'This card is a TEMPLATE shared by several people: each field key in its own element, one line each — lines without a value are removed when printing.' : '',
    '',
    `SYNTAX EXAMPLE (syntax only — compose your own page):\n\`\`\`html\n${flow ? FLOW_EXAMPLE : FIXED_EXAMPLE}\n\`\`\``,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Les outils dont CETTE page a besoin, et eux seuls (documentation à la demande). */
export function toolLines(ctx: DocumentContext, o: { charts: string[]; tables: string[]; icons: boolean; galleries?: string[] }): string {
  const lines = ['TOOLS (drawn by code — you place and size them):', `- <idem-logo variant="primary" class="h-[${logoSizePx(ctx)}px]"></idem-logo> the brand logo (variant from BRAND); this height is sized for this canvas, keep it unless the brand language asks for another.`];
  if (o.charts.length)
    lines.push(
      `- <idem-chart data-block="${o.charts[0]}" class="w-full text-ink"></idem-chart> the exact chart of a block, drawn from its data. Optional: data-aspect="16/9"; data-type="bar|horizontalBar|line|area|groupedBar|stacked|pie|doughnut|radar" to choose another representation; data-highlight="<label>" to bring one category forward.`
    );
  if (o.tables.length) lines.push(`- <idem-table data-block="${o.tables[0]}" class="w-full text-[13px] [&_th]:bg-brand-primary [&_th]:text-on-brand"></idem-table> the exact table of a block, styled from the tag.`);
  if (o.galleries?.length) lines.push(`- <idem-gallery data-block="${o.galleries[0]}" class="h-[70%] w-full"></idem-gallery> the finished mockups of a block, side by side, WHOLE and with their names: give them most of the page; nothing on top of them, no rotation, no frame.`);
  if (o.icons) lines.push('- <idem-icon name="{{…icon}}" class="size-[32px] text-brand-primary"></idem-icon> a line icon: use the icon keys of the CONTENT (chosen for each item); an English noun only if it literally matches the text.');
  if (ctx.tokens.brand.patterns.length) lines.push('- <idem-pattern index="0" class="absolute right-0 top-0 h-full w-[18%] opacity-[0.12]"></idem-pattern> the brand pattern: a band, a panel or a corner, on a few pages only — never the whole page background.');
  return lines.join('\n');
}

/**
 * Le MODÈLE du client : un contrat de composition, pas une inspiration. Il passe avant le langage visuel de
 * la marque et avant toute idée de mise en page de l'auteur ; seules les couleurs, les polices, les mots et
 * la photo restent ceux de la marque.
 */
function referenceLines(ref?: ReferenceComposition): string {
  if (!ref) return '';
  const zones = (ref.zones ?? []).map((z) => `${z.role} at x${Math.round(z.x)}% y${Math.round(z.y)}% w${Math.round(z.w)}% h${Math.round(z.h)}%`).join('; ');
  const st = ref.style;
  const style = st
    ? [
        st.background && `background: ${st.background === 'brand' ? 'a full brand-colour background' : st.background === 'photo' ? 'the photo fills the background' : `a ${st.background} background`}`,
        st.align && `text alignment: ${st.align}`,
        st.headlineSize && `headline size: ${st.headlineSize === 'huge' ? 'huge (it dominates the canvas)' : st.headlineSize}`,
        st.textCase && `headline case: ${st.textCase === 'upper' ? 'UPPERCASE' : 'sentence case'}`,
        typeof st.colorBlocks === 'number' && `solid colour blocks: ${st.colorBlocks}`,
        st.photoCrop && `photo: ${st.photoCrop}`,
      ]
        .filter(Boolean)
        .join('; ')
    : '';
  return [
    "REFERENCE TO REPRODUCE — the client's own model. It is a CONTRACT, not an inspiration: same structure, same zones at the same places and proportions, same hierarchy, same alignment, same headline scale and case, same number and shape of colour blocks, same photo placement and crop. It OVERRIDES the brand visual language and your own layout ideas; only the colours (mapped to the brand roles), the fonts, the words and the photo come from the brand. Do not add decorations the model does not have; do not drop elements it has.",
    `WHAT THE MODEL LOOKS LIKE: ${ref.description.slice(0, 1400)}`,
    style ? `ITS STYLE: ${style}` : '',
    zones ? `ITS ZONES (in % of the canvas, top-left origin — keep them): ${zones}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface PageBrief {
  section: SectionContent;
  listing: string;
  tools: string;
  index?: number;
  total?: number;
  /** Le langage visuel de la marque. */
  language?: string;
  /** L'idée du document et la ligne de CETTE page, avec celles de ses voisines. */
  plan?: { idea?: string; page?: string; previous?: string; next?: string };
  reference?: ReferenceComposition;
}

export function authorUser(ctx: DocumentContext, p: PageBrief): string {
  const s = p.section;
  const intent = s.intent;
  const plan = p.plan;
  return [
    `PAGE: ${p.index && p.total && p.total > 1 ? `${p.index} of ${p.total}` : 'single page'}${s.role && ROLE_HINT[s.role] ? ` — ${ROLE_HINT[s.role]}` : ''} · texts in ${ctx.locale}`,
    `CANVAS: ${canvasLine(ctx.format)}`,
    `BRAND:\n${brandSheet(ctx)}`,
    p.language ? `BRAND VISUAL LANGUAGE (apply it):\n${p.language}` : directionLines(ctx),
    plan && (plan.idea || plan.page)
      ? `DOCUMENT PLAN:${plan.idea ? `\nidea: ${plan.idea}` : ''}${plan.previous ? `\nprevious page: ${plan.previous}` : ''}${plan.page ? `\nTHIS PAGE: ${plan.page}` : ''}${plan.next ? `\nnext page: ${plan.next}` : ''}`
      : '',
    ctx.layoutNote ? `THE CLIENT ASKS FOR THIS LAYOUT: ${ctx.layoutNote.slice(0, 600)}` : '',
    intent ? `INTENT: ${[intent.keyMessage ? `the reader must understand: ${intent.keyMessage}` : '', intent.visualStrategy ? `visual strategy: ${intent.visualStrategy}` : ''].filter(Boolean).join('; ')}` : '',
    referenceLines(p.reference),
    p.tools,
    `CONTENT (keys → texts):\n${p.listing}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ── Retouche écrite et correction ──────────────────────────────────────────────────────────

export function reviseUser(base: string, code: string, instruction: string): string {
  return `${base}\n\nCURRENT PAGE CODE:\n\`\`\`html\n${code.slice(0, 16000)}\n\`\`\`\n\nCHANGE REQUESTED BY THE CLIENT: ${instruction.slice(0, 1200)}\nRewrite the whole page applying exactly this change and keep the rest. Same output format.`;
}

export type RepairStrategy = 'fix' | 'rewrite' | 'minimal';

export function repairUser(base: string, strategy: RepairStrategy, o: { code?: string; error: string; history: string[] }): string {
  const past = o.history.length ? `\nPREVIOUS FAILURES:\n${o.history.map((h) => `- ${h}`).join('\n')}` : '';
  if (strategy === 'fix')
    return `${base}\n\nYOUR PAGE DID NOT DISPLAY.\nERROR: ${o.error}${o.code ? `\nYOUR CODE:\n\`\`\`html\n${o.code.slice(0, 14000)}\n\`\`\`` : ''}\nFix the cause and return the whole corrected page. Same output format.`;
  if (strategy === 'rewrite') return `${base}\n\nEarlier versions of this page did not display.${past}\nWrite the page again from scratch, with a different and simpler construction (fewer layers). Same output format.`;
  return `${base}\n\nEarlier versions of this page did not display.${past}\nWrite the SIMPLEST page that displays: the brand ground, the title, then every content key in order in a column, tools full width. Same output format.`;
}
