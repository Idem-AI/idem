import { Component, inject, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AnalyticsService } from './shared/services/analytics.service';
import { ThemeService } from './shared/services/theme.service';
import { Header } from './components/header/header';
import { Footer } from './components/footer/footer';
import { IdemUpdateBannerComponent } from '@idem/shared-offline/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Footer, IdemUpdateBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly router = inject(Router);

  protected readonly updateLabel = $localize`:@@appUpdateMessage:Une nouvelle version est disponible.`;
  protected readonly updateAction = $localize`:@@appUpdateReload:Actualiser`;
  protected readonly updateDismiss = $localize`:@@appUpdateLater:Plus tard`;

  // Force Analytics service initialization
  private readonly analytics = inject(AnalyticsService);

  // Applies the shared `idem_theme` cookie (light/dark/system) and keeps it in
  // sync across Idem apps (SSR-safe).
  private readonly themeService = inject(ThemeService);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);
      }
    });
  }

  protected resetPosition() {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }
}
