/**
 * SVG D'UN MODÈLE VECTORIEL → COUCHES DU LOGO IR.
 *
 * OmniSVG peint des tracés pleins les uns sur les autres (viewBox 0–200, une couleur par tracé,
 * jusqu'à 4 096 teintes). Un logo du moteur, lui, est fait de couches aux couleurs de la CHARTE
 * (`ink`, `ink2`, `accent`), sans recouvrements inutiles, retouchables par patch. La conversion :
 *
 *   1. lire les tracés pleins, dans l'ordre de peinture, et les ramener dans la boîte 0–100 ;
 *   2. retirer le fond (grand aplat presque blanc) ; garder un aplat de couleur pleine page comme
 *      conteneur (icône d'appli) ;
 *   3. regrouper les teintes proches, classer les groupes par surface, leur donner les rôles de la
 *      charte : le plus grand → `ink`, puis `accent`, puis `ink2`. Un groupe clair en trop, ou blanc,
 *      devient une DÉCOUPE : il creuse ce qu'il recouvre (le fond transparaît, comme les générateurs) ;
 *   4. fondre les tracés voisins de même rôle, jeter les poussières, arrondir les coordonnées.
 *
 * Le résultat est un Logo IR ordinaire (couches `shape` à tracé `path`) : mêmes mesures, mêmes
 * variantes, même recoloration, même propagation d'identité que tout autre logo. Un SVG trop
 * complexe pour un logo (trop de couches, tracés trop longs) est refusé (`null`).
 */
import type { GeometryKernel, Shape } from '../kernel/geometry';
import { multiply, scaleBy, translate } from '../kernel/geometry';
import type { ColorRole, LogoLayer, LogoPalette } from '../ir/logo.schema';
import { hexToRgb, luminance, rgbToHsl } from '../util/colors';
import type { RGB } from '../util/colors';

export interface ImportOptions {
  /** Préfixe des identifiants de couches (`v` → v1, v2…). */
  idPrefix?: string;
  /** Couches de symbole au plus (la place restante est pour le nom et l'accroche). */
  maxLayers?: number;
  /** Surface minimale d'un tracé gardé, dans la boîte 100 × 100. */
  minArea?: number;
}

export interface ImportedSymbol {
  layers: LogoLayer[];
  /** Les groupes de teintes du modèle et le rôle de charte reçu, par surface décroissante. */
  groups: { hex: string; role: ColorRole; area: number }[];
  stats: { paths: number; kept: number; knockouts: number; background: 'none' | 'dropped' | 'container' };
}

export type ImportFailure = { ok: false; reason: 'no_paths' | 'empty' | 'too_complex' };
export type ImportResult = ({ ok: true } & ImportedSymbol) | ImportFailure;

/** Écart (RGB euclidien, 0–441) sous lequel deux teintes du modèle sont la même couleur. */
const SAME_COLOR = 48;
const MAX_D = 6000;

interface RawPath {
  hex: string;
  shape: Shape;
  group: number;
}

const attrOf = (attrs: string, name: string): string | undefined => {
  const direct = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1] ?? attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*'([^']*)'`, 'i'))?.[1];
  if (direct !== undefined) return direct;
  return attrs.match(new RegExp(`style\\s*=\\s*"[^"]*\\b${name}\\s*:\\s*([^;"]+)`, 'i'))?.[1]?.trim();
};

/** Couleur de remplissage lisible (`#rgb`, `#rrggbb`, `rgb()`, noir/blanc, currentColor) ; `null` : pas de remplissage. */
export function fillHex(value: string | undefined): string | null {
  const v = (value ?? '').trim().toLowerCase();
  if (!v || v === 'none' || v === 'transparent') return null;
  if (v === 'currentcolor' || v === 'black') return '#000000';
  if (v === 'white') return '#ffffff';
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  const rgb = v.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`;
  return null;
}

const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Blanc ou presque (fond, reflets, découpes). */
export function isPaperLike(hex: string): boolean {
  const [, s, l] = rgbToHsl(hexToRgb(hex));
  return luminance(hex) > 0.86 && (s < 0.25 || l > 0.94);
}

/** Les nombres d'un tracé arrondis à `digits` décimales (0–100 : 0,1 suffit à toute taille d'usage). */
export function roundPath(d: string, digits = 1): string {
  const f = 10 ** digits;
  return d
    .replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (n) => {
      const r = Math.round(Number(n) * f) / f;
      return Object.is(r, -0) ? '0' : String(r);
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function parseViewBox(svg: string): { x: number; y: number; w: number; h: number } {
  const vb = svg.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) return { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  return { x: 0, y: 0, w: 200, h: 200 };
}

const overlaps = (a: Shape, b: Shape) =>
  a.bounds.x < b.bounds.x + b.bounds.w && b.bounds.x < a.bounds.x + a.bounds.w && a.bounds.y < b.bounds.y + b.bounds.h && b.bounds.y < a.bounds.y + a.bounds.h;

/** `a − b`, en distinguant « vide » (b couvre a : `null`) d'un échec du noyau (a inchangé). */
function carve(kernel: GeometryKernel, a: Shape, b: Shape): Shape | null {
  if (!overlaps(a, b)) return a;
  const cut = kernel.combine('subtract', a, b);
  if (cut && kernel.area(cut) > 0.01) return cut;
  const inter = kernel.combine('intersect', a, b);
  return inter && kernel.area(inter) >= kernel.area(a) * 0.98 ? null : a;
}

export function importVectorSymbol(svg: string, palette: LogoPalette, kernel: GeometryKernel, options: ImportOptions = {}): ImportResult {
  const prefix = options.idPrefix ?? 'v';
  const maxLayers = options.maxLayers ?? 16;
  const minArea = options.minArea ?? 6;
  const vb = parseViewBox(svg);
  const scale = 100 / Math.max(vb.w, vb.h);
  const toBox = multiply(scaleBy(scale), translate(-vb.x, -vb.y));

  // ── 1. Tracés pleins, dans l'ordre de peinture ──
  const raws: Omit<RawPath, 'group'>[] = [];
  let paths = 0;
  for (const m of svg.matchAll(/<path\b([^>]*?)\/?>/gi)) {
    const attrs = m[1];
    const d = attrOf(attrs, 'd');
    if (!d || !/[lcqa]/i.test(d)) continue; // « M0.0 M.0 Z » : tracé vide du décodeur
    paths++;
    const hex = fillHex(attrOf(attrs, 'fill') ?? '#000000');
    const opacity = Number(attrOf(attrs, 'fill-opacity') ?? attrOf(attrs, 'opacity') ?? 1);
    if (!hex || !(opacity > 0.05)) continue;
    const shape = kernel.fromPath(d);
    if (!shape) continue;
    raws.push({ hex, shape: kernel.transform(shape, toBox) });
  }
  if (!raws.length) return { ok: false, reason: 'no_paths' };

  // ── 2. Le fond ──
  let background: ImportedSymbol['stats']['background'] = 'none';
  const fullPage = (s: Shape) => s.bounds.w >= 92 && s.bounds.h >= 92;
  while (raws.length && fullPage(raws[0].shape) && isPaperLike(raws[0].hex)) {
    raws.shift();
    background = 'dropped';
  }
  if (!raws.length) return { ok: false, reason: 'empty' };
  if (fullPage(raws[0].shape)) background = 'container';

  // ── 3. Groupes de teintes → rôles de la charte ──
  const reps: RGB[] = [];
  const items: RawPath[] = raws.map((r) => {
    const rgb = hexToRgb(r.hex);
    let group = reps.findIndex((rep) => distance(rep, rgb) < SAME_COLOR);
    if (group < 0) {
      reps.push(rgb);
      group = reps.length - 1;
    }
    return { ...r, group };
  });
  const areas = reps.map((_, g) => items.filter((i) => i.group === g).reduce((sum, i) => sum + kernel.area(i.shape), 0));
  const hexOf = (g: number) => raws[items.findIndex((i) => i.group === g)].hex;
  const order = reps.map((_, g) => g).sort((a, b) => areas[b] - areas[a]);
  const roles: ColorRole[] = ['ink', ...(palette.accent ? (['accent'] as const) : []), ...(palette.ink2 && palette.ink2 !== palette.accent ? (['ink2'] as const) : [])];
  const roleOf = new Map<number, ColorRole>();
  const inked: number[] = [];
  for (const g of order) {
    const hex = hexOf(g);
    if (isPaperLike(hex)) roleOf.set(g, 'paper');
    else if (inked.length < roles.length) {
      roleOf.set(g, roles[inked.length]);
      inked.push(g);
    } else {
      // Une teinte en trop : plus claire que le groupe le plus proche, elle devient une découpe ; sinon elle le rejoint.
      const nearest = inked.reduce((best, h) => (distance(reps[h], reps[g]) < distance(reps[best], reps[g]) ? h : best), inked[0]);
      roleOf.set(g, luminance(hex) > luminance(hexOf(nearest)) + 0.15 ? 'paper' : roleOf.get(nearest)!);
    }
  }

  // ── 4. Peinture : les découpes creusent ce qu'elles recouvrent, les tracés voisins de même rôle fondent ──
  const stack: { role: ColorRole; shape: Shape }[] = [];
  let knockouts = 0;
  for (const item of items) {
    const role = roleOf.get(item.group)!;
    if (role === 'paper') {
      let carved = false;
      for (let i = stack.length - 1; i >= 0; i--) {
        const next = carve(kernel, stack[i].shape, item.shape);
        if (next !== stack[i].shape) carved = true;
        if (next) stack[i].shape = next;
        else stack.splice(i, 1);
      }
      if (carved) knockouts++;
      continue;
    }
    // Fondre avec le dernier tracé du même rôle si rien de peint depuis ne le recouvre.
    let merged = false;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].role === role) {
        const between = stack.slice(i + 1);
        if (!between.some((s) => overlaps(s.shape, item.shape))) {
          const union = kernel.combine('union', stack[i].shape, item.shape);
          if (union) {
            stack[i].shape = union;
            merged = true;
          }
        }
        break;
      }
    }
    if (!merged) stack.push({ role, shape: item.shape });
  }

  let kept = stack.filter((s) => kernel.area(s.shape) >= minArea);
  if (!kept.length) return { ok: false, reason: 'empty' };
  if (kept.length > maxLayers) {
    // Trop de couches : on fond par rôle (l'ordre de peinture se perd, mais les rôles ne se recouvrent qu'à la marge).
    const byRole = new Map<ColorRole, Shape>();
    for (const s of kept) byRole.set(s.role, byRole.has(s.role) ? kernel.combine('union', byRole.get(s.role)!, s.shape) ?? byRole.get(s.role)! : s.shape);
    kept = [...byRole.entries()].map(([role, shape]) => ({ role, shape }));
  }

  const layers: LogoLayer[] = [];
  for (const [i, s] of kept.entries()) {
    const d = roundPath(s.shape.d, 1);
    if (d.length > MAX_D) return { ok: false, reason: 'too_complex' };
    layers.push({ kind: 'shape', id: `${prefix}${i + 1}`, role: 'symbol', fill: s.role, geometry: { type: 'path', d } } as LogoLayer);
  }

  return {
    ok: true,
    layers,
    groups: order.map((g) => ({ hex: hexOf(g), role: roleOf.get(g)!, area: Math.round(areas[g]) })),
    stats: { paths, kept: layers.length, knockouts, background },
  };
}
