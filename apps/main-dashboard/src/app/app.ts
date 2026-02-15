import { AsyncPipe } from '@angular/common';
import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet, NavigationEnd } from '@angular/router';
import { LanguageService } from './shared/services/language.service';
import { AuthSyncService } from './shared/services/auth-sync.service';
import { GlobalLayoutComponent } from './layouts/global-layout/global-layout';
import { EmptyLayout } from './layouts/empty-layout/empty-layout';
import { NotificationContainerComponent } from './shared/components/notification-container/notification-container';
import { QuotaWarningComponent } from './shared/components/quota-warning/quota-warning';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { filter, startWith, map, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    GlobalLayoutComponent,
    EmptyLayout,
    NotificationContainerComponent,
    QuotaWarningComponent,
    DashboardLayoutComponent,
    AsyncPipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('main-dashboard');
  private readonly languageService = inject(LanguageService);
  private readonly authSyncService = inject(AuthSyncService);

  protected readonly router = inject(Router);
  protected readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Force Analytics service initialization

  // Signal pour contrôler l'affichage du splash screen
  protected readonly isInitialLoading = signal(true);

  /** Layout courant selon la route active */
  protected readonly currentLayout$: Observable<'public' | 'dashboard' | 'global' | 'empty'> =
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let route = this.activatedRoute.firstChild;
        while (route?.firstChild) {
          route = route.firstChild;
        }
        return (
          (route?.snapshot.data?.['layout'] as 'public' | 'dashboard' | 'global' | 'empty') ||
          'public'
        );
      }),
      distinctUntilChanged(),
    );

  ngOnInit(): void {
    // Force dark mode only - prevent light mode
    this.forceDarkMode();

    // Monitor and override any theme changes
    this.monitorThemeChanges();

    // Masquer le splash screen après le chargement initial
    this.hideInitialSplashScreen();

    // Auto-scroll to top on navigation
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

    // Override any CSS media queries that might detect light mode
    const style = document.createElement('style');
    style.textContent = `
      /* Force dark mode regardless of system preference */
      :root {
        color-scheme: dark !important;
      }

      /* Override any light mode media queries */
      @media (prefers-color-scheme: light) {
        :root {
          color-scheme: dark !important;
        }
        html {
          background-color: #0f141b !important;
          color: #ffffff !important;
        }
      }

      /* Ensure PrimeNG components use dark theme */
      .p-component {
        color-scheme: dark !important;
      }
    `;
    document.head.appendChild(style);
  }

  private monitorThemeChanges(): void {
    // Create a MutationObserver to watch for class changes on html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const htmlElement = document.documentElement;
          if (!htmlElement.classList.contains('dark')) {
            // Force dark mode back if it was removed
            htmlElement.classList.add('dark');
            htmlElement.classList.remove('light');
            htmlElement.style.colorScheme = 'dark';
          }
        }
      });
    });

    // Start observing
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    // Also monitor system theme changes and override them
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handleChange = () => {
        // Always force dark mode regardless of system preference
        this.forceDarkMode();
      };

      mediaQuery.addEventListener('change', handleChange);

      // Store the observer for cleanup
      this.destroy$.subscribe(() => {
        observer.disconnect();
        mediaQuery.removeEventListener('change', handleChange);
      });
    }
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected resetPosition() {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}
