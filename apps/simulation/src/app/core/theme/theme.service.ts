import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

/** Must match the pre-paint script in index.html. */
const STORAGE_KEY = 'idem_simulation_theme';

/**
 * Dark/light theming for the whole app.
 *
 * Nothing here knows about colours: it flips `data-theme` on the root element
 * and the token layer in styles.css does the rest.
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
      this.document.documentElement.dataset['theme'] = this.theme();
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
