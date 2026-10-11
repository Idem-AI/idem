/**
 * LE NOYAU GÉOMÉTRIQUE — l'interface derrière laquelle vit la bibliothèque de tracés.
 *
 * Le moteur ne parle jamais à Paper.js directement : il parle à un `GeometryKernel`. Remplacer
 * la bibliothèque (ou la doubler d'un noyau de test) se fait en écrivant une autre
 * implémentation de cette interface, sans toucher aux générateurs, à la composition ni à l'agent.
 *
 * Un `Shape` est immuable : un tracé (`d`, en commandes SVG absolues) et sa boîte.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Matrice affine à la façon SVG : [a, b, c, d, e, f]. */
export type Matrix = [number, number, number, number, number, number];

export interface Shape {
  readonly d: string;
  readonly bounds: Rect;
}

export type BoolOp = 'union' | 'subtract' | 'intersect' | 'exclude';

export interface GeometryKernel {
  readonly name: string;
  /** Tracé SVG → forme. `null` si le tracé est illisible ou vide. */
  fromPath(d: string): Shape | null;
  transform(shape: Shape, matrix: Matrix): Shape;
  /** Opération booléenne ; `null` si le noyau échoue ou si le résultat est vide. */
  combine(op: BoolOp, a: Shape, b: Shape): Shape | null;
  /** Aire pleine (valeur absolue, trous déduits). */
  area(shape: Shape): number;
  /** Contours distincts d'une forme composée (lettre à contre-forme : corps + trou). */
  contours(shape: Shape): Shape[];
}

// ─── Matrices ───────────────────────────────────────────────────────────────

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** a ∘ b : applique `b` d'abord, puis `a`. */
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
export const scaleBy = (sx: number, sy = sx): Matrix => [sx, 0, 0, sy, 0, 0];

export function rotateBy(deg: number, cx = 0, cy = 0): Matrix {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
}

export const skewXBy = (deg: number): Matrix => [1, 0, Math.tan((deg * Math.PI) / 180), 1, 0, 0];

/** Matrice qui applique `m` autour du point (cx, cy). */
export function around(m: Matrix, cx: number, cy: number): Matrix {
  return multiply(translate(cx, cy), multiply(m, translate(-cx, -cy)));
}

export function applyToPoint(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export const centerOf = (r: Rect): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Arrondi stable des nombres écrits dans un tracé (évite -0 et les 1e-7). */
export function fmt(value: number, digits = 2): string {
  const f = 10 ** digits;
  const r = Math.round(value * f) / f;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}
