/**
 * Les toiles que le moteur compose : page A4 d'un document paginé, diapositive, carte de visite,
 * visuels de réseaux, couvertures de profil.
 *
 * Deux natures, à ne pas confondre :
 *  · `flow`  — un document paginé (business plan) : la hauteur est un MINIMUM, la matière peut
 *    déborder, le paginateur du PDF redécoupera au bon endroit ;
 *  · `fixed` — une toile à cotes exactes (diapositive, charte, carte, visuel) : ce qui dépasse n'est
 *    pas rattrapable en aval, le moteur MESURE et resserre avant de rendre.
 */
import type { FormatId } from '../contracts/common';

export type FormatKind = 'flow' | 'fixed';
export type FormatFamily = 'document' | 'slide' | 'card' | 'visual' | 'cover' | 'chart';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FormatDef {
  id: FormatId;
  family: FormatFamily;
  kind: FormatKind;
  orientation: 'portrait' | 'landscape' | 'square';
  /** Toile en pixels CSS (96 dpi). */
  width: number;
  height: number;
  /** Cotes physiques, pour les formats imprimés. */
  mm?: { width: number; height: number };
  /** Marge de page (px). */
  pad: number;
  /** Où vit ce qui porte du sens (px depuis chaque bord) : plus large que la marge pour une story ou une couverture. */
  safe: Insets;
  /** Échelle typographique : corps, plus petit et plus grand lisibles (px). */
  base: number;
  minSize: number;
  maxSize: number;
  /** Unité d'espacement (px) ; l'échelle des espaces en est un multiple. */
  unit: number;
  /** Poids visuel relatif à une page A4 : sert les filets, les rayons, les ombres. */
  scale: number;
  /** Facteur de résolution à l'export PNG (cartes : 300 dpi). */
  exportScale: number;
  /** Les cotes CSS de la racine : en millimètres pour les pages imprimées, en pixels sinon. */
  css: { width: string; height: string; padding: string };
}

const MM = 96 / 25.4;
const mm = (v: number): number => Math.round(v * MM * 100) / 100;
const even = (v: number): Insets => ({ top: v, right: v, bottom: v, left: v });

function visual(id: FormatId, family: FormatFamily, width: number, height: number, extra: Partial<FormatDef> = {}): FormatDef {
  const u = Math.min(width, height) / 100;
  const orientation = height > width * 1.15 ? 'portrait' : width > height * 1.15 ? 'landscape' : 'square';
  const pad = Math.round((id === 'flyer-a4' ? 8 : 7) * u);
  return {
    id,
    family,
    kind: 'fixed',
    orientation,
    width,
    height,
    pad,
    safe: even(pad),
    base: Math.round(Math.min(width, height) / 36),
    minSize: Math.round(Math.min(width, height) / 54),
    maxSize: Math.round(Math.min(width, height) * 0.24),
    unit: Math.max(6, Math.round(u * 0.9)),
    scale: Math.max(1.4, u / 4.5),
    exportScale: 1,
    css: { width: `${width}px`, height: `${height}px`, padding: `${pad}px` },
    ...extra,
  };
}

/** Une couverture de profil : l'avatar mord le bas gauche et le mobile ne garde que le centre. */
function cover(id: FormatId, width: number, height: number, box: { left: number; top: number; right: number; bottom: number }): FormatDef {
  const safe = { top: Math.round(box.top * height), right: Math.round((1 - box.right) * width), bottom: Math.round((1 - box.bottom) * height), left: Math.round(box.left * width) };
  return visual(id, 'cover', width, height, { safe, pad: Math.min(safe.left, safe.top), base: Math.max(14, Math.round(height / 17)), minSize: Math.max(12, Math.round(height / 28)), maxSize: Math.round(height * 0.34) });
}

export const FORMATS: Record<FormatId, FormatDef> = {
  'a4-portrait': {
    id: 'a4-portrait',
    family: 'document',
    kind: 'flow',
    orientation: 'portrait',
    width: mm(210),
    height: mm(297),
    mm: { width: 210, height: 297 },
    pad: mm(12),
    safe: even(mm(12)),
    base: 13,
    minSize: 9,
    maxSize: 56,
    unit: 4,
    scale: 1,
    exportScale: 1,
    css: { width: '210mm', height: '297mm', padding: '12mm' },
  },
  'slide-16x9': {
    id: 'slide-16x9',
    family: 'slide',
    kind: 'fixed',
    orientation: 'landscape',
    width: mm(297),
    height: mm(167),
    mm: { width: 297, height: 167 },
    pad: mm(14),
    safe: even(mm(14)),
    base: 16,
    minSize: 11,
    maxSize: 104,
    unit: 5,
    scale: 1.25,
    exportScale: 1,
    css: { width: '297mm', height: '167mm', padding: '14mm' },
  },
  // Une PAGE fixe (une section = exactement une page) : la charte graphique quand elle est choisie en
  // A4. Mêmes motifs que les diapositives, à la capacité d'une page A4.
  'page-a4': {
    id: 'page-a4',
    family: 'slide',
    kind: 'fixed',
    orientation: 'portrait',
    width: mm(210),
    height: mm(297),
    mm: { width: 210, height: 297 },
    pad: mm(12),
    safe: even(mm(12)),
    base: 13,
    minSize: 9,
    maxSize: 80,
    unit: 4,
    scale: 1,
    exportScale: 1,
    css: { width: '210mm', height: '297mm', padding: '12mm' },
  },
  'page-a4-landscape': {
    id: 'page-a4-landscape',
    family: 'slide',
    kind: 'fixed',
    orientation: 'landscape',
    width: mm(297),
    height: mm(210),
    mm: { width: 297, height: 210 },
    pad: mm(14),
    safe: even(mm(14)),
    base: 14,
    minSize: 10,
    maxSize: 92,
    unit: 5,
    scale: 1.1,
    exportScale: 1,
    css: { width: '297mm', height: '210mm', padding: '14mm' },
  },
  'card-landscape': {
    id: 'card-landscape',
    family: 'card',
    kind: 'fixed',
    orientation: 'landscape',
    width: mm(85),
    height: mm(55),
    mm: { width: 85, height: 55 },
    pad: mm(4.5),
    safe: even(mm(4)),
    base: 9.5,
    // Plancher d'impression : 8,5 px CSS ≈ 6,4 pt sur la carte imprimée (jamais sous les 6 pt d'usage).
    minSize: 8.5,
    maxSize: 30,
    unit: 2.2,
    scale: 0.55,
    exportScale: 300 / 96,
    css: { width: '85mm', height: '55mm', padding: '4.5mm' },
  },
  'card-portrait': {
    id: 'card-portrait',
    family: 'card',
    kind: 'fixed',
    orientation: 'portrait',
    width: mm(55),
    height: mm(85),
    mm: { width: 55, height: 85 },
    pad: mm(4.5),
    safe: even(mm(4)),
    base: 9.5,
    // Plancher d'impression : 8,5 px CSS ≈ 6,4 pt sur la carte imprimée (jamais sous les 6 pt d'usage).
    minSize: 8.5,
    maxSize: 30,
    unit: 2.2,
    scale: 0.55,
    exportScale: 300 / 96,
    css: { width: '55mm', height: '85mm', padding: '4.5mm' },
  },
  'flyer-square': visual('flyer-square', 'visual', 1080, 1080),
  // Story : l'interface du réseau (profil en haut, réponse en bas) couvre ~12 % et ~15 % de la hauteur.
  'flyer-story': visual('flyer-story', 'visual', 1080, 1920, { safe: { top: Math.round(1920 * 0.12), right: 76, bottom: Math.round(1920 * 0.15), left: 76 } }),
  'flyer-banner': visual('flyer-banner', 'visual', 1200, 630),
  'flyer-post': visual('flyer-post', 'visual', 1200, 1500),
  'flyer-a4': visual('flyer-a4', 'visual', 1240, 1754),
  'cover-facebook': cover('cover-facebook', 1640, 624, { left: 0.22, top: 0.16, right: 0.86, bottom: 0.8 }),
  'cover-linkedin': cover('cover-linkedin', 1128, 191, { left: 0.3, top: 0.16, right: 0.94, bottom: 0.84 }),
  'cover-x': cover('cover-x', 1500, 500, { left: 0.32, top: 0.16, right: 0.94, bottom: 0.84 }),
  'cover-youtube': cover('cover-youtube', 2560, 1440, { left: 0.24, top: 0.14, right: 0.76, bottom: 0.86 }),
  'avatar-square': visual('avatar-square', 'cover', 800, 800, { pad: 80, safe: even(80), base: 30, minSize: 18 }),
  'chart-free': {
    id: 'chart-free',
    family: 'chart',
    kind: 'fixed',
    orientation: 'landscape',
    width: 640,
    height: 360,
    pad: 0,
    safe: even(0),
    base: 12,
    minSize: 9,
    maxSize: 40,
    unit: 4,
    scale: 1,
    exportScale: 1,
    css: { width: '640px', height: '360px', padding: '0' },
  },
};

export const formatOf = (id: FormatId): FormatDef => FORMATS[id];

/** Surface utile à l'intérieur des marges. */
export function contentBox(format: FormatDef): { width: number; height: number } {
  return { width: format.width - format.safe.left - format.safe.right, height: format.height - format.safe.top - format.safe.bottom };
}

/** Un format est-il imprimé en cotes physiques ? */
export const isPrint = (format: FormatDef): boolean => Boolean(format.mm);
