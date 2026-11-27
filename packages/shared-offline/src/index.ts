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
      // Une version restée en attente (ancien worker sans `skipWaiting`) :
      // la faire passer aux commandes, sans rechargement.
      registration.waiting?.postMessage('idem-sw:skip-waiting');

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
 * Retire le worker et ses caches, puis recharge une fois si la page en venait.
 *
 * En développement, le worker servait des modules Vite de sessions précédentes
 * (`?v=` périmés) : deux instances d'`@angular/core` cohabitaient et `inject()`
 * échouait (NG0203).
 */
export async function unregisterIdemServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
  if (typeof caches !== 'undefined') {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('idem-')).map((n) => caches.delete(n)));
  }
  // Après désinscription, le rechargement n'a plus de contrôleur : pas de boucle.
  if (navigator.serviceWorker.controller) window.location.reload();
}
