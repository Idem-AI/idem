/**
 * LES TRAJECTOIRES — vérifiées, pas seulement l'image finale (banc Code2Video de HeyGen : des textes qui se percutent
 * EN CHEMIN). Les boîtes des textes sont échantillonnées à 10 instants de chaque mouvement, dans chaque format ; deux
 * textes visibles (opacité ≥ 0,35) qui se recouvrent en route sont une collision. Correctifs, dans l'ordre :
 *
 *   1. retarder le second jusqu'à ce que le premier soit arrivé (s'il reste le temps de le lire) ;
 *   2. le re-router : son entrée vient du côté opposé ;
 *   3. réduire son déplacement de moitié.
 *
 * Calcul pur (aucun rendu) : les boîtes sont celles du solveur géométrique, les mouvements ceux de la piste résolue.
 */
import { easeFunction } from '../design/motion';
import { Box, overlap, area } from './geometry';

export interface TrackStep {
  /** Nœuds visés (identifiants simples ; un texte découpé compte pour lui-même). */
  ids: string[];
  at: number;
  dur: number;
  ease: string;
  /** Décalage relatif de départ (u) et opacité / échelle de départ. */
  dx: number;
  dy: number;
  opacity?: number;
  scale?: number;
  stagger: number;
}

export interface Collision {
  a: string;
  b: string;
  t: number;
  format: string;
}

function relativeOf(v: unknown, W: number, H: number): number {
  if (typeof v !== 'string') return 0;
  const m = /^\s*([+-])=\s*(W|H)\s*\*\s*([\d.]+)\s*$/.exec(v);
  if (m) return (m[1] === '-' ? -1 : 1) * (m[2] === 'W' ? W : H) * Number(m[3]);
  const n = /^\s*([+-])=\s*([\d.]+)\s*$/.exec(v);
  return n ? (n[1] === '-' ? -1 : 1) * Number(n[2]) : 0;
}

/** Les pas de la piste vus comme des déplacements (pour la simulation). */
export function trackOf(timeline: { at: unknown; dur?: unknown; ease?: unknown; target?: unknown; from?: Record<string, unknown>; stagger?: unknown }[], W: number, H: number): TrackStep[] {
  return timeline
    .filter((s) => s.target && typeof s.at === 'number' && typeof s.dur === 'number' && s.from)
    .map((s) => ({
      ids: (Array.isArray(s.target) ? s.target : [s.target]).map((t) => String(t).split('.')[0]),
      at: s.at as number,
      dur: s.dur as number,
      ease: typeof s.ease === 'string' ? s.ease : 'standard',
      dx: relativeOf(s.from?.x, W, H),
      dy: relativeOf(s.from?.y, W, H),
      ...(typeof s.from?.opacity === 'number' ? { opacity: s.from.opacity as number } : {}),
      ...(typeof s.from?.scale === 'number' ? { scale: s.from.scale as number } : {}),
      stagger: typeof s.stagger === 'number' ? (s.stagger as number) : 0,
    }));
}

/** La boîte et l'opacité d'un texte à un instant (sa boîte finale décalée par les pas en cours). */
function stateAt(id: string, final: Box, track: TrackStep[], t: number): { box: Box; opacity: number } {
  let dx = 0;
  let dy = 0;
  let opacity = 1;
  let scale = 1;
  for (const s of track) {
    if (!s.ids.includes(id)) continue;
    const start = s.at;
    const e = easeFunction(s.ease);
    const p = t <= start ? 0 : t >= start + s.dur ? 1 : e((t - start) / s.dur);
    dx += s.dx * (1 - p);
    dy += s.dy * (1 - p);
    if (s.opacity !== undefined) opacity = Math.min(opacity, s.opacity + (1 - s.opacity) * p);
    if (s.scale !== undefined) scale *= s.scale + (1 - s.scale) * p;
  }
  const w = (final.x1 - final.x0) * scale;
  const h = (final.y1 - final.y0) * scale;
  const cxp = (final.x0 + final.x1) / 2 + dx;
  const cyp = (final.y0 + final.y1) / 2 + dy;
  return { box: { x0: cxp - w / 2, y0: cyp - h / 2, x1: cxp + w / 2, y1: cyp + h / 2 }, opacity };
}

/** Les collisions de textes EN CHEMIN, dans un format. */
export function findCollisions(boxes: Map<string, Box>, track: TrackStep[], format: string): Collision[] {
  const ids = [...boxes.keys()];
  const out: Collision[] = [];
  const instants = new Set<number>();
  for (const s of track) for (let k = 0; k <= 10; k++) instants.add(Math.round((s.at + (s.dur * k) / 10) * 1000) / 1000);
  for (const t of [...instants].sort((a, b) => a - b)) {
    const states = ids.map((id) => ({ id, ...stateAt(id, boxes.get(id)!, track, t) })).filter((x) => x.opacity >= 0.35);
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const o = overlap(states[i].box, states[j].box);
        if (o > 0.08 * Math.min(area(states[i].box), area(states[j].box)) && !out.some((c) => c.a === states[i].id && c.b === states[j].id)) out.push({ a: states[i].id, b: states[j].id, t, format });
      }
    }
  }
  return out;
}

/** Corrige une collision sur la piste (en place) ; rend la description du correctif, ou null. */
export function resolveCollision(c: Collision, timeline: { at: unknown; dur?: unknown; target?: unknown; from?: Record<string, unknown> }[], latest: number, readOf: (id: string) => number): string | null {
  const touches = (s: (typeof timeline)[number], id: string) => (Array.isArray(s.target) ? s.target : [s.target]).some((x) => String(x).split('.')[0] === id);
  const startOf = (id: string) => Math.min(...timeline.filter((s) => touches(s, id) && typeof s.at === 'number').map((s) => s.at as number));
  const endOf = (id: string) => Math.max(...timeline.filter((s) => touches(s, id) && typeof s.at === 'number').map((s) => (s.at as number) + (typeof s.dur === 'number' ? s.dur : 0.5)));
  const later = startOf(c.a) >= startOf(c.b) ? c.a : c.b;
  const earlier = later === c.a ? c.b : c.a;
  const shift = endOf(earlier) - startOf(later) + 0.04;
  // 1. Retarder : si le texte retardé reste lisible avant la fin.
  if (shift > 0 && endOf(later) + shift + readOf(later) <= latest) {
    for (const s of timeline) if (touches(s, later) && typeof s.at === 'number') s.at = Math.round((s.at + shift) * 1000) / 1000;
    return `${later} retardé de ${shift.toFixed(2)} s (croisait ${earlier} en chemin)`;
  }
  // 2. Re-router : l'entrée vient du côté opposé ; 3. puis réduire le déplacement.
  for (const s of timeline) {
    if (!touches(s, later) || !s.from) continue;
    for (const axis of ['x', 'y'] as const) {
      const v = s.from[axis];
      if (typeof v !== 'string') continue;
      if (/^\s*[+-]=/.test(v) && !(s as { _flipped?: boolean })._flipped) {
        s.from[axis] = v.replace(/^\s*([+-])=/, (_m, sign: string) => (sign === '+' ? '-=' : '+='));
        (s as { _flipped?: boolean })._flipped = true;
        return `${later} entre du côté opposé (croisait ${earlier})`;
      }
      s.from[axis] = v.replace(/([\d.]+)\s*$/, (n) => String(Math.round(Number(n) * 50) / 100));
      return `${later} : déplacement réduit de moitié (croisait ${earlier})`;
    }
  }
  return null;
}
