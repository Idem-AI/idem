import logger from '../../../config/logger';
import { LoadedFont } from './fontLoader.service';

/**
 * Vectorisation du wordmark : le nom de marque devient un `<path>` tracé avec
 * les contours réels de la police choisie par l'utilisateur.
 *
 * Deux problèmes disparaissent d'un coup :
 *  - la typographie est garantie partout (PNG via sharp/librsvg, `<img>`, PDF,
 *    maquettes) puisqu'il n'y a plus de police à résoudre au moment du rendu ;
 *  - les métriques (largeur d'encre, hauteur de capitale, jambages) sont
 *    mesurées et non estimées, ce qui rend l'alignement exact par construction.
 *
 * La composition est faite glyphe par glyphe (cmap + kerning) plutôt que via
 * `font.getPath()` : le moteur de shaping d'opentype.js lève sur certaines
 * tables GSUB (Merriweather, entre autres), et un logo n'a de toute façon pas
 * besoin de ligatures — il a besoin d'être reproductible.
 */

const PATH_PRECISION = 2;

export interface TextRun {
  text: string;
  fill?: string;
}

export interface RunPath {
  d: string;
  fill?: string;
}

export interface RunLayout {
  paths: RunPath[];
  /** Boîte d'encre, origine = début du tracé, ligne de base en y = 0. */
  inkLeft: number;
  inkRight: number;
  inkTop: number;
  inkBottom: number;
}

export interface WordmarkOptions {
  /** Hauteur de capitale visée, en unités du viewBox du logo. */
  capHeight: number;
  /** Interlettrage en em (0.08 = 8 % du corps), comme la propriété CSS. */
  letterSpacingEm?: number;
}

export interface WordmarkGeometry {
  /** Tracé du mot, ligne de base en y = 0, origine typographique en x = 0. */
  pathData: string;
  /** Décalage à appliquer pour que l'ENCRE commence exactement en x = 0. */
  inkOffsetX: number;
  /** Largeur d'encre réelle (bord gauche du 1er glyphe → bord droit du dernier). */
  inkWidth: number;
  capHeight: number;
  /** Encre au-dessus de la ligne de base (ascendantes incluses). */
  ascent: number;
  /** Encre sous la ligne de base (jambages descendants), valeur positive. */
  descent: number;
  fontSize: number;
}

/**
 * Trace une suite de segments (un segment = une couleur) sur une même ligne de
 * base, kerning compris à la jonction des segments.
 * Renvoie `null` si un caractère n'existe pas dans la police (mieux vaut un
 * `<text>` dégradé que des rectangles `.notdef` dans un logo) ou si la police
 * refuse de produire un tracé.
 */
export function layoutRuns(
  runs: TextRun[],
  loaded: LoadedFont,
  fontSize: number,
  letterSpacingEm = 0
): RunLayout | null {
  const scale = fontSize / loaded.unitsPerEm;
  const tracking = letterSpacingEm * fontSize;

  let pen = 0;
  let previousGlyph: ReturnType<typeof loaded.font.charToGlyph> | null = null;
  let inkLeft = Number.POSITIVE_INFINITY;
  let inkRight = Number.NEGATIVE_INFINITY;
  let inkTop = Number.POSITIVE_INFINITY;
  let inkBottom = Number.NEGATIVE_INFINITY;
  const paths: RunPath[] = [];

  try {
    for (const run of runs) {
      const segments: string[] = [];

      for (const char of run.text) {
        const glyph = loaded.font.charToGlyph(char);
        if (!glyph || (glyph.index === 0 && !/\s/.test(char))) return null;

        if (previousGlyph) {
          pen += loaded.font.getKerningValue(previousGlyph, glyph) * scale;
        }

        const path = glyph.getPath(pen, 0, fontSize);
        // `commands` existe sur le tracé d'opentype.js, mais ses typages ne le déclarent pas.
        const data = safePathData((path as unknown as { commands: Record<string, any>[] }).commands || []);
        if (data) {
          segments.push(data);
          const box = path.getBoundingBox();
          // Même prudence que pour le tracé : une boîte illisible n'élargit rien.
          if (Number.isFinite(box.x1)) inkLeft = Math.min(inkLeft, box.x1);
          if (Number.isFinite(box.x2)) inkRight = Math.max(inkRight, box.x2);
          if (Number.isFinite(box.y1)) inkTop = Math.min(inkTop, box.y1);
          if (Number.isFinite(box.y2)) inkBottom = Math.max(inkBottom, box.y2);
        }

        pen += (glyph.advanceWidth ?? 0) * scale + tracking;
        previousGlyph = glyph;
      }

      if (segments.length) paths.push({ d: segments.join(''), fill: run.fill });
    }
  } catch (error) {
    logger.warn(`Glyph layout failed for "${loaded.family}": ${(error as Error).message}`);
    return null;
  }

  if (!paths.length || !Number.isFinite(inkLeft) || inkRight <= inkLeft) return null;

  return { paths, inkLeft, inkRight, inkTop, inkBottom };
}

/**
 * Données de tracé d'un glyphe, sans coordonnée non finie.
 *
 * opentype.js rend parfois un `NaN` dans un tracé (contours quadratiques de certaines polices
 * variables — Fraunces, par exemple). Un moteur SVG arrête de dessiner le chemin entier à la
 * première valeur illisible : le mot s'arrêtait net après une lettre (« Verd ι »). La coordonnée
 * manquante reprend celle du point courant (ou du point d'arrivée pour un point de contrôle) ;
 * une commande sans point d'arrivée lisible est écartée.
 */
function safePathData(commands: ReadonlyArray<Record<string, any>>): string {
  const n = (v: number) => {
    const r = Math.round(v * 10 ** PATH_PRECISION) / 10 ** PATH_PRECISION;
    return Object.is(r, -0) ? '0' : String(r);
  };
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  let cx = 0;
  let cy = 0;
  const out: string[] = [];
  for (const c of commands) {
    if (c.type === 'Z') {
      out.push('Z');
      continue;
    }
    const x = ok(c.x) ? c.x : cx;
    const y = ok(c.y) ? c.y : cy;
    if (!ok(c.x) && !ok(c.y)) continue;
    if (c.type === 'M' || c.type === 'L') out.push(`${c.type}${n(x)} ${n(y)}`);
    else if (c.type === 'Q') out.push(`Q${n(ok(c.x1) ? c.x1 : x)} ${n(ok(c.y1) ? c.y1 : y)} ${n(x)} ${n(y)}`);
    else if (c.type === 'C')
      out.push(`C${n(ok(c.x1) ? c.x1 : cx)} ${n(ok(c.y1) ? c.y1 : cy)} ${n(ok(c.x2) ? c.x2 : x)} ${n(ok(c.y2) ? c.y2 : y)} ${n(x)} ${n(y)}`);
    else continue;
    cx = x;
    cy = y;
  }
  return out.join('');
}

export function buildWordmarkGeometry(
  text: string,
  loaded: LoadedFont,
  options: WordmarkOptions
): WordmarkGeometry | null {
  const content = (text || '').trim();
  if (!content) return null;

  const capHeight = options.capHeight;
  // On raisonne en hauteur de capitale (ce que l'œil aligne), pas en corps :
  // deux polices au même font-size n'ont pas la même hauteur perçue.
  const fontSize = (capHeight * loaded.unitsPerEm) / loaded.capHeightUnits;

  const layout = layoutRuns([{ text: content }], loaded, fontSize, options.letterSpacingEm ?? 0);
  if (!layout) return null;

  return {
    pathData: layout.paths.map((path) => path.d).join(''),
    inkOffsetX: -layout.inkLeft,
    inkWidth: layout.inkRight - layout.inkLeft,
    capHeight,
    ascent: Math.max(capHeight, -layout.inkTop),
    descent: Math.max(0, layout.inkBottom),
    fontSize,
  };
}

/**
 * Estimation utilisée uniquement quand la police n'a pas pu être téléchargée
 * (réseau coupé, famille inconnue). Volontairement grossière : elle sert à
 * dimensionner un `<text>` de secours, jamais à produire l'alignement final.
 */
export function estimateWordmarkWidth(text: string, fontSize: number, letterSpacingEm = 0): number {
  const chars = (text || '').length;
  return chars * fontSize * 0.6 + Math.max(0, chars - 1) * fontSize * letterSpacingEm;
}
