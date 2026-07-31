import logger from '../../../config/logger';
import { LogoLockupArrangement, LogoLockupSpec } from '../../../models/logo.model';
import { fontLoader, LoadedFont } from './fontLoader.service';
import {
  buildWordmarkGeometry,
  estimateWordmarkWidth,
  layoutRuns,
  TextRun,
  WordmarkGeometry,
} from './wordmark.util';
import {
  Box,
  fitTransform,
  measureInkBox,
  parseSvg,
  round,
  stripTextElements,
} from './svgGeometry.util';

/**
 * Composition déterministe du lockup « icône + nom ».
 *
 * L'IA ne dessine plus que l'ICÔNE. Le nom de marque est posé ici, à partir des
 * métriques réelles de la police choisie par l'utilisateur :
 *  - alignement optique exact (la ligne médiane des capitales du mot tombe sur
 *    le centre d'encre de l'icône, mesuré et non déduit du viewBox) ;
 *  - largeur du bloc calculée sur l'encre réelle → plus de texte rogné ni de
 *    viewBox trop étroit ;
 *  - typographie garantie : le mot est vectorisé dans la vraie police, donc
 *    identique en SVG, en PNG (sharp/librsvg), en PDF et dans les maquettes.
 *
 * Le mode dégradé (police non téléchargeable) émet un `<text>` positionné avec
 * les mêmes formules, ce qui reste très supérieur à ce que produisait l'IA.
 */

/** Carré d'inscription de l'icône, en unités du viewBox du lockup. */
const ICON_BOX = 72;
/** Hauteur de capitale du wordmark, en proportion de la hauteur d'encre de l'icône. */
const CAP_RATIO = 0.6;
const CAP_MIN = 26;
const CAP_MAX = 54;
/** Gouttière icône↔mot : proportion de la hauteur de capitale (blanc typographique). */
const GAP_RATIO = 0.62;
/**
 * Au-delà de ce rapport largeur-du-mot / largeur-d'icône, le lockup horizontal
 * devient un ruban illisible en petit : on empile. Calibré pour laisser passer
 * les noms usuels (« Squarespace » ≈ 5,7) et n'attraper que les vrais cas longs
 * (« Constellation Analytics » ≈ 9).
 */
const STACK_TRIGGER_RATIO = 6.5;
const STACK_CAP_RATIO = 0.42;
const STACK_CAP_MIN = 20;
const STACK_CAP_MAX = 42;
const STACK_GAP_RATIO = 0.6;

/** Canvas carré de l'icône seule (favicon, déclinaisons iconOnly). */
const ICON_ONLY_CANVAS = 100;
const ICON_ONLY_INK = 92;

const NEAR_BLACK = '#0B1220';
const PURE_WHITE = '#FFFFFF';
const MONO_DARK = '#111827';

type LockupArrangement = LogoLockupArrangement;

export interface ComposedLockup {
  /** Lockup complet (icône + nom), viewBox ajusté au contenu. */
  svg: string;
  /** Icône seule, normalisée et centrée sur un canvas carré. */
  iconSvg: string;
  spec: LogoLockupSpec;
  /** `false` = mode dégradé `<text>` (police indisponible au moment du rendu). */
  outlined: boolean;
}

export class LogoLockupService {
  /**
   * Compose le lockup à partir du SVG d'icône produit par l'IA.
   * Renvoie `null` si le SVG est inexploitable — l'appelant garde alors le SVG
   * d'origine plutôt que de perdre le concept.
   */
  async compose(iconSvgRaw: string, spec: LogoLockupSpec): Promise<ComposedLockup | null> {
    const parsed = parseSvg(iconSvgRaw);
    if (!parsed) {
      logger.warn('Lockup composition skipped: unparseable icon SVG');
      return null;
    }

    // Le wordmark est composé ici : tout texte laissé par le modèle est écarté.
    const iconInner = stripTextElements(parsed.inner).trim();
    if (!iconInner) {
      logger.warn('Lockup composition skipped: icon SVG has no drawable content');
      return null;
    }

    const iconSvgClean = wrapSvg(iconInner, parsed.viewBox.x, parsed.viewBox.y, parsed.viewBox.w, parsed.viewBox.h);
    const ink = await measureInkBox(iconSvgClean, parsed.viewBox);

    const loaded = await fontLoader.load(spec.fontFamily, spec.fontWeight);
    const iconFit = fitTransform(ink, { x: 0, y: 0, w: ICON_BOX, h: ICON_BOX });
    const iconDrawnW = ink.w * iconFit.scale;
    const iconDrawnH = ink.h * iconFit.scale;

    const svg = this.layout(iconInner, ink, iconDrawnW, iconDrawnH, spec, loaded);

    return {
      svg: svg.markup,
      iconSvg: this.buildIconOnlySvg(iconInner, ink),
      spec: { ...spec, arrangement: svg.arrangement },
      outlined: svg.outlined,
    };
  }

  /**
   * Recompose le même lockup avec une icône recolorée et une couleur de mot
   * adaptée au fond — utilisé pour les déclinaisons, sans appel IA : la
   * géométrie et la typographie restent rigoureusement identiques.
   */
  async recompose(
    iconVariationSvg: string,
    spec: LogoLockupSpec,
    background: 'light' | 'dark' | 'mono'
  ): Promise<string | null> {
    const wordmarkColor = wordmarkColorForBackground(spec.wordmarkColor, background);
    const composed = await this.compose(iconVariationSvg, { ...spec, wordmarkColor });
    return composed?.svg ?? null;
  }

  /**
   * Vectorise les `<text>` d'un SVG déjà composé par l'IA (types « name » et
   * « initial ») dans la police retenue. À défaut de police téléchargeable, on
   * se contente d'imposer la bonne `font-family`.
   */
  async outlineSvgText(svg: string, fontFamily: string, fontWeight = 700): Promise<string> {
    if (!svg || !/<text\b/i.test(svg)) return svg;

    const loaded = await fontLoader.load(fontFamily, fontWeight);
    if (!loaded) return enforceFontFamily(svg, fontFamily);

    const parsed = parseSvg(svg);
    if (!parsed) return enforceFontFamily(svg, fontFamily);

    let overflow = 0;
    const replaced = parsed.inner.replace(
      /<text\b([^>]*)>([\s\S]*?)<\/text>/gi,
      (match, rawAttrs: string, content: string) => {
        const outlined = outlineTextElement(rawAttrs, content, loaded, fontWeight);
        if (!outlined) return match;

        // Le texte vectorisé ne doit jamais sortir du cadre : on note le
        // débordement pour élargir le viewBox symétriquement ensuite.
        overflow = Math.max(
          overflow,
          parsed.viewBox.x - outlined.inkBox.x,
          outlined.inkBox.x + outlined.inkBox.w - (parsed.viewBox.x + parsed.viewBox.w)
        );
        return outlined.markup;
      }
    );

    if (replaced === parsed.inner) return enforceFontFamily(svg, fontFamily);

    const pad = overflow > 0 ? Math.ceil(overflow) + 4 : 0;
    return wrapSvg(
      enforceFontFamily(replaced, fontFamily),
      parsed.viewBox.x - pad,
      parsed.viewBox.y,
      parsed.viewBox.w + pad * 2,
      parsed.viewBox.h
    );
  }

  private layout(
    iconInner: string,
    ink: Box,
    iconDrawnW: number,
    iconDrawnH: number,
    spec: LogoLockupSpec,
    loaded: LoadedFont | null
  ): { markup: string; arrangement: LockupArrangement; outlined: boolean } {
    const horizontalCap = clamp(iconDrawnH * CAP_RATIO, CAP_MIN, CAP_MAX);
    const horizontal = this.buildWordmark(spec, loaded, horizontalCap);

    const arrangement: LockupArrangement =
      spec.arrangement === 'stacked' || horizontal.inkWidth > iconDrawnW * STACK_TRIGGER_RATIO
        ? 'stacked'
        : 'horizontal';

    const wordmark =
      arrangement === 'stacked'
        ? this.buildWordmark(spec, loaded, clamp(iconDrawnH * STACK_CAP_RATIO, STACK_CAP_MIN, STACK_CAP_MAX))
        : horizontal;

    const gap =
      arrangement === 'stacked'
        ? wordmark.capHeight * STACK_GAP_RATIO
        : Math.max(8, wordmark.capHeight * GAP_RATIO);

    let width: number;
    let height: number;
    let iconX: number;
    let iconY: number;
    let textX: number;
    let baselineY: number;

    if (arrangement === 'stacked') {
      width = Math.max(iconDrawnW, wordmark.inkWidth);
      iconX = (width - iconDrawnW) / 2;
      iconY = 0;
      textX = (width - wordmark.inkWidth) / 2;
      // La gouttière sépare le bas de l'icône du HAUT D'ENCRE du mot : une
      // ascendante ne vient donc jamais mordre sur l'icône.
      baselineY = iconDrawnH + gap + wordmark.ascent;
      height = baselineY + wordmark.descent;
    } else {
      // Alignement optique : la médiane des capitales tombe sur le centre
      // d'encre de l'icône (et non sur le centre de son viewBox).
      baselineY = iconDrawnH / 2 + wordmark.capHeight / 2;
      const contentTop = Math.min(0, baselineY - wordmark.ascent);
      const contentBottom = Math.max(iconDrawnH, baselineY + wordmark.descent);

      width = iconDrawnW + gap + wordmark.inkWidth;
      height = contentBottom - contentTop;
      iconX = 0;
      iconY = -contentTop;
      baselineY -= contentTop;
      textX = iconDrawnW + gap;
    }

    const fit = fitTransform(ink, { x: iconX, y: iconY, w: iconDrawnW, h: iconDrawnH });
    const iconGroup = `<g id="icon" transform="translate(${round(fit.tx)} ${round(fit.ty)}) scale(${round(
      fit.scale,
      4
    )})">${iconInner}</g>`;
    const wordmarkGroup = wordmark.render(textX, baselineY);

    return {
      markup: wrapSvg(iconGroup + wordmarkGroup, 0, 0, round(width), round(height)),
      arrangement,
      outlined: wordmark.outlined,
    };
  }

  /** Géométrie vectorisée quand la police est disponible, `<text>` sinon. */
  private buildWordmark(
    spec: LogoLockupSpec,
    loaded: LoadedFont | null,
    capHeight: number
  ): {
    inkWidth: number;
    capHeight: number;
    ascent: number;
    descent: number;
    outlined: boolean;
    render: (x: number, baselineY: number) => string;
  } {
    const geometry: WordmarkGeometry | null = loaded
      ? buildWordmarkGeometry(spec.brandName, loaded, {
          capHeight,
          letterSpacingEm: spec.letterSpacing,
        })
      : null;

    if (geometry) {
      return {
        inkWidth: geometry.inkWidth,
        capHeight: geometry.capHeight,
        ascent: geometry.ascent,
        descent: geometry.descent,
        outlined: true,
        // `inkOffsetX` recale l'origine typographique pour que le bord gauche
        // de l'ENCRE tombe exactement sur x : la gouttière est alors visuelle,
        // pas approximative.
        render: (x, baselineY) =>
          `<g id="wordmark" transform="translate(${round(x + geometry.inkOffsetX)} ${round(
            baselineY
          )})"><path d="${geometry.pathData}" fill="${spec.wordmarkColor}"/></g>`,
      };
    }

    // Mode dégradé : métriques approchées, mais la ligne de base reste calculée
    // (jamais de `dominant-baseline`, mal supporté par librsvg et consorts).
    const fontSize = capHeight / 0.7;
    return {
      inkWidth: estimateWordmarkWidth(spec.brandName, fontSize, spec.letterSpacing),
      capHeight,
      ascent: capHeight,
      descent: fontSize * 0.21,
      outlined: false,
      render: (x, baselineY) =>
        `<text id="wordmark" x="${round(x)}" y="${round(baselineY)}" font-family="${fontStack(
          spec.fontFamily
        )}" font-size="${round(fontSize)}" font-weight="${spec.fontWeight}" letter-spacing="${
          spec.letterSpacing
        }em" fill="${spec.wordmarkColor}">${escapeXml(spec.brandName)}</text>`,
    };
  }

  private buildIconOnlySvg(iconInner: string, ink: Box): string {
    const target: Box = {
      x: (ICON_ONLY_CANVAS - ICON_ONLY_INK) / 2,
      y: (ICON_ONLY_CANVAS - ICON_ONLY_INK) / 2,
      w: ICON_ONLY_INK,
      h: ICON_ONLY_INK,
    };
    const fit = fitTransform(ink, target);
    return wrapSvg(
      `<g id="icon" transform="translate(${round(fit.tx)} ${round(fit.ty)}) scale(${round(
        fit.scale,
        4
      )})">${iconInner}</g>`,
      0,
      0,
      ICON_ONLY_CANVAS,
      ICON_ONLY_CANVAS
    );
  }
}

/** Vectorise un `<text>` en conservant son intention de placement. */
function outlineTextElement(
  rawAttrs: string,
  content: string,
  loaded: LoadedFont,
  defaultWeight: number
): { markup: string; inkBox: Box } | null {
  // Un tspan positionné (x/y/dx/dy) porte une mise en page qu'on ne rejouerait
  // pas fidèlement : on laisse ce texte tel quel.
  if (/<tspan\b[^>]*\b(x|y|dx|dy)\s*=/i.test(content)) return null;

  const runs = extractRuns(content);
  if (!runs.length) return null;

  const fullText = runs.map((run) => run.text).join('');
  if (!fullText.trim()) return null;

  const attrs = parseAttributes(rawAttrs);
  const fontSize = Number(attrs['font-size']?.replace(/px$/i, ''));
  if (!Number.isFinite(fontSize) || fontSize <= 0) return null;

  const letterSpacing = parseLetterSpacing(attrs['letter-spacing'], fontSize);
  const capHeight = (fontSize * loaded.capHeightUnits) / loaded.unitsPerEm;

  const layout = layoutRuns(runs, loaded, fontSize, letterSpacing);
  if (!layout) return null;

  const inkWidth = layout.inkRight - layout.inkLeft;
  const anchor = (attrs['text-anchor'] || 'start').toLowerCase();
  const x = Number(attrs.x ?? 0) || 0;
  const y = Number(attrs.y ?? 0) || 0;
  const inkX = anchor === 'middle' ? x - inkWidth / 2 : anchor === 'end' ? x - inkWidth : x;
  const baselineY = resolveBaseline(attrs['dominant-baseline'], y, capHeight, loaded, fontSize);

  const defaultFill = attrs.fill || '#111111';
  const fontWeight = attrs['font-weight'] || String(defaultWeight);
  const paths = layout.paths
    .map((path) => `<path d="${path.d}" fill="${path.fill || defaultFill}"/>`)
    .join('');

  return {
    markup: `<g data-wordmark="${escapeXml(fullText)}" font-weight="${fontWeight}" transform="translate(${round(
      inkX - layout.inkLeft
    )} ${round(baselineY)})">${paths}</g>`,
    inkBox: { x: inkX, y: baselineY - capHeight, w: inkWidth, h: capHeight },
  };
}

/** Découpe le contenu d'un `<text>` en segments de couleur (tspans compris). */
function extractRuns(content: string): TextRun[] {
  const runs: TextRun[] = [];
  const pattern = /<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const before = decodeXml(content.slice(lastIndex, match.index).replace(/<[^>]*>/g, ''));
    if (before) runs.push({ text: before });
    runs.push({
      text: decodeXml(match[2].replace(/<[^>]*>/g, '')),
      fill: parseAttributes(match[1]).fill,
    });
    lastIndex = pattern.lastIndex;
  }

  const tail = decodeXml(content.slice(lastIndex).replace(/<[^>]*>/g, ''));
  if (tail) runs.push({ text: tail });

  return runs.filter((run) => run.text.length > 0);
}

/**
 * `dominant-baseline` est inégalement supporté par les moteurs de rendu (c'est
 * l'une des causes du texte « parfois décalé ») : on le résout ici en une
 * ligne de base absolue, une bonne fois pour toutes.
 */
function resolveBaseline(
  dominantBaseline: string | undefined,
  y: number,
  capHeight: number,
  loaded: LoadedFont,
  fontSize: number
): number {
  const value = (dominantBaseline || '').toLowerCase();
  if (value === 'central' || value === 'middle') return y + capHeight / 2;
  if (value === 'hanging' || value === 'text-before-edge') {
    return y + (loaded.font.ascender / loaded.unitsPerEm) * fontSize;
  }
  return y;
}

function parseAttributes(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z-]+)\s*=\s*["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(rawAttrs)) !== null) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function parseLetterSpacing(value: string | undefined, fontSize: number): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (trimmed.endsWith('em')) return Number.parseFloat(trimmed) || 0;
  const px = Number.parseFloat(trimmed);
  return Number.isFinite(px) && fontSize > 0 ? px / fontSize : 0;
}

/** Couleur du mot adaptée au fond, en gardant la couleur de marque si elle tient. */
export function wordmarkColorForBackground(
  baseColor: string,
  background: 'light' | 'dark' | 'mono'
): string {
  if (background === 'mono') return MONO_DARK;
  if (background === 'dark') {
    return contrastRatio(baseColor, '#111827') >= 4.5 ? baseColor : PURE_WHITE;
  }
  return contrastRatio(baseColor, PURE_WHITE) >= 4.5 ? baseColor : NEAR_BLACK;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return 0;
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(hex: string): number | null {
  const parsed = parseHex(hex);
  if (!parsed) return null;
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(parsed.r) + 0.7152 * channel(parsed.g) + 0.0722 * channel(parsed.b);
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!match) return null;
  const value =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : match[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/**
 * Couleur du wordmark : le choix du modèle s'il est exploitable et lisible sur
 * blanc, sinon la première couleur de palette qui l'est, sinon un noir riche.
 */
export function pickWordmarkColor(candidate: unknown, palette: string[] = []): string {
  if (isValidHexColor(candidate) && contrastRatio(candidate.trim(), PURE_WHITE) >= 4.5) {
    return candidate.trim();
  }
  const fromPalette = palette.find(
    (color) => isValidHexColor(color) && contrastRatio(color.trim(), PURE_WHITE) >= 4.5
  );
  return fromPalette ? fromPalette.trim() : NEAR_BLACK;
}

export function normalizeWordmarkWeight(value: unknown): number {
  const weight = Number(value);
  if (!Number.isFinite(weight)) return 700;
  return clamp(Math.round(weight / 100) * 100, 300, 900);
}

/** Interlettrage en em, borné aux valeurs qui restent lisibles dans un logo. */
export function normalizeTracking(value: unknown): number {
  const tracking = Number(value);
  if (!Number.isFinite(tracking)) return 0;
  return clamp(tracking, -0.05, 0.2);
}

function enforceFontFamily(svg: string, fontFamily: string): string {
  const stack = fontStack(fontFamily);
  return svg
    .replace(/\s*font-family="[^"]*"/gi, '')
    .replace(/\s*font-family='[^']*'/gi, '')
    .replace(/<text\b/gi, `<text font-family="${stack}"`);
}

function fontStack(fontFamily: string): string {
  const family = (fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
  return `'${family}', 'Helvetica Neue', Arial, sans-serif`;
}

function wrapSvg(inner: string, x: number, y: number, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(x)} ${round(y)} ${round(w)} ${round(
    h
  )}">${inner}</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const logoLockupService = new LogoLockupService();
