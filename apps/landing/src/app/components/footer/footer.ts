import { Component, inject, LOCALE_ID } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-footer',
  imports: [CommonModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  protected readonly locale = inject(LOCALE_ID);
  private readonly document = inject(DOCUMENT);

  protected switchLanguage(targetLang: string): void {
    if (this.locale === targetLang) {
      return;
    }

    // Save language preference in localStorage and cookie
    localStorage.setItem('idem_lang', targetLang);
    document.cookie = `idem_lang=${targetLang}; path=/; max-age=31536000; SameSite=Lax`;

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
