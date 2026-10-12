/**
 * Le KIT GRAPHIQUE : des formes NOMMÉES, dessinées par le code.
 *
 * Un plan (ou un agent) écrit une ligne — `{ t: 'shape', shape: 'rings', seed: 3, tone: 'brand' }` — et le
 * code dessine la forme aux couleurs de la marque. Une forme nommée pèse quelques dizaines de signes là
 * où un SVG écrit à la main en pèse des milliers, et elle ne peut ni déborder ni sortir de la palette.
 *
 * Toutes les formes se dessinent dans un carré 100 × 100 et se posent en `slice` : un cercle reste rond
 * quelle que soit la boîte qui le reçoit.
 */
import type { ShapeId } from '../../contracts/design-spec';
import { Rng } from '../../foundation/rng';

export interface ShapePaint {
  /** Couleur principale de la forme. */
  main: string;
  /** Couleur secondaire (alternances). */
  alt: string;
  /** Pour les formes au trait. */
  stroke?: number;
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Courbe fermée lisse passant par des points (Catmull-Rom → Bézier). */
function smoothClosed(points: Array<[number, number]>): string {
  const n = points.length;
  let d = `M${r1(points[0][0])},${r1(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])},${r1(c1[1])} ${r1(c2[0])},${r1(c2[1])} ${r1(p2[0])},${r1(p2[1])}`;
  }
  return `${d}Z`;
}

function blobPoints(rng: Rng, cx: number, cy: number, radius: number, wobble: number, count = 8): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = radius * (1 - wobble / 2 + rng.next() * wobble);
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

type Drawer = (rng: Rng, paint: ShapePaint) => string;

const DRAWERS: Record<ShapeId, Drawer> = {
  rings: (rng, p) => {
    const cx = rng.int(30, 70);
    const cy = rng.int(30, 70);
    const sw = p.stroke ?? 2.2;
    let out = '';
    for (let r = 8 + rng.int(0, 4); r < 110; r += 9 + rng.int(0, 3)) out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.main}" stroke-width="${sw}"/>`;
    return out;
  },
  'quarter-circles': (rng, p) => {
    let out = '';
    const n = 3;
    const s = 100 / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (rng.chance(0.18)) continue;
        const x = i * s;
        const y = j * s;
        const corner = rng.int(0, 3);
        const cx = corner % 2 === 0 ? x : x + s;
        const cy = corner < 2 ? y : y + s;
        const color = rng.chance(0.65) ? p.main : p.alt;
        out += `<path d="M${r1(cx)},${r1(cy)} L${r1(corner % 2 === 0 ? cx + s : cx - s)},${r1(cy)} A${r1(s)},${r1(s)} 0 0 ${corner === 0 || corner === 3 ? 1 : 0} ${r1(cx)},${r1(corner < 2 ? cy + s : cy - s)} Z" fill="${color}"/>`;
      }
    return out;
  },
  'half-discs': (rng, p) => {
    let out = '';
    const n = rng.int(3, 4);
    const w = 100 / n;
    for (let i = 0; i < n; i++) {
      const up = rng.chance(0.5);
      const cy = up ? 70 : 30;
      out += `<path d="M${r1(i * w)},${cy} A${r1(w / 2)},${r1(w / 2)} 0 0 ${up ? 1 : 0} ${r1((i + 1) * w)},${cy} Z" fill="${i % 2 ? p.alt : p.main}"/>`;
    }
    return out;
  },
  stripes: (rng, p) => {
    const gap = rng.int(9, 14);
    const w = gap * (0.38 + rng.next() * 0.2);
    let out = '';
    for (let x = -100; x < 200; x += gap) out += `<path d="M${x},0 L${r1(x + w)},0 L${r1(x + w - 100)},100 L${x - 100},100 Z" fill="${p.main}"/>`;
    return out;
  },
  'grid-lines': (rng, p) => {
    const step = rng.int(7, 11);
    const sw = p.stroke ?? 0.6;
    let out = '';
    for (let v = step; v < 100; v += step) out += `<line x1="${v}" y1="0" x2="${v}" y2="100" stroke="${p.main}" stroke-width="${sw}"/><line x1="0" y1="${v}" x2="100" y2="${v}" stroke="${p.main}" stroke-width="${sw}"/>`;
    return out;
  },
  'dots-field': (rng, p) => {
    const step = rng.int(6, 9);
    let out = '';
    const cx = rng.int(0, 100);
    const cy = rng.int(0, 100);
    for (let x = step / 2; x < 100; x += step)
      for (let y = step / 2; y < 100; y += step) {
        const d = Math.hypot(x - cx, y - cy) / 140;
        const r = Math.max(0.3, (step / 2.6) * (1 - d));
        out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${p.main}"/>`;
      }
    return out;
  },
  chevrons: (rng, p) => {
    const step = rng.int(10, 16);
    const sw = p.stroke ?? 3;
    let out = '';
    for (let y = -10; y < 110; y += step) out += `<polyline points="0,${y + step / 2} 25,${y} 50,${y + step / 2} 75,${y} 100,${y + step / 2}" fill="none" stroke="${p.main}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
    return out;
  },
  arcs: (rng, p) => {
    const corner = rng.pick([
      [0, 0],
      [100, 0],
      [0, 100],
      [100, 100],
    ]);
    const sw = p.stroke ?? 4;
    let out = '';
    for (let r = 20; r <= 140; r += 18) out += `<circle cx="${corner[0]}" cy="${corner[1]}" r="${r}" fill="none" stroke="${r % 36 === 20 ? p.main : p.alt}" stroke-width="${sw}"/>`;
    return out;
  },
  blob: (rng, p) => `<path d="${smoothClosed(blobPoints(rng, 50, 50, 42, 0.45, 9))}" fill="${p.main}"/>`,
  waves: (rng, p) => {
    const amp = rng.int(3, 6);
    const step = rng.int(9, 13);
    const sw = p.stroke ?? 2;
    let out = '';
    for (let y = 5; y < 105; y += step) {
      let d = `M0,${y}`;
      for (let x = 0; x <= 100; x += 12.5) d += ` Q${x + 6.25},${y + (x % 25 === 0 ? -amp : amp)} ${x + 12.5},${y}`;
      out += `<path d="${d}" fill="none" stroke="${p.main}" stroke-width="${sw}"/>`;
    }
    return out;
  },
  steps: (rng, p) => {
    const n = rng.int(4, 6);
    const w = 100 / n;
    let out = '';
    for (let i = 0; i < n; i++) out += `<rect x="${r1(i * w)}" y="${r1(100 - (i + 1) * (100 / n))}" width="${r1(w + 0.5)}" height="${r1((i + 1) * (100 / n))}" fill="${i % 2 ? p.alt : p.main}"/>`;
    return out;
  },
  triangles: (rng, p) => {
    const n = 4;
    const s = 100 / n;
    let out = '';
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (!rng.chance(0.55)) continue;
        const x = i * s;
        const y = j * s;
        const flip = rng.chance(0.5);
        out += `<path d="${flip ? `M${x},${y} L${x + s},${y} L${x},${y + s} Z` : `M${x + s},${y} L${x + s},${y + s} L${x},${y + s} Z`}" fill="${rng.chance(0.6) ? p.main : p.alt}"/>`;
      }
    return out;
  },
  'cross-marks': (rng, p) => {
    const step = rng.int(11, 16);
    const arm = step * 0.22;
    const sw = p.stroke ?? 1.6;
    let out = '';
    for (let x = step / 2; x < 100; x += step) for (let y = step / 2; y < 100; y += step) out += `<path d="M${r1(x - arm)},${r1(y)} H${r1(x + arm)} M${r1(x)},${r1(y - arm)} V${r1(y + arm)}" stroke="${p.main}" stroke-width="${sw}"/>`;
    return out;
  },
  checker: (rng, p) => {
    const n = rng.int(4, 6);
    const s = 100 / n;
    let out = '';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) out += `<rect x="${r1(i * s)}" y="${r1(j * s)}" width="${r1(s)}" height="${r1(s)}" fill="${p.main}"/>`;
    return out;
  },
  contours: (rng, p) => {
    const cx = rng.int(35, 65);
    const cy = rng.int(35, 65);
    const sw = p.stroke ?? 1.1;
    let out = '';
    for (let k = 1; k <= 9; k++) out += `<path d="${smoothClosed(blobPoints(rng, cx, cy, k * 9, 0.22, 10))}" fill="none" stroke="${p.main}" stroke-width="${sw}"/>`;
    return out;
  },
  /** Un pan oblique : le geste diagonal d'une composition (bande coupée en biais). */
  slant: (rng, p) => {
    const a = rng.int(30, 55);
    const b = rng.int(70, 95);
    return rng.chance(0.5) ? `<path d="M0,${a} L100,${b - 40} L100,100 L0,100 Z" fill="${p.main}"/>` : `<path d="M0,${b - 40} L100,${a} L100,100 L0,100 Z" fill="${p.main}"/>`;
  },
  burst: (rng, p) => {
    const rays = rng.int(14, 22);
    const cx = rng.pick([0, 50, 100]);
    const cy = rng.pick([0, 50, 100]);
    let out = '';
    for (let i = 0; i < rays; i += 2) {
      const a1 = (i / rays) * Math.PI * 2;
      const a2 = ((i + 1) / rays) * Math.PI * 2;
      out += `<path d="M${cx},${cy} L${r1(cx + Math.cos(a1) * 160)},${r1(cy + Math.sin(a1) * 160)} L${r1(cx + Math.cos(a2) * 160)},${r1(cy + Math.sin(a2) * 160)} Z" fill="${p.main}"/>`;
    }
    return out;
  },
};

export const SHAPES: readonly ShapeId[] = Object.keys(DRAWERS) as ShapeId[];

/** Les formes au TRAIT (lignes fines) : elles peuvent passer près d'un texte ; les aplats, non. */
export const LINE_SHAPES = new Set<ShapeId>(['rings', 'grid-lines', 'waves', 'contours', 'cross-marks', 'arcs', 'chevrons']);

/** Le SVG d'une forme, prêt à poser dans une boîte (il la remplit, rognée au besoin). */
export function drawShape(id: ShapeId, seed: number, paint: ShapePaint, options: { opacity?: number; title?: string } = {}): string {
  const rng = new Rng(`${id}:${seed}`);
  // Trait d'ÉCRAN : une forme étirée dans une lisière garde un trait fin au lieu de le grossir avec l'échelle.
  const body = DRAWERS[id](rng, paint).replace(/ stroke-width="/g, ' vector-effect="non-scaling-stroke" stroke-width="');
  const opacity = options.opacity !== undefined && options.opacity < 1 ? ` opacity="${Math.round(options.opacity * 100) / 100}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" focusable="false" style="display:block;overflow:hidden"${opacity}>${body}</svg>`;
}
