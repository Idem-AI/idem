/**
 * Les ADAPTATEURS IDEM : de la charte telle que les applications IDEM AFRICA la stockent (modèle
 * `BrandIdentityModel` de l'API, mêmes champs côté iVision) à l'entrée du moteur.
 *
 * Les types sont STRUCTURELS : le paquet n'importe jamais les modèles d'une application, il lit les champs
 * dont il a besoin. Rien n'est inventé : une couleur absente reste absente (le moteur la dérive), un logo
 * absent n'est pas remplacé par un faux.
 */
import type { BrandInput, BrandLogos, BrandPattern, DirectionInput } from '../design-system/tokens';

export interface IdemPaletteLike {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
}

/** La charte d'un projet, lue structurellement (`analysisResultModel.branding`). */
export interface IdemBrandingLike {
  colors?: { colors?: IdemPaletteLike | null } | null;
  typography?: {
    primaryFont?: string;
    secondaryFont?: string;
    primary?: { family?: string; cssUrl?: string } | null;
    secondary?: { family?: string; cssUrl?: string } | null;
  } | null;
  artDirection?: { styleId?: string; keywords?: unknown } | null;
  patterns?: { items?: Array<{ url?: string; tile?: number; ground?: string; kind?: string }> | null } | null;
}

/** Les déclinaisons du logo, déjà résolues en adresses affichables (`resolveLogoDeclensions` de l'API). */
export interface IdemLogoSetLike {
  primary?: string;
  icon?: string;
  withTextLight?: string;
  withTextDark?: string;
  withTextMono?: string;
  iconLight?: string;
  iconDark?: string;
  iconMono?: string;
}

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const hex = (value: unknown): string | undefined => (typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : undefined);
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

export function logosFromIdem(set?: IdemLogoSetLike | null, aspect?: number): BrandLogos | undefined {
  if (!set) return undefined;
  const logos: BrandLogos = {
    primary: str(set.primary),
    onLight: str(set.withTextLight) ?? str(set.primary),
    onDark: str(set.withTextDark),
    mono: str(set.withTextMono),
    icon: str(set.icon),
    iconOnLight: str(set.iconLight),
    iconOnDark: str(set.iconDark),
    ...(aspect ? { aspect } : {}),
  };
  return Object.values(logos).some(Boolean) ? logos : undefined;
}

export function patternsFromIdem(branding?: IdemBrandingLike | null): BrandPattern[] | undefined {
  const items = (branding?.patterns?.items ?? [])
    .filter((p): p is { url: string; tile?: number; ground?: string; kind?: string } => Boolean(p && typeof p.url === 'string' && p.url))
    .map((p) => ({ url: p.url, tile: typeof p.tile === 'number' && p.tile > 0 ? p.tile : 48, ...(hex(p.ground) ? { ground: hex(p.ground) } : {}), ...(p.kind ? { motif: p.kind } : {}) }));
  return items.length ? items : undefined;
}

/**
 * La charte d'un projet IDEM → l'entrée du moteur (marque + direction). Les feuilles de style des polices
 * (Google, Fontshare, police importée) sont reprises telles quelles : c'est le seul moyen de charger une
 * police venue d'ailleurs que de Google.
 */
export function brandFromIdem(input: { name: string; branding?: IdemBrandingLike | null; logos?: IdemLogoSetLike | null; logoAspect?: number }): { brand: BrandInput; direction: DirectionInput } {
  const b = input.branding ?? undefined;
  const palette = b?.colors?.colors ?? undefined;
  const typo = b?.typography ?? undefined;
  const display = str(typo?.primaryFont) ?? str(typo?.primary?.family);
  const body = str(typo?.secondaryFont) ?? str(typo?.secondary?.family);
  const keywords = Array.isArray(b?.artDirection?.keywords) ? (b?.artDirection?.keywords as unknown[]).filter((k): k is string => typeof k === 'string' && Boolean(k.trim())).slice(0, 10) : undefined;
  return {
    brand: {
      name: str(input.name) ?? 'Marque',
      palette: palette
        ? { primary: hex(palette.primary), secondary: hex(palette.secondary), accent: hex(palette.accent), background: hex(palette.background), text: hex(palette.text) }
        : undefined,
      fonts: display || body ? { display, body, displayCss: str(typo?.primary?.cssUrl), bodyCss: str(typo?.secondary?.cssUrl) } : undefined,
      logos: logosFromIdem(input.logos, input.logoAspect),
      patterns: patternsFromIdem(b),
    },
    direction: { styleId: str(b?.artDirection?.styleId), ...(keywords?.length ? { keywords } : {}) },
  };
}
