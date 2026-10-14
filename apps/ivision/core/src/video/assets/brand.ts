/**
 * LA MARQUE, EN JETONS POUR LES SCÈNES — couleurs, polices, logo.
 *
 * Ce module ne décide rien de l'apparence : il lit la charte et la rend disponible au code des
 * scènes (`ctx.brand`). Les polices sont embarquées dans la page (data URI) pour que le rendu ne
 * dépende pas du réseau.
 */
import { BrandKit, readFonts, readPalette, resolveLogoSlot } from '../../brand/brand-kit';
import { buildGoogleFontLinks } from '../../design/google-fonts';
import { BRAND_FONT_FAMILY, brandFontFaceStyle, isSelfHostedFamily } from '../../design/brand-font';
import { enforceLightSurface } from '../../design/lightSurface';
import type { BrandTokens } from '../../../motion/kit/context';
import { inlineFontLinks } from './fonts';

const DEFAULTS = { primary: '#1f6f4a', secondary: '#14324a', accent: '#f2a93b', background: '#fbfaf7', text: '#16181d' };

export interface FilmBrand {
  tokens: BrandTokens;
  /** Balises `<link>`/`<style>` des polices (à embarquer avec `embeddedFontCss`). */
  fontLinks: string;
}

/** Un SVG brut devient une source d'image ; une URL ou un data URI passe tel quel. */
function imageSrc(value?: string): string | undefined {
  const v = (value || '').trim();
  if (!v) return undefined;
  if (/^(https?:|data:)/.test(v)) return v;
  if (v.includes('<svg')) return `data:image/svg+xml;base64,${Buffer.from(v).toString('base64')}`;
  return undefined;
}

function svgMarkup(value?: string): string | undefined {
  const v = (value || '').trim();
  if (v.startsWith('<svg') || (v.startsWith('<?xml') && v.includes('<svg'))) return v;
  const m = v.match(/^data:image\/svg\+xml;base64,(.+)$/);
  return m ? Buffer.from(m[1], 'base64').toString('utf8') : undefined;
}

/** Largeur et hauteur d'un SVG (viewBox ou attributs), pour que le code des scènes sache le proportionner. */
function svgSize(svg?: string): { width: number; height: number } {
  const box = svg?.match(/viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (box) return { width: Number(box[1]) || 0, height: Number(box[2]) || 0 };
  const w = Number(svg?.match(/\swidth=["']([\d.]+)/i)?.[1]) || 0;
  const h = Number(svg?.match(/\sheight=["']([\d.]+)/i)?.[1]) || 0;
  return { width: w, height: h };
}

export function filmBrand(branding: Partial<BrandKit> | null | undefined, brandName: string, opts: { anonymous?: boolean } = {}): FilmBrand {
  const declared = readPalette(branding as BrandKit);
  const raw = {
    primary: declared.primary || DEFAULTS.primary,
    secondary: declared.secondary || DEFAULTS.secondary,
    accent: declared.accent || DEFAULTS.accent,
    background: declared.background || DEFAULTS.background,
    text: declared.text || DEFAULTS.text,
  };
  const safe = enforceLightSurface(raw);
  const colors = { ...raw, background: safe.background || raw.background, text: safe.text || raw.text };

  const fonts = readFonts(branding as BrandKit);
  const display = fonts.display || 'Poppins';
  const body = fonts.body || fonts.display || 'Inter';
  const google = [display, body].filter((f) => !isSelfHostedFamily(f));
  const fontLinks = [
    fonts.displayCss ? `<link rel="stylesheet" href="${fonts.displayCss}">` : '',
    fonts.bodyCss ? `<link rel="stylesheet" href="${fonts.bodyCss}">` : '',
    fonts.sheetUrl ? `<link rel="stylesheet" href="${fonts.sheetUrl}">` : '',
    !fonts.displayCss && !fonts.sheetUrl && google.length ? buildGoogleFontLinks(google) : '',
    [display, body].some((f) => f.toLowerCase() === BRAND_FONT_FAMILY.toLowerCase()) ? brandFontFaceStyle() : '',
  ]
    .filter(Boolean)
    .join('\n');

  const logo = opts.anonymous ? null : branding?.logo;
  const svg = svgMarkup(resolveLogoSlot(logo, 'svg')) || svgMarkup(resolveLogoSlot(logo, 'iconSvg'));
  const light = imageSrc(resolveLogoSlot(logo, 'assetUrls.withText.lightBackground')) || imageSrc(resolveLogoSlot(logo, 'assetUrls.primary')) || imageSrc(svg);
  const dark = imageSrc(resolveLogoSlot(logo, 'assetUrls.withText.darkBackground'));
  const size = svgSize(svg);
  return {
    tokens: {
      name: opts.anonymous ? '' : brandName,
      colors,
      fonts: { display, body },
      ...(light || dark || svg ? { logo: { ...(light ? { light } : {}), ...(dark ? { dark } : {}), ...(svg ? { svg } : {}), width: size.width, height: size.height } } : {}),
    },
    fontLinks,
  };
}

/** Les polices embarquées (data URI) : la page n'attend jamais une feuille distante. */
export async function embeddedFontCss(brand: FilmBrand, text: string): Promise<string> {
  return inlineFontLinks(brand.fontLinks, text);
}
