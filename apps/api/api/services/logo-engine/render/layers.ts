/**
 * Résolution des couches : du Logo IR aux formes de la scène.
 *
 *   shape       une géométrie (rectangle, polygone, anneau, arc, tracé…)
 *   text        des contours de lettres, avec leur effet typographique (module A)
 *   generator   un symbole du catalogue (modules B et D)
 *   boolean     union, soustraction, intersection, exclusion : découpes, masques, espace négatif
 *   repeat      rosace, miroirs, rangées, grilles
 *   group       un ensemble de couches qui se déplace ensemble
 *
 * Tout passe par le noyau géométrique : la scène ne contient que des formes déjà construites.
 */
import type { BooleanLayer, GeneratorLayer, LogoLayer, LogoTransform, RepeatLayer, ShapeLayer, TextLayer } from '../ir/logo.schema';
import { around, centerOf, multiply, rotateBy, scaleBy, skewXBy, translate } from '../kernel/geometry';
import type { Matrix, Shape } from '../kernel/geometry';
import { geometryToPath } from '../kernel/primitives';
import { getGenerator, resolveParams, seeded } from './generators/registry';
import { BuildContext, inkOf, Paint, Part, Resolved, transformPart } from './scene';
import { resolveText } from './text';

const EMPTY: Resolved = { parts: [], ink: null };

const resolved = (parts: Part[]): Resolved => ({ parts, ink: inkOf(parts) });

/** Graine stable d'une couche : la graine du document et l'identifiant de la couche. */
export function layerSeed(docSeed: number, id: string): number {
  let h = 2166136261 ^ docSeed;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Applique une transformation de couche aux formes déjà résolues. */
export function applyTransform(parts: Part[], t: LogoTransform | undefined, ctx: BuildContext): Part[] {
  if (!t || !parts.length) return parts;
  const box = inkOf(parts);
  if (!box) return parts;
  const [cx, cy] = t.origin ?? centerOf(box);
  const sx = Array.isArray(t.scale) ? t.scale[0] : t.scale ?? 1;
  const sy = Array.isArray(t.scale) ? t.scale[1] : t.scale ?? 1;
  let m: Matrix = scaleBy((t.flipX ? -1 : 1) * sx, (t.flipY ? -1 : 1) * sy);
  if (t.skewX) m = multiply(skewXBy(t.skewX), m);
  if (t.rotate) m = multiply(rotateBy(t.rotate), m);
  m = multiply(translate(t.x ?? 0, t.y ?? 0), around(m, cx, cy));
  return parts.map((part) => transformPart(part, m, ctx.kernel));
}

/**
 * Retire de chaque forme précédente celles qui sont des découpes. Une découpe ne se dessine
 * jamais : elle ne sert qu'à creuser ce qui la précède (et qui la recouvre).
 */
export function cutShapes<T extends { shape: Shape }>(items: T[], isCut: (item: T) => boolean, ctx: BuildContext): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (!isCut(item)) {
      out.push(item);
      continue;
    }
    for (let i = 0; i < out.length; i++) {
      const target = out[i];
      const a = target.shape.bounds;
      const b = item.shape.bounds;
      const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      if (!overlaps) continue;
      const cut = ctx.kernel.combine('subtract', target.shape, item.shape);
      if (cut) {
        out[i] = { ...target, shape: cut };
        continue;
      }
      // Résultat vide : la découpe recouvre-t-elle entièrement la forme, ou le noyau a-t-il échoué ?
      const inter = ctx.kernel.combine('intersect', target.shape, item.shape);
      if (inter && ctx.kernel.area(inter) >= ctx.kernel.area(target.shape) * 0.98) {
        out.splice(i, 1);
        i -= 1;
      }
    }
  }
  return out;
}

/** Les parties d'une couche : celles peintes en `paper` creusent les précédentes. */
export const applyKnockouts = (parts: Part[], ctx: BuildContext): Part[] => cutShapes(parts, (p) => p.paint === 'paper', ctx);

/** Fond toutes les parties (hors découpes) en une seule forme ; les découpes sont retirées. */
function flatten(parts: Part[], ctx: BuildContext): Shape | null {
  const solid = parts.filter((p) => p.paint !== 'paper' && p.paint !== 'none');
  const cuts = parts.filter((p) => p.paint === 'paper');
  let acc: Shape | null = null;
  for (const part of solid) acc = acc ? ctx.kernel.combine('union', acc, part.shape) ?? acc : part.shape;
  if (!acc) return null;
  for (const cut of cuts) acc = ctx.kernel.combine('subtract', acc, cut.shape) ?? acc;
  return acc;
}

const baseFill = (layer: LogoLayer): Paint => (layer.fill === 'none' ? 'ink' : layer.fill);

function resolveShape(layer: ShapeLayer, ctx: BuildContext): Resolved {
  if (layer.geometry.type === 'path' && !ctx.allowFreePaths) {
    ctx.warnings.push({ code: 'free_path_refused', layerId: layer.id, message: 'Le dessin libre est réservé aux crans qui autorisent le dessin d\'auteur.' });
    return EMPTY;
  }
  const d = geometryToPath(layer.geometry);
  const shape = d ? ctx.kernel.fromPath(d) : null;
  if (!shape) {
    ctx.warnings.push({ code: 'geometry_invalid', layerId: layer.id, message: `La géométrie de « ${layer.id} » est vide ou illisible.` });
    return EMPTY;
  }
  return resolved([{ layerId: layer.id, role: layer.role, shape, paint: layer.fill, stroke: layer.stroke, opacity: layer.opacity }]);
}

function resolveGenerator(layer: GeneratorLayer, ctx: BuildContext): Resolved {
  const spec = getGenerator(layer.generator);
  if (!spec) {
    ctx.warnings.push({ code: 'generator_unknown', layerId: layer.id, message: `Générateur inconnu : « ${layer.generator} ».` });
    return EMPTY;
  }
  const params = resolveParams(spec, layer.params);
  const rng = seeded(layerSeed(ctx.doc.meta.seed, layer.id) ^ (layer.seed ?? 0));
  const main = baseFill(layer);
  const toPaint = { a: main, b: 'ink2', c: 'accent', knockout: 'paper' } as const;
  // Les découpes du générateur (yeux, nervures…) creusent ses propres formes, AVANT que la couche
  // ne reçoive sa couleur : un calque entier peint en `paper` reste une découpe pour son parent.
  const built = spec.build(params, { kernel: ctx.kernel, rng }).flatMap((g) => {
    const shape = ctx.kernel.fromPath(g.d);
    return shape ? [{ tone: g.tone, shape }] : [];
  });
  const parts: Part[] = cutShapes(built, (g) => g.tone === 'knockout', ctx).map((g) => ({ layerId: layer.id, role: layer.role, shape: g.shape, paint: toPaint[g.tone], stroke: layer.stroke, opacity: layer.opacity }));
  if (!parts.length) {
    ctx.warnings.push({ code: 'empty_layer', layerId: layer.id, message: `Le générateur « ${layer.generator} » n'a produit aucune forme.` });
    return EMPTY;
  }
  return resolved(parts);
}

function resolveBoolean(layer: BooleanLayer, ctx: BuildContext): Resolved {
  const operands = layer.operands.map((operand) => resolveLayer(operand, ctx)).map((r) => flatten(r.parts, ctx));
  const [first, ...rest] = operands;
  if (!first) {
    ctx.warnings.push({ code: 'boolean_failed', layerId: layer.id, message: `Le premier opérande de « ${layer.id} » est vide.` });
    return EMPTY;
  }
  let acc: Shape = first;
  for (const operand of rest) {
    if (!operand) {
      if (layer.op === 'intersect') {
        ctx.warnings.push({ code: 'boolean_failed', layerId: layer.id, message: `Un opérande de « ${layer.id} » est vide : l'intersection est vide.` });
        return EMPTY;
      }
      continue;
    }
    const next = ctx.kernel.combine(layer.op, acc, operand);
    if (!next) {
      ctx.warnings.push({ code: 'boolean_failed', layerId: layer.id, message: `L'opération « ${layer.op} » de « ${layer.id} » a donné une forme vide.` });
      if (layer.op === 'subtract') continue;
      return layer.op === 'union' ? resolved([{ layerId: layer.id, role: layer.role, shape: acc, paint: layer.fill, stroke: layer.stroke, opacity: layer.opacity }]) : EMPTY;
    }
    acc = next;
  }
  return resolved([{ layerId: layer.id, role: layer.role, shape: acc, paint: layer.fill, stroke: layer.stroke, opacity: layer.opacity }]);
}

function resolveRepeat(layer: RepeatLayer, ctx: BuildContext): Resolved {
  const child = resolveLayer(layer.child, ctx);
  if (!child.parts.length || !child.ink) return EMPTY;
  const copies: Part[][] = [];
  const copy = (m: Matrix) => child.parts.map((p) => ({ ...transformPart(p, m, ctx.kernel), layerId: layer.id }));
  const n = layer.count;
  const [cx, cy] = [50, 50];
  switch (layer.mode) {
    case 'radial':
      for (let i = 0; i < n; i++) copies.push(copy(around(rotateBy((360 / n) * i), cx, cy)));
      break;
    case 'mirror-x':
      copies.push(child.parts.map((p) => ({ ...p, layerId: layer.id })), copy(around(scaleBy(-1, 1), cx, cy)));
      break;
    case 'mirror-y':
      copies.push(child.parts.map((p) => ({ ...p, layerId: layer.id })), copy(around(scaleBy(1, -1), cx, cy)));
      break;
    case 'mirror-xy':
      copies.push(
        child.parts.map((p) => ({ ...p, layerId: layer.id })),
        copy(around(scaleBy(-1, 1), cx, cy)),
        copy(around(scaleBy(1, -1), cx, cy)),
        copy(around(scaleBy(-1, -1), cx, cy))
      );
      break;
    case 'linear':
      for (let i = 0; i < n; i++) copies.push(copy(translate(layer.radius * (i - (n - 1) / 2), 0)));
      break;
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(n));
      for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        copies.push(copy(translate(layer.radius * (col - (cols - 1) / 2), layer.radius * (row - (Math.ceil(n / cols) - 1) / 2))));
      }
      break;
    }
  }
  let parts = copies.flat();
  if (layer.merge) {
    const byPaint = new Map<string, Part>();
    for (const part of parts) {
      const key = `${part.paint}`;
      const held = byPaint.get(key);
      if (held) held.shape = ctx.kernel.combine('union', held.shape, part.shape) ?? held.shape;
      else byPaint.set(key, { ...part });
    }
    parts = [...byPaint.values()];
  }
  return resolved(parts);
}

/** Résout une couche (récursivement) en formes, transformation de couche comprise. */
export function resolveLayer(layer: LogoLayer, ctx: BuildContext): Resolved {
  if (layer.hidden) return EMPTY;
  let out: Resolved;
  switch (layer.kind) {
    case 'shape':
      out = resolveShape(layer, ctx);
      break;
    case 'generator':
      out = resolveGenerator(layer, ctx);
      break;
    case 'boolean':
      out = resolveBoolean(layer, ctx);
      break;
    case 'repeat':
      out = resolveRepeat(layer, ctx);
      break;
    case 'group': {
      const parts = layer.children.flatMap((child) => resolveLayer(child, ctx).parts);
      out = resolved(applyKnockouts(parts, ctx));
      break;
    }
    case 'text': {
      const text = layer as TextLayer;
      const placed: TextLayer = text.at || text.curve ? text : { ...text, at: { x: 50, y: 50 } };
      const result = resolveText(placed, ctx, placed.size ?? 30);
      out = result ? resolved(result.parts) : EMPTY;
      break;
    }
  }
  if (!out.parts.length) return out;
  return resolved(applyTransform(out.parts, layer.transform, ctx));
}
