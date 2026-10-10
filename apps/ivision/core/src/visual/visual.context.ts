/**
 * D'une charte (`BrandKit`) au contexte de marque d'un visuel (`VisualBrandContext`).
 *
 * La même traduction pour les deux hôtes : IDEM (la charte d'un projet) et iVision (une marque
 * scannée depuis un site, saisie, ou importée d'un projet IDEM). Couleurs, polices, logos dans
 * toutes leurs déclinaisons : le compositeur et le rendu ne voient jamais d'où vient la marque.
 */
import type { ArtDirectionModel } from '../brand/art-direction.model';
import { BrandKit, BrandVoice, logoSlotValue, LogoSlot, readFonts } from '../brand/brand-kit';
import type { VisualBrandContext } from './visual.model';

/**
 * Un `src` d'image utilisable pour un logo : l'URL hébergée d'abord ; à défaut, le SVG en ligne
 * converti en data-URI (jamais du balisage brut dans un `src`).
 */
export function logoSrc(url?: string, svgFallback?: string): string | undefined {
  const hosted = (url || '').trim();
  if (hosted) return hosted;
  const svg = (svgFallback || '').trim();
  if (!svg) return undefined;
  if (svg.startsWith('http://') || svg.startsWith('https://') || svg.startsWith('data:')) return svg;
  if (svg.includes('<svg')) return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return svg;
}

/** Deux feuilles Google Fonts (`css2`) réunies en une : le rendu n'en charge qu'une. */
export function mergeGoogleCss(...urls: (string | undefined)[]): string | undefined {
  const sheets = urls.filter((u): u is string => !!u && /^https:\/\/fonts\.googleapis\.com\/css2\?/.test(u));
  if (!sheets.length) return urls.find((u) => !!u);
  const families = new Set<string>();
  for (const sheet of sheets) for (const family of new URL(sheet).searchParams.getAll('family')) families.add(family);
  return `https://fonts.googleapis.com/css2?${[...families].map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+').replace(/%3A/gi, ':').replace(/%40/g, '@').replace(/%3B/gi, ';').replace(/%2C/gi, ',')}`).join('&')}&display=swap`;
}

/** Palette par défaut d'une marque sans couleurs (identique au module Communication d'IDEM). */
const DEFAULT_COLORS = { primary: '#144706', secondary: '#000066', accent: '#f59e0b', background: '#ffffff', text: '#0f172a' };

/** Couleurs, polices et logos d'une charte, au format du compositeur de visuels. */
export function visualBrandingFromKit(branding: BrandKit | null | undefined): VisualBrandContext['branding'] {
  const colors: Partial<Record<string, string>> = branding?.colors?.colors ?? DEFAULT_COLORS;
  const fonts = readFonts(branding);
  const typography = branding?.typography;
  const logo = branding?.logo;
  const slot = (path: LogoSlot) => logoSlotValue(logo, path) || undefined;
  const pair = (kind: 'withText' | 'iconOnly') =>
    slot(`assetUrls.${kind}.lightBackground` as LogoSlot) || slot(`variations.${kind}.lightBackground` as LogoSlot) || slot(`assetUrls.${kind}.darkBackground` as LogoSlot) || slot(`variations.${kind}.darkBackground` as LogoSlot) || slot(`assetUrls.${kind}.monochrome` as LogoSlot) || slot(`variations.${kind}.monochrome` as LogoSlot)
      ? {
          light: logoSrc(slot(`assetUrls.${kind}.lightBackground` as LogoSlot), slot(`variations.${kind}.lightBackground` as LogoSlot)),
          dark: logoSrc(slot(`assetUrls.${kind}.darkBackground` as LogoSlot), slot(`variations.${kind}.darkBackground` as LogoSlot)),
          mono: logoSrc(slot(`assetUrls.${kind}.monochrome` as LogoSlot), slot(`variations.${kind}.monochrome` as LogoSlot)),
        }
      : undefined;
  return {
    primary: colors.primary || '#0ea5e9',
    secondary: colors.secondary || '#1e293b',
    accent: colors.accent,
    background: colors.background,
    text: colors.text,
    // Les champs historiques de la charte IDEM d'abord (le rendu sait lire un ancien slug de
    // feuille), puis ceux d'une marque scannée (une feuille Google par police, réunies).
    primaryFont: typography?.primaryFont || fonts.display || undefined,
    secondaryFont: typography?.secondaryFont || fonts.body || undefined,
    fontUrl: typography?.url || mergeGoogleCss(fonts.displayCss, fonts.bodyCss),
    logoSvg: logo?.svg,
    // Les PNG hébergés d'abord ; le SVG en ligne (data-URI) pour une charte sans PNG.
    logoUrls: logo
      ? {
          primary: (logoSrc(slot('assetUrls.primary'), logo.svg) || logo.svg) as string,
          withText: pair('withText'),
          iconOnly: pair('iconOnly'),
        }
      : undefined,
  };
}

/** Le contexte complet d'un visuel, pour une marque d'iVision (nom, ton, charte). */
export function visualContextFromBrand(input: { brandName: string; voice: BrandVoice; branding: BrandKit | null | undefined }): VisualBrandContext {
  return {
    brandName: input.brandName,
    businessType: input.voice.businessType || 'business',
    tone: input.voice.tone || 'clear, confident, helpful',
    keywords: input.voice.keywords || [],
    language: input.voice.language || 'fr',
    ...(input.voice.valueProposition ? { valueProposition: input.voice.valueProposition } : {}),
    branding: visualBrandingFromKit(input.branding),
    ...(input.branding?.artDirection ? { artDirection: input.branding.artDirection as ArtDirectionModel } : {}),
  };
}
