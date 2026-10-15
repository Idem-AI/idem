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
  artDirection?: { styleId?: string; keywords?: unknown; layout?: object | null; typography?: object | null; color?: object | null; graphicDevices?: unknown; dos?: unknown; donts?: unknown } | null;
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
    direction: { styleId: str(b?.artDirection?.styleId), ...(keywords?.length ? { keywords } : {}), ...densityOf((b?.artDirection?.layout as { density?: unknown } | null | undefined)?.density), ...grammarOf(b?.artDirection) },
  };
}

/** La densité de la grammaire (« airy », « balanced », « dense », éventuellement suivie d'une phrase). */
function densityOf(raw: unknown): { density?: 'airy' | 'balanced' | 'dense' } {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const d = (['airy', 'balanced', 'dense'] as const).find((x) => v.startsWith(x));
  return d ? { density: d } : {};
}

/**
 * La grammaire de composition de la charte, en texte compact pour l'auteur des pages : la façon d'occuper
 * l'espace propre à CETTE marque, pas celle de son style. Bornée (~900 signes) : elle part dans chaque prompt.
 */
export function grammarOf(ad: IdemBrandingLike['artDirection']): { grammar?: string } {
  if (!ad) return {};
  const t = (v: unknown, max = 160) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).slice(0, n).map((x) => x.trim().slice(0, 110)) : []);
  const layout = (ad.layout ?? {}) as Record<string, unknown>;
  const recipes = Array.isArray(layout.recipes) ? (layout.recipes as Array<Record<string, unknown>>).slice(0, 3).map((r) => `${t(r.name, 40)} (${t(r.use, 30)}): ${t(r.zones, 200)}`).filter((r) => r.length > 8) : [];
  const typo = (ad.typography ?? {}) as Record<string, unknown>;
  const color = (ad.color ?? {}) as Record<string, unknown>;
  const parts = [
    t(layout.grid) && `grid: ${t(layout.grid)}`,
    t(layout.whitespace) && `white space: ${t(layout.whitespace)}`,
    t(layout.signatureMove) && `SIGNATURE MOVE (visible on every page): ${t(layout.signatureMove, 200)}`,
    recipes.length ? `layout recipes: ${recipes.join(' | ')}` : '',
    t(typo.scaleContrast) && `type scale: ${t(typo.scaleContrast, 100)}`,
    t(typo.caseAndTracking) && `case: ${t(typo.caseAndTracking, 100)}`,
    t(typo.treatment) && t(typo.treatment) !== 'aucun' ? `type treatment: ${t(typo.treatment, 100)}` : '',
    t(color.distribution) && `colour split: ${t(color.distribution, 80)}; ${t(color.application, 120)}`,
    list(ad.graphicDevices, 3).length ? `graphic devices: ${list(ad.graphicDevices, 3).join('; ')}` : '',
    list(ad.dos, 3).length ? `do: ${list(ad.dos, 3).join('; ')}` : '',
    list(ad.donts, 3).length ? `never: ${list(ad.donts, 3).join('; ')}` : '',
  ].filter(Boolean);
  const grammar = parts.join('\n').slice(0, 1200);
  return grammar ? { grammar } : {};
}
