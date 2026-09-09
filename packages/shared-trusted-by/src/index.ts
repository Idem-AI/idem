/**
 * Cœur indépendant de tout framework : les données des partenaires.
 *
 * Les rendus vivent dans des points d'entrée séparés, pour qu'une application
 * React n'embarque pas Angular et réciproquement :
 * `@idem/shared-trusted-by/angular` et `@idem/shared-trusted-by/react`. Ils
 * partagent la même feuille, `./trusted-by.css`, que les vues Blade chargent
 * depuis la copie déposée par `npm run sync:trusted-by`.
 */
export {
  PARTNERS,
  TRUSTED_BY_ASSETS_BASE_PATH,
  resolvePartners,
  type Partner,
  type ResolvedPartner,
} from './partners';
