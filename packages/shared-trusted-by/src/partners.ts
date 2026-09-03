import data from '../partners.json';

/** Un partenaire affiché dans le bandeau « Ils nous font confiance ». */
export interface Partner {
  /** Nom lisible, utilisé pour l'alternative textuelle et l'infobulle. */
  name: string;
  /** Nom du fichier logo, tel que déposé dans le dossier public de l'app. */
  logo: string;
  /** Site du partenaire, ouvert dans un nouvel onglet. */
  url: string;
}

/** Un partenaire dont le logo est déjà résolu en URL servable. */
export interface ResolvedPartner extends Partner {
  logoUrl: string;
}

/**
 * Chemin sous lequel `sync:trusted-by` dépose les logos dans le dossier
 * public de chaque application.
 */
export const TRUSTED_BY_ASSETS_BASE_PATH: string = data.assetsBasePath;

/** Les partenaires, dans l'ordre d'affichage. Source : `partners.json`. */
export const PARTNERS: readonly Partner[] = data.partners;

/**
 * Préfixe le logo de chaque partenaire par `basePath`.
 *
 * Les applications ne servent pas toutes leurs images au même endroit — une
 * base explicite évite d'avoir à réécrire la liste pour chacune.
 */
export function resolvePartners(basePath: string = TRUSTED_BY_ASSETS_BASE_PATH): ResolvedPartner[] {
  const base = basePath.replace(/\/+$/, '');
  return PARTNERS.map((partner) => ({ ...partner, logoUrl: `${base}/${partner.logo}` }));
}
