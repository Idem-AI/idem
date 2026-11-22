/**
 * UNE POLICE DEMANDÉE À LA RETOUCHE D'UN SITE (iCode : « mets les titres en Sora »).
 *
 * La famille est retrouvée dans un catalogue public (Google, Fontshare, Fontsource) ou parmi les polices importées de
 * la personne, et le site lit DIRECTEMENT l'adresse de sa feuille : rien n'est téléchargé ni déposé dans notre
 * stockage (le bucket n'est pas chargé inutilement). Jamais un paquet `@fontsource/…` importé dans le code du site :
 * il n'y est pas installé, et l'aperçu tombait en erreur.
 */
import { fontCatalogService } from '../font-catalog.service';

export interface SiteFont {
  family: string;
  /** La feuille `@font-face` à charger, telle que le catalogue la sert. */
  cssUrl: string;
  source: string;
  weights: number[];
}

/** La police d'un nom donné, ou `null` : aucune police de ce nom (jamais inventée). */
export async function resolveSiteFont(userId: string, family: string): Promise<SiteFont | null> {
  const found = await fontCatalogService.resolve(family, undefined, userId).catch(() => null);
  if (!found?.cssUrl) return null;
  return { family: found.family, cssUrl: found.cssUrl, source: found.source, weights: found.weights ?? [] };
}
