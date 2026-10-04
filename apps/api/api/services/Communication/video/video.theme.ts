/**
 * La charte de la marque, traduite en jetons de vidéo.
 *
 * Rien ici n'est confié au modèle : couleurs, polices et logo viennent de la
 * charte, et chaque couple fond / encre est recalculé jusqu'au contraste AA
 * (texte normal) ou AAA (grands titres sur fond clair). La politique de surface
 * claire s'applique : un fond de marque sombre est redressé, la teinte gardée.
 */
import { BrandIdentityModel } from '../../../models/brand-identity.model';
import { readFonts, readPalette, resolveLogoSlot } from '../../brand/brandTokens';
import { contrastRatio, ensureContrast, hexToOklch, hexToRgb, oklchToHex, relativeLuminance, rgbToHex } from '../../design/color';
import { enforceLightSurface } from '../../design/lightSurface';
import { buildGoogleFontLinks } from '../../../utils/google-fonts.util';
import { VideoSceneInstance } from '../../../models/motionVideo.model';

export type SurfaceName = VideoSceneInstance['surface'];

export interface SurfaceTokens {
  /** Fond de la scène. */
  bg: string;
  /** Encre principale (≥ 4,5:1 sur `bg`). */
  ink: string;
  /** Encre secondaire, plus discrète (≥ 3:1). */
  muted: string;
  /** Couleur d'accentuation : barres, pastilles, soulignés. */
  hl: string;
  /** Texte posé SUR `hl`. */
  hlInk: string;
  /** Mot mis en valeur dans un titre : `hl` s'il se lit (≥ 3:1, grand texte), sinon l'encre. */
  hlText: string;
  /** Surligneur derrière le mot mis en valeur. */
  hlSoft: string;
  /** Teinte très douce pour les formes de décor. */
  soft: string;
  /** Vrai si le fond est sombre (choix de la déclinaison du logo). */
  dark: boolean;
}

export interface VideoTheme {
  brandName: string;
  palette: { primary: string; secondary: string; accent: string; background: string; text: string };
  surfaces: Record<SurfaceName, SurfaceTokens>;
  fonts: { display: string; body: string; links: string };
  /** Sources d'image du logo (URL ou data-URI), par polarité de fond. */
  logo: { onLight?: string; onDark?: string; icon?: string; svgMarkup?: string; fullSvgMarkup?: string };
}

const DEFAULTS = {
  primary: '#1f6f4a',
  secondary: '#14324a',
  accent: '#f2a93b',
  background: '#fbfaf7',
  text: '#16181d',
};

export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return a;
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

function isDark(hex: string): boolean {
  const rgb = hexToRgb(hex);
  return !!rgb && relativeLuminance(rgb) < 0.4;
}

/** Encre lisible sur un fond : la couleur de marque si elle tient, sinon blanc / quasi-noir. */
function inkOn(bg: string, preferred: string, target = 4.5): string {
  if (contrastRatio(preferred, bg) >= target) return preferred;
  const white = '#ffffff';
  const black = '#111418';
  return contrastRatio(white, bg) >= contrastRatio(black, bg) ? white : black;
}

/** Choisit, parmi les couleurs de marque, celle qui ressort le mieux sur `bg`. */
function pickHighlight(bg: string, candidates: string[], min = 2.2): string {
  const ranked = candidates
    .filter(Boolean)
    .map((c) => ({ c, ratio: contrastRatio(c, bg) }))
    .sort((a, b) => b.ratio - a.ratio);
  const firstOk = candidates.find((c) => c && contrastRatio(c, bg) >= min);
  if (firstOk) return firstOk;
  return ranked[0]?.c ?? (isDark(bg) ? '#ffffff' : '#111418');
}

function surfaceFor(bg: string, palette: VideoTheme['palette'], highlightOrder: string[]): SurfaceTokens {
  const dark = isDark(bg);
  const ink = dark ? inkOn(bg, '#ffffff', 4.5) : ensureContrast(palette.text, bg, 7);
  const muted = ensureContrast(mixHex(ink, bg, 0.3), bg, 3);
  const hl = pickHighlight(bg, highlightOrder);
  return {
    bg,
    ink,
    muted,
    hl,
    hlInk: inkOn(hl, dark ? bg : '#ffffff', 4.5),
    hlText: contrastRatio(hl, bg) >= 3 ? hl : ink,
    hlSoft: mixHex(bg, hl, 0.32),
    soft: mixHex(bg, dark ? '#ffffff' : palette.primary, dark ? 0.12 : 0.08),
    dark,
  };
}

/** Teinte très claire d'une couleur (même teinte, clarté élevée, chroma réduite). */
export function tintOf(hex: string, lightness: number): string {
  const ok = hexToOklch(hex);
  return ok ? oklchToHex({ l: lightness + (1 - lightness) * 0.6, c: Math.min(ok.c, 0.05), h: ok.h }) : hex;
}

/** Version profonde d'une couleur (même teinte, clarté basse). */
export function deepOf(hex: string): string {
  const ok = hexToOklch(hex);
  return ok ? oklchToHex({ l: Math.min(ok.l, 0.3), c: Math.min(ok.c, 0.12), h: ok.h }) : hex;
}

/** Un SVG brut devient une source d'image utilisable dans `<img src>`. */
export function toImageSrc(value?: string): string | undefined {
  const v = (value || '').trim();
  if (!v) return undefined;
  if (/^(https?:|data:)/.test(v)) return v;
  if (v.includes('<svg')) return `data:image/svg+xml;base64,${Buffer.from(v).toString('base64')}`;
  return undefined;
}

/** Le SVG brut du logo (pour l'extruder en 3D), quand la charte le porte. */
export function svgMarkupOf(value?: string): string | undefined {
  const v = (value || '').trim();
  if (v.startsWith('<svg') || (v.startsWith('<?xml') && v.includes('<svg'))) return v;
  const m = v.match(/^data:image\/svg\+xml;base64,(.+)$/);
  if (m) return Buffer.from(m[1], 'base64').toString('utf8');
  return undefined;
}

export function buildVideoTheme(
  branding: Partial<BrandIdentityModel> | null | undefined,
  brandName: string
): VideoTheme {
  const declared = readPalette(branding);
  const raw = {
    primary: declared.primary || DEFAULTS.primary,
    secondary: declared.secondary || DEFAULTS.secondary,
    accent: declared.accent || DEFAULTS.accent,
    background: declared.background || DEFAULTS.background,
    text: declared.text || DEFAULTS.text,
  };
  // Politique de surface claire : jamais de fond de vidéo sombre par défaut.
  const safe = enforceLightSurface(raw);
  const palette = { ...raw, background: safe.background!, text: safe.text! };

  // Une secondaire trop proche du fond ne fait pas une surface : on la fonce
  // en gardant sa teinte, pour qu'une scène « secondaire » se distingue.
  let secondaryBg = palette.secondary;
  if (contrastRatio(secondaryBg, palette.background) < 1.6) {
    const ok = hexToOklch(secondaryBg);
    secondaryBg = ok ? oklchToHex({ ...ok, l: Math.min(ok.l, 0.42) }) : DEFAULTS.secondary;
  }

  const surfaces: Record<SurfaceName, SurfaceTokens> = {
    light: surfaceFor(palette.background, palette, [palette.primary, palette.accent, palette.secondary]),
    primary: surfaceFor(palette.primary, palette, [palette.accent, palette.background, palette.secondary]),
    secondary: surfaceFor(secondaryBg, palette, [palette.accent, palette.primary, palette.background]),
    accent: surfaceFor(palette.accent, palette, [palette.primary, palette.secondary, palette.background]),
    // Stratégie « trempée » : la même teinte en clair et en profond.
    tint: surfaceFor(tintOf(palette.primary, 0.9), palette, [palette.primary, palette.accent, palette.secondary]),
    deep: surfaceFor(deepOf(palette.primary), palette, [palette.accent, tintOf(palette.primary, 0.85), palette.background]),
  };

  const fonts = readFonts(branding);
  const display = fonts.display || 'Poppins';
  const body = fonts.body || fonts.display || 'Inter';
  const links = [
    fonts.displayCss ? `<link rel="stylesheet" href="${fonts.displayCss}">` : '',
    fonts.bodyCss ? `<link rel="stylesheet" href="${fonts.bodyCss}">` : '',
    fonts.sheetUrl ? `<link rel="stylesheet" href="${fonts.sheetUrl}">` : '',
    !fonts.displayCss && !fonts.sheetUrl ? buildGoogleFontLinks([display, body]) : '',
  ]
    .filter(Boolean)
    .join('\n');

  const logo = branding?.logo;
  return {
    brandName: brandName || 'Marque',
    palette,
    surfaces,
    fonts: { display, body, links },
    logo: {
      onLight: toImageSrc(resolveLogoSlot(logo, 'assetUrls.withText.lightBackground')),
      onDark: toImageSrc(resolveLogoSlot(logo, 'assetUrls.withText.darkBackground')),
      icon: toImageSrc(resolveLogoSlot(logo, 'assetUrls.icon')),
      svgMarkup: svgMarkupOf(resolveLogoSlot(logo, 'iconSvg')) || svgMarkupOf(resolveLogoSlot(logo, 'svg')),
      // Le logo complet (symbole + nom), pour les animations de logo vectoriel.
      fullSvgMarkup: svgMarkupOf(resolveLogoSlot(logo, 'svg')),
    },
  };
}
