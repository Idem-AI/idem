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
 * `buildTokens` du moteur graphique (@idem/graphic-engine), exactement celui qui a produit les pages.
 */

import crypto from 'crypto';

import { BrandIdentityModel } from '../../models/brand-identity.model';
import { brandFromIdem, buildTokens } from '@idem/graphic-engine';

// Lecteurs de la marque : une seule implémentation, dans le moteur partagé (apps/ivision/core).
import { BrandFontTokens, BrandPalette, isHex6, LOGO_SLOTS, logoSlotValue, normalizeHex, PALETTE_ROLES, readFonts, readPalette, resolveLogoSlot } from '../../../../ivision/core/src/brand/brand-kit';
export { isHex6, LOGO_SLOTS, normalizeHex, PALETTE_ROLES, readFonts, readPalette, resolveLogoSlot };
export type { BrandFontTokens, BrandPalette, LogoSlot, PaletteRole } from '../../../../ivision/core/src/brand/brand-kit';

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

/**
 * Couleurs dérivées par le design system des documents.
 *
 * Elles ne dépendent QUE de la palette (le style et la graine pilotent la
 * grille, le rayon et le rythme, jamais la couleur) : une graine neutre suffit
 * donc à reproduire exactement les teintes posées sur les pages.
 */
/**
 * Les couleurs DÉRIVÉES que le moteur graphique pose dans les documents (encres lisibles, surfaces,
 * filets, rampes) : quand la charte change, ce sont elles qu'il faut traduire dans les livrables déjà
 * produits. Calculées exactement comme le moteur les calcule (`buildTokens`).
 */
function documentColorTokens(branding: Partial<BrandIdentityModel>): Array<[string, string]> {
  const { brand, direction } = brandFromIdem({ name: 'brand', branding: branding as never });
  const c = buildTokens({ brand: { ...brand, logos: undefined, patterns: undefined }, direction, format: 'a4-portrait' }).color;
  const tokens: Array<[string, string]> = [
    ['doc.primary', c.primary],
    ['doc.secondary', c.secondary],
    ['doc.accent', c.accent],
    ['doc.ground', c.ground],
    ['doc.ink', c.ink],
    ['doc.muted', c.muted],
    ['doc.faint', c.faint],
    ['doc.onBrand', c.onBrand],
    ['doc.onAccent', c.onAccent],
    ['doc.raised', c.raised],
    ['doc.sunken', c.sunken],
    ['doc.rule', c.rule],
    ['doc.ruleStrong', c.ruleStrong],
    ['doc.brandSoft', c.brandSoft],
    ['doc.accentSoft', c.accentSoft],
    ['doc.deep', c.deep],
    ['doc.onDeep', c.onDeep],
  ];
  for (const [stop, hex] of Object.entries(c.brandRamp)) tokens.push([`doc.brand.${stop}`, hex]);
  for (const [stop, hex] of Object.entries(c.accentRamp)) tokens.push([`doc.accent.${stop}`, hex]);
  for (const [stop, hex] of Object.entries(c.neutral)) tokens.push([`doc.neutral.${stop}`, hex]);
  return tokens
    .map(([name, hex]) => [name, normalizeHex(hex)] as [string, string])
    .filter(([, hex]) => !!hex);
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
