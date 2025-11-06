import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  ngOnInit(): void {
    // Force dark mode only - prevent light mode
    this.forceDarkMode();

    // Masquer le splash screen après le chargement initial
    this.hideInitialSplashScreen();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }, 0);
    });
  }

  private forceDarkMode(): void {
    // Force dark class on html element
    document.documentElement.classList.add('dark');
    // Remove light class if it exists
    document.documentElement.classList.remove('light');
    // Set color-scheme to dark
    document.documentElement.style.colorScheme = 'dark';
  }

  private hideInitialSplashScreen(): void {
    // Attendre que les composants soient initialisés
    if (document.readyState === 'complete') {
      // Page déjà chargée, masquer immédiatement
      setTimeout(() => {
        this.isInitialLoading.set(false);
      }, 100);
    } else {
      // Attendre le chargement complet
      window.addEventListener(
        'load',
        () => {
          setTimeout(() => {
            this.isInitialLoading.set(false);
          }, 500);
        },
        { once: true },
      );
    }
  }

  protected resetPosition() {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}
