import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NavigationError, Router } from '@angular/router';

import { applyIdemServiceWorkerUpdate, registerIdemServiceWorker } from '../index';

/** À quelle fréquence un onglet ouvert demande si une version a été déployée. */
const CHECK_EVERY_MS = 5 * 60 * 1000;
/** Une navigation vérifie aussi, au plus à cette cadence. */
const NAVIGATION_CHECK_MS = 60 * 1000;
const RELOADED_FOR_CHUNK = 'idem_reloaded_for_chunk';

/**
 * « Cet onglet tourne-t-il sur la version déployée ? »
 *
 * Deux sources, un seul signal :
 *
 * 1. **Le service worker**, qui prévient quand il a récupéré une version plus
 *    récente en arrière-plan.
 * 2. **L'ETag de `index.html`**, interrogé de temps en temps. Une application
 *    d'une seule page garde le code qu'elle a chargé : un onglet ouvert avant
 *    une mise en production continuait des heures sur l'ancien — correctifs
 *    déployés, rien ne changeait à l'écran. La requête est un `HEAD`, donc
 *    quelques octets, ce qui reste acceptable à bas débit.
 *
 * Une page paresseuse dont le fichier n'existe plus après une mise en
 * production recharge d'elle-même, une fois par session : un fichier toujours
 * manquant après rechargement est une vraie erreur, pas une nouvelle version.
 *
 * (Mécanisme d'origine : `AppVersionService` d'iDeploy, généralisé ici pour
 * que les six applications en bénéficient et qu'il n'y ait qu'une bannière.)
 */
@Injectable({ providedIn: 'root' })
export class IdemServiceWorkerService {
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  /** Vrai quand une version plus récente attend d'être appliquée. */
  readonly updateAvailable = signal(false);

  private loaded: string | null = null;
  private lastCheck = 0;
  private started = false;

  /** Appelé une fois, par `provideIdemServiceWorker()`. */
  register(): void {
    if (this.started) return;
    this.started = true;

    registerIdemServiceWorker({ onUpdate: () => this.updateAvailable.set(true) });
    this.watchDeployedVersion();
  }

  /** Applique la version en attente et recharge. Geste de l'utilisateur. */
  applyUpdate(): void {
    // `applyIdemServiceWorkerUpdate` recharge de lui-même, après avoir fait
    // passer le nouveau worker aux commandes — un simple `reload()` repartirait
    // sur l'ancienne version, servie par le worker encore actif.
    void applyIdemServiceWorkerUpdate();
  }

  /** « Plus tard » : la barre disparaît, la version suivante s'appliquera seule. */
  dismissUpdate(): void {
    this.updateAvailable.set(false);
  }

  private watchDeployedVersion(): void {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;

    void this.check();

    const timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.check();
    });

    this.router?.events.subscribe((event) => {
      if (event instanceof NavigationError && this.isMissingChunk(event.error)) {
        this.reloadOnceForChunk();
        return;
      }
      if (Date.now() - this.lastCheck > NAVIGATION_CHECK_MS) void this.check();
    });
  }

  private async check(): Promise<void> {
    if (this.updateAvailable()) return;
    this.lastCheck = Date.now();
    try {
      const response = await fetch(new URL('index.html', document.baseURI).toString(), {
        method: 'HEAD',
        cache: 'no-store',
      });
      const version = response.headers.get('etag') ?? response.headers.get('last-modified');
      if (!response.ok || !version) return;
      if (this.loaded === null) this.loaded = version;
      else if (version !== this.loaded) this.updateAvailable.set(true);
    } catch {
      /* hors ligne : on redemandera */
    }
  }

  private isMissingChunk(error: unknown): boolean {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
      message,
    );
  }

  private reloadOnceForChunk(): void {
    try {
      if (sessionStorage.getItem(RELOADED_FOR_CHUNK)) {
        this.updateAvailable.set(true);
        return;
      }
      sessionStorage.setItem(RELOADED_FOR_CHUNK, '1');
    } catch {
      /* stockage bloqué : on recharge quand même */
    }
    window.location.reload();
  }
}
