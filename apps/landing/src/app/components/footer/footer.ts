import { ChangeDetectionStrategy, Component, inject, LOCALE_ID } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { isSupportedLocale, writeLocaleCookie } from '../../shared/utils/locale-cookie';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';

@Component({
  selector: 'app-footer',
  imports: [ThemeToggleComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  protected readonly locale = inject(LOCALE_ID);
  private readonly document = inject(DOCUMENT);

  protected switchLanguage(targetLang: string): void {
    if (this.locale === targetLang) {
      return;
    }

    // Persist to the shared cross-app cookie (source of truth) + localStorage.
    if (isSupportedLocale(targetLang)) {
      writeLocaleCookie(targetLang);
    }
    localStorage.setItem('idem_lang', targetLang);

    const pathname = this.document.location.pathname;
    let newPath = pathname;

    // Check if the current URL has /fr/ or /fr or /en/ or /en prefix
    const hasFr = pathname.startsWith('/fr/') || pathname === '/fr';
    const hasEn = pathname.startsWith('/en/') || pathname === '/en';

    if (hasFr) {
      newPath = pathname.replace(/^\/fr(\/|$)/, `/${targetLang}$1`);
    } else if (hasEn) {
      newPath = pathname.replace(/^\/en(\/|$)/, `/${targetLang}$1`);
    } else {
      newPath = `/${targetLang}${pathname.startsWith('/') ? pathname : '/' + pathname}`;
    }

    this.document.location.href = `${this.document.location.origin}${newPath}`;
  }
}
