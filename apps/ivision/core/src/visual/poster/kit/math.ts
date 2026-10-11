/**
 * Les mathématiques du kit graphique — tirage déterministe, courbes lisses, format des nombres.
 *
 * Aucune dépendance ESM (d3-shape, d3-contour) : l'image de production tourne sur Node 20 en
 * CommonJS, où ces paquets ne se chargent pas. Les quelques courbes dont le kit a besoin tiennent
 * en vingt lignes.
 */
export type Pt = [number, number];

/** Un tirage reproductible : même graine, mêmes formes. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une graine entière à partir d'un texte. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Un nombre court (le SVG reste léger) : entier au-delà de 100 px, une décimale en dessous, jamais « -0 ». */
export function n1(v: number): number {
  const r = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

export const pt = (p: Pt) => `${n1(p[0])},${n1(p[1])}`;

/** Courbe fermée lisse (Catmull-Rom → Bézier) passant par les points. */
export function smoothClosed(points: Pt[]): string {
  const n = points.length;
  if (n < 3) return '';
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return `${d}Z`;
}

/** Courbe ouverte lisse. */
export function smoothOpen(points: Pt[]): string {
  const n = points.length;
  if (n < 2) return '';
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}

/** Un polygone (sommets reliés par des droites). */
export const polyline = (points: Pt[], close = false) => `M${points.map(pt).join('L')}${close ? 'Z' : ''}`;

/** Mélange de deux couleurs #rrggbb (t = part de `b`). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Luminance relative WCAG d'une couleur #rrggbb. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const isDark = (hex: string) => luminance(hex) < 0.18;

export const HEX6 = /^#[0-9a-f]{6}$/i;

/** Une valeur choisie dans une liste par le tirage. */
export const pick = <T>(rnd: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
