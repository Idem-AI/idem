import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly translateService = inject(TranslateService);
  private readonly STORAGE_KEY = 'idem_dashboard_language';
  private readonly SUPPORTED_LANGUAGES = ['en', 'fr'];

  constructor() {
    this.initializeLanguage();
  }

  /**
   * Initialize language from URL parameter, localStorage or browser settings
   */
  private initializeLanguage(): void {
    const urlLanguage = this.getLanguageFromURL();
    const savedLanguage = this.getSavedLanguage();
    const browserLanguage = this.getBrowserLanguage();
    const defaultLanguage = 'en';

    // Priority: URL param > localStorage > browser > default
    const languageToUse = urlLanguage || savedLanguage || browserLanguage || defaultLanguage;
    this.setLanguage(languageToUse);
  }

  /**
   * Get language from URL query parameter
   */
  private getLanguageFromURL(): string | null {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const lang = urlParams.get('lang');
      return lang && this.SUPPORTED_LANGUAGES.includes(lang) ? lang : null;
    }
    return null;
  }

  /**
   * Get saved language from localStorage
   */
  private getSavedLanguage(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved && this.SUPPORTED_LANGUAGES.includes(saved) ? saved : null;
    }
    return null;
  }

  /**
   * Get browser language
   */
  private getBrowserLanguage(): string | null {
    if (typeof window !== 'undefined' && window.navigator) {
      const browserLang = window.navigator.language.split('-')[0];
      return this.SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : null;
    }
    return null;
  }

  /**
   * Set the current language
   */
  setLanguage(lang: string): void {
    if (!this.SUPPORTED_LANGUAGES.includes(lang)) {
      console.warn(`Language ${lang} is not supported. Falling back to 'en'.`);
      lang = 'en';
    }

    this.translateService.use(lang);

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_KEY, lang);
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
