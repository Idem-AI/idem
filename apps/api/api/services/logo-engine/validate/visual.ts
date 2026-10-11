/**
 * VALIDATION VISUELLE DÉTERMINISTE — ce qu'un code peut mesurer d'un logo avant de le montrer.
 *
 *   petite taille     rendu à 16, 24, 32 et 64 px : l'encre reste-t-elle solide, ou devient-elle
 *                     une bouillie pâle ?
 *   fonds clair/sombre contraste de l'encre dominante sur blanc ; la variante inversée sur fond sombre
 *   symbole seul      le symbole tient-il sans le nom (taille, proportions) ?
 *   équilibre         centre de masse, alignement symbole/nom, hiérarchie, respiration
 *   typographie       une ou deux familles, deux graisses au plus
 *   simplicité        budget de nœuds et de couleurs adapté au type de logo
 *
 * Ces mesures ne jugent pas la beauté : elles disent si le logo est exploitable. Un évaluateur
 * multimodal (`critic.ts`) regarde le reste, et ne remplace jamais ces contrôles.
 */
import type { ConceptType, LogoDocument } from '../ir/logo.schema';
import { walkLayers } from '../ir/logo.schema';
import type { RenderedLogo } from '../render/build';
import { LogoSession } from '../render/build';
import { DARK_BACKGROUND, LIGHT_BACKGROUND, paletteColors, resolvePaint } from '../render/svg';
import type { Part } from '../render/scene';
import { centerOfMass, inkBox, inkCoverage, solidRatio } from '../raster/measure';
import type { Rasterizer } from '../raster/rasterizer';
import { defaultRasterizer } from '../raster/rasterizer';
import { contrast } from '../util/colors';
import type { Defect } from './technical';

/** Tailles testées (largeur en pixels). */
export const LEGIBILITY_SIZES = [16, 24, 32, 64] as const;

/** Seuils : en dessous, le défaut est signalé ; `blocker` seulement quand le logo n'est plus utilisable. */
export const THRESHOLDS = {
  solid24: 0.7,
  solid16Blocker: 0.45,
  symbolCoverage: 0.06,
  contrastDominant: 3,
  contrastAccent: 1.5,
  balanceX: 0.09,
  balanceY: 0.09,
  alignY: 0.12,
} as const;

/** Budget de nœuds du SYMBOL (hors lettres) selon le type : la simplicité est une contrainte de conception. */
export const NODE_BUDGET: Record<ConceptType, number> = {
  minimal: 70,
  abstract: 260,
  pictorial: 260,
  'negative-space': 300,
  mascot: 340,
  combination: 300,
  emblem: 700,
  dynamic: 300,
  lettermark: 520,
  letterform: 520,
  wordmark: 0,
};

export const COLOR_BUDGET: Record<ConceptType, number> = {
  minimal: 2,
  abstract: 3,
  pictorial: 3,
  'negative-space': 2,
  mascot: 4,
  combination: 3,
  emblem: 3,
  dynamic: 4,
  lettermark: 3,
  letterform: 3,
  wordmark: 3,
};

/** Types dont le symbole doit exister et se reconnaître seul. */
const SYMBOL_TYPES = new Set<ConceptType>(['pictorial', 'abstract', 'mascot', 'combination', 'emblem', 'negative-space', 'dynamic', 'minimal']);

export interface VisualReport {
  defects: Defect[];
  metrics: Record<string, number>;
}

const nodesOf = (parts: Part[]) => parts.reduce((n, p) => n + (p.shape.d.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length, 0);

export async function assessVisual(
  session: LogoSession,
  rendered: RenderedLogo,
  options: { rasterizer?: Rasterizer; symbolSvg?: string | null } = {}
): Promise<VisualReport> {
  const doc: LogoDocument = session.doc;
  const raster = options.rasterizer ?? defaultRasterizer();
  const defects: Defect[] = [];
  const metrics: Record<string, number> = {};
  const add = (code: string, message: string, severity: Defect['severity'] = 'warn', layerId?: string) => defects.push({ code, severity, message, layerId });

  // ── Petite taille ──
  // La taille est celle de la HAUTEUR : un nom en ligne rendu à 16 px de large n'a aucun sens
  // (il faudrait le lire en 3 px de haut). On garde la hauteur jusqu'à un rapport de 4:1.
  const aspect = Math.min(4, Math.max(1, rendered.width / rendered.height));
  for (const size of LEGIBILITY_SIZES) {
    const image = await raster.render(rendered.svg, Math.round(size * aspect), null);
    metrics[`solid${size}`] = round(solidRatio(image));
    metrics[`coverage${size}`] = round(inkCoverage(image));
  }
  if (metrics.solid16 < THRESHOLDS.solid16Blocker) add('illegible_small', `À 16 px, seulement ${pct(metrics.solid16)} de l'encre est solide : le logo devient une tache pâle.`, 'warn');
  if (metrics.solid24 < THRESHOLDS.solid24) add('thin_details', `À 24 px, ${pct(metrics.solid24)} de l'encre est solide (≥ ${pct(THRESHOLDS.solid24)} attendu) : traits ou détails trop fins.`, 'warn');
  if (metrics.coverage32 < 0.025) add('too_faint', 'À 32 px le logo couvre moins de 2,5 % du canevas : il disparaît.', 'warn');

  // ── Contraste : encre dominante sur fond clair, déclinaison inversée sur fond sombre ──
  const areas = new Map<string, number>();
  for (const part of rendered.scene.parts) {
    const color = resolvePaint(part.paint, { palette: doc.palette });
    if (!color) continue;
    areas.set(color, (areas.get(color) ?? 0) + session.area(part.shape));
  }
  const ranked = [...areas.entries()].sort((a, b) => b[1] - a[1]);
  metrics.colors = ranked.length;
  if (ranked.length) {
    const [dominant] = ranked[0];
    metrics.contrastDominant = round(contrast(dominant, LIGHT_BACKGROUND));
    if (metrics.contrastDominant < THRESHOLDS.contrastDominant) add('low_contrast_ink', `La couleur dominante ${dominant} n'a que ${metrics.contrastDominant}:1 de contraste sur fond clair (≥ ${THRESHOLDS.contrastDominant}:1 attendu).`, 'warn');
    for (const [color, area] of ranked.slice(1)) {
      if (area / ranked[0][1] < 0.02) continue; // un point d'accent minuscule n'a pas à porter la lisibilité
      if (contrast(color, LIGHT_BACKGROUND) < THRESHOLDS.contrastAccent) add('low_contrast_accent', `La couleur ${color} se perd sur fond clair (${round(contrast(color, LIGHT_BACKGROUND))}:1).`, 'warn');
    }
  }
  const dark = session.render({ mode: 'inverted' });
  if (dark) {
    const inkOnDark = [...new Set(dark.scene.parts.map((p) => resolvePaint(p.paint, { palette: doc.palette, mode: 'inverted' })).filter(Boolean) as string[])];
    metrics.minContrastDark = round(Math.min(...inkOnDark.map((c) => contrast(c, DARK_BACKGROUND))));
    if (metrics.minContrastDark < 3) add('low_contrast_dark', `Sur fond sombre, une couleur n'atteint que ${metrics.minContrastDark}:1.`, 'warn');
  }

  // ── Symbole seul ──
  const hasSymbol = rendered.scene.groups.symbol.length > 0;
  if (SYMBOL_TYPES.has(doc.concept.type) && !hasSymbol) add('missing_symbol', `Un logo « ${doc.concept.type} » doit porter un symbole : seule la typographie est présente.`, 'blocker');
  if (hasSymbol) {
    const symbolSvg = options.symbolSvg ?? session.render({ layout: 'symbol-only' })?.svg;
    if (symbolSvg) {
      const img = await raster.render(symbolSvg, 64, null);
      metrics.symbolCoverage64 = round(inkCoverage(img));
      metrics.symbolSolid32 = round(solidRatio(await raster.render(symbolSvg, 32, null)));
      if (metrics.symbolCoverage64 < THRESHOLDS.symbolCoverage) add('symbol_too_faint', `Le symbole seul couvre ${pct(metrics.symbolCoverage64)} du canevas à 64 px : il ne se reconnaît pas sans le nom.`, 'warn');
      if (metrics.symbolSolid32 < THRESHOLDS.solid24) add('symbol_thin', 'Le symbole seul perd ses détails à 32 px (favicon, avatar).', 'warn');
    }
  }

  // ── Équilibre, alignement, hiérarchie ──
  const full = await raster.render(rendered.svg, 256, null);
  const mass = centerOfMass(full);
  if (mass) {
    metrics.massX = round(mass.x - 0.5);
    metrics.massY = round(mass.y - 0.5);
    const horizontal = rendered.layout === 'horizontal';
    if (!horizontal && Math.abs(metrics.massX) > THRESHOLDS.balanceX) add('unbalanced_x', `Le centre de masse est décalé de ${pct(Math.abs(metrics.massX))} horizontalement.`, 'warn');
    if (Math.abs(metrics.massY) > THRESHOLDS.balanceY && rendered.layout !== 'stacked') add('unbalanced_y', `Le centre de masse est décalé de ${pct(Math.abs(metrics.massY))} verticalement.`, 'warn');
  }
  const box = inkBox(full);
  if (box) {
    const margin = Math.min(box.x0, box.y0, 1 - box.x1, 1 - box.y1);
    metrics.margin = round(margin);
    if (margin < 0.015) add('no_breathing_room', 'L\'encre touche le bord du canevas : aucune marge de sécurité.', 'warn');
  }
  const { symbol, wordmark } = rendered.scene.boxes;
  if (rendered.layout === 'horizontal' && symbol && wordmark) {
    metrics.alignY = round(Math.abs(symbol.y + symbol.h / 2 - (wordmark.y + wordmark.h / 2)) / rendered.height);
    if (metrics.alignY > THRESHOLDS.alignY) add('misaligned', `Le nom est décalé de ${pct(metrics.alignY)} de la hauteur par rapport au centre du symbole.`, 'warn');
    const ratio = wordmark.h / symbol.h;
    metrics.wordRatio = round(ratio);
    if (ratio > 1.15) add('wordmark_dominates', 'Le nom est plus haut que le symbole : la hiérarchie est inversée.', 'warn');
    if (ratio < 0.1) add('wordmark_tiny', 'Le nom est trop petit face au symbole : illisible en petit format.', 'warn');
    const gap = wordmark.x - (symbol.x + symbol.w);
    // L'espace se juge à l'échelle du symbole (10 % de sa hauteur au moins), pas du canevas.
    metrics.gap = round(gap / symbol.h);
    if (gap / symbol.h < 0.1) add('crowded', 'Le symbole et le nom se touchent : prévoir une respiration.', 'warn');
  }

  // ── Typographie ──
  const families = new Set<string>();
  const weights = new Set<number>();
  walkLayers(doc.layers, (layer) => {
    if (layer.kind !== 'text' || layer.hidden) return;
    families.add(layer.font.family?.toLowerCase() || layer.font.role);
    weights.add(layer.font.weight);
  });
  metrics.fontFamilies = families.size;
  metrics.fontWeights = weights.size;
  if (families.size > 2) add('too_many_fonts', `${families.size} familles de polices : un logo en porte une, deux au plus.`, 'warn');
  if (weights.size > 2) add('too_many_weights', `${weights.size} graisses : deux au plus.`, 'warn');

  // ── Simplicité ──
  const symbolNodes = nodesOf(rendered.scene.groups.symbol);
  metrics.symbolNodes = symbolNodes;
  const nodeBudget = NODE_BUDGET[doc.concept.type];
  if (nodeBudget && symbolNodes > nodeBudget) add('too_complex', `Le symbole compte ${symbolNodes} nœuds (budget ${nodeBudget} pour un logo « ${doc.concept.type} ») : trop détaillé pour ce type.`, 'warn');
  const colorBudget = COLOR_BUDGET[doc.concept.type];
  if (ranked.length > colorBudget) add('too_many_colors', `${ranked.length} couleurs (${colorBudget} au plus pour « ${doc.concept.type} »).`, 'warn');

  return { defects, metrics };
}

/** Une palette lisible sur fond clair ? (sert aussi au planificateur avant de construire) */
export function paletteIssues(palette: { ink: string; ink2?: string; accent?: string }): string[] {
  const out: string[] = [];
  const colors = paletteColors(palette);
  if (contrast(colors.ink, LIGHT_BACKGROUND) < THRESHOLDS.contrastDominant) out.push('ink');
  return out;
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const pct = (v: number) => `${Math.round(v * 100)} %`;
