/**
 * LES MOTIFS D'AMBIANCE — le décor tonal que le CODE pose derrière une composition.
 *
 * Même logique que le moteur vidéo (intention → motif → forme) : un motif est un petit ensemble de
 * formes du kit, placées et colorées par le code d'après la charte. Le routeur le CHOISIT sans un
 * jeton, selon l'intention du visuel et la direction artistique de la marque (l'IA, à partir du
 * cran High, peut en choisir un autre dans un menu de cinq).
 *
 * Règle de sûreté : un motif d'ambiance est TONAL (une teinte de la couleur du fond, jamais une
 * couleur franche). Derrière un texte, il ne retire presque rien au contraste — et le rendu le
 * mesure de toute façon sur les pixels. Les motifs francs (grands cercles de marque, bandes de
 * couleur) vivent dans les compositions qui réservent leur place au texte.
 */
import type { PosterIntent, PosterSpec } from '../poster.types';
import { clamp, hashSeed, isDark, mixHex, rng } from './math';
import { gfxContext, gfxHtml } from './render';
import type { GfxBox, GfxParams } from './types';

export interface MotifInput {
  width: number;
  height: number;
  u: number;
  safe: { top: number; right: number; bottom: number; left: number };
  orientation: 'portrait' | 'square' | 'landscape';
  /** Fond sur lequel le motif est posé. */
  bg: string;
  ink: string;
  primary: string;
  secondary: string;
  accent: string;
  /** Aplat de couleur (marque, accent, profond) : le décor s'éclaircit ou s'assombrit vers l'encre. */
  flat: boolean;
  seed: number;
  mirror: boolean;
}

interface Tones {
  soft: string;
  mid: string;
  line: string;
  strong: string;
}

/** Les teintes du décor : des mélanges du fond, dosés pour ne pas gêner la lecture du texte. */
export function tonesOf(i: MotifInput): Tones {
  // Sur un aplat de couleur (marque, accent), le décor S'ÉLOIGNE de l'encre : plus sombre derrière un
  // texte clair, plus clair derrière un texte sombre — il ne peut donc jamais retirer du contraste.
  const away = isDark(i.ink) ? '#ffffff' : '#000000';
  const toward = i.flat ? away : i.primary;
  const second = i.flat ? away : i.accent !== i.primary ? i.accent : i.secondary;
  const k = i.flat ? { soft: 0.1, mid: 0.15, line: 0.2, strong: 0.28 } : { soft: 0.08, mid: 0.14, line: 0.22, strong: 0.34 };
  return { soft: mixHex(i.bg, toward, k.soft), mid: mixHex(i.bg, second, k.mid), line: mixHex(i.bg, toward, k.line), strong: mixHex(i.bg, toward, k.strong) };
}

export interface MotifLayer {
  params: GfxParams;
  box: GfxBox;
}

export interface MotifDef {
  id: string;
  /** Pour le menu de l'agent (anglais) et pour les journaux. */
  summary: string;
  weight: number;
  intents: Partial<Record<PosterIntent, number>>;
  styles: Record<string, number>;
  layers: (i: MotifInput, t: Tones) => MotifLayer[];
}

const L = (params: GfxParams, x: number, y: number, w: number, h: number): MotifLayer => ({ params, box: { x, y, w, h } });

export const MOTIFS: MotifDef[] = [
  {
    id: 'none',
    summary: 'no decor: clean surface, only the type, the photo and the colour',
    weight: 0.4,
    intents: { quote: 0.3, info: 0.3 },
    styles: { minimalism: 1.2, swiss: 0.4, editorial: 0.6, brutalism: 0.5, handwritten: 0.4, victorian: 0.3 },
    layers: () => [],
  },
  {
    id: 'tonal-blobs',
    summary: 'two soft tonal organic shapes bleeding off opposite corners — friendly, warm',
    weight: 0.6,
    intents: { product: 0.4, quote: 0.3, recruit: 0.3, event: 0.2, promo: 0.2 },
    styles: { maximalism: 0.6, 'vector-art': 0.7, clay: 1, surreal: 0.6, glassmorphism: 0.6, handwritten: 0.4 },
    layers: (i, t) => {
      const r = rng(i.seed);
      const side = r() < 0.5 ? 1 : 0;
      const W = i.width;
      const H = i.height;
      const a = W * (0.75 + r() * 0.15);
      const b = W * (0.55 + r() * 0.12);
      return [
        L({ kind: 'blob', seed: i.seed, color: t.mid, variant: 'single' }, side ? W - a * 0.5 : -a * 0.5, -H * 0.1, a, a * 0.92),
        L({ kind: 'blob', seed: i.seed + 5, color: t.soft, variant: 'single' }, side ? -b * 0.4 : W - b * 0.6, H * 0.66, b, b * 0.9),
      ];
    },
  },
  {
    id: 'tonal-rings',
    summary: 'large concentric rings bleeding off a corner — depth, ripple, focus',
    weight: 0.6,
    intents: { launch: 0.4, product: 0.3, event: 0.2 },
    styles: { minimalism: 0.3, swiss: 0.5, y2k: 0.8, 'vector-art': 0.4, 'corporate-modern': 0.5 },
    layers: (i, t) => {
      const r = rng(i.seed);
      const S = Math.max(i.width, i.height) * 0.95;
      const right = r() < 0.5;
      const top = r() < 0.6;
      return [L({ kind: 'rings', seed: i.seed, color: t.line, color2: t.strong, variant: r() < 0.5 ? 'lines' : 'offset', stroke: 0.34, density: 4 }, right ? i.width - S * 0.62 : -S * 0.38, top ? -S * 0.38 : i.height - S * 0.62, S, S)];
    },
  },
  {
    id: 'topo',
    summary: 'faint topographic contour lines across the whole canvas — editorial, calm, precise',
    weight: 0.55,
    intents: { launch: 0.3, info: 0.4, quote: 0.3 },
    styles: { editorial: 0.8, futuristic: 0.5, cyberpunk: 0.5, surreal: 0.5, swiss: 0.2 },
    layers: (i, t) => [L({ kind: 'contours', seed: i.seed, color: t.line, color2: t.strong, variant: 'topo', stroke: 0.2, density: 3 }, 0, 0, i.width, i.height)],
  },
  {
    id: 'dot-field',
    summary: 'halftone dot field fading from a corner — pop, print, energy',
    weight: 0.5,
    intents: { promo: 0.4, event: 0.2, recruit: 0.3 },
    styles: { 'pop-art': 1, retro: 0.5, maximalism: 0.5, 'collage-art': 0.6, graffiti: 0.6, swiss: 0.4, 'pixel-art': 0.4, brutalism: 0.3 },
    layers: (i, t) => {
      const r = rng(i.seed);
      const right = r() < 0.5;
      const w = i.width * 0.78;
      const h = Math.min(i.height * 0.5, w * 0.9);
      return [L({ kind: 'dots', seed: i.seed, color: t.mid, variant: 'radial', angle: right ? 315 : 225, density: 3 }, right ? i.width - w : 0, 0, w, h)];
    },
  },
  {
    id: 'burst',
    summary: 'tonal sunburst rays from a corner — announcement, celebration, retro',
    weight: 0.45,
    intents: { promo: 0.5, event: 0.3 },
    styles: { retro: 0.8, 'pop-art': 0.8, y2k: 0.4, graffiti: 0.5, maximalism: 0.4 },
    layers: (i, t) => {
      const r = rng(i.seed);
      const S = Math.max(i.width, i.height) * 2.6;
      const cx = r() < 0.5 ? i.width * 0.95 : i.width * 0.05;
      const cy = i.height * 0.1;
      return [L({ kind: 'burst', seed: i.seed, color: t.soft, density: 3, angle: r() * 30 }, cx - S / 2, cy - S / 2, S, S)];
    },
  },
  {
    id: 'waves',
    summary: 'tonal layered waves along the bottom edge — flow, movement, calm',
    weight: 0.5,
    intents: { event: 0.3, promo: 0.2 },
    styles: { 'vector-art': 0.6, retro: 0.6, bohemian: 0.5, aurora: 0.4, 'corporate-modern': 0.4 },
    layers: (i, t) => [L({ kind: 'waves', seed: i.seed, color: t.soft, color2: t.mid, variant: 'layers', density: 3 }, 0, i.height * 0.6, i.width, i.height * 0.4)],
  },
  {
    id: 'grid-marks',
    summary: 'fine technical grid with crop marks in the margins — swiss, precise, systematic',
    weight: 0.5,
    intents: { info: 0.6, launch: 0.3 },
    styles: { swiss: 1, futuristic: 0.6, cyberpunk: 0.8, 'pixel-art': 0.8, editorial: 0.5, minimalism: 0.4, brutalism: 0.7, 'corporate-modern': 0.5, victorian: 0.3 },
    layers: (i, t) => [
      L({ kind: 'grid', seed: i.seed, color: t.soft, variant: 'lines', stroke: 0.1, density: 3 }, 0, 0, i.width, i.height),
      L({ kind: 'frame', seed: i.seed, color: t.strong, variant: 'corners', stroke: 0.3 }, i.u * 2.2, i.u * 2.2, i.width - i.u * 4.4, i.height - i.u * 4.4),
    ],
  },
  {
    id: 'mesh',
    summary: 'soft aurora light — glass, gradient glow, futuristic calm',
    weight: 0.45,
    intents: { launch: 0.5, product: 0.3 },
    styles: { glassmorphism: 1, aurora: 1, futuristic: 0.8, y2k: 0.6, cyberpunk: 0.5 },
    layers: (i, t) => [L({ kind: 'mesh', seed: i.seed, color: t.mid, color2: t.soft, opacity: 0.9, density: 3 }, 0, 0, i.width, i.height)],
  },
  {
    id: 'weave',
    summary: 'a woven geometric band along the bottom edge — West-African textile geometry (kente, bogolan, wax)',
    weight: 0.4,
    intents: { event: 0.4, recruit: 0.3, promo: 0.2 },
    styles: { bohemian: 0.9, maximalism: 0.6, 'collage-art': 0.6, 'pop-art': 0.2 },
    layers: (i, t) => {
      const r = rng(i.seed);
      const band = i.u * 4;
      return [L({ kind: 'weave', seed: i.seed, color: t.strong, color2: t.mid, variant: (['zigzag', 'diamond', 'saw', 'mud'] as const)[Math.floor(r() * 4)], density: 5 }, 0, i.height - band, i.width, band)];
    },
  },
];

export const MOTIF_BY_ID = new Map(MOTIFS.map((m) => [m.id, m]));

/** Le grain : quelles directions en veulent (sinon, rarement). */
const GRAIN_STYLES: Record<string, 'fine' | 'paper'> = { retro: 'paper', 'collage-art': 'paper', editorial: 'fine', bohemian: 'paper', handwritten: 'paper', graffiti: 'fine', 'pop-art': 'fine', surreal: 'paper', victorian: 'paper', 'vector-art': 'fine' };

export interface MotifQuery {
  intent: PosterIntent;
  styleId?: string;
  /** Les « à éviter » de la direction artistique. */
  donts?: string[];
  seed: number;
  /** Motifs récents de la marque (variété). */
  recent?: string[];
}

/** Ce que la direction artistique interdit, traduit en motifs écartés. */
export function excludedMotifs(donts: string[] = []): { motifs: Set<string>; grain: boolean } {
  const text = donts.join(' ').toLowerCase();
  const motifs = new Set<string>();
  let grain = false;
  if (/gradient|glow|blur|lueur/.test(text)) motifs.add('mesh');
  if (/pattern|texture|noise|grain|motif/.test(text)) {
    ['weave', 'dot-field', 'topo'].forEach((m) => motifs.add(m));
    grain = true;
  }
  if (/geometr|decorat|ornament|clutter|d[ée]cor|shape|forme/.test(text)) ['weave', 'burst', 'dot-field', 'tonal-rings'].forEach((m) => motifs.add(m));
  return { motifs, grain };
}

/** Les motifs classés pour cette demande — sans un jeton : intention, direction artistique, graine. */
export function rankMotifs(q: MotifQuery): { id: string; weight: number }[] {
  const style = String(q.styleId || '').toLowerCase();
  const { motifs: excluded } = excludedMotifs(q.donts);
  const recent = (q.recent || []).slice(-3);
  return MOTIFS.filter((m) => !excluded.has(m.id))
    .map((m) => {
      let w = m.weight + (m.intents[q.intent] ?? 0) + (m.styles[style] ?? 0);
      w -= recent.filter((r) => r === m.id).length * 0.6;
      w += ((hashSeed(`${q.seed}:${m.id}`) % 1000) / 1000) * 0.3;
      return { id: m.id, weight: w };
    })
    .sort((a, b) => b.weight - a.weight);
}

/** Le grain d'une demande : imposé par le style, sinon rarement ; jamais si la direction l'interdit. */
export function grainFor(q: MotifQuery): 'fine' | 'paper' | undefined {
  if (excludedMotifs(q.donts).grain) return undefined;
  const style = String(q.styleId || '').toLowerCase();
  if (GRAIN_STYLES[style]) return GRAIN_STYLES[style];
  if (style === 'minimalism' || style === 'swiss' || style === 'glassmorphism') return undefined;
  return hashSeed(`${q.seed}:grain`) % 5 === 0 ? 'fine' : undefined;
}

export function motifInputOf(spec: Pick<PosterSpec, 'width' | 'height' | 'u' | 'safe' | 'orientation' | 'scheme' | 'palette' | 'mirror'>, bg: string, seed: number): MotifInput {
  return {
    width: spec.width,
    height: spec.height,
    u: spec.u,
    safe: spec.safe,
    orientation: spec.orientation,
    bg,
    ink: spec.scheme.ink,
    primary: spec.palette.primary,
    secondary: spec.palette.secondary,
    accent: spec.palette.accent,
    flat: spec.scheme.id === 'brand' || spec.scheme.id === 'accent' || spec.scheme.id === 'ink',
    seed,
    mirror: spec.mirror,
  };
}

export interface MotifHtml {
  /** Derrière tout (avant le contenu). */
  back: string;
  /** Au-dessus de tout (le grain). */
  front: string;
}

/** Dessine le motif d'une composition. Un motif inconnu ou « none » ne dessine rien (grain excepté). */
export function motifHtml(spec: PosterSpec, bg: string): MotifHtml {
  const m = spec.motif;
  if (!m) return { back: '', front: '' };
  const input = motifInputOf(spec, bg, m.seed);
  const ctx = gfxContext({ width: spec.width, height: spec.height, u: spec.u, tokens: {}, primary: spec.palette.primary, secondary: spec.palette.secondary, bg, ink: spec.scheme.ink });
  const def = MOTIF_BY_ID.get(m.id);
  const back = def ? def.layers(input, tonesOf(input)).map((l, n) => gfxHtml(l.params, l.box, ctx, `motif-${n + 1}`).html).join('') : '';
  const front = m.grain ? gfxHtml({ kind: 'grain', seed: m.seed, variant: m.grain, opacity: m.grain === 'paper' ? 0.34 : 0.26 }, { x: 0, y: 0, w: spec.width, h: spec.height }, ctx, 'motif-grain').html : '';
  return { back, front };
}

/** Le menu du motif pour l'agent (cran High) : cinq propositions, la lettre suffit. */
export function motifMenu(ranked: { id: string }[], count = 5): string[] {
  return ranked.slice(0, count).map((r, i) => `${'abcdefgh'[i]}) ${r.id} — ${MOTIF_BY_ID.get(r.id)?.summary || ''}`);
}

export { clamp };
