import {
  ChangeDetectionStrategy,
  Component,
  inject,
  LOCALE_ID,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { isSupportedLocale, writeLocaleCookie } from '../../shared/utils/locale-cookie';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';

/** Where the company keeps its clock. Cameroon is WAT, UTC+1, no DST. */
const HQ_TIME_ZONE = 'Africa/Douala';
/** A minute-resolution clock only has to be right to the minute. */
const CLOCK_INTERVAL_MS = 30_000;

@Component({
  selector: 'app-footer',
  imports: [ThemeToggleComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer implements OnInit, OnDestroy {
  protected readonly locale = inject(LOCALE_ID);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  /** Rendered in the signature line, so the page never dates itself. */
  protected readonly year = new Date().getFullYear();

  /**
   * Local time at the company, filled in the browser only.
   *
   * Empty on the server: a clock rendered at build time would be wrong by the
   * time anyone read it, and a server/client mismatch is exactly what breaks
   * hydration. The template renders the line only once this has a value.
   */
  protected readonly localTime = signal('');

  private clockId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.readClock();
    // Outside Angular: a ticking clock should not schedule change detection
    // for the whole page twice a minute.
    this.zone.runOutsideAngular(() => {
      this.clockId = setInterval(() => this.zone.run(() => this.readClock()), CLOCK_INTERVAL_MS);
    });
  }

  ngOnDestroy(): void {
    if (this.clockId !== null) clearInterval(this.clockId);
  }

  private readClock(): void {
    try {
      this.localTime.set(
        new Intl.DateTimeFormat(this.locale, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: HQ_TIME_ZONE,
        }).format(new Date()),
      );
    } catch {
      // A runtime without that time zone simply gets no clock rather than a
      // wrong one; the rest of the strip stands on its own.
      this.localTime.set('');
    }
  }

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
