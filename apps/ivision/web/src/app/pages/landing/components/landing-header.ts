import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth.service';
import { LanguageService } from '../../../core/language.service';
import { BrandMark } from '../../../shared/components/brand-mark';
import { Wrap } from './wrap';

/** Les sections que la navigation dessert (leurs `id` sont posés par chaque section). */
const LINKS = [
  { id: 'site', key: 'how' },
  { id: 'ateliers', key: 'workshops' },
  { id: 'cran', key: 'creativity' },
  { id: 'montage', key: 'montage' },
] as const;

/**
 * L'en-tête de la landing. Il reste en haut de l'écran et se pose sur un fond net dès qu'on
 * défile. La section en cours est marquée dans la navigation par le losange bleu d'IDEM. La
 * langue se choisit d'un geste (FR / EN). Sur téléphone et petite tablette, la navigation passe
 * dans un menu qui se déplie sous la barre (Échap le referme).
 */
@Component({
  selector: 'iv-landing-header',
  imports: [RouterLink, TranslateModule, BrandMark, Wrap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'header',
    '[class.is-raised]': 'scrolled() || menuOpen()',
    '(window:scroll)': 'onScroll()',
    '(document:keydown.escape)': 'menuOpen.set(false)',
  },
  template: `
    <header ivWrap class="flex h-[4.5rem] items-center gap-6">
      <a routerLink="/" class="shrink-0" [attr.aria-label]="'landing.home' | translate"><iv-brand-mark [size]="28" /></a>
      <a [href]="landingUrl" class="service hidden items-center gap-1.5 whitespace-nowrap text-sm text-text-tertiary hover:text-text-primary 2xl:inline-flex">
        {{ 'landing.header.service' | translate }} <i class="pi pi-arrow-up-right text-xs" aria-hidden="true"></i>
      </a>

      <nav class="mx-auto hidden items-center gap-1 lg:flex" [attr.aria-label]="'landing.header.label' | translate">
        @for (link of links; track link.id) {
          <a class="nav-link" [href]="'#' + link.id" [class.is-active]="active() === link.id" [attr.aria-current]="active() === link.id ? 'true' : null">
            <span class="diamond" aria-hidden="true"></span>{{ 'landing.header.links.' + link.key | translate }}
          </a>
        }
      </nav>

      <div class="ml-auto flex items-center gap-2 lg:ml-0">
        <div class="lang hidden sm:flex" role="group" [attr.aria-label]="'landing.header.language' | translate">
          @for (code of languages; track code) {
            <button type="button" class="button-ghost button-sm" [attr.aria-pressed]="language.current() === code" (click)="language.set(code)">
              {{ code.toUpperCase() }}
            </button>
          }
        </div>
        @if (!signedIn()) {
          <span class="hidden xl:contents">
            <a class="button-ghost button-sm whitespace-nowrap" routerLink="/studio/video">{{ 'landing.header.signIn' | translate }}</a>
          </span>
        }
        <a class="inner-button button-sm whitespace-nowrap" routerLink="/studio/video">
          {{ (signedIn() ? 'landing.header.openStudio' : 'landing.header.start') | translate }}
        </a>
        <span class="contents lg:hidden">
          <button
            type="button"
            class="button-icon"
            aria-controls="iv-landing-menu"
            [attr.aria-expanded]="menuOpen()"
            [attr.aria-label]="(menuOpen() ? 'landing.header.menuClose' : 'landing.header.menuOpen') | translate"
            (click)="menuOpen.set(!menuOpen())"
          >
            <i class="pi" [class.pi-bars]="!menuOpen()" [class.pi-times]="menuOpen()" aria-hidden="true"></i>
          </button>
        </span>
      </div>
    </header>

    @if (menuOpen()) {
      <div id="iv-landing-menu" ivWrap class="pb-6 lg:hidden">
        <nav class="flex flex-col border-t border-[var(--glass-border-subtle)] pt-3" [attr.aria-label]="'landing.header.label' | translate">
          @for (link of links; track link.id) {
            <a class="menu-link" [href]="'#' + link.id" (click)="menuOpen.set(false)">{{ 'landing.header.links.' + link.key | translate }}</a>
          }
        </nav>
        <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
          @if (!signedIn()) {
            <a class="outer-button" routerLink="/studio/video">{{ 'landing.header.signIn' | translate }}</a>
          }
          <div class="lang flex sm:hidden" role="group" [attr.aria-label]="'landing.header.language' | translate">
          @for (code of languages; track code) {
            <button type="button" class="button-ghost button-sm" [attr.aria-pressed]="language.current() === code" (click)="language.set(code)">
              {{ code.toUpperCase() }}
            </button>
          }
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      display: block;
      transition:
        background-color 0.25s ease,
        box-shadow 0.25s ease;
    }
    /* Dès qu'on défile (ou que le menu est ouvert), la barre se pose sur un fond net. Le filet
       du bas est une ombre : il n'ajoute rien à la hauteur (4,5 rem), dont dépend le hero. */
    :host(.is-raised) {
      box-shadow: 0 1px 0 var(--glass-border-subtle);
      background: var(--glass-bg-intense);
      -webkit-backdrop-filter: blur(var(--glass-blur-md));
      backdrop-filter: blur(var(--glass-blur-md));
    }
    .service {
      padding-left: 1.5rem;
      border-left: 1px solid var(--glass-border);
    }
    .nav-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      white-space: nowrap;
      border-radius: var(--radius-lg);
      color: var(--color-text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 600;
      transition: color 0.2s ease;
    }
    .nav-link:hover,
    .nav-link.is-active {
      color: var(--color-text-primary);
    }
    .nav-link:focus-visible,
    .menu-link:focus-visible {
      outline: 2px solid var(--color-primary-500);
      outline-offset: 2px;
    }
    /* Le losange d'IDEM marque la section en cours. */
    .diamond {
      width: 0.4rem;
      height: 0.4rem;
      rotate: 45deg;
      scale: 0;
      background: var(--color-primary-500);
      transition: scale 0.25s var(--ease-fluid);
    }
    .nav-link.is-active .diamond {
      scale: 1;
    }
    /* FR / EN : deux boutons du design system dans une même pastille. */
    .lang {
      gap: 0.125rem;
      padding: 0.125rem;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
    }
    .lang .button-ghost {
      color: var(--color-text-tertiary);
    }
    .lang .button-ghost[aria-pressed='true'] {
      background: var(--glass-bg-medium);
      color: var(--color-text-primary);
    }
    .menu-link {
      padding: 0.875rem 0.25rem;
      border-bottom: 1px solid var(--glass-border-subtle);
      color: var(--color-text-primary);
      font-size: var(--font-size-lg);
      font-weight: 700;
    }
    @media (prefers-reduced-motion: reduce) {
      :host,
      .diamond {
        transition: none;
      }
    }
  `,
})
export class LandingHeader {
  private readonly auth = inject(AuthService);
  protected readonly language = inject(LanguageService);
  protected readonly links = LINKS;
  protected readonly languages = ['fr', 'en'] as const;
  protected readonly landingUrl = environment.services.landing.url;
  protected readonly signedIn = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);
  /** La section au centre de l'écran (aucune dans le hero). */
  protected readonly active = signal<string | null>(null);

  constructor() {
    // La page reste publique : on regarde seulement si une session IDEM existe déjà.
    void this.auth.ensureLoaded().then((user) => this.signedIn.set(!!user));

    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.onScroll();
      if (typeof IntersectionObserver === 'undefined') return;
      // Une bande au milieu de l'écran : la section qui la traverse est la section en cours.
      const spy = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) if (entry.isIntersecting) this.active.set(entry.target.id);
        },
        { rootMargin: '-45% 0px -50% 0px' },
      );
      for (const link of LINKS) {
        const section = document.getElementById(link.id);
        if (section) spy.observe(section);
      }
      destroyRef.onDestroy(() => spy.disconnect());
    });
  }

  protected onScroll(): void {
    this.scrolled.set(scrollY > 8);
    // Revenu en haut de page : plus de section en cours.
    const first = document.getElementById(LINKS[0].id);
    if (first && first.getBoundingClientRect().top > innerHeight * 0.5) this.active.set(null);
  }
}
