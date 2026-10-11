/**
 * <Morph> — une forme qui se transforme en une autre (flubber), à partir de formes prêtes à l'emploi.
 *
 *   <Morph from="circle" to="heart" at={0.3} dur={1.2} fill="var(--hl)" style={{ width: 30 * u, height: 30 * u }} />
 *   <Morph shapes={['circle', 'star', 'heart', 'drop']} hold={0.8} fade={0.9} fill="var(--hl)" />
 *
 * Formes : circle, square, triangle, star, heart, drop, hexagon, cross, bolt, arrow, check, leaf, moon.
 * Un tracé personnalisé (viewBox 100 × 100) est accepté à la place d'un nom. Sans l'addon flubber, la
 * forme fond de l'une à l'autre. L'avancement est une fonction du temps de la scène.
 */
import { CSSProperties, useMemo } from 'react';
import { useLocalTime } from '../context';
import { addon } from '../shared';
import { clamp, progress } from '../time';

const poly = (n: number, r: number, rot = -90) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    return `${i ? 'L' : 'M'}${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join('') + 'Z';
const star = (n: number, ro: number, ri: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = ((-90 + (180 / n) * i) * Math.PI) / 180;
    const r = i % 2 ? ri : ro;
    return `${i ? 'L' : 'M'}${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
  }).join('') + 'Z';

export const MORPH_SHAPES: Record<string, string> = {
  circle: 'M50 8a42 42 0 1 1 0 84a42 42 0 1 1 0-84Z',
  square: 'M14 14H86V86H14Z',
  triangle: 'M50 10L92 86H8Z',
  star: star(5, 44, 18),
  heart: 'M50 88C14 60 8 34 24 20C36 10 46 16 50 28C54 16 64 10 76 20C92 34 86 60 50 88Z',
  drop: 'M50 8C50 8 18 44 18 62A32 32 0 0 0 82 62C82 44 50 8 50 8Z',
  hexagon: poly(6, 44),
  cross: 'M38 10H62V38H90V62H62V90H38V62H10V38H38Z',
  bolt: 'M58 6L18 54H46L40 94L84 42H54Z',
  arrow: 'M10 40H58V18L92 50L58 82V60H10Z',
  check: 'M10 52L22 40L40 58L78 18L90 30L40 82Z',
  leaf: 'M50 92C20 78 10 50 22 26C34 8 62 8 88 12C92 40 82 80 50 92Z',
  moon: 'M70 12A42 42 0 1 0 88 62A34 34 0 1 1 70 12Z',
};
export const MORPH_SHAPE_IDS = Object.keys(MORPH_SHAPES);

const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
const pathOf = (s: string) => MORPH_SHAPES[s] || (/^[Mm]/.test(s.trim()) ? s : MORPH_SHAPES.circle);

export interface MorphProps {
  from?: string;
  to?: string;
  /** Une suite de formes qui s'enchaînent en boucle (remplace `from`/`to`). */
  shapes?: string[];
  at?: number;
  dur?: number;
  /** Pour `shapes` : tenue d'une forme et durée de la transformation, en secondes. */
  hold?: number;
  fade?: number;
  /** Avancement imposé 0 → 1 de from → to. */
  p?: number;
  fill?: string;
  stroke?: string;
  /** Épaisseur du contour, en part du viewBox (1 = 1 %). */
  weight?: number;
  style?: CSSProperties;
  className?: string;
}

const cache = new Map<string, (t: number) => string>();

export function Morph({ from = 'circle', to = 'heart', shapes, at = 0, dur = 1.2, hold = 0.8, fade = 0.9, p, fill = 'var(--hl)', stroke, weight = 2, style, className }: MorphProps) {
  const lt = useLocalTime();
  const flubber = addon('flubber');
  let a = from;
  let b = to;
  let k: number;
  if (shapes && shapes.length >= 2) {
    const period = hold + fade;
    const cycle = Math.max(0, lt - at) / period;
    const i = Math.floor(cycle) % shapes.length;
    a = shapes[i];
    b = shapes[(i + 1) % shapes.length];
    k = smooth((cycle - Math.floor(cycle) - hold / period) / (fade / period));
  } else k = smooth(p ?? progress(lt, at, dur));
  const pa = pathOf(a);
  const pb = pathOf(b);
  const fn = useMemo(() => {
    if (!flubber) return null;
    const key = `${pa}|${pb}`;
    let f = cache.get(key);
    if (!f) {
      try {
        f = flubber.interpolate(pa, pb, { maxSegmentLength: 2 });
        cache.set(key, f);
      } catch {
        return null;
      }
    }
    return f;
  }, [flubber, pa, pb]);
  const common = { fill: fill || 'none', stroke: stroke || 'none', strokeWidth: stroke ? weight : 0, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 100 100" className={className} style={{ display: 'inline-block', overflow: 'visible', ...style }} aria-hidden>
      {fn ? <path d={fn(k)} {...common} /> : (
        <>
          <path d={pa} {...common} opacity={1 - k} />
          <path d={pb} {...common} opacity={k} />
        </>
      )}
    </svg>
  );
}
