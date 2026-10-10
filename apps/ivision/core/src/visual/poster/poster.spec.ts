/**
 * La géométrie d'un format et la « spec » d'une composition (tout ce qu'un gabarit lit).
 */
import { FORMAT_DIMENSIONS } from '../flyer.render';
import type { FlyerFormat } from '../visual.model';
import { buildSchemes } from './poster.schemes';
import type { PosterChoice, PosterCopy, PosterImage, PosterLogo, PosterScheme, PosterSpec } from './poster.types';

export function geometry(format: FlyerFormat): Pick<PosterSpec, 'width' | 'height' | 'u' | 'orientation' | 'safe'> {
  const dims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;
  const u = Math.min(W, H) / 100;
  const orientation: PosterSpec['orientation'] = H > W * 1.15 ? 'portrait' : W > H * 1.15 ? 'landscape' : 'square';
  const m = (format === 'a4' ? 8 : 7) * u;
  // Story : l'interface du réseau (profil en haut, réponse en bas) couvre ~12 % et ~15 % de la hauteur.
  const safe = format === 'story' ? { top: Math.round(H * 0.12), right: m, bottom: Math.round(H * 0.15), left: m } : { top: m, right: m, bottom: m, left: m };
  return { width: W, height: H, u, orientation, safe };
}

export interface SpecInput {
  format: FlyerFormat;
  copy: PosterCopy;
  palette: { primary: string; secondary?: string; accent?: string; background?: string; text?: string };
  image?: PosterImage;
  extraImages?: PosterImage[];
  logo: PosterLogo;
  brandName: string;
  language: string;
  allowDark?: boolean;
}

export function paletteOf(p: SpecInput['palette']): PosterSpec['palette'] {
  const hex = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined);
  const primary = hex(p.primary) || '#1447e6';
  return { primary, secondary: hex(p.secondary) || primary, accent: hex(p.accent) || hex(p.secondary) || primary, background: hex(p.background) || '#ffffff', text: hex(p.text) || '#111111' };
}

export function schemesOf(input: SpecInput): PosterScheme[] {
  return buildSchemes(paletteOf(input.palette), { allowDark: input.allowDark });
}

export function specFor(input: SpecInput, choice: PosterChoice, schemes = schemesOf(input)): PosterSpec | null {
  const scheme = schemes.find((s) => s.id === choice.scheme);
  if (!scheme) return null;
  return {
    format: input.format,
    ...geometry(input.format),
    copy: { ...input.copy, emphasis: choice.emphasis ?? input.copy.emphasis },
    scheme,
    palette: paletteOf(input.palette),
    image: input.image,
    extraImages: input.extraImages || [],
    treatment: choice.treatment,
    logo: input.logo,
    brandName: input.brandName,
    mirror: choice.mirror,
    language: input.language,
  };
}
