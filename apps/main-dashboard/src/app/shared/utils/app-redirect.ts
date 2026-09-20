import { environment } from '../../../environments/environment';

/**
 * Redirections vers les autres applications Idem après connexion.
 *
 * Aucune application de l'écosystème n'a son propre login : elles envoient
 * l'utilisateur ici avec `?redirect=<app>&returnUrl=<url>`, et c'est ce login
 * qui les y ramène une fois la session ouverte. La session elle-même voyage
 * par le cookie `session` posé par l'API Idem sur le domaine partagé — il n'y
 * a donc rien d'autre à transmettre.
 */
export type RedirectTarget = 'simulation';

/** Base autorisée pour chaque application acceptant un retour après login. */
export function appBaseUrl(target: RedirectTarget): string {
  switch (target) {
    case 'simulation':
      return environment.services.simulation.url;
  }
}

/**
 * Une `returnUrl` n'est suivie que si elle pointe bien vers l'application
 * annoncée : sans ce contrôle, le login serait un relais de redirection
 * ouvert, exploitable pour du hameçonnage.
 *
 * En développement, les applications tournent sur des ports `localhost` qui ne
 * correspondent pas toujours à la configuration : l'origine locale suffit.
 */
export function isTrustedReturnUrl(returnUrl: string, appUrl: string): boolean {
  try {
    const target = new URL(returnUrl, window.location.origin);
    if (target.origin === new URL(appUrl).origin) {
      return true;
    }
    return environment.environment === 'dev' && isLocalhost(target.hostname);
  } catch {
    return false;
  }
}

/**
 * Renvoie l'utilisateur sur l'application d'origine : la page qu'il demandait
 * si elle est digne de confiance, sinon la racine de cette application.
 */
export function redirectToApp(target: RedirectTarget, returnUrl: string | null): void {
  const base = appBaseUrl(target);

  if (returnUrl && !isTrustedReturnUrl(returnUrl, base)) {
    console.warn('Blocked redirect to untrusted returnUrl:', returnUrl);
    returnUrl = null;
  }

  window.location.href = returnUrl ?? base;
}

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
