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

const CHOICE_KEY = (projectId: string) => `idem:icode-choice:${projectId}`;

/**
 * Garde le choix fait sur le tableau de bord (site / application, web /
 * mobile) pour ce projet, et le remet dans l'adresse quand une redirection
 * l'a perdu (connexion, paiement, retour en arrière, lien sans paramètres).
 *
 * Appelé une fois, avant le premier rendu : tout le reste de l'atelier lit
 * l'adresse, il suffit donc qu'elle soit juste.
 */
export function rememberProductChoice(): void {
  try {
    const url = new URL(window.location.href);
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return;

    const product = currentProduct();
    if (product) {
      const platform = product === 'app' ? (currentPlatform() ?? 'web') : null;
      localStorage.setItem(CHOICE_KEY(projectId), JSON.stringify({ product, platform }));
      // L'application sans plateforme dans l'adresse est une application web.
      if (product === 'app' && !url.searchParams.get('platform')) {
        url.searchParams.set('platform', 'web');
        window.history.replaceState(window.history.state, '', url.toString());
      }
      return;
    }

    const raw = localStorage.getItem(CHOICE_KEY(projectId));
    if (!raw) return;
    const saved = JSON.parse(raw) as { product?: string; platform?: string | null };
    if (saved.product !== 'site' && saved.product !== 'app') return;

    url.searchParams.set('product', saved.product);
    if (saved.product === 'app') url.searchParams.set('platform', saved.platform === 'mobile' ? 'mobile' : 'web');
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // Stockage refusé (navigation privée) : l'adresse reste telle quelle.
  }
}

/** Ce qui se construit dans l'atelier, pour l'afficher à l'utilisateur. */
export type IdemBuildKind = 'site' | 'web-app' | 'mobile-app';

export function currentBuildKind(
  configs?: { landingPageConfig?: string; appPlatform?: string } | null
): IdemBuildKind | null {
  const product = currentProduct();
  if (product === 'site') return 'site';
  if (product === 'app') return currentPlatform() === 'mobile' ? 'mobile-app' : 'web-app';
  // Lien d'avant les deux produits : la configuration du projet décide.
  if (!configs) return null;
  if (configs.landingPageConfig === 'ONLY_LANDING') return 'site';
  return configs.appPlatform === 'mobile' ? 'mobile-app' : 'web-app';
}
