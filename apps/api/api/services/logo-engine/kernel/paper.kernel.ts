/**
 * Le noyau géométrique de production : Paper.js, sans DOM ni navigateur.
 *
 * `paper-core` fonctionne en Node pur pour tout ce dont un logo a besoin — opérations booléennes
 * (union, soustraction, intersection, exclusion), transformations, boîtes exactes, contours —
 * sans canvas ni jsdom. Les éléments Paper ne sortent jamais d'ici : le moteur ne voit que des
 * `Shape` (un tracé et sa boîte).
 */
import type {} from 'paper/dist/paper-core';
import type { BoolOp, GeometryKernel, Matrix, Rect, Shape } from './geometry';

/**
 * Charge `paper-core` SANS DOM. Par défaut, en Node, Paper démarre un jsdom complet et charge
 * `node-canvas` (un binaire natif qui entre en conflit avec libvips de sharp, et plus d'une
 * seconde de démarrage) alors qu'un logo n'a besoin que de sa géométrie. Paper n'y recourt que
 * si aucun objet `self` n'existe : on lui en prête un, minimal, le temps du chargement.
 */
function loadPaper(): typeof paper {
  const holder = globalThis as unknown as { self?: unknown };
  const had = 'self' in holder;
  const previous = holder.self;
  holder.self = { navigator: { userAgent: 'Node.js' } };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('paper/dist/paper-core');
  } finally {
    if (had) holder.self = previous;
    else delete holder.self;
  }
}

const paperCore = loadPaper();
const scope = new paperCore.PaperScope();
scope.setup(new scope.Size(1, 1));

/** Chiffres après la virgule des tracés produits (le SVG final repasse par SVGO). */
const PATH_PRECISION = 3;
/** Une forme dont les deux dimensions sont sous ce seuil est considérée comme vide. */
const EMPTY_EPS = 1e-4;

/** Élément Paper associé à chaque forme : évite de reparser le tracé à chaque opération. */
const ITEMS = new WeakMap<Shape, paper.PathItem>();

const METHODS: Record<BoolOp, 'unite' | 'subtract' | 'intersect' | 'exclude'> = {
  union: 'unite',
  subtract: 'subtract',
  intersect: 'intersect',
  exclude: 'exclude',
};

function pathDataOf(item: paper.PathItem): string {
  return (item as unknown as { getPathData(matrix?: unknown, precision?: number): string }).getPathData(undefined, PATH_PRECISION);
}

function wrap(item: paper.PathItem | null | undefined): Shape | null {
  if (!item) return null;
  const b = item.bounds;
  if (![b.x, b.y, b.width, b.height].every(Number.isFinite)) return null;
  if (b.width < EMPTY_EPS && b.height < EMPTY_EPS) return null;
  const d = pathDataOf(item);
  if (!d || !/[MmLlCcQqHhVvAaZz]/.test(d)) return null;
  const shape: Shape = { d, bounds: { x: b.x, y: b.y, w: b.width, h: b.height } };
  ITEMS.set(shape, item);
  return shape;
}

function closeAll(item: paper.PathItem): void {
  if (item instanceof scope.CompoundPath) item.children.forEach((child) => ((child as paper.Path).closed = true));
  else (item as paper.Path).closed = true;
}

function itemOf(shape: Shape): paper.PathItem | null {
  const cached = ITEMS.get(shape);
  if (cached) return cached;
  try {
    const parsed = new scope.CompoundPath({ pathData: shape.d, insert: false });
    closeAll(parsed);
    ITEMS.set(shape, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Aire pleine d'une forme. L'aire signée de Paper ne convient pas aux résultats composés : deux
 * croissants issus d'une exclusion ont des sens opposés et s'annuleraient. On somme donc l'aire de
 * chaque contour, en retranchant ceux qui sont contenus un nombre impair de fois (les trous).
 */
function areaOf(item: paper.PathItem): number {
  const area = (p: paper.PathItem) => Math.abs((p as unknown as { area: number }).area);
  if (!(item instanceof scope.CompoundPath)) return area(item);
  const kids = item.children as paper.Path[];
  const interior = (p: paper.Path) => (p as unknown as { interiorPoint: paper.Point }).interiorPoint;
  let total = 0;
  for (const kid of kids) {
    const point = interior(kid);
    const depth = kids.filter((other) => other !== kid && area(other) > area(kid) && (other as unknown as { contains(p: paper.Point): boolean }).contains(point)).length;
    total += (depth % 2 === 0 ? 1 : -1) * area(kid);
  }
  return Math.max(0, total);
}

const cloneOf = (item: paper.PathItem): paper.PathItem => item.clone({ insert: false }) as paper.PathItem;

export class PaperGeometryKernel implements GeometryKernel {
  readonly name = 'paper.js';

  fromPath(d: string): Shape | null {
    if (!d || typeof d !== 'string') return null;
    try {
      const item = new scope.CompoundPath({ pathData: d, insert: false });
      if (!item.children.length) return null;
      closeAll(item);
      return wrap(item);
    } catch {
      return null;
    }
  }

  transform(shape: Shape, m: Matrix): Shape {
    const item = itemOf(shape);
    if (!item) return shape;
    const copy = cloneOf(item);
    copy.transform(new scope.Matrix(m[0], m[1], m[2], m[3], m[4], m[5]));
    return wrap(copy) ?? shape;
  }

  combine(op: BoolOp, a: Shape, b: Shape): Shape | null {
    const left = itemOf(a);
    const right = itemOf(b);
    if (!left || !right) return null;
    const attempt = (nudge: number): Shape | null => {
      try {
        const operand = cloneOf(right);
        // Des arêtes parfaitement confondues font échouer les booléens : un décalage imperceptible les sépare.
        if (nudge) operand.translate(new scope.Point(nudge, nudge * 0.83));
        const result = (cloneOf(left) as paper.PathItem)[METHODS[op]](operand, { insert: false }) as paper.PathItem;
        const shape = wrap(result);
        return shape && areaOf(result) > EMPTY_EPS ? shape : null;
      } catch {
        return null;
      }
    };
    return attempt(0) ?? attempt(0.013) ?? attempt(-0.021);
  }

  area(shape: Shape): number {
    const item = itemOf(shape);
    return item ? areaOf(item) : 0;
  }

  contours(shape: Shape): Shape[] {
    const item = itemOf(shape);
    if (!item) return [];
    if (item instanceof scope.CompoundPath && item.children.length > 1) {
      return item.children.map((child) => wrap(cloneOf(child as paper.PathItem))).filter((s): s is Shape => !!s);
    }
    return [shape];
  }
}

let shared: GeometryKernel | null = null;

/** Le noyau partagé du processus. */
export function defaultKernel(): GeometryKernel {
  if (!shared) shared = new PaperGeometryKernel();
  return shared;
}

export type { Rect };
