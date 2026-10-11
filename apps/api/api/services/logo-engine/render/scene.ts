/**
 * LA SCÈNE — ce que le moteur construit entre le Logo IR et le SVG.
 *
 * Chaque couche est résolue en `Part`s : une forme (déjà passée par le noyau), la couleur qu'elle
 * demande (un RÔLE de la palette — ink, ink2, accent, paper — ou un hexadécimal) et son style.
 * Garder le rôle jusqu'à l'émission est ce qui rend les variantes gratuites : monochrome, inversée
 * ou symbole seul se réécrivent depuis la même scène, sans reparser un SVG ni appeler un modèle.
 */
import type { ColorRefValue, LogoDocument, LogoStroke } from '../ir/logo.schema';
import type { GeometryKernel, Matrix, Rect, Shape } from '../kernel/geometry';
import type { EngineFont, FontProvider } from '../kernel/typography';

export type LayerRole = 'symbol' | 'frame' | 'wordmark' | 'tagline';
export type Paint = ColorRefValue | 'none';

export interface Part {
  /** La couche d'où vient la forme (une couche peut produire plusieurs formes). */
  layerId: string;
  role: LayerRole;
  shape: Shape;
  paint: Paint;
  stroke?: LogoStroke;
  opacity?: number;
}

export interface Resolved {
  parts: Part[];
  ink: Rect | null;
}

export interface BuildWarning {
  code:
    | 'font_unavailable'
    | 'glyph_missing'
    | 'boolean_failed'
    | 'generator_unknown'
    | 'geometry_invalid'
    | 'free_path_refused'
    | 'empty_layer'
    | 'text_unfit'
    | 'palette_fallback';
  layerId?: string;
  message: string;
}

export interface FontSpec {
  family: string;
  cssUrl?: string;
}

/** Les polices de la charte : titre et texte courant. */
export interface BrandFonts {
  display: FontSpec;
  body?: FontSpec;
}

export interface BuildContext {
  kernel: GeometryKernel;
  fontProvider?: FontProvider;
  fonts: BrandFonts;
  /** Polices chargées avant la résolution (la résolution est synchrone). */
  loaded: Map<string, EngineFont>;
  doc: LogoDocument;
  warnings: BuildWarning[];
  /** Le dessin libre (`path`) est-il admis ? Réservé aux crans où l'IA dessine. */
  allowFreePaths: boolean;
}

export const fontKey = (family: string, weight: number) => `${family.toLowerCase()}|${weight}`;

export const rectUnion = (a: Rect | null, b: Rect | null): Rect | null => {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** Boîte d'une partie, épaisseur du contour comprise. */
export function partBounds(part: Part): Rect {
  const b = part.shape.bounds;
  const pad = part.stroke ? part.stroke.width / 2 : 0;
  return pad ? { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 } : b;
}

export function inkOf(parts: Part[]): Rect | null {
  let box: Rect | null = null;
  for (const part of parts) box = rectUnion(box, partBounds(part));
  return box;
}

/** Transforme une partie ; l'épaisseur de son contour suit l'échelle. */
export function transformPart(part: Part, m: Matrix, kernel: GeometryKernel): Part {
  const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  return {
    ...part,
    shape: kernel.transform(part.shape, m),
    ...(part.stroke ? { stroke: { ...part.stroke, width: part.stroke.width * scale } } : {}),
  };
}
