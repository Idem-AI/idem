/**
 * Enregistrement du service worker partagé d'IDEM.
 *
 * Le worker lui-même est `src/sw.js`, recopié par chaque application à la
 * racine de ses assets (`/sw.js`) : un service worker ne peut contrôler que
 * les pages situées sous son propre chemin, donc il doit être servi depuis la
 * racine du site, pas depuis un sous-dossier.
 */

/** Ce que le worker envoie quand une version plus récente est disponible. */
export const IDEM_SW_UPDATE = 'idem-sw:update';

export interface IdemServiceWorkerOptions {
  /** Appelé quand une version plus récente est prête. */
  onUpdate?: () => void;
  /** Chemin du worker. Par défaut `/sw.js`. */
  url?: string;
}

/**
 * Enregistre le service worker, sans rien bloquer.
 *
 * L'enregistrement est repoussé après `load` : sur un lien faible, la requête
 * du worker entrerait sinon en concurrence avec le premier rendu, ce qui
 * reviendrait à payer la deuxième visite au prix de la première.
 *
 * Sans effet si le navigateur ne sait pas faire, ou hors HTTPS (le service
 * worker exige une origine sûre ; `localhost` compte comme telle).
 */
export function registerIdemServiceWorker(options: IdemServiceWorkerOptions = {}): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  const url = options.url ?? '/sw.js';

  const start = (): void => {
    void navigator.serviceWorker.register(url).then((registration) => {
      // Une version déjà en attente : prévenir tout de suite.
      if (registration.waiting) options.onUpdate?.();

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // `controller` non nul = ce n'est pas la première installation,
          // donc c'est bien un remplacement de version.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            options.onUpdate?.();
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (event.data === IDEM_SW_UPDATE) options.onUpdate?.();
    });
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

/**
 * Applique la version en attente et recharge. À n'appeler que sur un geste de
 * l'utilisateur : échanger les fichiers pendant qu'il travaille lui ferait
 * perdre ce qu'il est en train de faire.
 */
export async function applyIdemServiceWorkerUpdate(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }

  // Recharger seulement une fois le nouveau worker aux commandes, sinon la
  // page repartirait sur l'ancienne version.
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => window.location.reload(),
    { once: true },
  );
  waiting.postMessage('idem-sw:skip-waiting');
}
