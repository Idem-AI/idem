import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

/**
 * Le cookie de thème commun à toutes les applications IDEM (dashboard,
 * iDeploy, AppGen) : changer de thème ici le change partout. Même contrat que
 * `apps/main-dashboard/src/app/shared/utils/theme-cookie.ts`.
 */
const COOKIE_NAME = 'idem_theme';
const ONE_YEAR_SECONDS = 31_536_000;

/** Ancienne clé locale du simulateur, lue une fois pour ne pas perdre le choix. */
const LEGACY_STORAGE_KEY = 'idem_simulation_theme';

/**
 * Thème clair/sombre de toute l'application.
 *
 * Rien ici ne connaît de couleur : le service pose `.dark` / `.light` sur la
 * racine, et le design system fournit les deux palettes.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemPrefersLight = signal(false);

  readonly preference = signal<ThemePreference>(this.readPreference());

  readonly theme = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    if (preference !== 'system') {
      return preference;
    }
    return this.systemPrefersLight() ? 'light' : 'dark';
  });

  constructor() {
    const view = this.document.defaultView;
    const media = view?.matchMedia('(prefers-color-scheme: light)');
    if (media) {
      this.systemPrefersLight.set(media.matches);
      media.addEventListener('change', (event) => this.systemPrefersLight.set(event.matches));
    }

    // Un autre onglet IDEM a pu changer le thème pendant que celui-ci était caché.
    this.document.addEventListener('visibilitychange', () => {
      if (this.document.visibilityState === 'visible') {
        const shared = this.readCookie();
        if (shared && shared !== this.preference()) {
          this.preference.set(shared);
        }
      }
    });

    effect(() => {
      const theme = this.theme();
      const root = this.document.documentElement;
      root.dataset['theme'] = theme;
      root.classList.toggle('dark', theme === 'dark');
      root.classList.toggle('light', theme === 'light');
      root.style.colorScheme = theme;
    });
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    this.writeCookie(preference);
  }

  /** Passe au thème opposé à celui qui est à l'écran. */
  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private readPreference(): ThemePreference {
    const shared = this.readCookie();
    if (shared) {
      return shared;
    }
    try {
      const legacy = this.document.defaultView?.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy === 'dark' || legacy === 'light') {
        return legacy;
      }
    } catch {
      // Stockage bloqué : on suit le système.
    }
    return 'system';
  }

  private readCookie(): ThemePreference | null {
    const match = this.document.cookie.match(/(?:^|;\s*)idem_theme=([^;]+)/);
    const value = match ? decodeURIComponent(match[1]) : null;
    return value === 'light' || value === 'dark' || value === 'system' ? value : null;
  }

  private writeCookie(preference: ThemePreference): void {
    const host = this.document.location?.hostname ?? '';
    const scope = host.endsWith('idem.africa') ? '; domain=.idem.africa; Secure' : '';
    this.document.cookie = `${COOKIE_NAME}=${preference}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${scope}`;
  }
}
