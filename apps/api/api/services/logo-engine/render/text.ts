/**
 * MODULE A — TYPOGRAPHIE : une couche de texte devient des contours, avec son idée typographique.
 *
 * Wordmark, monogramme, lettre unique, ligature, lettrage personnalisé : tout part d'ici. Le
 * texte est posé lettre par lettre dans la police de la charte, puis UN effet (au plus trois)
 * lui donne sa signature — point d'accent, coupe, ligature, point de « i » remplacé, angle
 * entaillé, lettre ronde remplacée par un disque… Chaque effet est une opération géométrique
 * exacte sur les contours, jamais un dessin à main levée.
 */
import type { ColorRefValue, LogoTextEffect, TextLayer } from '../ir/logo.schema';
import { around, multiply, rotateBy, skewXBy, translate, unionRect } from '../kernel/geometry';
import type { Matrix, Rect, Shape } from '../kernel/geometry';
import { circlePath, polyPath, rectPath } from '../kernel/primitives';
import type { Pt } from '../kernel/primitives';
import { applyCase, layoutText } from '../kernel/typography';
import type { EngineFont } from '../kernel/typography';
import { BuildContext, fontKey, Paint, Part } from './scene';

export interface TextResult {
  parts: Part[];
  /** Boîte d'encre. La ligne de base est en y = 0. */
  ink: Rect;
  capHeight: number;
  /** Largeur d'avance (sans les décorations) : sert à l'alignement optique. */
  advance: number;
}

/** La police d'une couche de texte, chargée en amont. */
export function fontForLayer(layer: TextLayer, ctx: BuildContext): EngineFont | undefined {
  const spec = layer.font.family ? { family: layer.font.family } : layer.font.role === 'body' ? ctx.fonts.body ?? ctx.fonts.display : ctx.fonts.display;
  return ctx.loaded.get(fontKey(spec.family, layer.font.weight));
}

/** Les (famille, graisse) qu'une couche de texte demandera : le moteur les charge avant de résoudre. */
export function fontRequest(layer: TextLayer, ctx: Pick<BuildContext, 'fonts'>): { family: string; weight: number; cssUrl?: string } {
  const spec = layer.font.family ? { family: layer.font.family, cssUrl: undefined } : layer.font.role === 'body' ? ctx.fonts.body ?? ctx.fonts.display : ctx.fonts.display;
  return { family: spec.family, weight: layer.font.weight, cssUrl: (spec as { cssUrl?: string }).cssUrl };
}

const DOT_CHARS = new Set(['i', 'j', 'ï', 'î', 'í', 'ì', 'ī', 'ĩ', 'ĭ', 'į']);
const ROUND_CHARS = new Set(['o', 'O', '0', 'Q', 'D']);

interface GlyphPart {
  index: number;
  char: string;
  shapes: { shape: Shape; paint: Paint }[];
}

function unionAll(kernel: BuildContext['kernel'], shapes: Shape[]): Shape | null {
  let acc: Shape | null = null;
  for (const shape of shapes) acc = acc ? kernel.combine('union', acc, shape) ?? acc : shape;
  return acc;
}

/** Remplacement du point d'un « i » : la forme est centrée sur le point d'origine. */
function dotShape(kind: 'circle' | 'diamond' | 'square' | 'triangle' | 'leaf', cx: number, cy: number, size: number): string {
  const r = size / 2;
  switch (kind) {
    case 'circle':
      return circlePath(cx, cy, r);
    case 'square':
      return rectPath(cx - r, cy - r, size, size, size * 0.08);
    case 'diamond':
      return polyPath([[cx, cy - r * 1.2], [cx + r * 1.2, cy], [cx, cy + r * 1.2], [cx - r * 1.2, cy]]);
    case 'triangle':
      return polyPath([[cx, cy - r * 1.15], [cx + r * 1.1, cy + r * 0.85], [cx - r * 1.1, cy + r * 0.85]]);
    case 'leaf':
      return `M${cx - r} ${cy + r}C${cx - r} ${cy - r * 0.2} ${cx - r * 0.1} ${cy - r * 1.1} ${cx + r * 1.05} ${cy - r}C${cx + r * 1.05} ${cy + r * 0.2} ${cx + r * 0.1} ${cy + r * 1.1} ${cx - r} ${cy + r}Z`;
  }
}

function applyGlyphEffects(glyph: GlyphPart, effects: LogoTextEffect[], base: Paint, ctx: BuildContext, capHeight: number): void {
  const { kernel } = ctx;
  for (const effect of effects) {
    if (effect.type === 'accentChar' && effect.index === glyph.index) {
      glyph.shapes = glyph.shapes.map((s) => ({ ...s, paint: effect.color }));
    }
    if (effect.type === 'cutCorner' && effect.index === glyph.index) {
      const union = unionAll(kernel, glyph.shapes.map((s) => s.shape));
      if (!union) continue;
      const b = union.bounds;
      const s = effect.size * Math.min(b.w, b.h);
      const x = effect.corner === 'tl' || effect.corner === 'bl' ? b.x : b.x + b.w;
      const y = effect.corner === 'tl' || effect.corner === 'tr' ? b.y : b.y + b.h;
      const sx = effect.corner === 'tl' || effect.corner === 'bl' ? 1 : -1;
      const sy = effect.corner === 'tl' || effect.corner === 'tr' ? 1 : -1;
      const cut = kernel.fromPath(polyPath([[x - sx * 2, y - sy * 2], [x + sx * (s + 2), y - sy * 2], [x - sx * 2, y + sy * (s + 2)]]));
      if (!cut) continue;
      glyph.shapes = glyph.shapes.map((part) => ({ ...part, shape: kernel.combine('subtract', part.shape, cut) ?? part.shape }));
    }
    if (effect.type === 'swapRound' && effect.index === glyph.index && ROUND_CHARS.has(glyph.char)) {
      const union = unionAll(kernel, glyph.shapes.map((s) => s.shape));
      if (!union) continue;
      const b = union.bounds;
      const r = Math.min(b.w, b.h) / 2;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const outer = kernel.fromPath(circlePath(cx, cy, r));
      if (!outer) continue;
      const paint: Paint = effect.color ?? glyph.shapes[0]?.paint ?? base;
      if (effect.with === 'ring') {
        // L'épaisseur de l'anneau reprend celle du trait de la police (corps extérieur − contre-forme).
        const contours = kernel.contours(union).sort((a, c) => c.bounds.w - a.bounds.w);
        const hole = contours[1];
        const stroke = hole ? Math.max(r * 0.18, (contours[0].bounds.w - hole.bounds.w) / 2) : r * 0.3;
        const inner = kernel.fromPath(circlePath(cx, cy, Math.max(0.5, r - stroke)));
        const ring = inner ? kernel.combine('subtract', outer, inner) : outer;
        glyph.shapes = [{ shape: ring ?? outer, paint }];
      } else {
        glyph.shapes = [{ shape: outer, paint }];
      }
    }
    if (effect.type === 'dotReplace' && DOT_CHARS.has(glyph.char)) {
      const union = unionAll(kernel, glyph.shapes.map((s) => s.shape));
      if (!union) continue;
      const contours = kernel.contours(union);
      if (contours.length < 2) continue;
      const sorted = [...contours].sort((a, b) => a.bounds.y - b.bounds.y);
      const dot = sorted[0];
      const stem = sorted.slice(1);
      if (dot.bounds.h > capHeight * 0.45) continue;
      const size = Math.max(dot.bounds.w, dot.bounds.h) * (effect.shape === 'circle' ? 1.12 : 1.18);
      const replacement = kernel.fromPath(dotShape(effect.shape, dot.bounds.x + dot.bounds.w / 2, dot.bounds.y + dot.bounds.h / 2, size));
      const stemShape = unionAll(kernel, stem);
      if (!replacement || !stemShape) continue;
      glyph.shapes = [
        { shape: stemShape, paint: glyph.shapes[0]?.paint ?? base },
        { shape: replacement, paint: effect.color ?? 'accent' },
      ];
    }
  }
}

/** Décorations posées contre le mot (point, filet, barre). */
function decorations(effects: LogoTextEffect[], ink: Rect, capHeight: number, ctx: BuildContext, layerId: string, role: Part['role']): Part[] {
  const { kernel } = ctx;
  const parts: Part[] = [];
  const add = (d: string, paint: Paint) => {
    const shape = kernel.fromPath(d);
    if (shape) parts.push({ layerId, role, shape, paint });
  };
  for (const effect of effects) {
    if (effect.type === 'dot') {
      const r = capHeight * 0.15;
      const cx = ink.x + ink.w + capHeight * 0.12 + r;
      const cy = -r;
      const d = effect.shape === 'square' ? rectPath(cx - r, cy - r, r * 2, r * 2) : effect.shape === 'diamond' ? polyPath([[cx, cy - r * 1.3], [cx + r * 1.3, cy], [cx, cy + r * 1.3], [cx - r * 1.3, cy]]) : circlePath(cx, cy, r);
      add(d, effect.color ?? 'accent');
    }
    if (effect.type === 'underline') {
      const y = Math.max(ink.y + ink.h, capHeight * 0.12) + capHeight * 0.16;
      const h = capHeight * 0.12;
      add(rectPath(ink.x, y, ink.w * effect.span, h, h / 2), effect.color ?? 'accent');
    }
    if (effect.type === 'bar') {
      const w = capHeight * 0.18;
      add(rectPath(ink.x - capHeight * 0.44 - w, -capHeight, w, capHeight), effect.color ?? 'accent');
    }
  }
  return parts;
}

/**
 * Résout une couche de texte en contours.
 *
 * Sans `at` ni `curve`, le texte est rendu « au naturel » : début de l'encre en x = 0, ligne de
 * base en y = 0 — la composition le positionne. Avec `at`, il est centré dans la boîte de dessin ;
 * avec `curve`, il épouse un arc de cercle.
 */
export function resolveText(layer: TextLayer, ctx: BuildContext, capHeight: number): TextResult | null {
  const font = fontForLayer(layer, ctx);
  if (!font) {
    ctx.warnings.push({ code: 'font_unavailable', layerId: layer.id, message: `Police introuvable pour « ${layer.id} » : le texte ne peut pas être vectorisé.` });
    return null;
  }
  const effects = layer.effects ?? [];
  const ligature = effects.find((e): e is Extract<LogoTextEffect, { type: 'ligature' }> => e.type === 'ligature');
  const content = applyCase(layer.content, layer.case);
  const laid = layoutText(content, font, capHeight, layer.tracking, ligature ? -ligature.overlap * capHeight : 0);
  if (!laid) {
    ctx.warnings.push({ code: 'glyph_missing', layerId: layer.id, message: `Un caractère de « ${content} » n'existe pas dans la police ${font.family}.` });
    return null;
  }

  const { kernel } = ctx;
  const base: Paint = layer.fill;
  const glyphs: GlyphPart[] = [];
  for (const g of laid.glyphs) {
    if (!g.d) continue;
    const shape = kernel.fromPath(g.d);
    if (shape) glyphs.push({ index: g.index, char: g.char, shapes: [{ shape, paint: base }] });
  }
  for (const glyph of glyphs) applyGlyphEffects(glyph, effects, base, ctx, capHeight);

  let flat: { shape: Shape; paint: Paint; index: number }[] = glyphs.flatMap((g) => g.shapes.map((s) => ({ ...s, index: g.index })));

  if (ligature) {
    // Fond les lettres voisines de même couleur en une seule forme.
    const merged: typeof flat = [];
    for (const item of flat) {
      const last = merged[merged.length - 1];
      if (last && last.paint === item.paint) {
        const union = kernel.combine('union', last.shape, item.shape);
        if (union) {
          last.shape = union;
          continue;
        }
      }
      merged.push({ ...item });
    }
    flat = merged;
  }

  const slice = effects.find((e): e is Extract<LogoTextEffect, { type: 'slice' }> => e.type === 'slice');
  if (slice) {
    const gap = Math.max(0.6, capHeight * slice.gap);
    const y = -capHeight * (1 - slice.at) - gap / 2;
    const band = kernel.fromPath(rectPath(-capHeight, y, laid.width + capHeight * 4, gap));
    if (band) flat = flat.map((item) => ({ ...item, shape: kernel.combine('subtract', item.shape, band) ?? item.shape }));
  }

  const italic = effects.find((e): e is Extract<LogoTextEffect, { type: 'italic' }> => e.type === 'italic');
  const skew: Matrix | null = italic ? skewXBy(-italic.angle) : null;
  if (skew) flat = flat.map((item) => ({ ...item, shape: kernel.transform(item.shape, skew) }));

  const parts: Part[] = flat.map((item) => ({ layerId: layer.id, role: layer.role, shape: item.shape, paint: item.paint, stroke: layer.stroke, opacity: layer.opacity }));
  let ink = parts.reduce<Rect | null>((box, p) => unionRect(box, p.shape.bounds), null);
  if (!ink) return null;

  if (!layer.curve) {
    parts.push(...decorations(effects, ink, capHeight, ctx, layer.id, layer.role));
    ink = parts.reduce<Rect | null>((box, p) => unionRect(box, p.shape.bounds), null) ?? ink;
  }

  // Positionnement.
  if (layer.curve) {
    const { radius, start, side } = layer.curve;
    const cx = layer.at?.x ?? 50;
    const cy = layer.at?.y ?? 50;
    const placed: Part[] = [];
    for (const item of flat) {
      const glyph = laid.glyphs.find((g) => g.index === item.index);
      if (!glyph) continue;
      const mid = glyph.pen + glyph.advance / 2 - laid.width / 2;
      const arc = (mid / radius) * (180 / Math.PI);
      const dx = cx - (glyph.pen + glyph.advance / 2);
      const m: Matrix =
        side === 'top'
          ? around(rotateBy(start + arc), cx, cy)
          : around(rotateBy(start - arc), cx, cy);
      const lift = translate(dx, side === 'top' ? cy - radius : cy + radius);
      const full: Matrix = multiply(m, lift);
      placed.push({ layerId: layer.id, role: layer.role, shape: kernel.transform(item.shape, full), paint: item.paint, stroke: layer.stroke, opacity: layer.opacity });
    }
    const box = placed.reduce<Rect | null>((b, p) => unionRect(b, p.shape.bounds), null);
    if (!box || !placed.length) return null;
    return { parts: placed, ink: box, capHeight, advance: laid.width };
  }

  if (layer.at) {
    const dx = layer.at.x - (ink.x + ink.w / 2);
    const dy = layer.at.y + capHeight / 2;
    const m = translate(dx, dy);
    const moved = parts.map((p) => ({ ...p, shape: kernel.transform(p.shape, m) }));
    const box = moved.reduce<Rect | null>((b, p) => unionRect(b, p.shape.bounds), null) ?? ink;
    return { parts: moved, ink: box, capHeight, advance: laid.width };
  }

  return { parts, ink, capHeight, advance: laid.width };
}

export type { ColorRefValue };
