/**
 * LE SOLVEUR GÉOMÉTRIQUE — une intention de scène → la boîte de chaque élément, format par format.
 *
 * Les blocs (une pile de textes, un média, un appareil, un logo) sont posés sur la GRILLE de la zone sûre (colonnes,
 * gouttière) par le type de composition ; leur position verticale est résolue par contraintes (Cassowary,
 * `@lume/kiwi`, BSD-3) à forces graduées :
 *
 *   obligatoires  rester dans la zone sûre ; aucun texte sur un autre (les piles s'empilent, les blocs se suivent avec
 *                 une gouttière) ; l'élément principal garde une taille minimale (contre « prudence = platitude ») ;
 *   fortes        bords sur les colonnes, bords partagés, centres alignés entre blocs voisins ;
 *   moyennes      position verticale choisie (centre, tiers haut, tiers bas), part du média, équilibre des masses ;
 *   faibles       ce que le modèle souhaite (relations « above », « below »…).
 *
 * Les tailles de texte viennent de l'échelle du film (niveaux), les boîtes de texte des métriques réelles de la police
 * (`design/typography.ts`). Le navigateur garde la garantie finale (`FIT`) : ce solveur PLACE, il ne dessine pas.
 */
import * as kiwi from '@lume/kiwi';
import type { SceneDesign } from '../design/types';
import { frameInUnits, SafeFormat } from '../design/safezones';
import { textBox } from '../design/typography';
import type { TypeLevel } from '../dsl/types';
import type { IntentElement, SceneIntent } from '../intent/types';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const boxW = (b: Box) => b.x1 - b.x0;
export const boxH = (b: Box) => b.y1 - b.y0;
export const cx = (b: Box) => (b.x0 + b.x1) / 2;
export const cy = (b: Box) => (b.y0 + b.y1) / 2;
export const area = (b: Box) => Math.max(0, boxW(b)) * Math.max(0, boxH(b));
export function overlap(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
}

/** Le choix discret d'une variante (le code en produit 4 à 12 par scène ; le juge garde la meilleure). */
export interface VariantChoice {
  /** Le côté du média ou de l'appareil : début (gauche / haut) ou fin (droite / bas). */
  side: 'start' | 'end';
  /** La part du média (0,42 · 0,5 · 0,58). */
  ratio: number;
  valign: 'center' | 'upper' | 'lower';
  /** Un cran d'échelle de plus ou de moins pour l'élément principal. */
  typeStep: -1 | 0 | 1;
  /** Échelle d'un logo ou d'un appareil (1 ou 1,15). */
  scale: number;
  /** Plein cadre : où poser le texte (zone calme du média, bas, haut). */
  textZone: 'calm' | 'bottom' | 'top';
  /** Alignement des textes. */
  align: 'left' | 'center';
}

export const DEFAULT_CHOICE: VariantChoice = { side: 'start', ratio: 0.5, valign: 'center', typeStep: 0, scale: 1, textZone: 'calm', align: 'left' };

export interface SolveMedia {
  kind: 'image' | 'video';
  width: number;
  height: number;
  /** Zone calme de l'image pour ce format (0..1 dans le cadre recadré) et sa clarté. */
  calm?: { x: number; y: number; w: number; h: number; light?: boolean };
}

export interface SolveInput {
  intent: SceneIntent;
  texts: Record<string, string>;
  media: SolveMedia[];
  design: SceneDesign;
  fonts: { display: string; body: string };
  /** Proportion du logo (largeur / hauteur). */
  logoAspect?: number;
  format: SafeFormat;
  choice: VariantChoice;
}

export interface Placed {
  id: string;
  kind: IntentElement['kind'] | 'bullet' | 'item';
  box: Box;
  /** Texte : taille (u), lignes estimées, alignement. */
  size?: number;
  lines?: string[];
  align?: 'left' | 'center' | 'right';
  rank: number;
  /** Ordre de dessin (les décors d'abord, les textes en dernier). */
  layer: number;
  /** L'élément est posé sur un aplat (plein cadre sans zone calme) ou sur un média (zone calme). */
  on?: 'ground' | 'plate' | 'media-light' | 'media-dark' | 'button' | 'chip';
  /** Média : plein cadre (débord). */
  bleed?: boolean;
  /** Puce d'une liste : la clé de son texte. */
  textKey?: string;
  level?: TypeLevel;
}

export interface Placement {
  format: SafeFormat;
  choice: VariantChoice;
  elements: Placed[];
  /** Aplats posés sous des textes (plein cadre sans zone calme). */
  plates: { id: string; box: Box; behind: string[] }[];
  feasible: boolean;
  notes: string[];
  frame: ReturnType<typeof frameInUnits>;
}

// ─── Mesures ─────────────────────────────────────────────────────────────────

const HEADINGS: TypeLevel[] = ['display', 'title', 'subtitle'];

interface Measured {
  el: IntentElement;
  size: number;
  width: number;
  height: number;
  lines: string[];
}

function textOf(input: SolveInput, key?: string): string {
  if (!key) return '';
  return String(input.texts[key.replace(/^\$/, '')] || '');
}

/** La taille (u) d'un texte : son niveau, et pour l'élément principal le cran d'échelle de la variante. */
function sizeOf(input: SolveInput, el: IntentElement): number {
  const level = el.level || 'body';
  const base = input.design.sizes[level];
  const ratio = Math.max(1.15, Math.min(1.7, input.design.sizes.subtitle / Math.max(1, input.design.sizes.body)));
  return el.rank === 1 ? base * Math.pow(ratio, input.choice.typeStep * 0.5) : base;
}

function measureText(input: SolveInput, el: IntentElement, maxWidth: number, sizeOverride?: number): Measured {
  const level = el.level || 'body';
  const heading = HEADINGS.includes(level);
  const size = sizeOverride ?? sizeOf(input, el);
  const upper = heading && (level === 'display' || level === 'title') && input.design.uppercaseTitles;
  const weight = level === 'display' ? input.design.weights.display : level === 'title' ? input.design.weights.title : level === 'subtitle' ? input.design.weights.subtitle : input.design.weights.body;
  const pad = el.kind === 'button' || el.kind === 'chip' ? size * 1.2 : 0;
  const tb = textBox(textOf(input, el.text), { size, maxWidth: Math.max(4, maxWidth - 2 * pad), family: heading ? input.fonts.display : input.fonts.body, weight, lineHeight: heading ? 1.08 : 1.18, letterSpacing: heading ? input.design.tracking.title : input.design.tracking.body, upper });
  return { el, size, width: tb.width + 2 * pad, height: tb.height + (pad ? size * 1.1 : 0), lines: tb.lines };
}

// ─── Contraintes verticales (kiwi) ───────────────────────────────────────────

interface VBlock {
  id: string;
  /** Hauteur fixe, ou bornes et préférence (média). */
  h: number | { min: number; max: number; prefer: number };
  top: number;
  bottom: number;
  /** Position verticale souhaitée dans ses bornes. */
  valign?: 'center' | 'upper' | 'lower' | 'top' | 'bottom';
}

/**
 * Résout la position verticale de blocs : `seq` impose un ordre (a au-dessus de b, gouttière obligatoire), `alignCenter`
 * aligne des centres (forte), `valign` place un bloc dans ses bornes (moyenne). Rend null si l'obligatoire est impossible.
 */
function solveVertical(blocks: VBlock[], seq: [string, string, number][], alignCenter: [string, string][] = [], prefer?: { a: string; rel: 'above' | 'below'; b: string }[]): Map<string, { y0: number; y1: number }> | null {
  const solver = new kiwi.Solver();
  const vars = new Map<string, { y0: kiwi.Variable; h: kiwi.Variable }>();
  const C = (expr: kiwi.Expression, op: kiwi.Operator, strength: number) => solver.addConstraint(new kiwi.Constraint(expr, op, 0, strength));
  try {
    for (const b of blocks) {
      const y0 = new kiwi.Variable(`${b.id}.y0`);
      const h = new kiwi.Variable(`${b.id}.h`);
      vars.set(b.id, { y0, h });
      if (typeof b.h === 'number') C(new kiwi.Expression(h, -b.h), kiwi.Operator.Eq, kiwi.Strength.required);
      else {
        C(new kiwi.Expression(h, -b.h.min), kiwi.Operator.Ge, kiwi.Strength.required);
        C(new kiwi.Expression(h, -b.h.max), kiwi.Operator.Le, kiwi.Strength.required);
        C(new kiwi.Expression(h, -b.h.prefer), kiwi.Operator.Eq, kiwi.Strength.medium);
      }
      // Dans ses bornes (zone sûre ou région).
      C(new kiwi.Expression(y0, -b.top), kiwi.Operator.Ge, kiwi.Strength.required);
      C(new kiwi.Expression(y0, h, -b.bottom), kiwi.Operator.Le, kiwi.Strength.required);
      const span = b.bottom - b.top;
      const target = b.valign === 'upper' ? b.top + span * 0.33 : b.valign === 'lower' ? b.top + span * 0.67 : b.top + span / 2;
      if (b.valign === 'top') C(new kiwi.Expression(y0, -b.top), kiwi.Operator.Eq, kiwi.Strength.medium);
      else if (b.valign === 'bottom') C(new kiwi.Expression(y0, h, -b.bottom), kiwi.Operator.Eq, kiwi.Strength.medium);
      // Centre du bloc sur la cible : y0 + h/2 = target.
      else C(new kiwi.Expression(y0, [0.5, h], -target), kiwi.Operator.Eq, kiwi.Strength.medium);
    }
    for (const [a, b, gap] of seq) {
      const A = vars.get(a);
      const B = vars.get(b);
      if (!A || !B) continue;
      // b commence sous a, avec la gouttière (obligatoire : jamais de chevauchement).
      C(new kiwi.Expression(B.y0, [-1, A.y0], [-1, A.h], -gap), kiwi.Operator.Ge, kiwi.Strength.required);
      // … et pas plus loin que nécessaire (forte) : les blocs d'une même idée restent ensemble.
      C(new kiwi.Expression(B.y0, [-1, A.y0], [-1, A.h], -gap), kiwi.Operator.Eq, kiwi.Strength.strong);
    }
    for (const [a, b] of alignCenter) {
      const A = vars.get(a);
      const B = vars.get(b);
      if (A && B) C(new kiwi.Expression(A.y0, [0.5, A.h], [-1, B.y0], [-0.5, B.h]), kiwi.Operator.Eq, kiwi.Strength.strong);
    }
    for (const p of prefer || []) {
      const A = vars.get(p.a);
      const B = vars.get(p.b);
      if (!A || !B) continue;
      if (p.rel === 'above') C(new kiwi.Expression(B.y0, [-1, A.y0]), kiwi.Operator.Ge, kiwi.Strength.weak);
      else C(new kiwi.Expression(A.y0, [-1, B.y0]), kiwi.Operator.Ge, kiwi.Strength.weak);
    }
    solver.updateVariables();
  } catch {
    return null;
  }
  const out = new Map<string, { y0: number; y1: number }>();
  for (const [id, v] of vars) out.set(id, { y0: v.y0.value(), y1: v.y0.value() + v.h.value() });
  return out;
}

// ─── Piles de textes ─────────────────────────────────────────────────────────

/** L'écart (u) sous un élément dans une pile : plus grand sous le titre, serré dans un corps de texte. */
function gapAfter(m: Measured, next?: Measured): number {
  if (!next) return 0;
  const level = m.el.level || 'body';
  if (next.el.kind === 'button') return Math.max(2.4, m.size * 0.9);
  if (level === 'display' || level === 'title') return Math.max(1.6, m.size * 0.42);
  if (level === 'subtitle') return Math.max(1.4, m.size * 0.55);
  return Math.max(1.2, m.size * 0.6);
}

interface StackPlan {
  id: string;
  items: Measured[];
  width: number;
  height: number;
  align: 'left' | 'center';
}

function planStack(id: string, items: Measured[], align: 'left' | 'center'): StackPlan {
  const height = items.reduce((a, m, i) => a + m.height + gapAfter(m, items[i + 1]), 0);
  const width = Math.max(0, ...items.map((m) => m.width));
  return { id, items, width, height, align };
}

/** Pose une pile dans une boîte (x0 → largeur, y0 donné). */
function placeStack(stack: StackPlan, x0: number, regionW: number, y0: number, on: Placed['on']): Placed[] {
  const out: Placed[] = [];
  let y = y0;
  stack.items.forEach((m, i) => {
    const w = Math.min(regionW, Math.max(m.width, 0));
    const left = stack.align === 'center' ? x0 + (regionW - w) / 2 : x0;
    out.push({ id: m.el.id, kind: m.el.kind, box: { x0: left, y0: y, x1: left + w, y1: y + m.height }, size: m.size, lines: m.lines, align: stack.align === 'center' ? 'center' : 'left', rank: m.el.rank, layer: 10 + i, on: m.el.kind === 'button' ? 'button' : m.el.kind === 'chip' ? 'chip' : on, level: m.el.level });
    y += m.height + gapAfter(m, stack.items[i + 1]);
  });
  return out;
}

// ─── Le solveur ──────────────────────────────────────────────────────────────

export function solveGeometry(input: SolveInput): Placement {
  const F = frameInUnits(input.format);
  const { intent, choice } = input;
  const notes: string[] = [];
  const vertical = input.format === 'story' || input.format === 'portrait';
  const square = input.format === 'square';
  const cols = input.design.columns;
  const g = input.design.gutter;
  const colW = (F.SW - g * (cols - 1)) / cols;
  const colX = (k: number) => F.L + k * (colW + g);
  const els = intent.elements;
  const byKind = (k: IntentElement['kind'][]) => els.filter((e) => k.includes(e.kind));
  const textEls = byKind(['text', 'chip', 'button']).sort((a, b) => a.rank - b.rank);
  const medias = byKind(['image', 'video']);
  const devices = byKind(['device']);
  const logos = byKind(['logo']);
  const icons = byKind(['icon']);
  const lists = byKind(['list']);
  const shapes = byKind(['shape']);
  const placed: Placed[] = [];
  const plates: Placement['plates'] = [];
  let feasible = true;

  // Les mesures de lecture : un titre pas trop large (le regard), un corps plus étroit encore.
  const titleShare = vertical ? 1 : square ? 0.92 : 0.66;
  const bodyShare = vertical ? 0.92 : square ? 0.86 : 0.52;
  const maxW = (el: IntentElement, region: number) => Math.min(region, F.SW * (HEADINGS.includes(el.level || 'body') ? titleShare : bodyShare));

  /** La pile de textes d'une région (logo et icône en tête s'ils sont rangés avant). */
  const textStack = (region: number, align: 'left' | 'center', sizeK = 1): StackPlan => {
    const items: Measured[] = [];
    for (const el of [...icons, ...textEls].sort((a, b) => a.rank - b.rank || (a.kind === 'icon' ? -1 : 1))) {
      if (el.kind === 'icon') {
        const s = Math.max(6, input.design.sizes.title * 0.9) * choice.scale;
        items.push({ el, size: s, width: s, height: s, lines: [] });
      } else items.push(measureText(input, el, maxW(el, region), sizeOf(input, el) * sizeK));
    }
    for (const list of lists) {
      for (const [k, key] of (list.items || []).entries()) {
        const m = measureText(input, { ...list, id: `${list.id}-${k}`, kind: 'text', text: key, level: list.level || 'body' }, maxW(list, region) - 4);
        items.push({ ...m, el: { ...m.el, kind: 'text' }, width: m.width + 4 });
      }
    }
    return planStack('text', items, align);
  };

  /** La pile tient-elle ? Sinon elle descend d'un cran (jusqu'à trois fois), puis c'est dit. */
  const fitStack = (region: number, regionH: number, align: 'left' | 'center'): StackPlan => {
    let k = 1;
    let stack = textStack(region, align, k);
    for (let i = 0; i < 4 && stack.height > regionH; i++) {
      k *= 0.86;
      stack = textStack(region, align, k);
    }
    if (stack.height > regionH) {
      feasible = false;
      notes.push(`les textes demandent ${stack.height.toFixed(0)} u pour ${regionH.toFixed(0)} u`);
    } else if (k < 1) notes.push(`textes réduits à ${Math.round(k * 100)} % pour tenir`);
    return stack;
  };

  const pushStack = (stack: StackPlan, x0: number, regionW: number, y0: number, on: Placed['on']) => {
    const items = placeStack(stack, x0, regionW, y0, on);
    // Les puces d'une liste : un point devant chaque item, l'item décalé.
    for (const p of items) {
      const m = /^(.+)-(\d+)$/.exec(p.id);
      const list = m && lists.find((l) => l.id === m[1]);
      if (list && m) {
        const key = list.items?.[Number(m[2])];
        p.kind = 'item';
        p.textKey = key?.replace(/^\$/, '');
        const d = Math.max(1.1, (p.size || 4) * 0.32);
        const yb = p.box.y0 + (p.size || 4) * 0.6;
        placed.push({ id: `${p.id}-dot`, kind: 'bullet', box: { x0: p.box.x0, y0: yb - d / 2, x1: p.box.x0 + d, y1: yb + d / 2 }, rank: 3, layer: 5 });
        p.box = { ...p.box, x0: p.box.x0 + 4, x1: p.box.x1 };
      }
    }
    placed.push(...items);
  };

  const mediaAspect = (m?: IntentElement) => {
    const src = m?.media !== undefined ? input.media[m.media] : undefined;
    return src && src.width && src.height ? src.width / src.height : 16 / 9;
  };

  const layout = intent.layout === 'hero' && (medias.length || devices.length) ? (devices.length ? 'device' : 'media-split') : intent.layout;
  const align: 'left' | 'center' = layout === 'hero' || layout === 'end-card' || layout === 'quote' ? 'center' : layout === 'figure' ? choice.align : 'left';

  switch (layout) {
    case 'grid': {
      // Une grille : les textes en haut, les médias en cartes sur les colonnes (2 en vertical et en carré, jusqu'à 4 en
      // paysage), centrées dans la place qui reste.
      const cards = [...medias, ...devices];
      const stack = fitStack(F.SW, F.SH * 0.32, align);
      const gap = Math.max(2, g);
      const top = F.T;
      const areaTop = top + stack.height + gap * 1.5;
      const areaH = F.B - areaTop;
      const n = Math.max(1, cards.length);
      const cols = vertical || square ? Math.min(2, n) : Math.min(4, n);
      const rows = Math.ceil(n / cols);
      const cw = (F.SW - gap * (cols - 1)) / cols;
      const ch = Math.max(4, Math.min((areaH - gap * (rows - 1)) / rows, cw * 1.25));
      const gridH = rows * ch + (rows - 1) * gap;
      const y0 = areaTop + Math.max(0, (areaH - gridH) / 2);
      pushStack(stack, F.L, F.SW, top, 'ground');
      cards.forEach((m, k) => {
        const r = Math.floor(k / cols);
        const c = k % cols;
        const inRow = Math.min(cols, n - r * cols);
        const rowW = inRow * cw + (inRow - 1) * gap;
        const x0 = -rowW / 2 + c * (cw + gap);
        placed.push({ id: m.id, kind: m.kind, box: { x0, y0: y0 + r * (ch + gap), x1: x0 + cw, y1: y0 + r * (ch + gap) + ch }, rank: m.rank, layer: 3 });
      });
      if (areaH < F.SH * 0.25) notes.push('grille : peu de place sous les textes');
      break;
    }
    case 'media-split':
    case 'device':
    case 'list':
    case 'stacked': {
      const visual = devices[0] || medias[0];
      const extraMedia = medias.filter((m) => m !== visual);
      if (!visual) {
        // Pas de média : une pile alignée à gauche, centrée verticalement.
        const region = vertical ? F.SW : colW * Math.round(cols * 0.75) + g * (Math.round(cols * 0.75) - 1);
        const stack = fitStack(region, F.SH, align);
        const v = solveVertical([{ id: 'text', h: stack.height, top: F.T, bottom: F.B, valign: choice.valign }], []);
        pushStack(stack, F.L, region, v?.get('text')?.y0 ?? F.T, 'ground');
        break;
      }
      const isDevice = visual.kind === 'device';
      if (vertical || square) {
        // Média en haut (ou en bas), textes dessous (ou dessus) : la part du média se négocie (moyenne).
        const textFirst = choice.side === 'end';
        const stack = fitStack(F.SW, F.SH * 0.62, align);
        const aspect = isDevice ? (visual.device === 'laptop' ? 1.56 : visual.device === 'browser' ? 1.6 : 0.48) : mediaAspect(visual);
        const prefer = isDevice ? Math.min(F.SH * 0.62, (F.SW * (visual.device === 'phone' ? 0.5 : 0.92)) / aspect) * choice.scale : F.SH * (square ? choice.ratio * 0.92 : choice.ratio);
        const blocks: VBlock[] = [
          { id: 'visual', h: { min: F.SH * 0.26, max: F.SH * 0.68, prefer: Math.min(prefer, F.SH * 0.68) }, top: F.T, bottom: F.B, valign: textFirst ? 'lower' : 'upper' },
          { id: 'text', h: stack.height, top: F.T, bottom: F.B, valign: textFirst ? 'upper' : 'lower' },
        ];
        const gap = Math.max(3, g * 1.4);
        const v = solveVertical(blocks, textFirst ? [['text', 'visual', gap]] : [['visual', 'text', gap]]);
        if (!v) {
          feasible = false;
          notes.push('média et textes ne tiennent pas ensemble');
        }
        const vb = v?.get('visual') || { y0: F.T, y1: F.T + F.SH * 0.45 };
        const tb = v?.get('text') || { y0: vb.y1 + gap, y1: vb.y1 + gap + stack.height };
        const vh = vb.y1 - vb.y0;
        const vw = isDevice ? Math.min(F.SW, vh * aspect) : F.SW;
        const vx = isDevice ? -vw / 2 : F.L;
        placed.push({ id: visual.id, kind: visual.kind, box: { x0: vx, y0: vb.y0, x1: vx + vw, y1: vb.y1 }, rank: visual.rank, layer: 3 });
        pushStack(stack, F.L, F.SW, tb.y0, 'ground');
      } else {
        // Paysage : le média sur des colonnes entières (gauche ou droite), les textes dans le reste, centrés verticalement.
        const mediaCols = Math.max(4, Math.min(cols - 4, Math.round(cols * choice.ratio)));
        const mw = colW * mediaCols + g * (mediaCols - 1);
        const left = choice.side === 'start';
        const mx0 = left ? F.L : F.R - mw;
        const tx0 = left ? mx0 + mw + g * 2 : F.L;
        const tw = F.SW - mw - g * 2;
        const stack = fitStack(tw, F.SH, align);
        const aspect = isDevice ? (visual.device === 'phone' ? 0.48 : 1.58) : mediaAspect(visual);
        const vh = isDevice ? Math.min(F.SH, (mw * choice.scale) / aspect) : F.SH;
        const vw = isDevice ? Math.min(mw, vh * aspect) : mw;
        const v = solveVertical([{ id: 'visual', h: vh, top: F.T, bottom: F.B, valign: 'center' }, { id: 'text', h: stack.height, top: F.T, bottom: F.B, valign: choice.valign }], [], choice.valign === 'center' ? [['visual', 'text']] : []);
        const vb = v?.get('visual') || { y0: -vh / 2, y1: vh / 2 };
        const tb = v?.get('text') || { y0: -stack.height / 2, y1: stack.height / 2 };
        const vx0 = left ? mx0 + (mw - vw) / 2 : mx0 + (mw - vw) / 2;
        placed.push({ id: visual.id, kind: visual.kind, box: { x0: vx0, y0: vb.y0, x1: vx0 + vw, y1: vb.y1 }, rank: visual.rank, layer: 3 });
        pushStack(stack, tx0, tw, tb.y0, 'ground');
      }
      // Les autres médias (grille) : de petites cartes sous la pile ou à côté, sans chevauchement.
      if (extraMedia.length) {
        const occupied = placed.map((p) => p.box);
        const bottom = Math.max(...occupied.map((b) => b.y1));
        const room = F.B - bottom - g;
        if (room > F.SH * 0.12) {
          const n = extraMedia.length;
          const w = (F.SW - g * (n - 1)) / n;
          const h = Math.min(room, w / 1.3);
          extraMedia.forEach((m, k) => placed.push({ id: m.id, kind: m.kind, box: { x0: F.L + k * (w + g), y0: bottom + g, x1: F.L + k * (w + g) + w, y1: bottom + g + h }, rank: m.rank, layer: 3 }));
        } else extraMedia.forEach((m) => notes.push(`${m.id} : pas de place, montré en fond`));
      }
      break;
    }
    case 'full-bleed': {
      const visual = medias[0];
      const src = visual?.media !== undefined ? input.media[visual.media] : undefined;
      if (visual) placed.push({ id: visual.id, kind: visual.kind, box: { x0: -F.W / 2, y0: -F.H / 2, x1: F.W / 2, y1: F.H / 2 }, rank: visual.rank, layer: 1, bleed: true });
      // Le texte va dans la zone calme du média si elle peut le porter ; sinon en bas (ou en haut) sur un aplat.
      const calm = choice.textZone === 'calm' && src?.calm ? src.calm : undefined;
      const zone = calm
        ? { x0: -F.W / 2 + calm.x * F.W, y0: -F.H / 2 + calm.y * F.H, x1: -F.W / 2 + (calm.x + calm.w) * F.W, y1: -F.H / 2 + (calm.y + calm.h) * F.H }
        : choice.textZone === 'top'
          ? { x0: F.L, y0: F.T, x1: F.R, y1: F.T + F.SH * 0.45 }
          : { x0: F.L, y0: F.B - F.SH * 0.45, x1: F.R, y1: F.B };
      const inner = { x0: Math.max(zone.x0, F.L), y0: Math.max(zone.y0, F.T), x1: Math.min(zone.x1, F.R), y1: Math.min(zone.y1, F.B) };
      const regionW = boxW(inner);
      const stack = fitStack(regionW - 4, boxH(inner) - 4, align);
      const usesCalm = !!calm && stack.height <= boxH(inner) - 4 && regionW >= F.SW * 0.4;
      // Sans zone calme, le texte se pose au bord du cadre (tiers bas ou haut), loin du sujet que le recadrage centre.
      const v = solveVertical([{ id: 'text', h: stack.height, top: inner.y0 + 2, bottom: inner.y1 - 2, valign: choice.textZone === 'top' ? 'top' : calm ? 'center' : 'bottom' }], []);
      const y0 = v?.get('text')?.y0 ?? inner.y0 + 2;
      const on: Placed['on'] = usesCalm ? (calm?.light ? 'media-light' : 'media-dark') : 'plate';
      const x0 = inner.x0 + 2;
      pushStack(stack, x0, regionW - 4, y0, on);
      if (!usesCalm) {
        // Une marge franche autour des textes (au moins 3,6 u, près de la moitié de la taille du titre) : un aplat
        // trop juste laisse le sujet de la photo affleurer au bord des lettres.
        const texts = placed.filter((p) => p.layer >= 10);
        const pad = Math.max(3.6, 0.45 * Math.max(...texts.map((p) => p.size || 0)));
        const b = { x0: Math.min(...texts.map((p) => p.box.x0)) - pad, y0: Math.min(...texts.map((p) => p.box.y0)) - pad, x1: Math.max(...texts.map((p) => p.box.x1)) + pad, y1: Math.max(...texts.map((p) => p.box.y1)) + pad };
        plates.push({ id: 'plate', box: b, behind: texts.map((p) => p.id) });
        notes.push(calm ? 'zone calme trop petite : aplat' : 'pas de zone calme : aplat');
      }
      break;
    }
    case 'end-card': {
      // Le logo au centre, 15 à 30 % de la largeur, la signature et l'appel dessous.
      const logo = logos[0];
      const aspect = input.logoAspect && input.logoAspect > 0 ? input.logoAspect : 3;
      const lw = Math.min(F.SW * 0.9, F.W * (vertical ? 0.42 : square ? 0.36 : 0.24) * choice.scale);
      const lh = lw / aspect;
      const stack = fitStack(F.SW, F.SH - (logo ? lh + 4 : 0), 'center');
      const blocks: VBlock[] = [...(logo ? [{ id: 'logo', h: lh, top: F.T, bottom: F.B, valign: 'center' as const }] : []), { id: 'text', h: stack.height, top: F.T, bottom: F.B, valign: 'center' }];
      const v = solveVertical(blocks, logo ? [['logo', 'text', Math.max(3, lh * 0.35)]] : []);
      if (logo) {
        const b = v?.get('logo') || { y0: -lh, y1: 0 };
        placed.push({ id: logo.id, kind: 'logo', box: { x0: -lw / 2, y0: b.y0, x1: lw / 2, y1: b.y1 }, rank: logo.rank, layer: 8 });
      }
      pushStack(stack, F.L, F.SW, v?.get('text')?.y0 ?? 0, 'ground');
      break;
    }
    default: {
      // hero, hero-left, figure, quote : une pile, centrée ou alignée à gauche, placée verticalement par la variante.
      const logo = logos[0];
      const regionW = layout === 'hero-left' ? (vertical ? F.SW : colW * Math.round(cols * 0.66) + g * (Math.round(cols * 0.66) - 1)) : F.SW;
      const lw = logo ? Math.min(F.SW * 0.5, F.W * 0.2 * choice.scale) : 0;
      const lh = logo ? lw / (input.logoAspect || 3) : 0;
      const stack = fitStack(regionW, F.SH - (logo ? lh + 4 : 0), align);
      const blocks: VBlock[] = [...(logo ? [{ id: 'logo', h: lh, top: F.T, bottom: F.B, valign: 'upper' as const }] : []), { id: 'text', h: stack.height, top: F.T, bottom: F.B, valign: choice.valign }];
      const v = solveVertical(blocks, logo ? [['logo', 'text', 4]] : []);
      if (logo) {
        const b = v?.get('logo') || { y0: F.T, y1: F.T + lh };
        const x0 = align === 'center' ? -lw / 2 : F.L;
        placed.push({ id: logo.id, kind: 'logo', box: { x0, y0: b.y0, x1: x0 + lw, y1: b.y1 }, rank: logo.rank, layer: 8 });
      }
      pushStack(stack, F.L, regionW, v?.get('text')?.y0 ?? -stack.height / 2, 'ground');
    }
  }

  // Les logos hors fin de film et hors pile (rare) : en signature, en bas.
  for (const logo of logos) {
    if (placed.some((p) => p.id === logo.id)) continue;
    const lw = F.W * 0.14;
    const lh = lw / (input.logoAspect || 3);
    placed.push({ id: logo.id, kind: 'logo', box: { x0: -lw / 2, y0: F.B - lh, x1: lw / 2, y1: F.B }, rank: logo.rank, layer: 8 });
  }
  // Un média qui n'a pas trouvé de place va en fond plein cadre.
  for (const m of medias) {
    if (placed.some((p) => p.id === m.id)) continue;
    placed.push({ id: m.id, kind: m.kind, box: { x0: -F.W / 2, y0: -F.H / 2, x1: F.W / 2, y1: F.H / 2 }, rank: m.rank, layer: 0, bleed: true });
  }

  // Les décors, posés par rapport à l'élément principal, jamais sur un texte.
  const lead = placed.filter((p) => p.layer >= 10).sort((a, b) => a.rank - b.rank)[0];
  const textBoxes = placed.filter((p) => p.layer >= 10).map((p) => p.box);
  const visualBox = placed.find((p) => (p.kind === 'image' || p.kind === 'video' || p.kind === 'device') && !p.bleed)?.box;
  for (const s of shapes) {
    let box: Box | null = null;
    const stroke = Math.max(0.5, input.design.stroke * 3);
    if (s.shape === 'bar' && lead) {
      const all = { y0: Math.min(...textBoxes.map((b) => b.y0)), y1: Math.max(...textBoxes.map((b) => b.y1)) };
      box = lead.align === 'center' ? { x0: cx(lead.box) - 6, y0: lead.box.y0 - 3.6, x1: cx(lead.box) + 6, y1: lead.box.y0 - 3.6 + stroke * 1.4 } : { x0: lead.box.x0 - 3.4, y0: all.y0, x1: lead.box.x0 - 3.4 + stroke * 1.6, y1: all.y1 };
    } else if (s.shape === 'underline' && lead) {
      const w = boxW(lead.box) * 0.36;
      const x0 = lead.align === 'center' ? cx(lead.box) - w / 2 : lead.box.x0;
      box = { x0, y0: lead.box.y1 + 0.8, x1: x0 + w, y1: lead.box.y1 + 0.8 + stroke * 1.3 };
    } else if ((s.shape === 'circle' || s.shape === 'ring' || s.shape === 'arc') && (lead || visualBox)) {
      const target = placed.find((p) => p.kind === 'logo' || p.kind === 'icon')?.box || visualBox || lead!.box;
      const d = Math.min(F.SW, Math.max(boxW(target), boxH(target)) * 1.35);
      box = { x0: cx(target) - d / 2, y0: cy(target) - d / 2, x1: cx(target) + d / 2, y1: cy(target) + d / 2 };
    } else if (s.shape === 'block' && visualBox) {
      box = { x0: visualBox.x0 + 3, y0: visualBox.y0 + 3, x1: visualBox.x1 + 3, y1: visualBox.y1 + 3 };
    } else if (s.shape === 'dots') {
      // Un coin libre : celui qui ne touche aucun texte.
      const size = Math.min(F.SW, F.SH) * 0.18;
      const corners: Box[] = [
        { x0: F.R - size, y0: F.T, x1: F.R, y1: F.T + size },
        { x0: F.L, y0: F.B - size, x1: F.L + size, y1: F.B },
        { x0: F.R - size, y0: F.B - size, x1: F.R, y1: F.B },
        { x0: F.L, y0: F.T, x1: F.L + size, y1: F.T + size },
      ];
      box = corners.find((c) => !textBoxes.some((t) => overlap(t, c) > 0)) || null;
    } else if (s.shape === 'pill' && lead) {
      box = { x0: lead.box.x0 - 2, y0: lead.box.y0 - 1.2, x1: lead.box.x1 + 2, y1: lead.box.y1 + 1.2 };
    }
    if (!box) {
      notes.push(`${s.id} : décor « ${s.shape} » sans place, retiré`);
      continue;
    }
    // Un décor ne traverse jamais un texte (sauf l'aplat « pill » qui le porte).
    if (s.shape !== 'pill' && s.shape !== 'circle' && s.shape !== 'block' && textBoxes.some((t) => overlap(t, box!) > 0.02 * area(t))) {
      notes.push(`${s.id} : décor « ${s.shape} » sur un texte, retiré`);
      continue;
    }
    placed.push({ id: s.id, kind: 'shape', box, rank: 3, layer: s.shape === 'pill' || s.shape === 'circle' || s.shape === 'block' ? 2 : 6 });
  }

  // Obligatoire : aucun texte sur un autre, aucun texte hors de la zone sûre (le reste est dit).
  const texts = placed.filter((p) => p.layer >= 10);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) if (overlap(texts[i].box, texts[j].box) > 0.01) {
      feasible = false;
      notes.push(`${texts[i].id} et ${texts[j].id} se chevauchent`);
    }
    const b = texts[i].box;
    if (b.x0 < F.L - 0.5 || b.x1 > F.R + 0.5 || b.y0 < F.T - 0.5 || b.y1 > F.B + 0.5) {
      feasible = false;
      notes.push(`${texts[i].id} sort de la zone sûre`);
    }
  }
  // Obligatoire : l'élément principal n'est pas timide (titre ≥ 4 % de la hauteur, visuel ≥ 12 % de l'image).
  const main = placed.find((p) => p.rank === 1);
  if (main) {
    const tooSmall = main.size !== undefined ? main.size < F.H * 0.035 && (main.level === 'title' || main.level === 'display') : area(main.box) < F.W * F.H * 0.06;
    if (tooSmall) notes.push(`l’élément principal ${main.id} est petit pour le format`);
  }
  return { format: input.format, choice, elements: placed.sort((a, b) => a.layer - b.layer), plates, feasible, notes, frame: F };
}

/** Les variantes d'une composition : 4 à 12 choix discrets (le juge les compare). */
export function variantChoices(intent: SceneIntent, max = 12): VariantChoice[] {
  const out: VariantChoice[] = [];
  const add = (c: Partial<VariantChoice>) => out.push({ ...DEFAULT_CHOICE, ...c });
  const layout = intent.layout;
  const hasVisual = intent.elements.some((e) => e.kind === 'image' || e.kind === 'video' || e.kind === 'device');
  if (layout === 'full-bleed') for (const textZone of ['calm', 'bottom', 'top'] as const) for (const typeStep of [0, 1] as const) add({ textZone, typeStep });
  else if (layout === 'end-card') for (const scale of [1, 1.15]) for (const typeStep of [0, -1] as const) add({ scale, typeStep, align: 'center' });
  else if (hasVisual || layout === 'media-split' || layout === 'device' || layout === 'list' || layout === 'grid' || layout === 'stacked') for (const side of ['start', 'end'] as const) for (const ratio of [0.5, 0.42, 0.58]) for (const typeStep of [0, 1] as const) add({ side, ratio, typeStep });
  else for (const valign of ['center', 'upper', 'lower'] as const) for (const typeStep of [0, 1, -1] as const) add({ valign, typeStep, align: layout === 'figure' ? 'center' : 'left' });
  if (layout === 'figure') for (const typeStep of [0, 1] as const) add({ align: 'left', typeStep });
  return out.slice(0, Math.max(4, max));
}
