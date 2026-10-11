/**
 * TYPOGRAPHIE — du texte au contour, glyphe par glyphe, avec OpenType.js.
 *
 * Un logo n'embarque jamais une police : le texte est converti en tracés. La composition est
 * faite glyphe par glyphe (table cmap + crénage) plutôt que par le moteur de shaping
 * d'opentype.js, qui lève sur certaines tables GSUB (Merriweather, entre autres) : un logo n'a
 * pas besoin de ligatures de police, il a besoin d'être reproductible.
 *
 * Le moteur ne charge pas lui-même les polices : il les demande à un `FontProvider`. IDEM branche
 * le chargeur de polices de l'API (Google Fonts, Fontshare, polices importées) ; les contrôles
 * branchent un fichier local.
 */
import type { LoadedFont } from '../../BandIdentity/lockup/fontLoader.service';
import type { Rect } from './geometry';
import { fmt } from './geometry';

/** Une police prête à tracer : le sous-ensemble de `LoadedFont` dont le moteur a besoin. */
export type EngineFont = Pick<LoadedFont, 'family' | 'weight' | 'font' | 'unitsPerEm' | 'capHeightUnits'>;

export interface FontProvider {
  /** La police, ou `null` si elle est introuvable (le moteur le signale, il n'invente pas de repli). */
  load(family: string, weight: number, cssUrl?: string): Promise<EngineFont | null>;
}

export interface LaidGlyph {
  char: string;
  /** Position dans le texte (0 = première lettre). */
  index: number;
  /** Tracé absolu, ligne de base en y = 0 (le haut des lettres est en y négatif). Vide pour une espace. */
  d: string;
  /** Début de la lettre sur la ligne de base. */
  pen: number;
  advance: number;
  ink: Rect | null;
}

export interface LaidText {
  glyphs: LaidGlyph[];
  /** Avance totale (début de la 1re lettre → fin de la dernière, interlettrage compris). */
  width: number;
  fontSize: number;
  capHeight: number;
}

export function applyCase(text: string, mode: 'none' | 'upper' | 'lower' | 'title'): string {
  if (mode === 'upper') return text.toUpperCase();
  if (mode === 'lower') return text.toLowerCase();
  if (mode === 'title') return text.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
  return text;
}

const stripAccents = (c: string) => c.normalize('NFD').replace(/[̀-ͯ]/g, '');

type RawCommand = Record<string, unknown>;

/** Tracé sans coordonnée non finie (certaines polices variables en produisent). */
function safePathData(commands: ReadonlyArray<RawCommand>): string {
  const ok = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  let cx = 0;
  let cy = 0;
  const out: string[] = [];
  for (const c of commands) {
    if (c.type === 'Z') {
      out.push('Z');
      continue;
    }
    if (!ok(c.x) && !ok(c.y)) continue;
    const x = ok(c.x) ? c.x : cx;
    const y = ok(c.y) ? c.y : cy;
    const f = (v: number) => fmt(v, 2);
    if (c.type === 'M' || c.type === 'L') out.push(`${c.type}${f(x)} ${f(y)}`);
    else if (c.type === 'Q') out.push(`Q${f(ok(c.x1) ? c.x1 : x)} ${f(ok(c.y1) ? c.y1 : y)} ${f(x)} ${f(y)}`);
    else if (c.type === 'C') out.push(`C${f(ok(c.x1) ? c.x1 : cx)} ${f(ok(c.y1) ? c.y1 : cy)} ${f(ok(c.x2) ? c.x2 : x)} ${f(ok(c.y2) ? c.y2 : y)} ${f(x)} ${f(y)}`);
    else continue;
    cx = x;
    cy = y;
  }
  return out.join('');
}

/**
 * Pose un texte sur sa ligne de base. `capHeight` est la hauteur de capitale visée, dans l'unité
 * de la boîte de dessin : on raisonne en hauteur de capitale (ce que l'œil aligne), jamais en
 * corps. `null` si un caractère n'existe pas dans la police (mieux vaut refuser que dessiner des
 * rectangles `.notdef`).
 */
export function layoutText(text: string, loaded: EngineFont, capHeight: number, trackingEm = 0, extraGap = 0): LaidText | null {
  const content = text.trim();
  if (!content) return null;
  const fontSize = (capHeight * loaded.unitsPerEm) / loaded.capHeightUnits;
  const scale = fontSize / loaded.unitsPerEm;
  const tracking = trackingEm * fontSize;
  const glyphs: LaidGlyph[] = [];
  let pen = 0;
  let previous: ReturnType<typeof loaded.font.charToGlyph> | null = null;
  try {
    let index = 0;
    for (const raw of content) {
      let glyph = loaded.font.charToGlyph(raw);
      let char = raw;
      if ((!glyph || (glyph.index === 0 && !/\s/.test(raw))) && stripAccents(raw) !== raw) {
        char = stripAccents(raw);
        glyph = loaded.font.charToGlyph(char);
      }
      if (!glyph || (glyph.index === 0 && !/\s/.test(char))) return null;
      if (previous) pen += loaded.font.getKerningValue(previous, glyph) * scale;
      const path = glyph.getPath(pen, 0, fontSize);
      const d = safePathData((path as unknown as { commands: RawCommand[] }).commands || []);
      let ink: Rect | null = null;
      if (d) {
        const b = path.getBoundingBox();
        if ([b.x1, b.y1, b.x2, b.y2].every(Number.isFinite)) ink = { x: b.x1, y: b.y1, w: b.x2 - b.x1, h: b.y2 - b.y1 };
      }
      const advance = (glyph.advanceWidth ?? 0) * scale;
      glyphs.push({ char, index: index++, d, pen, advance, ink });
      pen += advance + tracking + extraGap;
      previous = glyph;
    }
  } catch {
    return null;
  }
  if (!glyphs.some((g) => g.d)) return null;
  const last = glyphs[glyphs.length - 1];
  return { glyphs, width: last.pen + last.advance - glyphs[0].pen, fontSize, capHeight };
}

/** Hauteur de capitale d'une police pour un corps donné, en unités du tracé. */
export const capHeightOf = (loaded: EngineFont, fontSize: number) => (loaded.capHeightUnits / loaded.unitsPerEm) * fontSize;

/** Hauteur d'x (minuscules) mesurée sur la lettre « x », en fraction de la capitale. */
export function xHeightRatio(loaded: EngineFont): number {
  try {
    const box = loaded.font.getPath('x', 0, 0, loaded.unitsPerEm).getBoundingBox();
    const h = Math.abs(box.y1);
    return h > 0 ? Math.min(1, h / loaded.capHeightUnits) : 0.72;
  } catch {
    return 0.72;
  }
}
