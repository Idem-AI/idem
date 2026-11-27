import { inject, isDevMode, provideAppInitializer, type EnvironmentProviders } from '@angular/core';

import { unregisterIdemServiceWorker } from '../index';
import { IdemServiceWorkerService } from './service-worker.service';

export { IdemServiceWorkerService } from './service-worker.service';
export { IdemNetworkAwarePreloading } from './preload';

/**
 * Branche le service worker partagé.
 *
 * À mettre dans les `providers` de `app.config.ts`. L'enregistrement lui-même
 * est repoussé après `load` (voir `registerIdemServiceWorker`) : sur un lien
 * faible, la requête du worker entrerait sinon en concurrence avec le premier
 * rendu, ce qui reviendrait à payer la deuxième visite au prix de la première.
 *
 * @example
 * ```ts
 * providers: [provideIdemServiceWorker(), ...]
 * ```
 */
export function provideIdemServiceWorker(): EnvironmentProviders {
  return provideAppInitializer(() => {
    // `ng serve` : le worker mettrait en cache les modules Vite, qui changent à chaque session.
    if (isDevMode()) {
      void unregisterIdemServiceWorker();
      return;
    }
    inject(IdemServiceWorkerService).register();
  });
}
