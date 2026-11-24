/**
 * GÉOMÉTRIES AFRICAINES — des systèmes de construction, jamais des symboles recopiés.
 *
 * LUSONA (sona au singulier) : dessins sur sable des Tchokwe du nord-est de l'Angola. Le dessinateur
 * pose une grille de points, puis trace d'un seul geste une ligne qui contourne les points et
 * « rebondit » sur le cadre comme un rayon de lumière sur un miroir. Paulus Gerdes (Geometry from
 * Africa, 1999) a montré que ces dessins sont des COURBES-MIROIRS : une trajectoire diagonale dans
 * une grille, réfléchie par le bord et par des miroirs placés entre deux points. L'idéal du sona est
 * MONOLINÉAIRE : une seule courbe fermée qui passe partout.
 *
 * Construction (coordonnées doublées, entières) :
 *   points      (2i, 2j), 0 ≤ i < m, 0 ≤ j < n
 *   nœuds       milieux entre deux points voisins (X + Y impair), cadre en X = −1, 2m − 1, Y = −1, 2n − 1
 *   trajet      pas diagonaux (±1, ±1) d'un nœud au suivant
 *   réflexion   sur le cadre ; sur un miroir « h » (le long des deux points) dy s'inverse, « v » dx
 *   miroirs     posés par orbites d'un groupe de symétrie (D2, ou C4 sur grille carrée) : le dessin
 *               entier hérite de cette symétrie
 *   lissage     courbe de Bézier quadratique : points de contrôle sur les nœuds, passages aux milieux
 *               — la ligne s'arrondit autour des points comme le doigt dans le sable
 */
import { circlePath } from '../../kernel/primitives';
import type { GenPart } from './registry';
import { bool, num, opt, register } from './registry';

type Mirror = 'h' | 'v';

interface Grid {
  m: number;
  n: number;
  mirrors: Map<string, Mirror>;
}

const key = (x: number, y: number) => `${x},${y}`;

/** Le nœud existe-t-il (dans le cadre, X + Y impair) ? */
function isNode(g: Grid, x: number, y: number): boolean {
  if ((x + y) % 2 === 0) return false;
  if (x < -1 || y < -1 || x > 2 * g.m - 1 || y > 2 * g.n - 1) return false;
  const onX = x === -1 || x === 2 * g.m - 1;
  const onY = y === -1 || y === 2 * g.n - 1;
  if (onX && onY) return false;
  if (onX) return y >= 0 && y <= 2 * g.n - 2;
  if (onY) return x >= 0 && x <= 2 * g.m - 2;
  return true;
}

/** Direction de sortie à un nœud, selon la direction d'arrivée. */
function bounce(g: Grid, x: number, y: number, dx: number, dy: number): [number, number] {
  if (x === -1 || x === 2 * g.m - 1) return [-dx, dy];
  if (y === -1 || y === 2 * g.n - 1) return [dx, -dy];
  const mirror = g.mirrors.get(key(x, y));
  if (mirror === 'h') return [dx, -dy];
  if (mirror === 'v') return [-dx, dy];
  return [dx, dy];
}

const edgeKey = (ax: number, ay: number, bx: number, by: number) => (ax < bx || (ax === bx && ay < by) ? `${ax},${ay}|${bx},${by}` : `${bx},${by}|${ax},${ay}`);

/** Toutes les courbes fermées de la grille (chaque segment diagonal parcouru une fois). */
export function traceMirrorCurves(g: Grid): [number, number][][] {
  const used = new Set<string>();
  const curves: [number, number][][] = [];
  const nodes: [number, number][] = [];
  for (let x = -1; x <= 2 * g.m - 1; x++) for (let y = -1; y <= 2 * g.n - 1; y++) if (isNode(g, x, y)) nodes.push([x, y]);
  for (const [sx, sy] of nodes)
    for (const [ddx, ddy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (!isNode(g, sx + ddx, sy + ddy) || used.has(edgeKey(sx, sy, sx + ddx, sy + ddy))) continue;
      const points: [number, number][] = [];
      let [x, y, dx, dy] = [sx, sy, ddx, ddy];
      for (let guard = 0; guard < 4 * nodes.length + 8; guard++) {
        const nx = x + dx;
        const ny = y + dy;
        used.add(edgeKey(x, y, nx, ny));
        points.push([nx, ny]);
        [dx, dy] = bounce(g, nx, ny, dx, dy);
        x = nx;
        y = ny;
        // La dynamique est réversible : on revient forcément au nœud de départ avec la sortie de départ.
        if (x === sx && y === sy && dx === ddx && dy === ddy) break;
      }
      curves.push(points);
    }
  return curves;
}

/** Les nœuds intérieurs, regroupés en orbites du groupe de symétrie (même type de miroir dans une orbite). */
function orbits(m: number, n: number, sym: 'd2' | 'c4'): { nodes: [number, number][]; swap: boolean[] }[] {
  const seen = new Set<string>();
  const out: { nodes: [number, number][]; swap: boolean[] }[] = [];
  for (let x = 0; x <= 2 * m - 2; x++)
    for (let y = 0; y <= 2 * n - 2; y++) {
      if ((x + y) % 2 === 0 || seen.has(key(x, y))) continue;
      let members: [number, number, boolean][];
      if (sym === 'c4' && m === n) {
        const s = 2 * m - 2;
        // Rotation d'un quart de tour : (x, y) → (s − y, x) ; un miroir « h » devient « v ».
        members = [[x, y, false], [s - y, x, true], [s - x, s - y, false], [y, s - x, true]];
      } else {
        members = [[x, y, false], [2 * m - 2 - x, y, false], [x, 2 * n - 2 - y, false], [2 * m - 2 - x, 2 * n - 2 - y, false]];
      }
      const unique = members.filter(([a, b], i) => members.findIndex(([c, d]) => c === a && d === b) === i);
      unique.forEach(([a, b]) => seen.add(key(a, b)));
      out.push({ nodes: unique.map(([a, b]) => [a, b]), swap: unique.map(([, , s]) => s) });
    }
  return out;
}

/**
 * Cherche des miroirs symétriques donnant le moins de courbes possible (1 = sona monolinéaire),
 * près de la densité visée. Graine fixe : même entrée, même dessin.
 */
export function solveSona(m: number, n: number, density: number, sym: 'd2' | 'c4', rng: () => number, tries = 80): { grid: Grid; curves: [number, number][][] } {
  const groups = orbits(m, n, sym);
  let best: { grid: Grid; curves: [number, number][][]; cost: number } | null = null;
  for (let t = 0; t < tries; t++) {
    const mirrors = new Map<string, Mirror>();
    const p = t === 0 ? 0 : density * (0.6 + rng() * 0.8);
    for (const orbit of groups) {
      if (rng() >= p) continue;
      const type: Mirror = rng() < 0.5 ? 'h' : 'v';
      orbit.nodes.forEach(([x, y], i) => mirrors.set(key(x, y), orbit.swap[i] ? (type === 'h' ? 'v' : 'h') : type));
    }
    const grid = { m, n, mirrors };
    const curves = traceMirrorCurves(grid);
    const cost = (curves.length - 1) * 10 + Math.abs(mirrors.size / Math.max(1, groups.length * 2) - density);
    if (!best || cost < best.cost) best = { grid, curves, cost };
    if (curves.length === 1 && mirrors.size > 0) break;
  }
  return best!;
}

/** Une courbe fermée lissée : contrôles sur les nœuds, passages aux milieux. */
function smoothClosed(points: [number, number][], map: (p: [number, number]) => [number, number]): string {
  const pts = points.map(map);
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const f = (v: number) => Math.round(v * 100) / 100;
  const start = mid(pts[pts.length - 1], pts[0]);
  let d = `M${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < pts.length; i++) {
    const next = mid(pts[i], pts[(i + 1) % pts.length]);
    d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(next[0])} ${f(next[1])}`;
  }
  return d + 'Z';
}

register({
  id: 'lusona',
  label: 'Sona (courbe-miroir tchokwe)',
  family: 'abstract',
  tags: ['afrique', 'africa', 'culture', 'tradition', 'héritage', 'heritage', 'récit', 'story', 'communauté', 'community', 'lien', 'connexion', 'connection', 'savoir', 'knowledge', 'éducation', 'artisanat', 'réseau', 'network'],
  tones: 2,
  stroked: true,
  style: 'monoline',
  params: {
    cols: num(2, 6, 3, true),
    rows: num(2, 6, 3, true),
    density: num(0, 0.7, 0.35),
    sym: opt(['d2', 'c4']),
    thick: num(0.16, 0.34, 0.24),
    dots: bool(true),
  },
  build: (p, { rng }) => {
    const m = p.cols as number;
    const n = p.rows as number;
    const sym = p.sym === 'c4' && m === n ? 'c4' : 'd2';
    const { curves } = solveSona(m, n, p.density as number, sym, rng);
    // La grille occupe ~78 % de la boîte ; le cadre de réflexion est à un demi-pas des points.
    const unit = 78 / Math.max(m, n);
    const ox = 50 - ((m - 1) / 2) * unit;
    const oy = 50 - ((n - 1) / 2) * unit;
    const map = ([x, y]: [number, number]): [number, number] => [ox + (x / 2) * unit, oy + (y / 2) * unit];
    const parts: GenPart[] = curves.map((c) => ({ d: smoothClosed(c, map), tone: 'a', stroke: unit * (p.thick as number) }));
    if (p.dots) {
      const r = unit * 0.1;
      const dots: string[] = [];
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) dots.push(circlePath(ox + i * unit, oy + j * unit, r));
      parts.push({ d: dots.join(''), tone: 'b' });
    }
    return parts;
  },
});
