import { Component, inject, OnInit, PLATFORM_ID, Inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AnalyticsService } from './shared/services/analytics.service';
import { ThemeService } from './shared/services/theme.service';
import { Header } from './components/header/header';
import { Footer } from './components/footer/footer';
import { DockComponent } from './components/dock/dock';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Footer, DockComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly router = inject(Router);

  /** The home page (/fr/, /en/, /home): the only one whose dock shows the partners. */
  protected readonly isHome = signal(this.homeUrl(this.router.url));


  // Force Analytics service initialization
  private readonly analytics = inject(AnalyticsService);

  // Applies the shared `idem_theme` cookie (light/dark/system) and keeps it in
  // sync across Idem apps (SSR-safe).
  private readonly themeService = inject(ThemeService);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.isHome.set(this.homeUrl((event as NavigationEnd).urlAfterRedirects));
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);
      }
    });
  }

  private homeUrl(url: string): boolean {
    const path = url.split(/[?#]/)[0];
    return path === '/' || path === '' || path === '/home';
  }

  protected resetPosition() {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }
}
