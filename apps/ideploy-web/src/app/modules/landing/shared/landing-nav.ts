import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../shared/services/auth.service';
import { environment } from '../../../../environments/environment';

/**
 * Header shared by the two public pages.
 *
 * Over the landing's hero photograph it is transparent with white type — no
 * bar, no tint, just the links on the image. It only takes a surface once the
 * page has scrolled past the hero, where white type would stop being readable.
 * Pricing has no hero, so it passes `overHero` false and starts solid.
 */
@Component({
  selector: 'app-landing-nav',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:scroll)': 'onScroll()',
    '(document:click)': 'menuOpen.set(false)',
  },
  template: `
    <nav
      class="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      [class.glass]="solid()"
      [style.border-bottom]="solid() ? '1px solid var(--glass-border-subtle)' : '1px solid transparent'"
      [style.backdrop-filter]="solid() ? 'blur(20px)' : null"
      [style.-webkit-backdrop-filter]="solid() ? 'blur(20px)' : null"
      style="transition: background-color .25s ease, border-color .25s ease;">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <a routerLink="/" class="shrink-0">
          @if (solid()) {
            <img
              src="/assets/logos/Ideploy%20logo%20light.png"
              [alt]="'landing.logoAlt' | translate"
              class="h-7 w-auto dark:hidden" />
            <img
              src="/assets/logos/Ideploy%20logo%20dark.png"
              alt=""
              aria-hidden="true"
              class="h-7 w-auto hidden dark:block" />
          } @else {
            <img
              src="/assets/logos/Ideploy%20logo%20dark.png"
              [alt]="'landing.logoAlt' | translate"
              class="h-7 w-auto" />
          }
        </a>

        <div class="hidden md:flex items-center gap-8">
          @for (link of links; track link) {
            <a
              routerLink="/"
              [fragment]="link"
              class="text-sm font-semibold transition-smooth"
              [class]="solid() ? 'text-text-secondary hover:text-text-primary' : 'text-white/75 hover:text-white'">
              {{ 'landing.nav.' + link | translate }}
            </a>
          }
          <a
            routerLink="/pricing"
            class="text-sm font-semibold transition-smooth"
            [class]="solid() ? 'text-text-secondary hover:text-text-primary' : 'text-white/75 hover:text-white'">
            {{ 'landing.nav.pricing' | translate }}
          </a>
        </div>

        @if (user(); as u) {
          <div class="relative shrink-0">
            <button
              type="button"
              class="flex items-center rounded-full transition-smooth"
              [attr.aria-label]="'landing.nav.menu' | translate"
              [attr.aria-expanded]="menuOpen()"
              [title]="u.displayName || u.email"
              (click)="toggleMenu($event)">
              @if (u.photoURL) {
                <img
                  [src]="u.photoURL"
                  alt=""
                  class="w-9 h-9 rounded-full object-cover"
                  [style.border]="solid() ? '1px solid var(--glass-border)' : '1px solid rgba(255,255,255,0.35)'" />
              } @else {
                <span
                  class="w-9 h-9 rounded-full flex items-center justify-center gradient-primary text-sm font-bold text-white"
                  >{{ initial() }}</span
                >
              }
            </button>

            @if (menuOpen()) {
              <div
                class="absolute right-0 mt-3 w-56 overflow-hidden glass-card"
                style="border-radius: var(--radius-xl);"
                (click)="$event.stopPropagation()">
                <div class="px-4 py-3" style="border-bottom: 1px solid var(--glass-border-subtle);">
                  <p class="text-sm font-bold truncate">{{ u.displayName || u.email }}</p>
                  @if (u.displayName) {
                    <p class="font-mono text-xs text-text-tertiary truncate">{{ u.email }}</p>
                  }
                </div>
                <a routerLink="/dashboard" class="block px-4 py-2.5 text-sm font-semibold text-text-secondary hover:text-text-primary">
                  {{ 'landing.nav.dashboard' | translate }}
                </a>
                <a [href]="profileUrl" class="block px-4 py-2.5 text-sm font-semibold text-text-secondary hover:text-text-primary">
                  {{ 'landing.nav.profile' | translate }}
                </a>
                <button
                  type="button"
                  class="w-full text-left px-4 py-2.5 text-sm font-semibold"
                  style="color: var(--color-danger); border-top: 1px solid var(--glass-border-subtle);"
                  (click)="logout()">
                  {{ 'landing.nav.logout' | translate }}
                </button>
              </div>
            }
          </div>
        } @else {
          <div class="flex items-center gap-4 shrink-0">
            <a
              [href]="loginUrl"
              class="hidden sm:block text-sm font-semibold transition-smooth"
              [class]="solid() ? 'text-text-secondary hover:text-text-primary' : 'text-white/75 hover:text-white'">
              {{ 'landing.nav.login' | translate }}
            </a>
            <a [href]="loginUrl" class="inner-button px-5 py-2.5 text-sm">{{ 'landing.nav.start' | translate }}</a>
          </div>
        }
      </div>
    </nav>
  `,
})
export class LandingNavComponent {
  /** True on the landing, whose hero is a dark photograph behind this bar. */
  readonly overHero = input(false);

  private readonly auth = inject(AuthService);
  protected readonly user = toSignal(this.auth.user$, { initialValue: null });
  protected readonly menuOpen = signal(false);
  private readonly scrolled = signal(false);

  /** Transparent only while sitting on the hero image. */
  protected readonly solid = computed(() => !this.overHero() || this.scrolled());

  protected readonly initial = computed(() => {
    const u = this.user();
    return (u?.displayName || u?.email || '?').charAt(0).toUpperCase();
  });

  protected readonly loginUrl = `${environment.services.console.url}/login?redirect=ideploy`;
  protected readonly profileUrl = `${environment.services.console.url}/account/profile`;
  protected readonly links = ['how', 'where', 'services'];

  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 120);
  }

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  protected logout(): void {
    this.menuOpen.set(false);
    void this.auth.logout();
  }
}
