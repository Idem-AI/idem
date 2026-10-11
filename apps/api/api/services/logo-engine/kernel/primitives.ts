/**
 * Constructeurs de tracés : de la géométrie du Logo IR au `d` d'un chemin SVG.
 *
 * Fonctions pures, sans noyau : tout ce qui se calcule par une formule se calcule ici, le noyau
 * (Paper.js) n'intervenant que pour les opérations booléennes et les transformations.
 *
 * Convention d'angle : 0° = haut (midi), sens horaire — celle qu'un auteur imagine d'instinct
 * pour un cadran ou une rosace.
 */
import type { LogoGeometry } from '../ir/logo.schema';
import { fmt } from './geometry';

export type Pt = [number, number];

const KAPPA = 0.5522847498;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Point du cercle (cx, cy, r) à l'angle donné (0° = haut, sens horaire). */
export const polar = (cx: number, cy: number, r: number, deg: number): Pt => [cx + r * Math.sin(rad(deg)), cy - r * Math.cos(rad(deg))];

const P = (p: Pt) => `${fmt(p[0], 3)} ${fmt(p[1], 3)}`;

export function ellipsePath(cx: number, cy: number, rx: number, ry: number, clockwise = true): string {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  if (clockwise) {
    return `M${P([cx, cy - ry])}C${P([cx + kx, cy - ry])} ${P([cx + rx, cy - ky])} ${P([cx + rx, cy])}C${P([cx + rx, cy + ky])} ${P([cx + kx, cy + ry])} ${P([cx, cy + ry])}C${P([cx - kx, cy + ry])} ${P([cx - rx, cy + ky])} ${P([cx - rx, cy])}C${P([cx - rx, cy - ky])} ${P([cx - kx, cy - ry])} ${P([cx, cy - ry])}Z`;
  }
  return `M${P([cx, cy - ry])}C${P([cx - kx, cy - ry])} ${P([cx - rx, cy - ky])} ${P([cx - rx, cy])}C${P([cx - rx, cy + ky])} ${P([cx - kx, cy + ry])} ${P([cx, cy + ry])}C${P([cx + kx, cy + ry])} ${P([cx + rx, cy + ky])} ${P([cx + rx, cy])}C${P([cx + rx, cy - ky])} ${P([cx + kx, cy - ry])} ${P([cx, cy - ry])}Z`;
}

export const circlePath = (cx: number, cy: number, r: number, clockwise = true) => ellipsePath(cx, cy, r, r, clockwise);

export function rectPath(x: number, y: number, w: number, h: number, r = 0): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr < 0.01) return `M${P([x, y])}H${fmt(x + w, 3)}V${fmt(y + h, 3)}H${fmt(x, 3)}Z`;
  const k = rr * (1 - KAPPA);
  return [
    `M${P([x + rr, y])}H${fmt(x + w - rr, 3)}`,
    `C${P([x + w - k, y])} ${P([x + w, y + k])} ${P([x + w, y + rr])}`,
    `V${fmt(y + h - rr, 3)}`,
    `C${P([x + w, y + h - k])} ${P([x + w - k, y + h])} ${P([x + w - rr, y + h])}`,
    `H${fmt(x + rr, 3)}`,
    `C${P([x + k, y + h])} ${P([x, y + h - k])} ${P([x, y + h - rr])}`,
    `V${fmt(y + rr, 3)}`,
    `C${P([x, y + k])} ${P([x + k, y])} ${P([x + rr, y])}Z`,
  ].join('');
}

/** Anneau plein : cercle extérieur horaire, cercle intérieur antihoraire (le trou). */
export function ringPath(cx: number, cy: number, r: number, thickness: number): string {
  const inner = Math.max(0.1, r - thickness);
  return circlePath(cx, cy, r, true) + circlePath(cx, cy, inner, false);
}

/** Bande d'anneau entre deux angles ; `round` ajoute des bouts arrondis. */
export function arcBandPath(cx: number, cy: number, r: number, thickness: number, from: number, to: number, round = false): string {
  let sweep = to - from;
  if (Math.abs(sweep) >= 359.9) return ringPath(cx, cy, r, thickness);
  if (sweep < 0) {
    from = to;
    sweep = -sweep;
  }
  const outer = r;
  const inner = Math.max(0.1, r - thickness);
  const a0 = from;
  const a1 = from + sweep;
  const large = sweep > 180 ? 1 : 0;
  const o0 = polar(cx, cy, outer, a0);
  const o1 = polar(cx, cy, outer, a1);
  const i1 = polar(cx, cy, inner, a1);
  const i0 = polar(cx, cy, inner, a0);
  const cap = (outer - inner) / 2;
  const end = round ? `A${fmt(cap, 3)} ${fmt(cap, 3)} 0 0 1 ${P(i1)}` : `L${P(i1)}`;
  const start = round ? `A${fmt(cap, 3)} ${fmt(cap, 3)} 0 0 1 ${P(o0)}` : 'Z';
  return `M${P(o0)}A${fmt(outer, 3)} ${fmt(outer, 3)} 0 ${large} 1 ${P(o1)}${end}A${fmt(inner, 3)} ${fmt(inner, 3)} 0 ${large} 0 ${P(i0)}${start}${round ? 'Z' : ''}`;
}

/** Polygone (ou polyligne fermée) à angles éventuellement arrondis par de vrais arcs de cercle. */
export function polyPath(points: Pt[], cornerRadius = 0): string {
  const n = points.length;
  if (n < 3) return '';
  if (cornerRadius <= 0.01) return `M${points.map(P).join('L')}Z`;
  const segments: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i + n - 1) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const v1: Pt = [prev[0] - cur[0], prev[1] - cur[1]];
    const v2: Pt = [next[0] - cur[0], next[1] - cur[1]];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const cos = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)));
    const theta = Math.acos(cos);
    if (theta < 0.02 || theta > Math.PI - 0.02) {
      segments.push(`${segments.length ? 'L' : 'M'}${P(cur)}`);
      continue;
    }
    const tan = Math.tan(theta / 2);
    const t = Math.min(cornerRadius / tan, (Math.min(l1, l2) / 2) * 0.999);
    const rho = t * tan;
    const entry: Pt = [cur[0] + (v1[0] / l1) * t, cur[1] + (v1[1] / l1) * t];
    const exit: Pt = [cur[0] + (v2[0] / l2) * t, cur[1] + (v2[1] / l2) * t];
    const cross = v1[0] * v2[1] - v1[1] * v2[0];
    segments.push(`${segments.length ? 'L' : 'M'}${P(entry)}A${fmt(rho, 3)} ${fmt(rho, 3)} 0 0 ${cross > 0 ? 0 : 1} ${P(exit)}`);
  }
  return segments.length ? `${segments.join('')}Z` : '';
}

export function regularPolygonPoints(cx: number, cy: number, r: number, sides: number, rotation = 0): Pt[] {
  return Array.from({ length: sides }, (_, i) => polar(cx, cy, r, rotation + (360 / sides) * i));
}

export function starPoints(cx: number, cy: number, outer: number, inner: number, points: number, rotation = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points * 2; i++) out.push(polar(cx, cy, i % 2 === 0 ? outer : Math.min(inner, outer - 0.1), rotation + (180 / points) * i));
  return out;
}

/** Courbe lisse (Catmull-Rom) à travers des points, fermée. */
export function smoothClosedPath(points: Pt[]): string {
  const n = points.length;
  if (n < 3) return '';
  let d = `M${P(points[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i + n - 1) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return `${d}Z`;
}

export function superellipsePath(cx: number, cy: number, rx: number, ry: number, n: number): string {
  const steps = 40;
  const points: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    points.push([cx + rx * Math.sign(c) * Math.abs(c) ** (2 / n), cy + ry * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return smoothClosedPath(points);
}

/** Trait épais : un rectangle orienté, à bouts droits ou arrondis. */
export function linePath(x1: number, y1: number, x2: number, y2: number, width: number, round = false): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return circlePath(x1, y1, width / 2);
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  const a: Pt = [x1 + nx, y1 + ny];
  const b: Pt = [x2 + nx, y2 + ny];
  const c: Pt = [x2 - nx, y2 - ny];
  const d: Pt = [x1 - nx, y1 - ny];
  if (!round) return `M${P(a)}L${P(b)}L${P(c)}L${P(d)}Z`;
  const r = fmt(width / 2, 3);
  return `M${P(a)}L${P(b)}A${r} ${r} 0 0 0 ${P(c)}L${P(d)}A${r} ${r} 0 0 0 ${P(a)}Z`;
}

/** Garde un tracé libre à des commandes SVG de chemin et à des nombres : aucun autre texte ne passe. */
export function sanitizePathData(d: string): string | null {
  const clean = d.trim();
  if (!clean || clean.length > 6000) return null;
  if (!/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/.test(clean)) return null;
  if (!/^[Mm]/.test(clean)) return null;
  return clean;
}

/** Le `d` d'une géométrie du Logo IR. Vide si la géométrie est dégénérée. */
export function geometryToPath(g: LogoGeometry): string {
  switch (g.type) {
    case 'rect':
      return rectPath(g.x, g.y, g.w, g.h, g.r);
    case 'circle':
      return circlePath(g.cx, g.cy, g.r);
    case 'ellipse':
      return ellipsePath(g.cx, g.cy, g.rx, g.ry);
    case 'polygon':
      return polyPath(regularPolygonPoints(g.cx, g.cy, g.r, g.sides, g.rotation), g.cornerRadius);
    case 'star':
      return polyPath(starPoints(g.cx, g.cy, g.outer, g.inner, g.points, g.rotation));
    case 'ring':
      return ringPath(g.cx, g.cy, g.r, g.thickness);
    case 'arc':
      return arcBandPath(g.cx, g.cy, g.r, g.thickness, g.from, g.to, g.round);
    case 'superellipse':
      return superellipsePath(g.cx, g.cy, g.rx, g.ry, g.n);
    case 'line':
      return linePath(g.x1, g.y1, g.x2, g.y2, g.width, g.round);
    case 'poly':
      return polyPath(g.points as Pt[], g.cornerRadius);
    case 'path':
      return sanitizePathData(g.d) ?? '';
  }
}
