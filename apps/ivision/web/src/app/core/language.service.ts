import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { SUPPORTED_LOCALES, isSupportedLocale, readLocaleCookie, writeLocaleCookie, type SupportedLocale } from './locale-cookie';

/**
 * La langue de l'interface : le cookie partagé `idem_lang` (toutes les applications IDEM),
 * puis le paramètre `?lang=`, puis le navigateur. iVision parle d'abord français.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  readonly current = signal<SupportedLocale>('fr');

  constructor() {
    this.translate.addLangs([...SUPPORTED_LOCALES]);
    this.translate.setFallbackLang('fr');
    const fromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null;
    const browser = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : null;
    this.set((isSupportedLocale(fromUrl) && fromUrl) || readLocaleCookie() || (isSupportedLocale(browser) && browser) || 'fr');
    // Une autre application IDEM a pu changer la langue pendant que l'onglet était caché.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        const cookie = readLocaleCookie();
        if (document.visibilityState === 'visible' && cookie && cookie !== this.current()) this.set(cookie);
      });
    }
  }

  set(lang: string): void {
    const locale: SupportedLocale = isSupportedLocale(lang) ? lang : 'fr';
    this.current.set(locale);
    this.translate.use(locale);
    writeLocaleCookie(locale);
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }
}
