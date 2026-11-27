import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationError, NavigationStart, Router } from '@angular/router';

import { registerIdemServiceWorker } from '../index';

/** À quelle fréquence un onglet ouvert demande si une version a été déployée. */
const CHECK_EVERY_MS = 5 * 60 * 1000;
/** Une navigation vérifie aussi, au plus à cette cadence. */
const NAVIGATION_CHECK_MS = 60 * 1000;
/**
 * Un onglet resté caché au moins aussi longtemps est, pour l'utilisateur, un
 * site qu'il « rouvre » (les navigateurs mobiles reprennent l'onglet au lieu
 * de recharger la page) : il doit retrouver la dernière version.
 */
const REOPEN_AFTER_HIDDEN_MS = 30 * 60 * 1000;
const RELOADED_FOR_CHUNK = 'idem_reloaded_for_chunk';

/**
 * Garder chaque onglet sur la version déployée, SANS RIEN DEMANDER.
 *
 * Il n'y a plus de bannière « Une nouvelle version est disponible » : elle
 * s'affichait à chaque mise en production et agaçait. La mise à jour est
 * appliquée en silence, à un moment où elle ne coûte rien :
 *
 * - **Ouverture du site** : le service worker va au réseau d'abord pour la
 *   page HTML (voir `sw.js`), nginx la sert en `no-cache` — on reçoit donc la
 *   dernière version sans actualiser.
 * - **Onglet déjà ouvert** : une version détectée est appliquée au prochain
 *   changement de page — la navigation se fait en chargement complet au lieu
 *   d'une navigation interne. L'utilisateur quittait la page de toute façon :
 *   rien de ce qu'il écrivait n'est perdu.
 * - **Onglet repris après une longue absence** (30 min cachée) : rechargé à son
 *   retour, sauf si un champ a été rempli.
 *
 * Détection, deux sources :
 *
 * 1. **Le service worker**, qui prévient quand il a servi la coquille depuis
 *    le cache (réseau trop lent) et qu'une version plus fraîche est arrivée.
 * 2. **L'ETag de `index.html`**, interrogé de temps en temps par un `HEAD`
 *    (quelques octets, acceptable à bas débit).
 *
 * Une page paresseuse dont le fichier n'existe plus après une mise en
 * production recharge d'elle-même, une fois par session.
 */
@Injectable({ providedIn: 'root' })
export class IdemServiceWorkerService {
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  /** Une version plus récente est déployée : la prochaine occasion l'applique. */
  private pending = false;
  private loaded: string | null = null;
  private lastCheck = 0;
  private hiddenSince: number | null = null;
  private started = false;

  /** Appelé une fois, par `provideIdemServiceWorker()`. */
  register(): void {
    if (this.started) return;
    this.started = true;

    registerIdemServiceWorker({ onUpdate: () => (this.pending = true) });
    this.watchDeployedVersion();
  }

  private watchDeployedVersion(): void {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;

    void this.check();

    const timer = setInterval(() => void this.check(), CHECK_EVERY_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenSince = Date.now();
        return;
      }
      const away = this.hiddenSince === null ? 0 : Date.now() - this.hiddenSince;
      this.hiddenSince = null;
      void this.check().then(() => {
        if (this.pending && away >= REOPEN_AFTER_HIDDEN_MS && !this.hasUserInput()) {
          window.location.reload();
        }
      });
    });

    this.router?.events.subscribe((event) => {
      if (event instanceof NavigationStart && this.pending) {
        // Chargement complet de la page demandée : elle arrive dans la
        // nouvelle version. Sur « précédent / suivant », l'adresse est déjà
        // celle de destination, un rechargement suffit.
        if (event.navigationTrigger === 'popstate') window.location.reload();
        else window.location.assign(new URL(event.url.replace(/^\//, ''), document.baseURI).toString());
        return;
      }
      if (event instanceof NavigationError && this.isMissingChunk(event.error)) {
        this.reloadOnceForChunk();
        return;
      }
      if (Date.now() - this.lastCheck > NAVIGATION_CHECK_MS) void this.check();
    });
  }

  private async check(): Promise<void> {
    if (this.pending) return;
    this.lastCheck = Date.now();
    try {
      const response = await fetch(new URL('index.html', document.baseURI).toString(), {
        method: 'HEAD',
        cache: 'no-store',
      });
      const version = response.headers.get('etag') ?? response.headers.get('last-modified');
      if (!response.ok || !version) return;
      if (this.loaded === null) this.loaded = version;
      else if (version !== this.loaded) this.pending = true;
    } catch {
      /* hors ligne : on redemandera */
    }
  }

  /** Un champ rempli ou en cours d'édition : ne jamais recharger sous ses doigts. */
  private hasUserInput(): boolean {
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) {
      return true;
    }
    const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])',
    );
    for (const field of Array.from(fields)) {
      if (field.value && field.value !== field.defaultValue) return true;
    }
    return false;
  }

  private isMissingChunk(error: unknown): boolean {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
      message,
    );
  }

  private reloadOnceForChunk(): void {
    try {
      if (sessionStorage.getItem(RELOADED_FOR_CHUNK)) return;
      sessionStorage.setItem(RELOADED_FOR_CHUNK, '1');
    } catch {
      /* stockage bloqué : on recharge quand même */
    }
    window.location.reload();
  }
}
