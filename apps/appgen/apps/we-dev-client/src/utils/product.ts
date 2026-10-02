/**
 * Un projet IDEM peut avoir deux produits : son site vitrine et son
 * application. Le tableau de bord ouvre iCode avec `?product=site` ou
 * `?product=app`, et chacun garde sa conversation, son code et son adresse
 * publiée.
 *
 * Le site reste le produit par défaut et garde les emplacements d'avant
 * (`<projectId>_chat`, `<projectId>_deployment`…) : les projets existants
 * retrouvent leur travail sans migration.
 */
export type IdemProduct = 'site' | 'app';

/** Le produit demandé dans l'adresse, ou `null` s'il n'est pas précisé. */
export function currentProduct(): IdemProduct | null {
  const product = new URLSearchParams(window.location.search).get('product');
  return product === 'site' || product === 'app' ? product : null;
}

/** Paramètre à ajouter aux appels de stockage de l'API IDEM. */
export function productQuery(): string {
  return currentProduct() === 'app' ? '?product=app' : '';
}

/** Clé locale propre au produit (caches du navigateur). */
export function productScope(id: string): string {
  return currentProduct() === 'app' ? `${id}:app` : id;
}

/**
 * Pour l'application : web (par défaut) ou mobile. Le tableau de bord ajoute
 * `?platform=mobile` ; l'aperçu s'ouvre alors dans un cadre de téléphone et le
 * serveur génère une application pensée pour le téléphone.
 */
export type IdemPlatform = 'web' | 'mobile';

export function currentPlatform(): IdemPlatform | null {
  const platform = new URLSearchParams(window.location.search).get('platform');
  return platform === 'web' || platform === 'mobile' ? platform : null;
}

/** L'atelier ouvert construit-il une application mobile ? */
export function isMobileApp(): boolean {
  return currentProduct() === 'app' && currentPlatform() === 'mobile';
}
