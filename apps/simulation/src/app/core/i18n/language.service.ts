import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '@env';

export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Must match the pre-paint script in index.html. */
const STORAGE_KEY = 'idem_simulation_language';

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Resolves the active language once, in this order: `?lang=` (so the
 * dashboard can hand its own language over), stored choice, browser, then the
 * configured default.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);

  private readonly activeLanguage = signal<SupportedLanguage>('fr');
  readonly language = this.activeLanguage.asReadonly();
  readonly available = SUPPORTED_LANGUAGES;

  init(): void {
    const fallback = isSupported(environment.defaultLanguage)
      ? environment.defaultLanguage
      : 'fr';

    this.translate.setFallbackLang(fallback);
    this.use(this.fromUrl() ?? this.fromStorage() ?? this.fromBrowser() ?? fallback);
  }

  use(language: SupportedLanguage): void {
    this.activeLanguage.set(language);
    this.translate.use(language);
    this.document.documentElement.lang = language;

    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Storage can be blocked; the choice still applies for this session.
    }
  }

  private fromUrl(): SupportedLanguage | null {
    const search = this.document.defaultView?.location.search;
    if (!search) {
      return null;
    }
    const value = new URLSearchParams(search).get('lang');
    return isSupported(value) ? value : null;
  }

  private fromStorage(): SupportedLanguage | null {
    try {
      const value = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      return isSupported(value) ? value : null;
    } catch {
      return null;
    }
  }

  private fromBrowser(): SupportedLanguage | null {
    const value = this.document.defaultView?.navigator.language?.split('-')[0];
    return isSupported(value) ? value : null;
  }
}
