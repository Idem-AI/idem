import sharp from 'sharp';
import logger from '../../../config/logger';

/**
 * Géométrie SVG : lecture du viewBox, extraction du contenu et — surtout —
 * mesure de la BOÎTE D'ENCRE réelle d'une icône.
 *
 * Le viewBox annoncé par le modèle ne dit rien de l'endroit où l'icône est
 * réellement dessinée : elle est souvent décentrée ou entourée de blanc
 * asymétrique. Aligner le texte sur le viewBox produit alors un décalage
 * visible. On rastérise donc l'icône et on détourne le blanc (sharp `trim`)
 * pour connaître ses bords exacts, transformations et strokes compris.
 */

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParsedSvg {
  viewBox: ViewBox;
  /** Contenu interne du `<svg>` (defs/gradients compris), sans la balise racine. */
  inner: string;
}

/** Résolution de mesure : suffisante pour un bord au 1/1000 du viewBox. */
const MEASURE_TARGET_PX = 600;
/** Bornes de densité : un viewBox minuscule ne doit pas déclencher un rendu géant. */
const MIN_DENSITY = 24;
const MAX_DENSITY = 2400;

export function parseSvg(svg: string): ParsedSvg | null {
  if (!svg || typeof svg !== 'string') return null;

  const openTag = svg.match(/<svg\b[^>]*>/i);
  const closeIndex = svg.lastIndexOf('</svg>');
  if (!openTag || closeIndex === -1) return null;

  const viewBox = parseViewBox(openTag[0]);
  if (!viewBox) return null;

  const start = (openTag.index ?? 0) + openTag[0].length;
  return { viewBox, inner: svg.slice(start, closeIndex).trim() };
}

function parseViewBox(openTag: string): ViewBox | null {
  const match = openTag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (match) {
    const parts = match[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((value) => Number.isFinite(value)) && parts[2] > 0 && parts[3] > 0) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }

  // Pas de viewBox : on retombe sur width/height si le modèle les a posés.
  const width = Number(openTag.match(/\bwidth\s*=\s*["']([\d.]+)/i)?.[1]);
  const height = Number(openTag.match(/\bheight\s*=\s*["']([\d.]+)/i)?.[1]);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { x: 0, y: 0, w: width, h: height };
  }

  return null;
}

/**
 * Boîte d'encre de l'icône, exprimée dans le repère de son viewBox.
 * Retombe sur le viewBox complet si la mesure échoue (SVG vide, rendu KO).
 */
export async function measureInkBox(svg: string, viewBox: ViewBox): Promise<Box> {
  const fallback: Box = { x: viewBox.x, y: viewBox.y, w: viewBox.w, h: viewBox.h };

  try {
    const density = Math.min(
      MAX_DENSITY,
      Math.max(MIN_DENSITY, Math.round((MEASURE_TARGET_PX / Math.max(viewBox.w, viewBox.h)) * 72))
    );
    const input = Buffer.from(svg, 'utf-8');

    const metadata = await sharp(input, { density }).metadata();
    if (!metadata.width || !metadata.height) return fallback;

    const { info } = await sharp(input, { density })
      .trim({ threshold: 1 })
      .toBuffer({ resolveWithObject: true });

    const scaleX = metadata.width / viewBox.w;
    const scaleY = metadata.height / viewBox.h;
    // `trimOffset*` est négatif : c'est le déplacement appliqué à l'image.
    const left = Math.abs(info.trimOffsetLeft ?? 0) / scaleX;
    const top = Math.abs(info.trimOffsetTop ?? 0) / scaleY;
    const width = info.width / scaleX;
    const height = info.height / scaleY;

    if (!(width > 0) || !(height > 0)) return fallback;

    return { x: viewBox.x + left, y: viewBox.y + top, w: width, h: height };
  } catch (error) {
    logger.warn(`Icon ink measurement failed, falling back to viewBox: ${(error as Error).message}`);
    return fallback;
  }
}

/** Retire les éléments textuels : dans un lockup, le wordmark est composé ici. */
export function stripTextElements(inner: string): string {
  return inner
    .replace(/<text\b[\s\S]*?<\/text>/gi, '')
    .replace(/<text\b[^>]*\/>/gi, '');
}

/** Transformation qui envoie `source` (repère d'origine) sur `target`. */
export function fitTransform(source: Box, target: Box): { scale: number; tx: number; ty: number } {
  const scale = Math.min(target.w / source.w, target.h / source.h);
  const drawnW = source.w * scale;
  const drawnH = source.h * scale;
  const tx = target.x + (target.w - drawnW) / 2 - source.x * scale;
  const ty = target.y + (target.h - drawnH) / 2 - source.y * scale;
  return { scale, tx, ty };
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
