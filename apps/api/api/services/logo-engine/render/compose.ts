/**
 * MODULE C — COMPOSITION : placer le symbole, le nom et la ligne d'accroche.
 *
 * L'auteur du Logo IR ne donne aucune coordonnée pour le nom : la composition le pose d'après
 * des règles de métier — hauteur du symbole en multiples de la hauteur de capitale, espace en
 * fraction de la hauteur du symbole, centrage optique du nom sur le symbole, marge de sécurité.
 *
 *   horizontal   symbole à gauche, nom centré sur lui
 *   stacked      symbole au-dessus, nom centré dessous
 *   symbol-only  le symbole (et son cadre) seul
 *   wordmark-only le nom seul, avec sa ligne d'accroche
 */
import type { LogoComposition, LogoDocument, TextLayer } from '../ir/logo.schema';
import { centerOf, multiply, scaleBy, translate } from '../kernel/geometry';
import type { Matrix, Rect } from '../kernel/geometry';
import { applyKnockouts, applyTransform } from './layers';
import { resolveLayer } from './layers';
import { BuildContext, inkOf, Part, rectUnion, transformPart } from './scene';
import { resolveText } from './text';

/** Hauteur de capitale du nom dans le repère de composition (le résultat est remis à l'échelle ensuite). */
export const CAP = 30;

export type Layout = 'horizontal' | 'stacked' | 'symbol-only' | 'wordmark-only';

export interface Groups {
  /** Couches symbole et cadre (et textes placés par `at` / `curve`). */
  symbol: Part[];
  /** Une entrée par ligne de nom. */
  wordmark: { parts: Part[]; ink: Rect; cap: number }[];
  tagline: { parts: Part[]; ink: Rect; cap: number }[];
}

export interface ComposedScene {
  parts: Part[];
  width: number;
  height: number;
  layout: Layout;
  /** Boîtes d'encre finales de chaque groupe (pour les contrôles : équilibre, symbole seul…). */
  boxes: { symbol: Rect | null; wordmark: Rect | null; tagline: Rect | null; all: Rect };
  /** Parties finales par groupe. */
  groups: { symbol: Part[]; wordmark: Part[]; tagline: Part[] };
}

const isComposedText = (layer: { kind: string; role: string; at?: unknown; curve?: unknown }) =>
  layer.kind === 'text' && (layer.role === 'wordmark' || layer.role === 'tagline') && !layer.at && !layer.curve;

/** Résout toutes les couches de premier niveau et les range par groupe. */
export function resolveGroups(doc: LogoDocument, ctx: BuildContext): Groups {
  const groups: Groups = { symbol: [], wordmark: [], tagline: [] };
  const taglineCap = CAP * doc.composition.taglineScale;
  for (const layer of doc.layers) {
    if (layer.hidden) continue;
    if (isComposedText(layer as never)) {
      const text = layer as TextLayer;
      const cap = text.role === 'tagline' ? taglineCap : CAP;
      const result = resolveText(text, ctx, cap);
      if (!result) continue;
      const parts = applyTransform(result.parts, text.transform, ctx);
      const ink = inkOf(parts);
      if (!ink) continue;
      (text.role === 'tagline' ? groups.tagline : groups.wordmark).push({ parts, ink, cap });
      continue;
    }
    groups.symbol.push(...resolveLayer(layer, ctx).parts);
  }
  groups.symbol = applyKnockouts(groups.symbol, ctx);
  return groups;
}

export function resolveLayout(composition: LogoComposition, groups: Groups): Layout {
  const hasSymbol = groups.symbol.length > 0;
  const hasWord = groups.wordmark.length > 0;
  const requested = composition.layout;
  if (requested === 'symbol-only') return hasSymbol ? 'symbol-only' : 'wordmark-only';
  if (requested === 'wordmark-only') return hasWord ? 'wordmark-only' : 'symbol-only';
  if (!hasWord) return 'symbol-only';
  if (!hasSymbol) return 'wordmark-only';
  return requested === 'stacked' ? 'stacked' : 'horizontal';
}

const moveBy = (parts: Part[], m: Matrix, ctx: BuildContext) => parts.map((p) => transformPart(p, m, ctx.kernel));

/** Empile des lignes de texte (leurs lignes de base séparées de `leading`), alignées à gauche ou au centre. */
function stackLines(lines: { parts: Part[]; ink: Rect; cap: number }[], align: 'center' | 'start', leading: number, ctx: BuildContext): { parts: Part[]; ink: Rect } | null {
  if (!lines.length) return null;
  const width = Math.max(...lines.map((l) => l.ink.w));
  const out: Part[] = [];
  lines.forEach((line, i) => {
    const dx = (align === 'center' ? (width - line.ink.w) / 2 : 0) - line.ink.x;
    out.push(...moveBy(line.parts, translate(dx, i * leading), ctx));
  });
  const ink = inkOf(out);
  return ink ? { parts: out, ink } : null;
}

export function composeScene(doc: LogoDocument, groups: Groups, ctx: BuildContext, layoutOverride?: Layout): ComposedScene | null {
  const comp = doc.composition;
  const layout = layoutOverride ?? resolveLayout(comp, groups);
  const symbolInk = inkOf(groups.symbol);

  let word = layout === 'symbol-only' ? null : stackLines(groups.wordmark, comp.align, CAP * 1.35, ctx);
  let tag = layout === 'symbol-only' ? null : stackLines(groups.tagline, comp.align, CAP * 0.6, ctx);

  const placed: { symbol: Part[]; wordmark: Part[]; tagline: Part[] } = { symbol: [], wordmark: [], tagline: [] };

  // Texte seul (ou texte + accroche) : le nom est le logo.
  const layoutTextBlock = (originX: number, originY: number, centerOnY: boolean) => {
    if (!word) return;
    const gapTag = CAP * 0.5;
    const wordBox = word.ink;
    let wordShift = translate(originX - wordBox.x, originY - (centerOnY ? wordBox.y + wordBox.h / 2 : wordBox.y));
    if (tag) {
      const wordWidth = wordBox.w;
      const tagW = tag.ink.w;
      const blockH = wordBox.h + gapTag + tag.ink.h;
      if (centerOnY) wordShift = translate(originX - wordBox.x, originY - blockH / 2 - wordBox.y);
      const wordMoved = moveBy(word.parts, wordShift, ctx);
      const wb = inkOf(wordMoved)!;
      const tagDx = comp.align === 'center' ? wb.x + (wordWidth - tagW) / 2 - tag.ink.x : wb.x - tag.ink.x;
      const tagMoved = moveBy(tag.parts, translate(tagDx, wb.y + wb.h + gapTag - tag.ink.y), ctx);
      placed.wordmark = wordMoved;
      placed.tagline = tagMoved;
    } else {
      placed.wordmark = moveBy(word.parts, wordShift, ctx);
    }
  };

  if (layout === 'symbol-only' || !word) {
    if (!symbolInk) return null;
    const f = 100 / Math.max(symbolInk.w, symbolInk.h);
    placed.symbol = moveBy(groups.symbol, multiply(scaleBy(f), translate(-symbolInk.x, -symbolInk.y)), ctx);
    word = null;
    tag = null;
  } else if (layout === 'wordmark-only' || !symbolInk) {
    layoutTextBlock(0, 0, false);
  } else if (layout === 'horizontal') {
    const scale = comp.symbolScale ?? 2.7;
    const targetH = CAP * scale;
    let f = targetH / symbolInk.h;
    if (symbolInk.w * f > targetH * 1.9) f = (targetH * 1.9) / symbolInk.w;
    const m = multiply(scaleBy(f), translate(-symbolInk.x, -symbolInk.y - symbolInk.h / 2));
    placed.symbol = moveBy(groups.symbol, m, ctx);
    const sb = inkOf(placed.symbol)!;
    const gap = comp.gap * sb.h;
    const x0 = sb.x + sb.w + gap;
    if (groups.wordmark.length > 1 || tag) layoutTextBlock(x0, 0, true);
    // Une seule ligne : c'est le centre de la hauteur de capitale (et non de l'encre, descendantes comprises) qui se centre sur le symbole.
    else placed.wordmark = moveBy(word.parts, translate(x0 - word.ink.x, CAP / 2), ctx);
  } else {
    // stacked
    const scale = comp.symbolScale ?? 3.4;
    const targetH = CAP * scale;
    let f = targetH / symbolInk.h;
    const wordW = word.ink.w;
    if (symbolInk.w * f > wordW * 0.95) f = (wordW * 0.95) / symbolInk.w;
    const m = multiply(scaleBy(f), translate(-symbolInk.x - symbolInk.w / 2, -symbolInk.y - symbolInk.h));
    placed.symbol = moveBy(groups.symbol, m, ctx);
    const sb = inkOf(placed.symbol)!;
    const gap = Math.max(comp.gap, 0.12) * sb.h;
    // Le nom, centré sous le symbole.
    const wordLeft = comp.align === 'center' ? -word.ink.w / 2 : sb.x;
    const wordMoved = moveBy(word.parts, translate(wordLeft - word.ink.x, gap - word.ink.y), ctx);
    placed.wordmark = wordMoved;
    if (tag) {
      const wb = inkOf(wordMoved)!;
      const tagDx = comp.align === 'center' ? wb.x + (wb.w - tag.ink.w) / 2 - tag.ink.x : wb.x - tag.ink.x;
      placed.tagline = moveBy(tag.parts, translate(tagDx, wb.y + wb.h + CAP * 0.5 - tag.ink.y), ctx);
    }
  }

  const all = [...placed.symbol, ...placed.wordmark, ...placed.tagline];
  const box = inkOf(all);
  if (!box) return null;

  // Cadrage final : marge de sécurité, échelle à la largeur du canevas.
  const padRatio = comp.padding;
  const pad = padRatio * Math.min(box.w, box.h);
  const innerW = box.w + pad * 2;
  const innerH = box.h + pad * 2;
  const W = doc.canvas.width;
  let s = W / innerW;
  let H = innerH * s;
  let offX = 0;
  let offY = 0;
  if (doc.canvas.height !== 'auto') {
    const targetH = doc.canvas.height as number;
    s = Math.min(W / innerW, targetH / innerH);
    H = targetH;
    offX = (W - innerW * s) / 2;
    offY = (H - innerH * s) / 2;
  }
  const final = multiply(translate(offX, offY), multiply(scaleBy(s), translate(pad - box.x, pad - box.y)));
  const finalize = (parts: Part[]) => moveBy(parts, final, ctx);
  const groupsOut = { symbol: finalize(placed.symbol), wordmark: finalize(placed.wordmark), tagline: finalize(placed.tagline) };
  const finalBox = (parts: Part[]) => inkOf(parts);
  return {
    parts: [...groupsOut.symbol, ...groupsOut.wordmark, ...groupsOut.tagline],
    width: W,
    height: H,
    layout,
    boxes: {
      symbol: finalBox(groupsOut.symbol),
      wordmark: finalBox(groupsOut.wordmark),
      tagline: finalBox(groupsOut.tagline),
      all: { x: 0, y: 0, w: W, h: H },
    },
    groups: groupsOut,
  };
}

export { centerOf, rectUnion };
