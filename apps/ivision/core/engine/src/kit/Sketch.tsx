/**
 * Le trait humain et le vivant, pilotés par le temps (addon `draw`).
 *
 *  - <Sketch>     une forme « dessinée à la main » (rough.js) qui se trace : cadre, cercle,
 *                 ellipse, ligne, arc, polygone, tracé SVG, courbe ; graine fixe = même forme
 *                 à chaque image
 *  - <Brush>      un trait de pinceau à pression variable (perfect-freehand) qui avance
 *  - useNoise()   bruit simplex 2D / 3D, graine du moteur (jamais Math.random)
 *  - <FlowField>  des lignes de flux qui ondulent dans un champ de bruit
 *
 * Coordonnées en viewBox 100 × 100, étirées à la boîte ; épaisseurs constantes à l'écran.
 */
import { CSSProperties, useMemo } from 'react';
import { useEngine, useLocalTime } from '../context';
import { addon } from '../shared';
import { hash, progress } from '../time';

const svgBox: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' };

export type SketchShape =
  | { shape: 'rectangle'; x: number; y: number; w: number; h: number }
  | { shape: 'circle'; cx: number; cy: number; d: number }
  | { shape: 'ellipse'; cx: number; cy: number; w: number; h: number }
  | { shape: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { shape: 'arc'; cx: number; cy: number; w: number; h: number; start: number; stop: number; closed?: boolean }
  | { shape: 'polygon'; points: [number, number][] }
  | { shape: 'curve'; points: [number, number][] }
  | { shape: 'path'; d: string };

export interface SketchProps {
  /** La forme (viewBox 100 × 100). */
  draw: SketchShape;
  /** Avancement du tracé, 0 → 1 (ex. ease(progress(lt, 0.3, 0.8))). */
  p?: number;
  color?: string;
  fill?: string;
  /** hachure, solid, zigzag, cross-hatch, dots, dashed, zigzag-line. */
  fillStyle?: string;
  /** Épaisseur à l'écran, en unités u. */
  weight?: number;
  /** 0 = net, 1 = croquis, 2+ = très libre. */
  roughness?: number;
  seed?: number;
  preserve?: 'none' | 'xMidYMid meet';
  style?: CSSProperties;
}

/** Une forme tracée à la main qui se dessine. */
export function Sketch({ draw, p = 1, color = 'var(--hl)', fill, fillStyle = 'hachure', weight = 0.5, roughness = 1.2, seed = 3, preserve = 'none', style }: SketchProps) {
  const lib = addon('draw');
  const { u } = useEngine();
  const paths = useMemo(() => {
    if (!lib) return [];
    const g = lib.generator();
    // Couleurs posées ensuite en CSS : rough ne voit que des marqueurs.
    const o = { seed: Math.max(1, Math.round(seed)), roughness, bowing: 1, stroke: '#000', strokeWidth: 1, fill: fill ? '#111' : undefined, fillStyle, hachureGap: 2.2, fillWeight: 0.6 };
    const d = draw;
    const shape =
      d.shape === 'rectangle' ? g.rectangle(d.x, d.y, d.w, d.h, o)
      : d.shape === 'circle' ? g.circle(d.cx, d.cy, d.d, o)
      : d.shape === 'ellipse' ? g.ellipse(d.cx, d.cy, d.w, d.h, o)
      : d.shape === 'line' ? g.line(d.x1, d.y1, d.x2, d.y2, o)
      : d.shape === 'arc' ? g.arc(d.cx, d.cy, d.w, d.h, d.start, d.stop, !!d.closed, o)
      : d.shape === 'polygon' ? g.polygon(d.points, o)
      : d.shape === 'curve' ? g.curve(d.points, o)
      : g.path(d.d, o);
    return g.toPaths(shape) as { d: string; stroke: string; fill?: string }[];
  }, [lib, JSON.stringify(draw), fill, fillStyle, roughness, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lib) return null;
  const clamped = Math.max(0, Math.min(1, p));
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio={preserve} style={{ ...svgBox, ...style }} aria-hidden>
      {paths.map((path, i) => {
        // Les remplissages (hachures) apparaissent après le contour, le contour se trace.
        const isFill = !!path.fill && path.fill !== 'none';
        return isFill ? (
          <path key={i} d={path.d} fill={fill} opacity={Math.max(0, clamped * 2 - 1)} />
        ) : (
          <path key={i} d={path.d} fill="none" stroke={path.stroke === '#000' ? color : fill || color} strokeWidth={weight * u} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - clamped} />
        );
      })}
    </svg>
  );
}

/** Un trait de pinceau qui avance le long de `points` (viewBox 100 × 100). */
export function Brush({ points, p = 1, size = 3, thinning = 0.6, color = 'var(--hl)', preserve = 'none', style }: { points: [number, number][]; p?: number; size?: number; thinning?: number; color?: string; preserve?: 'none' | 'xMidYMid meet'; style?: CSSProperties }) {
  const lib = addon('draw');
  if (!lib || points.length < 2) return null;
  // Les points parcourus à l'instant p, le dernier interpolé : le trait avance sans à-coups.
  const reach = Math.max(0, Math.min(1, p)) * (points.length - 1);
  const k = Math.floor(reach);
  const shown = points.slice(0, k + 1).map(([x, y]) => [x, y]);
  if (k < points.length - 1) {
    const f = reach - k;
    const [a, b] = [points[k], points[k + 1]];
    shown.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  if (shown.length < 2) return null;
  const outline = lib.getStroke(shown, { size, thinning, smoothing: 0.6, streamline: 0.4, simulatePressure: true, last: k >= points.length - 1 });
  const d = outline.length ? `M${outline.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z` : '';
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio={preserve} style={{ ...svgBox, ...style }} aria-hidden>
      <path d={d} fill={color} />
    </svg>
  );
}

const fallbackNoise = {
  noise2D: (x: number, y: number) => Math.sin(x * 1.7 + Math.sin(y * 1.3)) * Math.cos(y * 1.1 - x * 0.4),
  noise3D: (x: number, y: number, z: number) => Math.sin(x * 1.7 + z) * Math.cos(y * 1.1 - z * 0.7),
};

/** Bruit simplex à graine fixe (même graine, même champ) ; -1 → 1. */
export function useNoise(seed = 1): { noise2D: (x: number, y: number) => number; noise3D: (x: number, y: number, z: number) => number } {
  const lib = addon('draw');
  return useMemo(() => {
    if (!lib) return fallbackNoise;
    let k = 0;
    const random = () => hash(seed * 7919 + k++ * 1.618);
    return { noise2D: lib.createNoise2D(random), noise3D: lib.createNoise3D(random) };
  }, [lib, seed]);
}

/** Lignes de flux qui ondulent dans un champ de bruit, aux couleurs de la marque. */
export function FlowField({ lines = 34, steps = 26, seed = 5, opacity = 0.35, speed = 0.18, style }: { lines?: number; steps?: number; seed?: number; opacity?: number; speed?: number; style?: CSSProperties }) {
  const { noise3D } = useNoise(seed);
  const { u } = useEngine();
  const lt = useLocalTime();
  const z = lt * speed;
  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    let x = hash(seed + i * 1.31) * 100;
    let y = hash(seed * 3 + i * 2.17) * 100;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    for (let s = 0; s < steps; s++) {
      const a = noise3D(x * 0.018, y * 0.018, z) * Math.PI * 2;
      x += Math.cos(a) * 2.4;
      y += Math.sin(a) * 2.4;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    paths.push(d);
  }
  const enter = progress(lt, 0, 1.2);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ ...svgBox, opacity: opacity * enter, ...style }} aria-hidden>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={i % 3 === 0 ? 'var(--hl)' : 'var(--c-primary)'} strokeWidth={0.22 * u} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
