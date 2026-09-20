/**
 * Lecture de la charte graphique stockée sur le projet : ce qu'elle contient
 * et ce qu'elle DOIT contenir.
 *
 * Partagé par la page d'affichage de la charte et par le mode Chat : les deux
 * montrent le même document, et une page annoncée manquante d'un côté mais pas
 * de l'autre serait un bug visible pour l'utilisateur.
 */

import { BRANDING_SECTION_NAMES } from './generation-completeness';

interface IconSet {
  lightBackground?: string;
  darkBackground?: string;
  monochrome?: string;
}

/** Sources d'icône du logo, lues comme l'API les lit. */
export interface LogoIconSources {
  iconSvg?: string;
  assetUrls?: { icon?: string; iconOnly?: IconSet };
  variations?: { iconOnly?: IconSet };
}

/** Ce que l'interface lit de la charte stockée. */
export interface StoredBranding {
  sections?: { name: string; data?: unknown }[];
  pdfFormat?: string;
  logo?: LogoIconSources;
}

/**
 * La page « Logomark » n'existe que si la marque a une icône — même condition
 * que l'API (`expectedCharterPageCount`, branding.service.ts). Sans ce filtre,
 * une marque dont le nom EST le logo afficherait une page manquante qui ne
 * sera jamais générée.
 */
export function hasLogomark(logo: LogoIconSources | undefined): boolean {
  const sets = [logo?.assetUrls?.iconOnly, logo?.variations?.iconOnly];
  return Boolean(
    logo?.assetUrls?.icon ||
    logo?.iconSvg ||
    sets.some((set) => set?.lightBackground || set?.darkBackground || set?.monochrome),
  );
}

/** Pages attendues de la charte, dans l'ordre du document. */
export function expectedBrandingSections(branding: StoredBranding | undefined): readonly string[] {
  return hasLogomark(branding?.logo)
    ? BRANDING_SECTION_NAMES
    : BRANDING_SECTION_NAMES.filter((name) => name !== 'Logomark');
}

/** La charte a des pages rendues (et pas seulement une coquille). */
export function hasCharterContent(branding: StoredBranding | undefined): boolean {
  return (branding?.sections ?? []).some(
    (section) => typeof section.data === 'string' && section.data.trim() !== '',
  );
}
