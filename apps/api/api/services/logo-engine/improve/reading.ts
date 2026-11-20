/**
 * L'OBSERVATEUR — premier agent de la voie « améliorer mon logo ».
 *
 * Il REGARDE le logo envoyé par l'utilisateur et le DÉCRIT, sans rien proposer : le lot d'éléments,
 * leur géométrie, leurs positions, leurs couleurs, la typographie, ce qui fait la reconnaissance du
 * logo (`keep`) et ce qui l'abîme (`fix`). Le dessinateur (agent suivant) ne verra JAMAIS l'image :
 * cette description est son seul regard, elle doit donc suffire à redessiner le logo.
 *
 * Ce que le code garantit, sans confiance dans le modèle :
 *   · la palette est MESURÉE sur les pixels (le modèle estime mal les hex) ;
 *   · le texte du logo est lu dans le SVG quand il y a des <text> (sinon, la lecture du modèle) ;
 *   · la description est validée (éléments, conservation, longueur) et redemandée une fois avec le motif du refus ;
 *   · elle est mise en cache par empreinte du SVG : relancer ne repaie pas la vision.
 */
import crypto from 'crypto';
import { parseLlmJson } from '../../../utils/llm-json.util';
import { CONCEPT_TYPES } from '../ir/logo.schema';
import type { ConceptType } from '../ir/logo.schema';
import type { RasterImage } from '../raster/rasterizer';
import { hexToRgb, isHex, rgbToHex, rgbToHsl } from '../util/colors';

export type ReadingKind = 'icon' | 'name' | 'initial';
export type ReadingLayout = 'horizontal' | 'stacked' | 'symbol-only' | 'wordmark-only';

export interface ReadingElement {
  id: string;
  role: 'symbol' | 'wordmark' | 'tagline' | 'container' | 'accent';
  /** Ce que c'est, en une phrase visuelle (« un hexagone orange aux angles arrondis »). */
  description: string;
  /** Sa géométrie (« hexagone régulier, pointe en haut, angles arrondis ≈ 8 % »). */
  geometry: string;
  /** Où il se trouve dans le logo (« à gauche, centré verticalement »). */
  position: string;
  /** Sa taille relative (« ≈ 60 % de la hauteur du logo »). */
  size: string;
  /** Sa couleur (hex estimé). */
  color: string;
  /** Sa boîte dans le carré du logo, 0–100 (x, y = coin haut-gauche) : ce que le dessinateur recopie en coordonnées. */
  box?: { x: number; y: number; w: number; h: number };
}

export interface LogoReading {
  /** Le texte lisible dans le logo, tel qu'écrit (« » s'il n'y en a pas). */
  brandText: string;
  kind: ReadingKind;
  layout: ReadingLayout;
  /** La catégorie du moteur la plus proche. */
  conceptType: ConceptType;
  /** Le logo en 2–4 phrases, pour quelqu'un qui ne le verra jamais. */
  summary: string;
  elements: ReadingElement[];
  symmetry: 'none' | 'vertical' | 'horizontal' | 'both' | 'radial';
  /** Comment le logo est construit (grille, cercles concentriques, angles, trait constant…). */
  construction: string;
  typography: string;
  /** Palette MESURÉE par le code (hex, part de l'encre) ; l'usage vient de l'observateur. */
  palette: { hex: string; share: number; usage: string }[];
  symbolism: string;
  /** Les défauts constatés (un par ligne, concrets). */
  weaknesses: string[];
  /** Ce qui fait la reconnaissance du logo : à ne PAS changer. */
  keep: string[];
  /** Ce qui doit être corrigé, une consigne par défaut. */
  fix: string[];
}

// ─── La consigne ────────────────────────────────────────────────────────────

export const OBSERVER_INSTRUCTION = `<role>You are the OBSERVER: a meticulous visual analyst. You only DESCRIBE what you see. You never propose a redesign.</role>
<context>The image shows a brand logo on white: the logo large, then (when present) the same logo at tiny size on the right. Another designer will redraw this logo WITHOUT ever seeing the image, from your description alone.</context>
<method>
1. Read any text exactly as written (letters, case, accents). If there is none, brandText is "".
2. List EVERY distinct visual element (symbol, container, wordmark, tagline, accent) with: what it is, its exact geometry (shape, sides, angles, curvature, stroke or fill, thickness), its position, its relative size, its color (hex estimate), and its BOX: [x, y, w, h] in a 0–100 square that tightly frames the whole logo (x, y = top-left corner).
3. Say how the whole is constructed: symmetry, alignment, repeated angles, proportions between elements.
4. Describe the typography (serif/sans/script/slab, weight, case, letter-spacing, any custom letter detail).
5. State the symbolism: what the mark evokes.
6. AUDIT honestly using BOTH renderings: unequal strokes, misalignment, muddy or clashing colors, too many details, details lost at tiny size, dated effects (gradient, shadow, bevel, 3D), awkward spacing or kerning, unbalanced weight.
7. keep = the features that make this logo RECOGNIZABLE (core silhouette, hue family, symbol idea, initials/name, signature detail). fix = one precise instruction per weakness.
</method>
<rules>
- Be concrete and measurable: "a rounded hexagon, point up, filled orange #F28C28, about 60% of the logo height, left of the wordmark" — never "a nice shape".
- Never invent an element that is not in the image. Never omit one that is.
- All fields are required. Write in English.
</rules>
<output_format>
ONLY valid JSON, no fences, no prose:
{
 "brandText": "<text exactly as written or empty>",
 "kind": "icon" | "name" | "initial",
 "layout": "horizontal" | "stacked" | "symbol-only" | "wordmark-only",
 "conceptType": "${CONCEPT_TYPES.join('" | "')}",
 "summary": "<2-4 sentences describing the whole logo>",
 "elements": [{"id":"e1","role":"symbol|wordmark|tagline|container|accent","description":"","geometry":"","position":"","size":"","color":"#RRGGBB","box":[x,y,w,h]}],
 "symmetry": "none" | "vertical" | "horizontal" | "both" | "radial",
 "construction": "",
 "typography": "<description or 'none'>",
 "paletteUsage": [{"hex":"#RRGGBB","usage":"<where this color is used>"}],
 "symbolism": "",
 "weaknesses": ["<concrete defect>"],
 "keep": ["<recognition feature>"],
 "fix": ["<one precise instruction>"]
}
</output_format>`;

// ─── Lecture de la réponse ──────────────────────────────────────────────────

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v: unknown, max: number, each = 220) => (Array.isArray(v) ? v.map((x) => str(x, each)).filter(Boolean).slice(0, max) : []);
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (typeof v === 'string' && (values as readonly string[]).includes(v) ? (v as T) : fallback);

const ROLES = ['symbol', 'wordmark', 'tagline', 'container', 'accent'] as const;

/** Une boîte [x, y, w, h] (ou {x,y,w,h}) ramenée dans le carré 0–100 ; `null` si illisible ou vide. */
export function parseBox(v: unknown): { x: number; y: number; w: number; h: number } | null {
  const arr = Array.isArray(v) ? v : v && typeof v === 'object' ? [(v as Record<string, unknown>).x, (v as Record<string, unknown>).y, (v as Record<string, unknown>).w, (v as Record<string, unknown>).h] : null;
  if (!arr || arr.length < 4) return null;
  const [x, y, w, h] = arr.slice(0, 4).map((n) => Number(n));
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
  const c = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
  return { x: c(x), y: c(y), w: Math.max(1, c(Math.min(w, 100 - c(x)))), h: Math.max(1, c(Math.min(h, 100 - c(y)))) };
}

export interface ParsedReading {
  reading?: Omit<LogoReading, 'palette'> & { paletteUsage: { hex: string; usage: string }[] };
  /** Pourquoi la réponse est refusée (renvoyé au modèle pour la seconde tentative). */
  problem?: string;
}

export function parseReading(raw: string): ParsedReading {
  const json = parseLlmJson<Record<string, unknown>>(raw || '');
  if (!json || typeof json !== 'object') return { problem: 'the answer was not a valid JSON object' };
  const elements: ReadingElement[] = (Array.isArray(json.elements) ? json.elements : [])
    .map((e, i) => {
      const o = (e ?? {}) as Record<string, unknown>;
      const color = str(o.color, 9);
      return {
        id: str(o.id, 24) || `e${i + 1}`,
        role: oneOf(o.role, ROLES, 'symbol'),
        description: str(o.description),
        geometry: str(o.geometry),
        position: str(o.position, 160),
        size: str(o.size, 120),
        color: isHex(color) ? color.toLowerCase() : '',
        ...(parseBox(o.box) ? { box: parseBox(o.box)! } : {}),
      };
    })
    .filter((e) => e.description.length > 5)
    .slice(0, 12);
  if (!elements.length) return { problem: 'no visual element was described (elements must list every part of the logo)' };
  if (elements.filter((e) => e.geometry.length > 4).length < Math.ceil(elements.length / 2)) return { problem: 'most elements have no geometry (give shape, sides, curvature, stroke or fill)' };
  const summary = str(json.summary, 700);
  if (summary.length < 40) return { problem: 'summary is missing or too short (2-4 sentences required)' };
  const keep = list(json.keep, 8);
  if (!keep.length) return { problem: 'keep is empty (list what makes the logo recognizable)' };
  const fix = list(json.fix, 10);
  const weaknesses = list(json.weaknesses, 10);
  const paletteUsage = (Array.isArray(json.paletteUsage) ? json.paletteUsage : [])
    .map((p) => ({ hex: str((p as Record<string, unknown>)?.hex, 9).toLowerCase(), usage: str((p as Record<string, unknown>)?.usage, 120) }))
    .filter((p) => isHex(p.hex))
    .slice(0, 6);
  return {
    reading: {
      brandText: str(json.brandText, 80),
      kind: oneOf(json.kind, ['icon', 'name', 'initial'] as const, 'icon'),
      layout: oneOf(json.layout, ['horizontal', 'stacked', 'symbol-only', 'wordmark-only'] as const, 'horizontal'),
      conceptType: oneOf(json.conceptType, CONCEPT_TYPES as readonly ConceptType[], 'combination'),
      summary,
      elements,
      symmetry: oneOf(json.symmetry, ['none', 'vertical', 'horizontal', 'both', 'radial'] as const, 'none'),
      construction: str(json.construction, 400),
      typography: str(json.typography, 300) || 'none',
      paletteUsage,
      symbolism: str(json.symbolism, 300),
      weaknesses,
      keep,
      fix: fix.length ? fix : weaknesses.map((w) => `Fix: ${w}`),
    },
  };
}

// ─── Ce que le code mesure ──────────────────────────────────────────────────

/** Les textes écrits dans le SVG (`<text>`), quand il en a : la lecture la plus fiable du nom. */
export function svgTexts(svg: string): string[] {
  const out: string[] = [];
  for (const m of svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)) {
    const t = m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#?\w+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (t) out.push(t);
  }
  return out;
}

/**
 * La palette mesurée : les pixels sont groupés par teinte (quantification 4 bits), les gris
 * fusionnés, les couleurs voisines réunies. Le fond (blanc, ou la couleur dominante des coins)
 * est écarté. Retourne au plus 5 couleurs, de la plus couverte à la moins couverte.
 */
export function measurePalette(image: RasterImage): { hex: string; share: number }[] {
  const { width, height, rgba } = image;
  const corner = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]] as const;
  };
  const corners = [corner(0, 0), corner(width - 1, 0), corner(0, height - 1), corner(width - 1, height - 1)];
  const flat = corners.every((c) => Math.abs(c[0] - corners[0][0]) + Math.abs(c[1] - corners[0][1]) + Math.abs(c[2] - corners[0][2]) < 24 && Math.abs(c[3] - corners[0][3]) < 24);
  const bg = flat ? corners[0] : null;
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a < 200) continue;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    if (bg && bg[3] >= 200 && Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 40) continue;
    if (!bg && r > 245 && g > 245 && b > 245) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    cur.r += r;
    cur.g += g;
    cur.b += b;
    cur.n++;
    buckets.set(key, cur);
    total++;
  }
  if (!total) return [];
  const colors = [...buckets.values()]
    .map((c) => ({ rgb: [c.r / c.n, c.g / c.n, c.b / c.n] as [number, number, number], n: c.n }))
    .sort((a, b) => b.n - a.n);
  // Réunit les couleurs voisines (antialiasing, dégradés) autour de la plus couverte.
  const merged: { rgb: [number, number, number]; n: number }[] = [];
  for (const c of colors) {
    const near = merged.find((m) => Math.hypot(m.rgb[0] - c.rgb[0], m.rgb[1] - c.rgb[1], m.rgb[2] - c.rgb[2]) < 56);
    if (near) near.n += c.n;
    else merged.push({ ...c });
  }
  return merged
    .filter((m) => m.n / total >= 0.02)
    .slice(0, 5)
    .map((m) => ({ hex: rgbToHex([Math.round(m.rgb[0]), Math.round(m.rgb[1]), Math.round(m.rgb[2])]), share: Math.round((m.n / total) * 100) / 100 }));
}

/** Rattache l'usage décrit par l'observateur à la couleur mesurée la plus proche. */
export function mergePalette(measured: { hex: string; share: number }[], usage: { hex: string; usage: string }[]): LogoReading['palette'] {
  const dist = (a: string, b: string) => {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  return measured.map((m) => {
    const best = usage.map((u) => ({ u, d: dist(u.hex, m.hex) })).sort((a, b) => a.d - b.d)[0];
    return { hex: m.hex, share: m.share, usage: best && best.d < 120 ? best.u.usage : 'accent detail' };
  });
}

/** Écart de teinte (0–180°) entre deux couleurs ; 0 quand l'une des deux est neutre (gris, noir, blanc). */
export function hueGap(a: string, b: string): number {
  const [ha, sa, la] = rgbToHsl(hexToRgb(a));
  const [hb, sb, lb] = rgbToHsl(hexToRgb(b));
  const neutral = (s: number, l: number) => s < 0.12 || l < 0.08 || l > 0.94;
  if (neutral(sa, la) || neutral(sb, lb)) return neutral(sa, la) && neutral(sb, lb) ? 0 : 90;
  const d = Math.abs(ha - hb) % 360;
  return d > 180 ? 360 - d : d;
}

export const readingKey = (svg: string) => crypto.createHash('sha1').update(svg).digest('hex').slice(0, 24);

/** La description complète, mise en forme pour le dessinateur (ordre fixe, une idée par ligne). */
export function readingSheet(r: LogoReading): string {
  return [
    `LOGO TO REDRAW — ${r.kind} logo, layout ${r.layout}, closest category: ${r.conceptType}`,
    r.brandText ? `TEXT IN THE LOGO: "${r.brandText}"` : 'TEXT IN THE LOGO: none',
    `SUMMARY: ${r.summary}`,
    'ELEMENTS:',
    ...r.elements.map((e) => ` - [${e.role}] ${e.description}. Geometry: ${e.geometry}. Position: ${e.position}${e.box ? ` (box x${e.box.x} y${e.box.y} w${e.box.w} h${e.box.h})` : ''}. Size: ${e.size}. Color: ${e.color || 'n/a'}.`),
    `SYMMETRY: ${r.symmetry}. CONSTRUCTION: ${r.construction || 'n/a'}`,
    `TYPOGRAPHY: ${r.typography}`,
    `PALETTE (measured): ${r.palette.map((p) => `${p.hex} (${Math.round(p.share * 100)}%, ${p.usage})`).join('; ') || 'n/a'}`,
    `SYMBOLISM: ${r.symbolism || 'n/a'}`,
    `WEAKNESSES: ${r.weaknesses.join(' | ') || 'none noted'}`,
    `KEEP (recognition — do not change): ${r.keep.join(' | ')}`,
    `FIX: ${r.fix.join(' | ') || 'none'}`,
  ].join('\n');
}

/**
 * La CARTE D'ENCRE de l'original, mesurée par le code : la silhouette recadrée sur un carré n × n,
 * « # » = encre pleine, « + » = encre partielle, « . » = vide. Le dessinateur ne voit pas l'image ;
 * cette carte lui donne la vraie silhouette (≈ 110 tokens pour 20 × 20) au lieu de seuls mots.
 */
export function inkMap(grid: Float32Array, n: number): string {
  const rows: string[] = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) {
      const v = grid[y * n + x];
      row += v >= 0.55 ? '#' : v >= 0.18 ? '+' : '.';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

/** Le texte d'analyse que la création de projet recopie dans `customDescription` : inutile au dessinateur, qui reçoit la lecture entière. */
export function wishWithoutAnalysis(text?: string): string | undefined {
  if (!text) return undefined;
  const kept = text
    .split(/\n\s*\n/)
    .filter((p) => !/^\s*(KEEP:|Original logo reference)/i.test(p))
    .join('\n\n')
    .trim();
  return kept || undefined;
}
