/**
 * LA MARQUE, telle que le moteur partagé la lit.
 *
 * Deux sources produisent une marque :
 *   - la charte d'un projet IDEM (`branding` : couleurs, typographie, logo, direction artistique) ;
 *   - le scan d'un site web dans iVision (`site/site-scanner.ts`), quand l'utilisateur colle son lien.
 *
 * Les deux donnent un `BrandKit` : le sous-ensemble de la charte IDEM que les moteurs lisent,
 * avec les MÊMES champs. Une charte IDEM est donc déjà un BrandKit (aucune conversion), et une
 * marque scannée se lit exactement comme une charte. Les lecteurs ci-dessous (palette, polices,
 * emplacements de logo avec leurs replis) sont la seule implémentation, partagée par les
 * documents IDEM (`apps/api/.../brand/brandTokens.ts`), les vidéos et les visuels.
 */
import type { ArtDirectionModel } from './art-direction.model';

export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'background' | 'text';
export const PALETTE_ROLES: PaletteRole[] = ['primary', 'secondary', 'accent', 'background', 'text'];
export type BrandPalette = Record<PaletteRole, string>;

export interface BrandFontTokens {
  display: string;
  body: string;
  displayCss?: string;
  bodyCss?: string;
  /** Feuille unique historique (`typography.url`) quand elle est un vrai lien. */
  sheetUrl?: string;
}

export interface BrandFontRef {
  family?: string;
  cssUrl?: string;
}

/** Les logos : chaînes (URL, data-URI ou SVG) rangées comme dans la charte IDEM. */
export interface BrandLogo {
  svg?: string;
  iconSvg?: string;
  assetUrls?: object;
  variations?: object;
}

/** Le contexte rédactionnel de la marque (ton, promesse, secteur). */
export interface BrandVoice {
  brandName?: string;
  businessType?: string;
  tone?: string;
  valueProposition?: string;
  keywords?: string[];
  language?: string;
}

/**
 * Seuls les champs lus sont déclarés (pas de signature d'index) : une charte IDEM complète
 * (`BrandIdentityModel`) s'y affecte telle quelle.
 */
export interface BrandKit {
  colors?: { colors?: Partial<Record<PaletteRole, string>> } | null;
  typography?: {
    primary?: BrandFontRef;
    secondary?: BrandFontRef;
    primaryFont?: string;
    secondaryFont?: string;
    url?: string;
  } | null;
  logo?: BrandLogo | null;
  artDirection?: Partial<ArtDirectionModel> | null;
}

const HEX6 = /^#[0-9a-f]{6}$/;

/** `#ABC`, `#aabbcc`, `aabbcc` → `#aabbcc` ; toute autre forme → ''. */
export function normalizeHex(value: unknown): string {
  if (typeof value !== 'string') return '';
  let hex = value.trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(hex)) hex = hex.split('').map((c) => c + c).join('');
  if (/^[0-9a-f]{8}$/.test(hex)) hex = hex.slice(0, 6);
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : '';
}

export function isHex6(value: string): boolean {
  return HEX6.test(value);
}

/** Palette déclarée par la charte, normalisée ; les rôles illisibles sont omis. */
export function readPalette(branding?: BrandKit | null): Partial<BrandPalette> {
  const source = branding?.colors?.colors;
  const palette: Partial<BrandPalette> = {};
  for (const role of PALETTE_ROLES) {
    const hex = normalizeHex(source?.[role]);
    if (hex) palette[role] = hex;
  }
  return palette;
}

export function readFonts(branding?: BrandKit | null): BrandFontTokens {
  const typography = branding?.typography;
  const display = (typography?.primary?.family || typography?.primaryFont || '').trim();
  const body = (typography?.secondary?.family || typography?.secondaryFont || '').trim();
  const sheet = (typography?.url || '').trim();
  return {
    display,
    body,
    displayCss: typography?.primary?.cssUrl?.trim() || undefined,
    bodyCss: typography?.secondary?.cssUrl?.trim() || undefined,
    sheetUrl: /^https?:\/\//.test(sheet) ? sheet : undefined,
  };
}

/**
 * Les emplacements de logo, dans un ordre stable.
 *
 * Le chemin sert de NOM de jeton : l'ancienne déclinaison « fond sombre » est
 * remplacée par la nouvelle déclinaison « fond sombre », jamais par le logo
 * primaire — sinon une page sombre recevrait un logo foncé illisible.
 */
export const LOGO_SLOTS = [
  'assetUrls.primary',
  'svg',
  'assetUrls.icon',
  'iconSvg',
  'assetUrls.withText.lightBackground',
  'variations.withText.lightBackground',
  'assetUrls.withText.darkBackground',
  'variations.withText.darkBackground',
  'assetUrls.withText.monochrome',
  'variations.withText.monochrome',
  'assetUrls.iconOnly.lightBackground',
  'variations.iconOnly.lightBackground',
  'assetUrls.iconOnly.darkBackground',
  'variations.iconOnly.darkBackground',
  'assetUrls.iconOnly.monochrome',
  'variations.iconOnly.monochrome',
] as const;

export type LogoSlot = (typeof LOGO_SLOTS)[number];

/**
 * Emplacement de repli quand le logo n'a pas la déclinaison demandée : un trou dans la
 * table ne doit jamais laisser l'ANCIENNE image en place, on retombe donc sur la
 * déclinaison la plus proche, puis sur le logo primaire.
 */
const LOGO_FALLBACKS: Record<LogoSlot, LogoSlot[]> = {
  'assetUrls.primary': ['svg'],
  svg: ['assetUrls.primary'],
  'assetUrls.icon': ['iconSvg', 'assetUrls.iconOnly.lightBackground', 'assetUrls.primary', 'svg'],
  iconSvg: ['assetUrls.icon', 'variations.iconOnly.lightBackground', 'svg', 'assetUrls.primary'],
  'assetUrls.withText.lightBackground': ['variations.withText.lightBackground', 'assetUrls.primary', 'svg'],
  'variations.withText.lightBackground': ['assetUrls.withText.lightBackground', 'svg', 'assetUrls.primary'],
  'assetUrls.withText.darkBackground': ['variations.withText.darkBackground', 'assetUrls.primary', 'svg'],
  'variations.withText.darkBackground': ['assetUrls.withText.darkBackground', 'svg', 'assetUrls.primary'],
  'assetUrls.withText.monochrome': ['variations.withText.monochrome', 'assetUrls.primary', 'svg'],
  'variations.withText.monochrome': ['assetUrls.withText.monochrome', 'svg', 'assetUrls.primary'],
  'assetUrls.iconOnly.lightBackground': ['variations.iconOnly.lightBackground', 'assetUrls.icon', 'iconSvg', 'assetUrls.primary', 'svg'],
  'variations.iconOnly.lightBackground': ['assetUrls.iconOnly.lightBackground', 'iconSvg', 'assetUrls.icon', 'svg', 'assetUrls.primary'],
  'assetUrls.iconOnly.darkBackground': ['variations.iconOnly.darkBackground', 'assetUrls.icon', 'iconSvg', 'assetUrls.primary', 'svg'],
  'variations.iconOnly.darkBackground': ['assetUrls.iconOnly.darkBackground', 'iconSvg', 'assetUrls.icon', 'svg', 'assetUrls.primary'],
  'assetUrls.iconOnly.monochrome': ['variations.iconOnly.monochrome', 'assetUrls.icon', 'iconSvg', 'assetUrls.primary', 'svg'],
  'variations.iconOnly.monochrome': ['assetUrls.iconOnly.monochrome', 'iconSvg', 'assetUrls.icon', 'svg', 'assetUrls.primary'],
};

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), source);
}

export function logoSlotValue(logo: BrandLogo | object | null | undefined, slot: LogoSlot): string {
  const value = readPath(logo, slot);
  return typeof value === 'string' ? value.trim() : '';
}

/** Valeur d'un emplacement, avec repli sur la déclinaison la plus proche. */
export function resolveLogoSlot(logo: BrandLogo | object | null | undefined, slot: LogoSlot): string {
  const own = logoSlotValue(logo, slot);
  if (own) return own;
  for (const fallback of LOGO_FALLBACKS[slot]) {
    const value = logoSlotValue(logo, fallback);
    if (value) return value;
  }
  return '';
}
