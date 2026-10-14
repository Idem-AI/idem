/**
 * CE QUE LIT L'IA — le directeur (une bible par document) et l'auteur (une page en HTML Tailwind).
 *
 * Aucun gabarit, aucun catalogue de mises en page, aucune règle esthétique : le modèle invente. Le contexte est
 * COMPACT et le même à tous les crans (la jauge choisit le modèle, pas les moyens) : la marque, le support et ses
 * cotes, la matière avec ses clés, les primitives, une référence Tailwind et UN exemple de syntaxe. C'est ce qui
 * permet à un petit modèle de rendre une page juste.
 */
import type { DocumentType } from '../contracts/common';
import type { SectionContent, SectionRole } from '../contracts/content-model';
import type { FormatDef } from '../design-system/formats';
import type { DesignTokens, DirectionInput } from '../design-system/tokens';
import { themeColors } from '../runtime/tailwind';

export interface ReferenceComposition {
  description: string;
  /** Les zones du modèle, en % de la toile (photo, titre, prix, logo, bandeau…). */
  zones?: Array<{ role: string; x: number; y: number; w: number; h: number }>;
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
  bindings: 'values' | 'markers';
}

const DELIVERABLE: Record<DocumentType, string> = {
  'pitch-deck': 'a slide of an investor pitch deck — one idea per slide, read in seconds on a screen',
  'business-plan': 'a page of a printed business plan — read closely by bankers and investors: clear hierarchy, well-set tables and charts',
  'brand-charter': "a page of the brand's identity guidelines (brand book) — it shows the brand system itself, exactly",
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
  if (f.kind === 'flow') return `${size} A4 page that GROWS downward when the content is long (printed; a page break may fall between top-level blocks). Body text around ${f.base}px, never below ${f.minSize}px.`;
  const safe = f.safe;
  const even = safe.top === safe.left && safe.left === safe.right && safe.right === safe.bottom;
  const zone = even ? `keep texts and logo at least ${safe.top}px from every edge` : `keep texts and logo inside the safe area: ${safe.top}px from the top, ${safe.bottom}px from the bottom, ${safe.left}px from the left, ${safe.right}px from the right (the platform covers the rest)`;
  return `${size}, FIXED: nothing scrolls, everything that matters must be inside. ${f.family === 'card' ? 'Printed card: ' : ''}${zone}; backgrounds and decoration may bleed to the edges. Smallest text ${f.minSize}px; body around ${f.base}px.`;
}

export function brandSheet(ctx: DocumentContext): string {
  const t = ctx.tokens;
  const colors = Object.entries(themeColors(t))
    .filter(([k]) => !/^(brand|accent)-\d/.test(k))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  const ramps = Object.keys(t.color.brandRamp).length ? `; shades brand-50…brand-950 and accent-50…accent-950 also exist` : '';
  const logos = Object.entries(t.brand.logos)
    .filter(([k, v]) => typeof v === 'string' && v && k !== 'aspect')
    .map(([k]) => k);
  const d = ctx.direction;
  return [
    `NAME: ${t.brand.name}`,
    `COLOURS (Tailwind names → hex): ${colors}${ramps}`,
    `FONTS: font-display = ${t.font.display} (titles), font-body = ${t.font.body} (text)`,
    logos.length ? `LOGO: <idem-logo variant="…"> with ${logos.join(', ')}${t.brand.logos.onDark ? ' (onDark is made for dark grounds)' : ''}` : 'LOGO: none — <idem-logo> prints the brand name as a wordmark',
    t.brand.patterns.length ? `BRAND PATTERN: ${t.brand.patterns.length} tile(s) — <idem-pattern index="0" class="absolute inset-0 opacity-[0.12]">` : '',
    d?.styleId ? `ART DIRECTION: ${t.style.name}${d.keywords?.length ? ` — ${d.keywords.join(', ')}` : ''}` : d?.keywords?.length ? `KEYWORDS: ${d.keywords.join(', ')}` : '',
    d?.grammar ? `BRAND COMPOSITION GRAMMAR (from its guidelines):\n${d.grammar.slice(0, 1600)}` : '',
    ctx.allowDark ? 'Dark grounds are allowed.' : 'Light grounds by default (dark only for small bands, panels or accents).',
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Le directeur ───────────────────────────────────────────────────────────────────────────

export function directorPrompt(ctx: DocumentContext, pages: Array<{ id: string; role?: SectionRole }>, previous: string[]): { system: string; user: string } {
  const system = [
    `You are the art director of ${deliverableLine(ctx)}, for an African business.`,
    'Before the pages are designed one by one, write the visual BIBLE they will all follow: the pages must feel like ONE family and be unmistakably this brand. You are free — no template, no imposed layout; avoid generic corporate clichés.',
    'Answer in English with exactly:',
    'BIBLE:',
    '- 6 to 10 short lines: the idea; how the colours are used (by their names); typography (display/body, scale, case, weight); grid and spacing; graphic language (shapes, lines, images, icons, texture); recurring elements (folio, logo place, page header); how pages vary while staying one family.',
  ].join('\n');
  const user = [
    `DELIVERABLE: ${deliverableLine(ctx)}`,
    `CANVAS: ${canvasLine(ctx.format)}`,
    `BRAND:\n${brandSheet(ctx)}`,
    ctx.brief ? `ABOUT THE BUSINESS: ${ctx.brief.slice(0, 1200)}` : '',
    pages.length ? `PAGES (${pages.length}): ${pages.map((p, i) => `${i + 1}. ${p.id}${p.role ? ` (${p.role})` : ''}`).join('; ').slice(0, 1600)}` : '',
    previous.length ? `BIBLES ALREADY USED FOR THIS BRAND (do something different):\n${previous.slice(0, 4).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

export function parseBible(raw: string): string | null {
  const text = (raw || '').replace(/```[a-z]*\n?|```/g, '').trim();
  const at = text.search(/BIBLE\s*:/i);
  const body = (at >= 0 ? text.slice(at).replace(/^BIBLE\s*:\s*/i, '') : text).trim();
  return body.length >= 40 ? body.slice(0, 2400) : null;
}

// ── L'auteur ───────────────────────────────────────────────────────────────────────────────

const TAILWIND_SHEET = (ctx: DocumentContext) =>
  [
    'TAILWIND v4 — the ONLY way to style. Write classes; never <style>, never style="", never scripts.',
    '- Brand colours by name: bg-brand-primary, text-ink, text-muted, bg-brand-soft, border-rule, text-on-brand… (list in BRAND). Opacity: bg-brand-primary/15. Another colour: bg-[#hex], sparingly.',
    '- Fonts: font-display, font-body. Weights font-light…font-black, uppercase, italic, tracking-[0.2em], leading-[1.05].',
    `- Exact sizes (the canvas is fixed in pixels): text-[44px], w-[420px], h-[38%], top-[12%], p-[48px], gap-[24px], size-[180px].${ctx.format.kind === 'flow' ? ' Prefer relative widths (w-full, w-1/2, grid) for the A4 flow.' : ''}`,
    '- Layout: flex, flex-col, items-end, justify-between, grid grid-cols-12 col-span-7, absolute inset-0, -right-[60px], z-10, overflow-hidden.',
    '- Graphic language: rounded-[28px], rounded-full, border-[3px], bg-linear-to-br from-brand-primary to-brand-accent, rotate-[-6deg], shadow-xl, mix-blend-multiply, opacity-20, blur-[60px]. Inline <svg> drawings are welcome (viewBox, fill="currentColor" with text-* classes, or brand hex).',
    '- Photos: <img src="{{key}}" alt="" class="w-full h-full object-cover object-[50%_30%]">.',
    '- Style children from a parent: [&_li]:mb-[8px], [&_th]:bg-brand-primary [&_th]:text-on-brand, [&_tr:nth-child(even)]:bg-sunken.',
    '- NOT available: responsive or state prefixes (md:, lg:, hover:, dark:), external images, fonts or links.',
  ].join('\n');

const PRIMITIVES = (ctx: DocumentContext) =>
  [
    'PRIMITIVES (drawn by code — you place and size them with classes):',
    '- <idem-chart data-block="ID" data-aspect="16/9" class="w-full h-[320px] text-ink"></idem-chart> the exact chart of block ID (its labels take the text colour).',
    '- <idem-table data-block="ID" class="w-full text-[13px] [&_th]:bg-brand-primary [&_th]:text-on-brand"></idem-table> the exact table of block ID (style it from the tag).',
    '- <idem-logo variant="primary" class="h-[40px]"></idem-logo> the brand logo.',
    '- <idem-icon name="truck" class="size-[40px] text-brand-primary"></idem-icon> a line icon (a name in English, or {{…icon}} keys from the content).',
    ctx.tokens.brand.patterns.length ? '- <idem-pattern index="0" class="absolute inset-0 opacity-[0.1]"></idem-pattern> the brand pattern tile.' : '',
  ]
    .filter(Boolean)
    .join('\n');

const CONTENT_RULES = (ctx: DocumentContext) =>
  [
    'CONTENT — every visible word comes from the CONTENT list: write {{key}} where its text goes. Never retype, translate, shorten or invent a text. Show every key (exact data blocks complete, in order); decide hierarchy, grouping and emphasis freely.',
    'You may add only non-verbal elements: shapes, lines, images from the keys, icons, and numbering such as 01, 02.',
    ctx.bindings === 'markers' ? 'This card is a TEMPLATE shared by several people: put each field key in its own element (one line each) — lines without a value are removed when printing.' : '',
  ]
    .filter(Boolean)
    .join('\n');

const FIXED_EXAMPLE = `<div class="relative w-full h-full overflow-hidden bg-ground">
  <div class="absolute -right-[120px] -top-[140px] size-[460px] rounded-full bg-brand-soft"></div>
  <div class="relative z-10 grid h-full grid-cols-12 gap-[32px] p-[56px]">
    <div class="col-span-5 flex flex-col justify-end">
      <p class="text-[13px] uppercase tracking-[0.2em] text-brand-primary">{{kicker}}</p>
      <h2 class="mt-[14px] font-display text-[54px] font-bold leading-[1.02] text-ink">{{title}}</h2>
      <p class="mt-[18px] text-[18px] leading-[1.5] text-muted">{{lede}}</p>
    </div>
    <div class="col-span-7 flex items-center"><idem-chart data-block="b2" data-aspect="16/10" class="w-full text-ink"></idem-chart></div>
  </div>
</div>`;

const FLOW_EXAMPLE = `<header class="flex items-end justify-between border-b-[3px] border-brand-primary pb-[14px]">
  <h2 class="font-display text-[30px] font-bold leading-[1.1] text-ink">{{title}}</h2>
  <p class="text-[11px] uppercase tracking-[0.18em] text-muted">{{kicker}}</p>
</header>
<p class="mt-[18px] max-w-[80%] text-[15px] leading-[1.55] text-ink">{{lede}}</p>
<section class="mt-[22px] grid grid-cols-3 gap-[14px]">
  <div class="rounded-[10px] bg-brand-soft p-[16px]"><p class="font-display text-[28px] font-bold text-brand-primary">{{b1.items.0.value}}</p><p class="mt-[4px] text-[12px] text-muted">{{b1.items.0.label}}</p></div>
</section>
<section class="mt-[24px]"><idem-table data-block="b2" class="text-[12px] [&_th]:bg-brand-primary [&_th]:text-on-brand"></idem-table></section>`;

export function authorSystem(ctx: DocumentContext): string {
  const flow = ctx.format.kind === 'flow';
  return [
    `You design ${deliverableLine(ctx)}, for an African business, by writing its HTML with Tailwind classes. You are a senior designer and you are free: invent the composition, the hierarchy, the graphic language. No template exists; do not make a generic page.`,
    flow
      ? 'OUTPUT: one ```html block with the page fragment only. It is placed inside an A4 page box (210 mm wide, 12 mm padding, ground colour, body font) that grows downward. Write the page as a SEQUENCE of top-level blocks (header, then each part) — do not wrap everything in one element; the printer splits long pages between top-level blocks (add data-keep-together to a block that must never be split). Use absolute positioning only for decoration.'
      : 'OUTPUT: one ```html block with the page fragment only. It is placed inside the page box, which is exactly the canvas (no padding). Your top element fills it: class="relative w-full h-full overflow-hidden …".',
    '',
    TAILWIND_SHEET(ctx),
    '',
    PRIMITIVES(ctx),
    '',
    CONTENT_RULES(ctx),
    '',
    `SYNTAX EXAMPLE (only to show the syntax — invent your own composition):\n\`\`\`html\n${flow ? FLOW_EXAMPLE : FIXED_EXAMPLE}\n\`\`\``,
  ].join('\n');
}

function referenceLines(ref?: ReferenceComposition): string {
  if (!ref) return '';
  const zones = (ref.zones ?? []).map((z) => `${z.role} at x${Math.round(z.x)}% y${Math.round(z.y)}% w${Math.round(z.w)}% h${Math.round(z.h)}%`).join('; ');
  return `REFERENCE TO REPRODUCE (the client's model — its composition, not its texts or colours): ${ref.description.slice(0, 700)}${zones ? `\nITS ZONES (in % of the canvas): ${zones}` : ''}`;
}

export interface PageBrief {
  section: SectionContent;
  listing: string;
  index?: number;
  total?: number;
  bible?: string;
  reference?: ReferenceComposition;
}

export function authorUser(ctx: DocumentContext, p: PageBrief): string {
  const s = p.section;
  const intent = s.intent;
  return [
    `PAGE: ${p.index && p.total && p.total > 1 ? `${p.index} of ${p.total}` : 'single page'}${s.role && ROLE_HINT[s.role] ? ` — ${ROLE_HINT[s.role]}` : ''}`,
    `CANVAS: ${canvasLine(ctx.format)}`,
    `LANGUAGE OF THE TEXTS: ${ctx.locale}`,
    p.bible ? `BIBLE OF THE DOCUMENT (follow it):\n${p.bible}` : '',
    `BRAND:\n${brandSheet(ctx)}`,
    intent ? `INTENT: ${[intent.keyMessage ? `the reader must understand: ${intent.keyMessage}` : '', intent.visualStrategy ? `visual strategy: ${intent.visualStrategy}` : ''].filter(Boolean).join('; ')}` : '',
    referenceLines(p.reference),
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
  if (strategy === 'rewrite') return `${base}\n\nEarlier versions of this page did not display.${past}\nWrite the page again from scratch, with a different and simpler construction (fewer layers, no tricks). Same output format.`;
  return `${base}\n\nEarlier versions of this page did not display.${past}\nWrite the SIMPLEST page that displays: the brand ground, the title, then every content key in order in a column, primitives full width. Same output format.`;
}
