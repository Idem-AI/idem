import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

/** Must match the pre-paint script in index.html. */
const STORAGE_KEY = 'idem_simulation_theme';

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

  readonly preference = signal<ThemePreference>(this.readStoredPreference());

  readonly theme = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    if (preference !== 'system') {
      return preference;
    }
    return this.systemPrefersLight() ? 'light' : 'dark';
  });

  constructor() {
    const media = this.document.defaultView?.matchMedia('(prefers-color-scheme: light)');
    if (media) {
      this.systemPrefersLight.set(media.matches);
      media.addEventListener('change', (event) => this.systemPrefersLight.set(event.matches));
    }

    effect(() => {
      const theme = this.theme();
      const root = this.document.documentElement;
      // Le design system bascule sur les classes `.dark` / `.light` ;
      // `data-theme` ne sert qu'au sélecteur sombre de PrimeNG.
      root.dataset['theme'] = theme;
      root.classList.toggle('dark', theme === 'dark');
      root.classList.toggle('light', theme === 'light');
    });
  }

  set(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage can be blocked; the choice still applies for this session.
    }
  }

  /** Flips to the opposite of what is currently on screen. */
  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private readStoredPreference(): ThemePreference {
    try {
      const stored = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        return stored;
      }
    } catch {
      // Fall through to the system default.
    }
    return 'system';
  }
}
