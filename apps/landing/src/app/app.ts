import { Component, inject, OnInit, signal, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { SplashScreenComponent } from './components/splash-screen/splash-screen';
import { filter } from 'rxjs/operators';

import { AnalyticsService } from './shared/services/analytics.service';
import { Header } from './components/header/header';
import { Footer } from './components/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SplashScreenComponent, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly router = inject(Router);

  // Force Analytics service initialization
  private readonly analytics = inject(AnalyticsService);

  // Signal pour contrôler l'affichage du splash screen
  protected readonly isInitialLoading = signal(true);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    // Force dark mode only - prevent light mode
    this.forceDarkMode();

    // Masquer le splash screen après le chargement initial
    this.hideInitialSplashScreen();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }, 0);
      }
    });
  }

  private forceDarkMode(): void {
    // Only run in browser (not during SSR)
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Force dark class on html element
    document.documentElement.classList.add('dark');
    // Remove light class if it exists
    document.documentElement.classList.remove('light');
    // Set color-scheme to dark
    document.documentElement.style.colorScheme = 'dark';
  }

  private hideInitialSplashScreen(): void {
    // Only run in browser (not during SSR)
    if (!isPlatformBrowser(this.platformId)) {
      this.isInitialLoading.set(false);
      return;
    }

    const MIN_SPLASH_DURATION = 2000; // Durée minimale de 2 secondes
    const startTime = Date.now();

    const hideSplash = () => {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, MIN_SPLASH_DURATION - elapsedTime);

      setTimeout(() => {
        this.isInitialLoading.set(false);
      }, remainingTime);
    };

    // Attendre que les composants soient initialisés
    if (document.readyState === 'complete') {
      // Page déjà chargée
      hideSplash();
    } else {
      // Attendre le chargement complet
      window.addEventListener('load', hideSplash, { once: true });
    }
  }

  protected resetPosition() {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }
}
