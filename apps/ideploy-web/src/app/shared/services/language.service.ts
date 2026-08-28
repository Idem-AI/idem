import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  SUPPORTED_LOCALES,
  isSupportedLocale,
  readLocaleCookie,
  writeLocaleCookie,
  type SupportedLocale,
} from '../utils/locale-cookie';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly translateService = inject(TranslateService);
  private readonly SUPPORTED_LANGUAGES = SUPPORTED_LOCALES;

  constructor() {
    this.initializeLanguage();
    this.listenForCrossAppChanges();
  }

  /**
   * Initialize language from URL parameter, the shared cross-app cookie or the browser.
   */
  private initializeLanguage(): void {
    const urlLanguage = this.getLanguageFromURL();
    const cookieLanguage = readLocaleCookie();
    const browserLanguage = this.getBrowserLanguage();
    const defaultLanguage: SupportedLocale = 'en';

    this.translateService.addLangs([...this.SUPPORTED_LANGUAGES]);
    this.translateService.setFallbackLang(defaultLanguage);

    // Priority: URL param > shared cookie > browser > default
    const languageToUse =
      urlLanguage || cookieLanguage || browserLanguage || defaultLanguage;
    this.setLanguage(languageToUse);
  }

  /**
   * Re-apply the language when returning to the tab: another Idem app may have
   * changed the shared cookie in the meantime (cross-app synchronization).
   */
  private listenForCrossAppChanges(): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      const cookieLanguage = readLocaleCookie();
      if (cookieLanguage && cookieLanguage !== this.getCurrentLanguage()) {
        this.setLanguage(cookieLanguage);
      }
    });
  }

  private getLanguageFromURL(): SupportedLocale | null {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const lang = urlParams.get('lang');
      return isSupportedLocale(lang) ? lang : null;
    }
    return null;
  }

  private getBrowserLanguage(): SupportedLocale | null {
    if (typeof window !== 'undefined' && window.navigator) {
      const browserLang = window.navigator.language.split('-')[0];
      return isSupportedLocale(browserLang) ? browserLang : null;
    }
    return null;
  }

  /**
   * Set the current language and persist it to the shared cookie.
   */
  setLanguage(lang: string): void {
    const locale: SupportedLocale = isSupportedLocale(lang) ? lang : 'en';
    this.translateService.use(locale);
    // Shared cookie = single source of truth across all Idem apps.
    writeLocaleCookie(locale);
  }

  getCurrentLanguage(): string {
    return this.translateService.currentLang || 'en';
  }

  getSupportedLanguages(): string[] {
    return [...this.SUPPORTED_LANGUAGES];
  }
}
