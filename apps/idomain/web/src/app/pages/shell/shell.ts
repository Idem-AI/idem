import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { LanguageService } from '../../core/language.service';
import { ThemeService } from '../../core/theme.service';
import { BrandMark } from '../../shared/components/brand-mark';

/**
 * La coque : l'en-tête (recherche, mes domaines, commandes, portefeuille) et, sur téléphone, les
 * mêmes entrées en bas d'écran, à portée de pouce. La session est lue sans jamais l'exiger ici :
 * l'accueil reste ouvert à tous.
 */
@Component({
  selector: 'idm-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslateModule, BrandMark],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col">
      <header class="sticky top-0 z-30 border-b border-[var(--glass-border-subtle)] bg-[color-mix(in_oklch,var(--color-bg-dark)_88%,transparent)] backdrop-blur-md">
        <div class="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <a routerLink="/" [attr.aria-label]="'nav.home' | translate"><idm-brand-mark /></a>
          @if (!auth.user() && path() === '/') {
            <!-- Visiteur : les repères de la page, sans quitter l'accueil. -->
            <nav class="hidden items-center gap-1 md:flex" [attr.aria-label]="'nav.page' | translate">
              @for (a of anchors; track a.id) {
                <a routerLink="/" [fragment]="a.id" class="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">{{ a.label | translate }}</a>
              }
            </nav>
          }
          @if (auth.user()) {
            <nav class="hidden items-center gap-1 md:flex" [attr.aria-label]="'nav.main' | translate">
              @for (link of links; track link.path) {
                <a [routerLink]="link.path" routerLinkActive="!text-[var(--color-text-primary)] bg-[var(--glass-bg-light)]" [routerLinkActiveOptions]="{ exact: link.path === '/' }"
                  class="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">{{ link.label | translate }}</a>
              }
            </nav>
          }
          <div class="ml-auto flex items-center gap-1">
            @if (auth.user()) {
              <a [href]="walletUrl" class="button-ghost button-sm hidden items-center gap-2 sm:inline-flex"><i class="pi pi-wallet" aria-hidden="true"></i>{{ 'nav.wallet' | translate }}</a>
            }
            <button type="button" class="button-icon !p-2" (click)="toggleLanguage()" [attr.aria-label]="'common.switchLanguage' | translate"><span class="text-xs font-semibold">{{ language.current() === 'fr' ? 'EN' : 'FR' }}</span></button>
            <button type="button" class="button-icon !p-2" (click)="toggleTheme()" [attr.aria-label]="'common.switchTheme' | translate"><i [class]="theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'" aria-hidden="true"></i></button>
            @if (auth.user()) {
              <button type="button" class="button-icon !p-2" (click)="auth.logout()" [attr.aria-label]="'common.logout' | translate"><i class="pi pi-sign-out" aria-hidden="true"></i></button>
            } @else {
              <button type="button" class="outer-button button-sm ml-2" (click)="auth.redirectToLogin(loginReturn())">{{ 'nav.login' | translate }}</button>
            }
          </div>
        </div>
      </header>

      <main class="flex-1 pb-20 md:pb-0">
        <router-outlet />
      </main>

      @if (auth.user()) {
        <!-- Téléphone : les entrées principales, en bas. -->
        <nav class="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-[var(--glass-border-subtle)] bg-[var(--color-bg-dark)] md:hidden" [attr.aria-label]="'nav.main' | translate">
          @for (link of links; track link.path) {
            <a [routerLink]="link.path" class="flex flex-col items-center gap-1 py-2.5 text-xs" [class]="isActive(link.path) ? 'text-[var(--color-primary-500)]' : 'text-[var(--color-text-secondary)]'">
              <i [class]="'pi ' + link.icon" aria-hidden="true"></i>{{ link.label | translate }}
            </a>
          }
        </nav>
      }
    </div>
  `,
})
export class Shell {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly walletUrl = `${environment.services.dashboard.url}/account/plans`;
  protected readonly anchors = [
    { id: 'comment', label: 'nav.how' },
    { id: 'services', label: 'nav.services' },
    { id: 'prix', label: 'nav.prices' },
    { id: 'applications', label: 'nav.apps' },
  ];
  protected readonly links = [
    { path: '/', label: 'nav.search', icon: 'pi-search' },
    { path: '/domains', label: 'nav.domains', icon: 'pi-globe' },
    { path: '/orders', label: 'nav.orders', icon: 'pi-receipt' },
  ];
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly path = computed(() => this.url().split('?')[0]);

  constructor() {
    void this.auth.ensureLoaded();
  }

  protected isActive(path: string): boolean {
    return path === '/' ? this.path() === '/' : this.path().startsWith(path);
  }

  protected loginReturn(): string {
    return window.location.href;
  }

  protected toggleTheme(): void {
    this.theme.setMode(this.theme.isDark() ? 'light' : 'dark');
  }

  protected toggleLanguage(): void {
    this.language.set(this.language.current() === 'fr' ? 'en' : 'fr');
  }
}
