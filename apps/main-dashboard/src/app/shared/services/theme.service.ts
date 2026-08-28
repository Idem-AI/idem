import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  type ThemeMode,
  readThemeCookie,
  resolveIsDark,
  writeThemeCookie,
} from '../utils/theme-cookie';

/**
 * Cross-app theme service. Mirrors LanguageService: the shared `idem_theme`
 * cookie is the source of truth; 'system' follows the browser preference.
 * Applies `.dark` / `.light` on <html> (the index.html boot script already
 * painted the initial theme before Angular started — this service only keeps
 * state in sync and handles changes).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private mql: MediaQueryList | null = null;

  /** User preference: 'light' | 'dark' | 'system' (cookie-backed). */
  readonly mode = signal<ThemeMode>('system');
  /** Resolved concrete theme. */
  readonly isDark = signal<boolean>(true);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.mode.set(readThemeCookie() ?? 'system');
    this.apply(false);

    this.mql = window.matchMedia('(prefers-color-scheme: dark)');
    this.mql.addEventListener('change', () => {
      if (this.mode() === 'system') {
        this.apply(false);
      }
    });

    // Cross-app sync: pick up a theme another Idem app set while this tab was hidden.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      const cookie = readThemeCookie() ?? 'system';
      if (cookie !== this.mode()) {
        this.mode.set(cookie);
        this.apply(false);
      }
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply(true);
  }

  private apply(persist: boolean): void {
    const dark = resolveIsDark(this.mode());
    this.isDark.set(dark);
    const el = document.documentElement;
    el.classList.toggle('dark', dark);
    el.classList.toggle('light', !dark);
    el.style.colorScheme = dark ? 'dark' : 'light';
    if (persist) {
      writeThemeCookie(this.mode());
    }
  }
}
