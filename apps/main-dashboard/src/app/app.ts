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

    // Masquer le splash screen après le chargement initial
    this.hideInitialSplashScreen();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$),
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
