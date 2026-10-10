import type { SeoLocale } from './ecosystem';

/**
 * Les images de partage (Open Graph / X), une par page et par langue.
 *
 * Elles sont dessinées par l'API à partir d'un gabarit HTML
 * (`apps/api/public/og/template.html`), de textes par langue
 * (`apps/api/public/og/i18n/<langue>.json`) et d'une illustration africaine
 * par clé (`apps/api/public/og/illustrations/<clé>.svg`). Ajouter une clé ici
 * oblige à écrire ses textes et son dessin : `npm run seo:check` le vérifie.
 */
export const OG_KEYS = [
  'home',
  'business',
  'simulator',
  'icode',
  'ideploy',
  'ivision',
  'pricing',
  'about',
  'open-source',
  'african-market',
  'contact',
  'beta',
  'legal',
  'not-found',
] as const;

export type OgKey = (typeof OG_KEYS)[number];

/** Le format recommandé par Facebook, LinkedIn, X et WhatsApp. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** Où l'API sert les images. */
export const OG_IMAGE_BASE = 'https://api.idem.africa/og';

/** L'adresse de l'image de partage d'une page, dans la langue de la page. */
export function ogImageUrl(key: OgKey, locale: SeoLocale): string {
  return `${OG_IMAGE_BASE}/${locale}/${key}.png`;
}

export function isOgKey(value: string): value is OgKey {
  return (OG_KEYS as readonly string[]).includes(value);
}
