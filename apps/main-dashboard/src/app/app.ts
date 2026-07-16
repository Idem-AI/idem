import { AsyncPipe } from '@angular/common';
import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet, NavigationEnd } from '@angular/router';
import { LanguageService } from './shared/services/language.service';
import { ThemeService } from './shared/services/theme.service';
import { AuthSyncService } from './shared/services/auth-sync.service';
import { GlobalLayoutComponent } from './layouts/global-layout/global-layout';
import { EmptyLayout } from './layouts/empty-layout/empty-layout';
import { NotificationContainerComponent } from './shared/components/notification-container/notification-container';
import { QuotaWarningComponent } from './shared/components/quota-warning/quota-warning';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { filter, startWith, map, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout';
import { ChatLayoutComponent } from './layouts/chat-layout/chat-layout';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    GlobalLayoutComponent,
    EmptyLayout,
    NotificationContainerComponent,
    QuotaWarningComponent,
    DashboardLayoutComponent,
    ChatLayoutComponent,
    AsyncPipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('main-dashboard');
  private readonly languageService = inject(LanguageService);
  // Applies the shared `idem_theme` cookie (light/dark/system) and keeps it in
  // sync across Idem apps.
  private readonly themeService = inject(ThemeService);
  private readonly authSyncService = inject(AuthSyncService);

  protected readonly router = inject(Router);
  protected readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroy$ = new Subject<void>();

  // Force Analytics service initialization

  // Signal pour contrôler l'affichage du splash screen
  protected readonly isInitialLoading = signal(true);

  /** Layout courant selon la route active */
  protected readonly currentLayout$: Observable<
    'public' | 'dashboard' | 'global' | 'empty' | 'chat'
  > = this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    startWith(null),
    map(() => {
      let route = this.activatedRoute.firstChild;
      while (route?.firstChild) {
        route = route.firstChild;
      }
      return (
        (route?.snapshot.data?.['layout'] as
          | 'public'
          | 'dashboard'
          | 'global'
          | 'empty'
          | 'chat') || 'public'
      );
    }),
    distinctUntilChanged(),
  );

  ngOnInit(): void {
    // Masquer le splash screen après le chargement initial
    this.hideInitialSplashScreen();

    // Auto-scroll to top on navigation
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }, 0);
    });
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
