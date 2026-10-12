/**
 * Les DÉCLINAISONS du logo d'une marque, résolues en adresses d'image prêtes à poser.
 *
 * Le moteur graphique (@idem/graphic-engine) choisit lui-même la déclinaison selon la luminance de la zone
 * où il pose le logo : il lui faut, pour chaque usage (complet, icône ; sur fond clair, sur fond sombre,
 * monochrome), une adresse valide — jamais un SVG brut, jamais un chemin symbolique.
 */

import { LogoModel } from '../models/logo.model';

/** Transforme un champ de logo en `src` d'image valide, ou renvoie ''. */
function toImgSrc(value?: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  if (trimmed.includes('<svg')) {
    return `data:image/svg+xml;base64,${Buffer.from(trimmed).toString('base64')}`;
  }
  return '';
}

export interface LogoDeclensions {
  primary: string;
  icon: string;
  withTextLight: string;
  withTextDark: string;
  withTextMono: string;
  iconLight: string;
  iconDark: string;
  iconMono: string;
}

/**
 * Résout toutes les déclinaisons en URLs affichables.
 *
 * Les PNG hébergés (`assetUrls`) priment ; on retombe sur les SVG hébergés
 * (`variations`) pour les projets antérieurs, et une déclinaison absente reprend
 * le logo primaire — un trou dans la table laisserait une image cassée sur la page.
 */
export function resolveLogoDeclensions(logo?: LogoModel | null): LogoDeclensions | null {
  if (!logo) return null;

  const a = logo.assetUrls;
  const v = logo.variations;
  const primary = toImgSrc(a?.primary) || toImgSrc(logo.svg);
  if (!primary) return null;

  const pick = (...candidates: Array<string | undefined>): string => {
    for (const candidate of candidates) {
      const src = toImgSrc(candidate);
      if (src) return src;
    }
    return primary;
  };

  return {
    primary,
    icon: pick(a?.icon, logo.iconSvg),
    withTextLight: pick(a?.withText?.lightBackground, v?.withText?.lightBackground),
    withTextDark: pick(a?.withText?.darkBackground, v?.withText?.darkBackground),
    withTextMono: pick(a?.withText?.monochrome, v?.withText?.monochrome),
    iconLight: pick(a?.iconOnly?.lightBackground, v?.iconOnly?.lightBackground),
    iconDark: pick(a?.iconOnly?.darkBackground, v?.iconOnly?.darkBackground),
    iconMono: pick(a?.iconOnly?.monochrome, v?.iconOnly?.monochrome),
  };
}
