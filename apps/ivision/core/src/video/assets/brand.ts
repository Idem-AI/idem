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
  /** La direction artistique de la charte, résumée pour l'auteur des scènes (style, mise en page, typographie, motifs, à faire / à éviter). */
  art?: string;
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

/** La DA de la charte en quelques lignes : ce que chaque scène doit respecter (jamais une mise en page imposée). */
function artSummary(art: any): string | undefined {
  if (!art || typeof art !== 'object') return undefined;
  const join = (xs: unknown, n: number) => (Array.isArray(xs) ? xs.filter((x) => typeof x === 'string').slice(0, n).join('; ') : '');
  const lines = [
    [art.styleName || art.styleId, art.tagline].filter(Boolean).join(' — '),
    art.keywords?.length ? `keywords: ${join(art.keywords, 6)}` : '',
    art.layout ? `layout: ${[art.layout.grid, art.layout.density, art.layout.whitespace, art.layout.signatureMove].filter(Boolean).join('; ')}` : '',
    art.typography ? `typography: ${[art.typography.scaleContrast, art.typography.caseAndTracking, art.typography.treatment].filter(Boolean).join('; ')}` : '',
    art.color ? `colour use: ${[art.color.distribution, art.color.application, art.color.contrast].filter(Boolean).join('; ')}` : '',
    art.imagery ? `imagery: ${[art.imagery.medium, art.imagery.treatment, art.imagery.framing].filter(Boolean).join('; ')}` : '',
    art.graphicDevices?.length ? `graphic devices: ${join(art.graphicDevices, 5)}` : '',
    art.dos?.length ? `do: ${join(art.dos, 4)}` : '',
    art.donts?.length ? `avoid: ${join(art.donts, 4)}` : '',
  ].filter(Boolean);
  return lines.length ? lines.join('\n').slice(0, 1400) : undefined;
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
  // Chaque police SANS feuille propre est demandée à Google Fonts — même quand l'autre vient d'une fonderie
  // (titre Fontshare + texte Google : avant, la police du texte n'était jamais chargée et la vidéo retombait sur
  // une police système). Une feuille unique de la charte (`sheetUrl`) couvre les deux.
  const google = fonts.sheetUrl
    ? []
    : [...new Set([...(fonts.displayCss ? [] : [display]), ...(fonts.bodyCss || body === display ? [] : [body])])].filter((f) => !isSelfHostedFamily(f));
  const fontLinks = [
    fonts.displayCss ? `<link rel="stylesheet" href="${fonts.displayCss}">` : '',
    fonts.bodyCss ? `<link rel="stylesheet" href="${fonts.bodyCss}">` : '',
    fonts.sheetUrl ? `<link rel="stylesheet" href="${fonts.sheetUrl}">` : '',
    google.length ? buildGoogleFontLinks(google) : '',
    [display, body].some((f) => f.toLowerCase() === BRAND_FONT_FAMILY.toLowerCase()) ? brandFontFaceStyle() : '',
  ]
    .filter(Boolean)
    .join('\n');

  const logo = opts.anonymous ? null : branding?.logo;
  const svg = svgMarkup(resolveLogoSlot(logo, 'svg')) || svgMarkup(resolveLogoSlot(logo, 'iconSvg'));
  const light = imageSrc(resolveLogoSlot(logo, 'assetUrls.withText.lightBackground')) || imageSrc(resolveLogoSlot(logo, 'assetUrls.primary')) || imageSrc(svg);
  const dark = imageSrc(resolveLogoSlot(logo, 'assetUrls.withText.darkBackground'));
  const size = svgSize(svg);
  const art = artSummary((branding as any)?.artDirection);
  return {
    ...(art ? { art } : {}),
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
