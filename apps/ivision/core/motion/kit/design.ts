/**
 * LE SYSTÈME DE DESIGN DANS LE NAVIGATEUR — ce que le code compilé lit dans `ctx.design` (calculé par le serveur :
 * `packages/motion-compiler/src/design/system.ts#resolveSceneDesign`), avec ses courbes et ressorts.
 *
 * Copie autonome (le kit est copié seul dans les images) des fonctions pures de `design/motion.ts` : le contrôle du
 * compilateur vérifie qu'elles donnent les mêmes valeurs.
 */
import type { SceneContext } from './context';

export type TypeLevel = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label';
export type DurToken = 'instant' | 'quick' | 'short' | 'medium' | 'long' | 'xlong';
export type EaseName = 'enter' | 'exit' | 'standard' | 'move' | 'arrive' | 'cut-in' | 'cut-out';
export type StaggerToken = 'letters' | 'words' | 'items' | 'cards';

export interface SceneDesignData {
  format: string;
  energy: number;
  colors: Record<string, string>;
  sizes: Record<TypeLevel, number>;
  weights: { display: number; title: number; subtitle: number; body: number };
  tracking: { title: number; body: number };
  uppercaseTitles: boolean;
  durations: Record<DurToken, number>;
  eases: Record<EaseName, [number, number, number, number]>;
  spring: number;
  stagger: Record<StaggerToken, number>;
  columns: number;
  gutter: number;
  radius: number;
  stroke: number;
  maxSimultaneous: number;
}

/** Les valeurs d'une scène sans système de design (vidéos d'avant le compilateur 0.3). */
export const DEFAULT_SIZES: Record<TypeLevel, number> = { display: 12, title: 9, subtitle: 6, body: 4.6, caption: 3.4, label: 3 };
export const DEFAULT_DURATIONS: Record<DurToken, number> = { instant: 0.1, quick: 0.2, short: 0.3, medium: 0.5, long: 0.7, xlong: 1 };
export const DEFAULT_EASES: Record<EaseName, [number, number, number, number]> = {
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
  standard: [0.2, 0, 0, 1],
  move: [0.45, 0, 0.55, 1],
  arrive: [0.16, 1, 0.3, 1],
  'cut-in': [0.5, 0, 0.75, 0],
  'cut-out': [0.25, 1, 0.5, 1],
};
export const DEFAULT_STAGGER: Record<StaggerToken, number> = { letters: 1 / 30, words: 0.09, items: 0.06, cards: 0.12 };

/** Une courbe cubic-bezier (x → y) : Newton puis dichotomie. */
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

/** Un ressort amorti en forme close (ζ = 1 : jamais de dépassement). */
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
    return t > 0.97 ? v + (1 - v) * ((t - 0.97) / 0.03) : v;
  };
}

const memo = new Map<string, (t: number) => number>();

/** La courbe nommée d'une scène (`enter`, `exit`, `spring`…). */
export function designEase(ctx: Pick<SceneContext, 'design'>, name: string): (t: number) => number {
  const d = ctx.design;
  if (name === 'spring') {
    const key = `spring:${d?.spring ?? 0.8}`;
    if (!memo.has(key)) memo.set(key, springEase(d?.spring ?? 0.8));
    return memo.get(key)!;
  }
  if (name === 'linear') return (t) => t;
  const curve = d?.eases?.[name as EaseName] || DEFAULT_EASES[name as EaseName] || DEFAULT_EASES.standard;
  const key = curve.join(',');
  if (!memo.has(key)) memo.set(key, cubicBezier(curve));
  return memo.get(key)!;
}

/** La taille (u) d'un niveau typographique. */
export const designSize = (ctx: Pick<SceneContext, 'design'>, level: TypeLevel): number => ctx.design?.sizes?.[level] ?? DEFAULT_SIZES[level] ?? DEFAULT_SIZES.body;

/** La durée (s) d'un jeton. */
export const designDur = (ctx: Pick<SceneContext, 'design'>, token: DurToken): number => ctx.design?.durations?.[token] ?? DEFAULT_DURATIONS[token] ?? 0.5;

/** Le décalage (s) d'une cascade. */
export const designStagger = (ctx: Pick<SceneContext, 'design'>, token: StaggerToken): number => ctx.design?.stagger?.[token] ?? DEFAULT_STAGGER[token] ?? 0.08;

/** La graisse d'un niveau. */
export function designWeight(ctx: Pick<SceneContext, 'design'>, level: TypeLevel): number {
  const w = ctx.design?.weights;
  if (level === 'display') return w?.display ?? 800;
  if (level === 'title') return w?.title ?? 700;
  if (level === 'subtitle') return w?.subtitle ?? 600;
  return w?.body ?? 400;
}

/** L'instant (s, depuis le début de la scène) du n-ième temps de la musique ; sans musique, une demi-seconde par temps. */
export function beatAt(ctx: Pick<SceneContext, 'beat' | 'beats'>, n: number): number {
  if (ctx.beats?.length) {
    const i = Math.floor(n);
    if (i < ctx.beats.length) return ctx.beats[i] + (n - i) * ((ctx.beats[i + 1] ?? ctx.beats[i] + 0.5) - ctx.beats[i]);
  }
  if (!ctx.beat || !ctx.beat.bpm) return n * 0.5;
  return ctx.beat.first + (n * 60) / ctx.beat.bpm;
}

/** Le temps de lecture d'un texte (s) : 17 signes par seconde, jamais moins de 5/6 s. */
export function readTime(text: string): number {
  const chars = String(text || '').replace(/\s+/g, ' ').trim().length;
  return chars ? Math.max(5 / 6, chars / 17) : 0;
}
