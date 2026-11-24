/**
 * GÉOMÉTRIE CALCULÉE — des constructions qu'un designer trace au compas ou à la règle, posées par le code.
 *
 *   phi-arcs      cercles emboîtés et tangents intérieurement, rayons en progression géométrique
 *                 (φ, √2 ou 2), alternativement retirés et ajoutés : l'« œil d'or » des grilles de
 *                 construction (Hsiao et al., Img2Logo, CGF 2023 — sans la photo : la progression seule).
 *   tessellation  triangulation de Delaunay (Bowyer–Watson) ou cellules de Voronoï (son dual) d'un
 *                 semis de points SYMÉTRIQUE, chaque facette rétrécie vers son centre : un cristal,
 *                 un réseau, une mosaïque — lisible parce que peu de points et une symétrie d'ordre k.
 */
import { circlePath, polyPath } from '../../kernel/primitives';
import type { Pt } from '../../kernel/primitives';
import type { GenPart } from './registry';
import { num, opt, register } from './registry';

const RATIOS: Record<string, number> = { phi: (1 + Math.sqrt(5)) / 2, sqrt2: Math.SQRT2, octave: 2 };

register({
  id: 'phi-arcs',
  label: 'Arcs en proportion (φ, √2, 2)',
  family: 'abstract',
  tags: ['croissance', 'growth', 'harmonie', 'harmony', 'nature', 'équilibre', 'balance', 'finance', 'patrimoine', 'sagesse', 'wisdom', 'temps', 'time', 'évolution', 'design'],
  tones: 1,
  style: 'geometric',
  params: {
    steps: num(2, 5, 3, true),
    turn: num(50, 150, 100),
    start: num(0, 360, 210),
    ratio: opt(['phi', 'sqrt2', 'octave']),
  },
  build: (p, { kernel }) => {
    const ratio = RATIOS[p.ratio as string] ?? RATIOS.phi;
    const steps = p.steps as number;
    let cx = 50;
    let cy = 50;
    let r = 46;
    let angle = ((p.start as number) * Math.PI) / 180;
    let acc = kernel.fromPath(circlePath(cx, cy, r));
    if (!acc) return [];
    for (let k = 1; k <= steps; k++) {
      // Le cercle suivant est tangent intérieurement au précédent, dans la direction `angle`.
      const next = r / ratio;
      cx += (r - next) * Math.cos(angle);
      cy += (r - next) * Math.sin(angle);
      r = next;
      angle += ((p.turn as number) * Math.PI) / 180;
      const disc = kernel.fromPath(circlePath(cx, cy, r));
      if (!disc) break;
      acc = kernel.combine(k % 2 ? 'subtract' : 'union', acc, disc) ?? acc;
    }
    return [{ d: acc.d, tone: 'a' }];
  },
});

// ─── Delaunay (Bowyer–Watson) ───────────────────────────────────────────────

type Tri = [number, number, number];

function circumcircle(a: Pt, b: Pt, c: Pt): { x: number; y: number; r2: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a[0] ** 2 + a[1] ** 2;
  const b2 = b[0] ** 2 + b[1] ** 2;
  const c2 = c[0] ** 2 + c[1] ** 2;
  const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { x, y, r2: (a[0] - x) ** 2 + (a[1] - y) ** 2 };
}

/** Triangulation de Delaunay d'un petit semis (Bowyer–Watson, O(n²) : n ≤ 40). */
export function delaunay(points: Pt[]): Tri[] {
  const pts: Pt[] = [...points, [-1000, -1000], [1100, -1000], [50, 1100]];
  const s = points.length;
  let tris: Tri[] = [[s, s + 1, s + 2]];
  for (let i = 0; i < s; i++) {
    const p = pts[i];
    const bad: Tri[] = [];
    const good: Tri[] = [];
    for (const t of tris) {
      const c = circumcircle(pts[t[0]], pts[t[1]], pts[t[2]]);
      if (c && (p[0] - c.x) ** 2 + (p[1] - c.y) ** 2 < c.r2 - 1e-9) bad.push(t);
      else good.push(t);
    }
    // Bord du trou : les arêtes des triangles retirés qui n'appartiennent qu'à un seul d'entre eux.
    const edges = new Map<string, [number, number]>();
    for (const t of bad)
      for (const [u, v] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
        const k = u < v ? `${u}-${v}` : `${v}-${u}`;
        if (edges.has(k)) edges.delete(k);
        else edges.set(k, [u, v]);
      }
    tris = [...good, ...[...edges.values()].map(([u, v]) => [u, v, i] as Tri)];
  }
  return tris.filter((t) => t.every((v) => v < s));
}

/** Un semis symétrique d'ordre k : quelques points d'un secteur, répétés par rotation, + un anneau de bord. */
function symmetricSites(order: number, perSector: number, rng: () => number): { sites: Pt[]; ring: number } {
  const sites: Pt[] = [[50, 50]];
  const base: Pt[] = [];
  for (let i = 0; i < perSector; i++) {
    const rad = 10 + rng() * 26;
    const ang = (rng() * 2 * Math.PI) / order;
    base.push([rad, ang]);
  }
  for (let k = 0; k < order; k++)
    for (const [rad, ang] of base) {
      const a = ang + (k * 2 * Math.PI) / order - Math.PI / 2;
      sites.push([50 + rad * Math.cos(a), 50 + rad * Math.sin(a)]);
    }
  const ring = sites.length;
  const boundary = order * 2;
  for (let k = 0; k < boundary; k++) {
    const a = (k * 2 * Math.PI) / boundary - Math.PI / 2;
    sites.push([50 + 44 * Math.cos(a), 50 + 44 * Math.sin(a)]);
  }
  return { sites, ring };
}

const shrink = (poly: Pt[], toward: Pt, factor: number): Pt[] => poly.map(([x, y]) => [toward[0] + (x - toward[0]) * factor, toward[1] + (y - toward[1]) * factor]);

register({
  id: 'tessellation',
  label: 'Facettes (Delaunay / Voronoï)',
  family: 'abstract',
  tags: ['cristal', 'crystal', 'gemme', 'gem', 'bijou', 'jewel', 'réseau', 'network', 'technologie', 'tech', 'données', 'data', 'mosaïque', 'structure', 'architecture', 'minerai', 'mining'],
  tones: 2,
  style: 'modular',
  params: {
    mode: opt(['delaunay', 'voronoi']),
    order: num(3, 8, 6, true),
    points: num(1, 3, 2, true),
    gap: num(0.04, 0.2, 0.1),
  },
  build: (p, { kernel, rng }) => {
    const order = p.order as number;
    const { sites, ring } = symmetricSites(order, p.points as number, rng);
    const tris = delaunay(sites);
    const keep = 1 - (p.gap as number);
    const parts: GenPart[] = [];
    const disc = kernel.fromPath(circlePath(50, 50, 46));
    if (p.mode === 'voronoi') {
      // Cellule d'un site intérieur : les centres des cercles circonscrits de ses triangles, triés par angle.
      for (let i = 0; i < ring; i++) {
        const centers = tris
          .filter((t) => t.includes(i))
          .map((t) => circumcircle(sites[t[0]], sites[t[1]], sites[t[2]]))
          .filter((c): c is NonNullable<typeof c> => !!c)
          .map((c) => [c.x, c.y] as Pt);
        if (centers.length < 3) continue;
        const site = sites[i];
        centers.sort((a, b) => Math.atan2(a[1] - site[1], a[0] - site[0]) - Math.atan2(b[1] - site[1], b[0] - site[0]));
        const cell = kernel.fromPath(polyPath(shrink(centers, site, keep)));
        const clipped = cell && disc ? kernel.combine('intersect', cell, disc) : cell;
        if (clipped) parts.push({ d: clipped.d, tone: i === 0 ? 'b' : 'a' });
      }
    } else {
      tris.forEach((t) => {
        const tri: Pt[] = [sites[t[0]], sites[t[1]], sites[t[2]]];
        const c: Pt = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
        // Deux tons en alternance par secteur : la symétrie de rotation reste lisible.
        const sector = Math.floor(((Math.atan2(c[1] - 50, c[0] - 50) + Math.PI * 2.5) % (Math.PI * 2)) / ((Math.PI * 2) / order));
        parts.push({ d: polyPath(shrink(tri, c, keep)), tone: sector % 2 ? 'b' : 'a' });
      });
    }
    return parts;
  },
});
