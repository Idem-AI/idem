/**
 * Le temps : courbes d'amorti, interpolation, quantification.
 *
 * Tout le moteur est une FONCTION DU TEMPS : chaque style est calculé à partir
 * de t, jamais accumulé image après image. L'image t est donc toujours la même,
 * quel que soit l'ordre de rendu.
 */

export type Bezier = [number, number, number, number];

/** Résolution d'une courbe de Bézier cubique (méthode de Newton puis dichotomie). */
export function bezier([x1, y1, x2, y2]: Bezier): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-5) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** Avancée normalisée d'une animation qui commence à `at` et dure `dur`. */
export const progress = (t: number, at: number, dur: number) => clamp((t - at) / Math.max(0.0001, dur));

/** Temps « image par image » : 12 i/s pour le mouvement façon papier découpé. */
export const quantize = (t: number, step: number) => (step > 0 ? Math.floor(t * (24 / step)) / (24 / step) : t);

/** Bruit déterministe (pour le brouillage de lettres, le grain…). */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Courbe « exponentielle » de référence quand la direction n'en impose pas. */
export const EXPO_OUT: Bezier = [0.16, 1, 0.3, 1];
export const EXPO_IN: Bezier = [0.7, 0, 0.84, 0];
