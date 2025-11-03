import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { SplashScreenComponent } from './components/splash-screen/splash-screen';
import { filter, map, startWith, distinctUntilChanged } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout';

import { EmptyLayout } from './layouts/empty-layout/empty-layout';
import { NotificationContainerComponent } from './shared/components/notification-container/notification-container';
import { QuotaWarningComponent } from './shared/components/quota-warning/quota-warning';
import { AnalyticsService } from './shared/services/analytics.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    PublicLayoutComponent,

    CommonModule,
    EmptyLayout,
    SplashScreenComponent,
    NotificationContainerComponent,
    QuotaWarningComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  protected readonly router = inject(Router);
  protected readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Force Analytics service initialization
  private readonly analytics = inject(AnalyticsService);

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
      distinctUntilChanged()
    );

  ngOnInit(): void {
    // Force dark mode only - prevent light mode
    this.forceDarkMode();

    // Masquer le splash screen après le chargement initial
    this.hideInitialSplashScreen();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
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
        { once: true }
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

  protected readonly title = 'idem';
}
