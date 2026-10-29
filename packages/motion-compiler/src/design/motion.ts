/**
 * LES JETONS DE MOUVEMENT ET DE LECTURE — des réglages de départ, à étalonner sur le banc.
 *
 *   durées     l'échelle Material 3 (50 → 1 000 ms), nommée par usage, multipliée par le facteur de la
 *              direction et par l'énergie de la scène ;
 *   courbes    par RÔLE du mouvement : une arrivée sur une longue traîne (emphasized decelerate
 *              0.05, 0.7, 0.1, 1), une sortie qui accélère (0.3, 0, 0.8, 0.15), une caméra dans les deux
 *              sens, la coupe au vol (power4 in / out, deux moitiés d'une même courbe) ;
 *   ressorts   nommés par leur amortissement ; la position et la taille rebondissent, jamais l'opacité ;
 *   cascades   lettres à une image d'écart, mots 60–120 ms, éléments d'une liste 40–80 ms ;
 *   lecture    un texte reste au moins le temps de le lire : 17 signes par seconde, jamais moins de 5/6 s.
 *
 * Les mesures de mouvement viennent des films de lancement HyperFrames (HeyGen, Apache-2.0 — voir NOTICE).
 */
import type { DurToken, EaseToken, StaggerToken } from './types';

/** Material 3 : `short2`, `short4`, `medium2`, `long2`, `extraLong1`, `extraLong4` (secondes). */
export const BASE_DURATIONS: Record<DurToken, number> = {
  instant: 0.1,
  quick: 0.2,
  short: 0.3,
  medium: 0.5,
  long: 0.7,
  xlong: 1.0,
};

/** Les courbes par rôle (cubic-bezier). */
export const EASE_CURVES: Record<Exclude<EaseToken, 'spring' | 'linear'>, [number, number, number, number]> = {
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
  standard: [0.2, 0, 0, 1],
  move: [0.45, 0, 0.55, 1],
  arrive: [0.16, 1, 0.3, 1],
  'cut-in': [0.5, 0, 0.75, 0],
  'cut-out': [0.25, 1, 0.5, 1],
};

export const BASE_STAGGER: Record<StaggerToken, number> = {
  letters: 1 / 30,
  words: 0.09,
  items: 0.06,
  cards: 0.12,
};

/** Facteur de vitesse d'une énergie (1 posé … 5 nerveux) : multiplie les durées. */
export const ENERGY_SPEED: Record<number, number> = { 1: 1.3, 2: 1.12, 3: 1, 4: 0.88, 5: 0.78 };

/** Mouvements PRINCIPAUX simultanés admis à une énergie (au-delà, l'œil ne suit plus). */
export const ENERGY_SIMULTANEOUS: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2 };

/** Le chevauchement d'un mouvement au suivant : le suivant part quand le précédent est fait à 30–50 %. */
export const OVERLAP = { min: 0.3, max: 0.5 };

/** Une sortie dure 40 à 50 % de moins que son entrée. */
export const EXIT_RATIO = 0.55;

/** La pause avant le moment fort (« stillness before climax »). */
export const CLIMAX_PAUSE = { min: 0.3, max: 0.75 };

/** Tolérance du calage sur un temps de la musique (s). */
export const BEAT_TOLERANCE = 0.12;

export const clampEnergy = (e: unknown): number => {
  const n = Math.round(Number(e));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
};

/** Les durées d'une scène : base × facteur de la direction × énergie. */
export function durations(speed: number, energy: number): Record<DurToken, number> {
  const k = speed * (ENERGY_SPEED[clampEnergy(energy)] ?? 1);
  return Object.fromEntries(Object.entries(BASE_DURATIONS).map(([t, s]) => [t, Math.round(s * k * 1000) / 1000])) as Record<DurToken, number>;
}

export function staggers(energy: number): Record<StaggerToken, number> {
  const k = ENERGY_SPEED[clampEnergy(energy)] ?? 1;
  return { letters: BASE_STAGGER.letters, words: Math.min(0.12, Math.max(0.06, BASE_STAGGER.words * k)), items: Math.min(0.08, Math.max(0.04, BASE_STAGGER.items * k)), cards: Math.round(BASE_STAGGER.cards * k * 1000) / 1000 };
}

/** Le temps de lecture d'un texte (s) : 17 signes par seconde, jamais moins de 5/6 s (règles de sous-titrage). */
export function readTime(text: string): number {
  const chars = String(text || '').replace(/\s+/g, ' ').trim().length;
  if (!chars) return 0;
  return Math.max(5 / 6, chars / 17);
}

/** Évalue une courbe cubic-bezier (x → y), par Newton puis dichotomie : la même fonction que le code compilé. */
export function cubicBezier(p: [number, number, number, number]): (t: number) => number {
  const [x1, y1, x2, y2] = p;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      const d = dx(t);
      if (Math.abs(e) < 1e-5) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/**
 * Un ressort amorti en forme close (rapport d'amortissement ζ) : chaque image se calcule seule (rendu en tronçons
 * parallèles, retour en arrière de l'aperçu). ζ = 1 : jamais de dépassement.
 */
export function springEase(zeta: number): (t: number) => number {
  const z = Math.min(1, Math.max(0.2, zeta));
  const w = 2 * Math.PI * 1.6;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const x = t * 1.35;
    if (z >= 0.999) return 1 - (1 + w * x) * Math.exp(-w * x);
    const wd = w * Math.sqrt(1 - z * z);
    const v = 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));
    // Ramené à 1 exactement à la fin (la traîne est sous le seuil visible).
    return t > 0.97 ? v + (1 - v) * ((t - 0.97) / 0.03) : v;
  };
}

/** La fonction d'une courbe nommée (les mesures du juge et du solveur temporel s'en servent). */
export function easeFunction(token: string, spring = 0.8): (t: number) => number {
  if (token === 'linear') return (t) => t;
  if (token === 'spring') return springEase(spring);
  const curve = (EASE_CURVES as Record<string, [number, number, number, number]>)[token];
  return curve ? cubicBezier(curve) : cubicBezier(EASE_CURVES.standard);
}
