/**
 * LE TRAVAIL DIVISÉ — une page se fait en petites tâches, chacune à la portée d'un modèle léger :
 *
 *   1. l'AGENT DE MISE EN PAGE (`graphic.layout`) invente la grille et les zones de CETTE page, en suivant la
 *      grammaire de composition de la direction artistique : un petit plan JSON, aucune ligne de HTML. Rien n'est
 *      prédéfini : ni nombre de colonnes, ni position, ni gabarit ;
 *   2. le CODE vérifie le plan : zones dans la grille, aucune zone sur une autre, chaque contenu placé une fois ;
 *   3. les AGENTS DE ZONE (`graphic.zone`), en parallèle, écrivent chacun UNE zone : sa taille exacte, ses seuls
 *      contenus, l'échelle typographique de la page (la même pour toutes les zones) ;
 *   4. le CODE assemble les zones sur la grille : un chevauchement est impossible par construction, une zone qui
 *      déborde est ramenée à sa taille par le code.
 *
 * Le coût reste celui d'un auteur : un petit plan, puis des zones courtes au lieu d'une page entière.
 */
import type { SectionContent } from '../contracts/content-model';
import type { FormatDef } from '../design-system/formats';
import { brandSheet, canvasLine, deliverableLine, directionLines, DocumentContext, professionalLines, TAILWIND_SHEET } from './prompts';

/** Une unité de contenu : un texte d'en-tête (`title`, `kicker`, `lede`) ou un bloc (son identifiant). */
export type Unit = string;

export interface LayoutZone {
  id: string;
  units: Unit[];
  /** Colonne et ligne de départ (1…), étendue en colonnes et en lignes. */
  col: number;
  span: number;
  row: number;
  rows: number;
  /** Alignement vertical du contenu dans la zone. */
  align: 'start' | 'center' | 'end';
  /** Ce que fait la zone, en une phrase (pour son agent). */
  intent: string;
}

export interface PageLayout {
  columns: number;
  /** Lignes de la grille (toile fixe) ; une page de flux grandit (lignes automatiques). */
  rows: number;
  background: 'ground' | 'soft';
  zones: LayoutZone[];
}

/** Les unités de la page et leur inventaire (les lignes de la carte de contenu qui les décrivent). */
export function listingUnits(listing: string): Map<Unit, string> {
  const out = new Map<Unit, string>();
  const [head, ...blocks] = listing.split(/\n(?=# block )/);
  for (const line of head.split('\n')) {
    const key = line.match(/^\{\{(title|kicker|lede)\}\} = /)?.[1];
    if (key) out.set(key, line);
  }
  for (const chunk of blocks) {
    const id = chunk.match(/^# block ([\w.:-]+)/)?.[1];
    if (id) out.set(id, chunk.trim());
  }
  return out;
}

/** La géométrie d'une page : marge et gouttière, d'après le format (pas un gabarit : des cotes d'impression). */
export function pageGeometry(format: FormatDef): { pad: number; gap: number } {
  return { pad: Math.round(format.pad ?? 48), gap: Math.max(12, Math.round((format.unit ?? 4) * 5)) };
}

/**
 * Le nombre de lignes au-delà duquel une rangée de la toile devient plus mince qu'une ligne de titre (conseil donné à
 * l'agent ; c'est la hauteur de chaque zone face à son contenu qui est EXIGÉE, cf. `parseLayout`). Douze rangées sur
 * une diapositive de 631 px laissaient 21 px par rangée, et le titre de 68 px posé dans une seule d'entre elles
 * débordait sur les maquettes (charte réelle, 05/11/2026).
 */
export function maxRows(format: FormatDef): number {
  if (format.kind === 'flow') return 12;
  const { pad, gap } = pageGeometry(format);
  const minRow = Math.max(36, Math.round(1.5 * gap));
  return Math.max(3, Math.min(12, Math.floor((format.height - 2 * pad + gap) / (minRow + gap))));
}

/** Ce que le code exige des zones : la hauteur minimale d'une unité (le titre à sa taille), les galeries de maquettes. */
export interface LayoutNeeds {
  /** La hauteur (px) qu'une unité demande pour une largeur de zone donnée ; 0 : rien d'exigé. */
  height?: (unit: Unit, width: number) => number;
  /** Les blocs de maquettes : la démonstration de la page, à qui revient la plus grande part de la toile. */
  galleries?: Unit[];
}

/** La part minimale de la toile utile qu'une galerie de maquettes occupe : elles sont la page. */
export const GALLERY_SHARE = 0.5;

// ── 1. L'agent de mise en page ───────────────────────────────────────────────────────────────

export function layoutPrompt(ctx: DocumentContext, p: { section: SectionContent; units: Map<Unit, string>; language?: string; plan?: { page?: string }; galleries?: Unit[] }): { system: string; user: string } {
  const flow = ctx.format.kind === 'flow';
  const rowsMax = maxRows(ctx.format);
  const system = [
    `You are the layout designer of ${deliverableLine(ctx)}. Invent the grid and the zones of THIS page — no HTML. Other designers will each fill ONE zone.`,
    'Follow the brand art direction: its grid, white space, signature move and layout recipes. The layout is yours: never a template, shaped by what this page has to show.',
    'Professional and essential: one focal zone that dominates, the others clearly secondary, related content in the same zone, generous space. 2 to 5 zones.',
    flow
      ? 'The page is A4 and GROWS DOWNWARD: zones sit on rows read from top to bottom; zones on the same row stand side by side. Long text and tables take the full width.'
      : `The page is a FIXED canvas: the zones together must fit it; give each zone room for its content (a table or a chart needs a large zone; a title a short one, but tall enough for the title at the page title size). Prefer at most ${rowsMax} rows: beyond that a single row is thinner than a line of title.`,
    p.galleries?.length ? `The mockups (${p.galleries.join(', ')}) ARE this page: their zone takes at least ${Math.round(GALLERY_SHARE * 100)} % of the canvas, as wide and tall as possible; the title is a short label beside or above them.` : '',
    'Every content unit goes to exactly one zone. Zones never overlap.',
    'Answer ONLY JSON:',
    `{"columns": 4-12, ${flow ? '' : `"rows": 3-12, `}"background": "ground"|"soft", "zones": [{"units": ["title", …], "col": 1…, "span": n, "row": 1…, ${flow ? '' : '"rows": n, '}"align": "start"|"center"|"end", "intent": "what this zone does, one short sentence"}]}`,
  ]
    .filter(Boolean)
    .join('\n');
  const user = [
    `CANVAS: ${canvasLine(ctx.format)}`,
    `BRAND:\n${brandSheet(ctx)}`,
    [p.language ? `BRAND VISUAL LANGUAGE:\n${p.language}` : '', directionLines(ctx)].filter(Boolean).join('\n\n'),
    p.plan?.page ? `THIS PAGE IN THE DOCUMENT PLAN: ${p.plan.page}` : '',
    ctx.layoutNote ? `THE CLIENT ASKS FOR THIS LAYOUT: ${ctx.layoutNote.slice(0, 400)}` : '',
    p.section.intent?.keyMessage ? `THE READER MUST UNDERSTAND: ${p.section.intent.keyMessage}` : '',
    `CONTENT UNITS (place each one in a zone):\n${[...p.units.entries()].map(([u, text]) => `- ${u}: ${text.split('\n')[0].replace(/^# block [\w.:-]+ — /, '').slice(0, 220)}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { system, user };
}

/**
 * Le plan, vérifié par le CODE. `null` : illisible ou impossible (zones hors grille, zones superposées) — l'agent
 * recommence ou la page retombe sur l'auteur unique. Une unité oubliée rejoint la zone du titre ; un doublon est
 * retiré ; une unité inconnue est ignorée.
 */
export function parseLayout(raw: string, units: Unit[], format: FormatDef, needs: LayoutNeeds = {}): { layout: PageLayout | null; error?: string } {
  const match = String(raw || '').replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
  if (!match) return { layout: null, error: 'no JSON layout' };
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return { layout: null, error: 'invalid JSON' };
  }
  const flow = format.kind === 'flow';
  const int = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);
  const columns = int(json.columns, 1, 12, 12);
  const rows = flow ? 0 : int(json.rows, 1, 12, 8);
  const known = new Set(units);
  const placed = new Set<Unit>();
  const zones: LayoutZone[] = [];
  for (const [i, z] of (Array.isArray(json.zones) ? json.zones : []).slice(0, 6).entries()) {
    const o = (z ?? {}) as Record<string, unknown>;
    const zu = [...new Set((Array.isArray(o.units) ? o.units : []).map(String))].filter((u) => known.has(u) && !placed.has(u));
    if (!zu.length) continue;
    zu.forEach((u) => placed.add(u));
    const col = int(o.col, 1, columns, 1);
    const span = int(o.span, 1, columns - col + 1, columns - col + 1);
    const row = int(o.row, 1, flow ? 40 : rows, 1);
    const rs = flow ? 1 : int(o.rows, 1, rows - row + 1, rows - row + 1);
    const align = o.align === 'center' || o.align === 'end' ? o.align : 'start';
    zones.push({ id: `z${i + 1}`, units: zu, col, span, row, rows: rs, align, intent: String(o.intent ?? '').slice(0, 160) });
  }
  if (!zones.length) return { layout: null, error: 'no zone holds a content unit' };
  // Les unités oubliées : avec le titre (ou la première zone).
  const missing = units.filter((u) => !placed.has(u));
  if (missing.length) (zones.find((z) => z.units.includes('title')) ?? zones[0]).units.push(...missing);
  // Aucune zone sur une autre.
  const taken = new Map<string, string>();
  for (const z of zones) {
    for (let r = z.row; r < z.row + z.rows; r++) {
      for (let c = z.col; c < z.col + z.span; c++) {
        const cell = `${r}:${c}`;
        if (taken.has(cell)) return { layout: null, error: `zones ${taken.get(cell)} and ${z.id} overlap at row ${r}, column ${c}` };
        taken.set(cell, z.id);
      }
    }
  }
  const layout: PageLayout = { columns, rows, background: json.background === 'soft' ? 'soft' : 'ground', zones };
  // Une zone trop basse pour ce qu'elle porte (le titre à la taille de la page) : il déborderait sur la voisine.
  if (!flow) {
    const { pad } = pageGeometry(format);
    const inner = (format.width - 2 * pad) * (format.height - 2 * pad);
    for (const z of zones) {
      const size = zoneSize(layout, z, format);
      const need = z.units.reduce((sum, u) => sum + (needs.height?.(u, size.width) ?? 0), 0);
      // Un léger excès est ramené par le code (réduction de la zone, plancher 0,6) ; au-delà, la zone ne peut pas le porter.
      if (size.height !== undefined && need * 0.6 > size.height) return { layout: null, error: `zone ${z.id} (${z.units.join(', ')}) is ${size.height}px high but its content needs about ${Math.round(need)}px: give it more rows or more columns` };
      const gallery = z.units.find((u) => needs.galleries?.includes(u));
      if (gallery && size.height !== undefined && (size.width * size.height) / inner < GALLERY_SHARE)
        return { layout: null, error: `the mockups (${gallery}) get only ${Math.round(((size.width * size.height) / inner) * 100)} % of the page: they are the page, give their zone at least ${Math.round(GALLERY_SHARE * 100)} %` };
    }
  }
  return { layout, error: undefined };
}

/** La taille d'une zone en px (largeur, et hauteur sur une toile fixe). */
export function zoneSize(layout: PageLayout, zone: LayoutZone, format: FormatDef): { width: number; height?: number } {
  const { pad, gap } = pageGeometry(format);
  const colW = (format.width - 2 * pad - (layout.columns - 1) * gap) / layout.columns;
  const width = Math.round(colW * zone.span + gap * (zone.span - 1));
  if (format.kind === 'flow' || !layout.rows) return { width };
  const rowH = (format.height - 2 * pad - (layout.rows - 1) * gap) / layout.rows;
  return { width, height: Math.round(rowH * zone.rows + gap * (zone.rows - 1)) };
}

// ── 3. Les agents de zone ────────────────────────────────────────────────────────────────────

/** L'échelle typographique de la PAGE, la même pour toutes ses zones (la hiérarchie ne se décide pas zone par zone). */
export function typeScaleLine(ctx: DocumentContext, showcase = false): string {
  const s = ctx.tokens.size;
  // Une page de maquettes : le titre est une étiquette, les maquettes sont la page.
  return `TYPE SCALE OF THE PAGE (use exactly these sizes, the same in every zone): page title ${Math.round(showcase ? s['2xl'] : s['4xl'])}px font-display; heading ${Math.round(s['2xl'])}px font-display; lead ${Math.round(s.lg)}px; body ${Math.round(s.base)}px; caption and labels ${Math.round(s.sm)}px; key figures up to ${Math.round(s['5xl'])}px.`;
}

export function zoneSystem(ctx: DocumentContext): string {
  const flow = ctx.format.kind === 'flow';
  return [
    `You write the HTML of ONE ZONE of ${deliverableLine(ctx)}, with Tailwind classes. Other designers write the other zones; the page grid is already decided.`,
    flow
      ? 'OUTPUT: one ```html block: the zone fragment. Its top element is class="w-full …"; the zone grows downward.'
      : 'OUTPUT: one ```html block: the zone fragment. Its top element fills the zone exactly (class="h-full w-full …"): nothing may exceed the zone size given.',
    '',
    professionalLines(ctx),
    '',
    TAILWIND_SHEET,
    '',
    'CONTENT — every visible word comes from the CONTENT list: write {{key}} where its text goes. Never retype, translate, shorten or invent a text: any word typed outside a key is deleted. No template loops ({{#each}}). Place EVERY key of your zone and no other key.',
  ].join('\n');
}

export function zoneUser(ctx: DocumentContext, p: { zone: LayoutZone; size: { width: number; height?: number }; listing: string; tools: string; language?: string; page: string; showcase?: boolean }): string {
  return [
    `PAGE: ${p.page}`,
    `THIS ZONE: ${p.size.width}px wide${p.size.height ? ` × ${p.size.height}px high (fixed)` : ', height grows with its content'} — content aligned ${p.zone.align === 'center' ? 'to the vertical centre' : p.zone.align === 'end' ? 'to the bottom' : 'to the top'}. Its job: ${p.zone.intent || 'show its content clearly'}.`,
    `BRAND:\n${brandSheet(ctx)}`,
    [p.language ? `BRAND VISUAL LANGUAGE (apply it):\n${p.language}` : '', directionLines(ctx)].filter(Boolean).join('\n\n'),
    typeScaleLine(ctx, p.showcase),
    p.tools,
    `CONTENT OF THIS ZONE (keys → texts):\n${p.listing}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ── 4. L'assemblage ──────────────────────────────────────────────────────────────────────────

/**
 * La page assemblée : la grille du plan, chaque zone à sa place (`data-ge-zone`), son HTML dedans. `zoom` : la
 * réduction qu'une zone qui déborde reçoit du code.
 */
export function assembleLayout(layout: PageLayout, zones: Map<string, string>, format: FormatDef, zoom: Map<string, number> = new Map()): string {
  const { pad, gap } = pageGeometry(format);
  const ground = layout.background === 'soft' ? 'bg-brand-soft' : 'bg-ground';
  const cell = (z: LayoutZone) => {
    const inner = zones.get(z.id) ?? '';
    const k = zoom.get(z.id);
    const body = k ? `<div class="h-[${(100 / k).toFixed(3)}%] w-[${(100 / k).toFixed(3)}%] [zoom:${k}]">${inner}</div>` : inner;
    const place = format.kind === 'flow' ? `col-start-${z.col} col-span-${z.span}` : `col-start-${z.col} col-span-${z.span} row-start-${z.row} row-span-${z.rows}`;
    const align = z.align === 'center' ? 'justify-center' : z.align === 'end' ? 'justify-end' : 'justify-start';
    return `<div data-ge-zone="${z.id}" class="${place} flex min-h-0 min-w-0 flex-col ${align}">${body}</div>`;
  };
  const cols = `grid-cols-[repeat(${layout.columns},minmax(0,1fr))]`;
  if (format.kind === 'flow') {
    // Une page de flux : une rangée par ligne du plan (le paginateur coupe entre les rangées).
    const byRow = new Map<number, LayoutZone[]>();
    for (const z of [...layout.zones].sort((a, b) => a.row - b.row || a.col - b.col)) byRow.set(z.row, [...(byRow.get(z.row) ?? []), z]);
    return `<div class="w-full ${ground}">${[...byRow.values()].map((row) => `<div class="grid ${cols} gap-x-[${gap}px] pb-[${gap}px]">${row.map(cell).join('')}</div>`).join('')}</div>`;
  }
  return `<div class="grid h-full w-full ${cols} grid-rows-[repeat(${layout.rows},minmax(0,1fr))] gap-[${gap}px] p-[${pad}px] ${ground}">${layout.zones.map(cell).join('')}</div>`;
}
