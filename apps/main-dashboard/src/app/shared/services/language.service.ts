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
  /** Legacy localStorage key, kept for backward-compat fallback only. */
  private readonly LEGACY_STORAGE_KEY = 'idem_dashboard_language';
  private readonly SUPPORTED_LANGUAGES = SUPPORTED_LOCALES;

  constructor() {
    this.initializeLanguage();
    this.listenForCrossAppChanges();
  }

  /**
   * Initialize language from URL parameter, shared cookie, legacy storage or browser.
   */
  private initializeLanguage(): void {
    const urlLanguage = this.getLanguageFromURL();
    const cookieLanguage = readLocaleCookie();
    const savedLanguage = this.getSavedLanguage();
    const browserLanguage = this.getBrowserLanguage();
    const defaultLanguage: SupportedLocale = 'en';

    // Priority: URL param > shared cookie > legacy localStorage > browser > default
    const languageToUse =
      urlLanguage || cookieLanguage || savedLanguage || browserLanguage || defaultLanguage;
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

  /**
   * Get language from URL query parameter
   */
  private getLanguageFromURL(): SupportedLocale | null {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const lang = urlParams.get('lang');
      return isSupportedLocale(lang) ? lang : null;
    }
    return null;
  }

  /**
   * Get saved language from legacy localStorage (backward compatibility)
   */
  private getSavedLanguage(): SupportedLocale | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(this.LEGACY_STORAGE_KEY);
      return isSupportedLocale(saved) ? saved : null;
    }
    return null;
  }

  /**
   * Get browser language
   */
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
    if (!isSupportedLocale(lang)) {
      console.warn(`Language ${lang} is not supported. Falling back to 'en'.`);
    }

    this.translateService.use(locale);

    // Shared cookie = single source of truth across all Idem apps.
    writeLocaleCookie(locale);

    // Keep the legacy key in sync so a rollback doesn't lose the user's choice.
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.LEGACY_STORAGE_KEY, locale);
    }
  }

  /**
   * Get the current language
   */
  getCurrentLanguage(): string {
    return this.translateService.currentLang || 'en';
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): string[] {
    return [...this.SUPPORTED_LANGUAGES];
  }
}
