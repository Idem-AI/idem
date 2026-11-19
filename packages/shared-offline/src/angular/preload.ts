import { Injectable } from '@angular/core';
import { type PreloadingStrategy, type Route } from '@angular/router';
import { EMPTY, type Observable, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

/**
 * Informations réseau du navigateur. `NetworkInformation` n'est pas dans la
 * bibliothèque TypeScript standard : Chrome et les navigateurs Android la
 * proposent, Safari et Firefox non — d'où les champs optionnels.
 */
interface NetworkInformation {
  readonly saveData?: boolean;
  readonly effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
}

/** Combien de temps on laisse le premier écran respirer avant de précharger. */
const QUIET_PERIOD_MS = 2000;

/**
 * Précharge les pages paresseuses, mais seulement quand le réseau le permet.
 *
 * Le problème : les routes sont bien découpées en chargement paresseux — c'est
 * ce qui garde le premier écran léger — mais chaque clic attend ensuite son
 * morceau. Sur un lien à 30 Ko/s, cela fait une attente visible à chaque
 * navigation.
 *
 * Précharger systématiquement serait pire : les morceaux se disputeraient la
 * bande passante avec ce que l'utilisateur regarde. Cette stratégie précharge
 * donc UNIQUEMENT quand :
 *
 * - le navigateur ne signale pas le mode économie de données (`saveData`) —
 *   l'utilisateur a demandé explicitement qu'on épargne son forfait ;
 * - la connexion n'est pas annoncée en 2G ;
 * - la route le demande (`data.preload !== false`).
 *
 * Et toujours après un délai de deux secondes : le premier écran a la priorité.
 *
 * Sur les navigateurs sans `connection` (Safari, Firefox), on précharge : ne
 * rien précharger pénaliserait tout le monde pour une information manquante.
 *
 * @example Exclure une route lourde et rarement visitée
 * ```ts
 * { path: 'admin', loadComponent: …, data: { preload: false } }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class IdemNetworkAwarePreloading implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] === false) return EMPTY;
    if (!this.networkAllows()) return EMPTY;
    return timer(QUIET_PERIOD_MS).pipe(mergeMap(() => load()));
  }

  private networkAllows(): boolean {
    if (typeof navigator === 'undefined') return false;

    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (!connection) return true;

    if (connection.saveData) return false;

    const type = connection.effectiveType;
    return type !== 'slow-2g' && type !== '2g';
  }
}
