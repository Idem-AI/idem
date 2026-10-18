import { Injectable, inject, signal } from '@angular/core';
import { NavigationError, Router } from '@angular/router';

/** How often an open tab asks whether a new version was deployed. */
const CHECK_EVERY_MS = 5 * 60 * 1000;
/** A navigation checks too, at most this often. */
const NAVIGATION_CHECK_MS = 60 * 1000;
const RELOADED_FOR_CHUNK = 'ideploy_reloaded_for_chunk';

/**
 * Whether the tab runs the version that is deployed.
 *
 * A single-page application keeps the code it loaded: a tab opened before a
 * release kept running the old one for hours — fixes deployed, nothing
 * changed on screen. The page itself (`index.html`, served without cache) is
 * asked for its ETag now and then; when it changes, a banner offers to reload.
 * A lazy page whose file no longer exists after a release reloads on its own.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private readonly router = inject(Router);
  readonly updateAvailable = signal(false);
  private loaded: string | null = null;
  private lastCheck = 0;

  start(): void {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    void this.check();
    setInterval(() => void this.check(), CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.check();
    });
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationError && this.isMissingChunk(event.error)) {
        this.reloadOnceForChunk();
        return;
      }
      if (Date.now() - this.lastCheck > NAVIGATION_CHECK_MS) void this.check();
    });
  }

  reload(): void {
    window.location.reload();
  }

  private async check(): Promise<void> {
    if (this.updateAvailable()) return;
    this.lastCheck = Date.now();
    try {
      const response = await fetch(new URL('index.html', document.baseURI).toString(), { method: 'HEAD', cache: 'no-store' });
      const version = response.headers.get('etag') ?? response.headers.get('last-modified');
      if (!response.ok || !version) return;
      if (this.loaded === null) this.loaded = version;
      else if (version !== this.loaded) this.updateAvailable.set(true);
    } catch {
      /* offline: asked again later */
    }
  }

  private isMissingChunk(error: unknown): boolean {
    const message = String((error as { message?: string })?.message ?? error ?? '');
    return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(message);
  }

  /** Once per session: a file that is still missing after a reload is a real error, not a release. */
  private reloadOnceForChunk(): void {
    try {
      if (sessionStorage.getItem(RELOADED_FOR_CHUNK)) {
        this.updateAvailable.set(true);
        return;
      }
      sessionStorage.setItem(RELOADED_FOR_CHUNK, '1');
    } catch {
      /* storage blocked: reload anyway */
    }
    window.location.reload();
  }
}
