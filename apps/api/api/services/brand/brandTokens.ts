/**
 * Les JETONS de la marque : la seule source de vérité de l'identité visuelle.
 *
 * Tous les supports d'un projet — charte, business plans, decks, cartes de
 * visite, visuels, site — dérivent leurs couleurs, leurs polices et leurs logos
 * de trois champs de la base : `branding.colors`, `branding.typography` et
 * `branding.logo`. Ce module les traduit en une table de jetons NOMMÉS :
 *
 *   palette.primary        → #1f4e5f
 *   doc.brand.600          → #2b5566      (rampe calculée par le design system)
 *   doc.ink                → #0f1b1f      (encre garantie AAA sur le fond)
 *   font.display           → Fraunces
 *   logo.variations.withText.darkBackground → https://…/logo-with-text-dark.svg
 *
 * Un nom de jeton désigne un RÔLE ; sa valeur change avec la marque. C'est ce
 * qui permet de propager un changement sans IA : deux tables calculées par le
 * même code, l'une avant et l'autre après, donnent pour chaque rôle l'ancienne
 * et la nouvelle valeur (cf. `brandRewrite.ts`).
 *
 * Tout ici est déterministe et sans réseau : les dérivées viennent de
 * `buildDocumentDesignSystem`, exactement celui qui a produit les pages.
 */

import crypto from 'crypto';

import { BrandIdentityModel } from '../../models/brand-identity.model';
import { LogoModel } from '../../models/logo.model';
import { buildDocumentSeed } from '../design/designSeed';
import { buildDocumentDesignSystem } from '../design/documentDesignSystem';

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

export interface BrandTokens {
  /** Palette déclarée, normalisée en `#rrggbb` minuscule. Vide si absente. */
  palette: Partial<BrandPalette>;
  /**
   * Toutes les couleurs nommées, dans l'ORDRE DE PRIORITÉ : quand deux rôles
   * portent la même valeur, c'est le premier qui décide de sa traduction.
   */
  colors: Array<[name: string, hex: string]>;
  fonts: BrandFontTokens;
  /** Chaque emplacement de logo, par son chemin dans `LogoModel`. */
  logos: Array<[slot: string, value: string]>;
  /** Empreinte de l'identité : change dès qu'un jeton change. */
  fingerprint: string;
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
export function readPalette(branding?: Partial<BrandIdentityModel> | null): Partial<BrandPalette> {
  const source = branding?.colors?.colors;
  const palette: Partial<BrandPalette> = {};
  for (const role of PALETTE_ROLES) {
    const hex = normalizeHex(source?.[role]);
    if (hex) palette[role] = hex;
  }
  return palette;
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
 * Emplacement de repli quand le nouveau logo n'a pas la déclinaison demandée.
 *
 * Même logique que `resolveLogoDeclensions` : un trou dans la table ne doit
 * jamais laisser l'ANCIENNE image en place, on retombe donc sur la déclinaison
 * la plus proche, puis sur le logo primaire.
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
  return path.split('.').reduce<unknown>(
    (node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined),
    source
  );
}

function logoSlotValue(logo: Partial<LogoModel> | null | undefined, slot: LogoSlot): string {
  const value = readPath(logo, slot);
  return typeof value === 'string' ? value.trim() : '';
}

/** Valeur d'un emplacement, avec repli sur la déclinaison la plus proche. */
export function resolveLogoSlot(logo: Partial<LogoModel> | null | undefined, slot: LogoSlot): string {
  const own = logoSlotValue(logo, slot);
  if (own) return own;
  for (const fallback of LOGO_FALLBACKS[slot]) {
    const value = logoSlotValue(logo, fallback);
    if (value) return value;
  }
  return '';
}

/**
 * Couleurs dérivées par le design system des documents.
 *
 * Elles ne dépendent QUE de la palette (le style et la graine pilotent la
 * grille, le rayon et le rythme, jamais la couleur) : une graine neutre suffit
 * donc à reproduire exactement les teintes posées sur les pages.
 */
function documentColorTokens(branding: Partial<BrandIdentityModel>): Array<[string, string]> {
  const ds = buildDocumentDesignSystem(
    branding as Parameters<typeof buildDocumentDesignSystem>[0],
    null,
    buildDocumentSeed(null, 'brand-tokens')
  );
  const c = ds.colors;
  const tokens: Array<[string, string]> = [
    ['doc.primary', c.primary],
    ['doc.secondary', c.secondary],
    ['doc.accent', c.accent],
    ['doc.surface', c.surface],
    ['doc.ink', c.ink],
    ['doc.inkMuted', c.inkMuted],
    ['doc.onAccent', c.onAccent],
    ['doc.surfaceRaised', c.surfaceRaised],
    ['doc.rule', c.rule],
  ];
  for (const [stop, hex] of Object.entries(c.brand)) tokens.push([`doc.brand.${stop}`, hex]);
  for (const [stop, hex] of Object.entries(c.neutral)) tokens.push([`doc.neutral.${stop}`, hex]);
  return tokens
    .map(([name, hex]) => [name, normalizeHex(hex)] as [string, string])
    .filter(([, hex]) => !!hex);
}

export function readFonts(branding?: Partial<BrandIdentityModel> | null): BrandFontTokens {
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

export function computeBrandTokens(branding?: Partial<BrandIdentityModel> | null): BrandTokens {
  const source = branding ?? {};
  const palette = readPalette(source);

  const colors: Array<[string, string]> = [
    ...PALETTE_ROLES.filter((role) => palette[role]).map(
      (role) => [`palette.${role}`, palette[role]!] as [string, string]
    ),
    ...documentColorTokens(source),
  ];

  const fonts = readFonts(source);

  const logos = LOGO_SLOTS.map(
    (slot) => [slot, logoSlotValue(source.logo, slot)] as [string, string]
  ).filter(([, value]) => !!value);

  const fingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify({ palette, fonts, logos }))
    .digest('hex')
    .slice(0, 16);

  return { palette, colors, fonts, logos, fingerprint };
}
