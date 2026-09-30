import { isRenderUrlAllowed } from './render-network-guard';

const MAX_REDIRECTS = 3;

/**
 * `fetch` pour les URL fournies par un utilisateur (logo à importer, SVG à
 * convertir, image d'un document).
 *
 * Le serveur ne doit jamais servir de relais vers son propre réseau : l'URL,
 * puis chaque redirection, doit viser une adresse publique (ou un hôte de
 * stockage explicitement autorisé). Les redirections sont suivies à la main
 * pour que chaque saut soit revérifié.
 */
export async function fetchPublicUrl(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let url = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http(s) URLs are allowed');
    }
    if (!(await isRenderUrlAllowed(url))) {
      throw new Error('URL points to a non-public address');
    }

    const response = await fetch(url, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      url = new URL(location, url).toString();
      continue;
    }
    return response;
  }

  throw new Error('Too many redirects');
}

/** Vérification seule, pour les appelants qui utilisent un autre client HTTP. */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  if (!(await isRenderUrlAllowed(rawUrl))) {
    throw new Error('URL points to a non-public address');
  }
}
