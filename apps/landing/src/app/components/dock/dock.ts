import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  inject,
  input,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TrustedByComponent } from '@idem/shared-trusted-by/angular';
import { environment } from '../../../environments/environment';

/**
 * L'arc fixe au bas de l'écran et son bouton « Essayer gratuitement », sur
 * toutes les pages (rendu par le gabarit de l'application).
 *
 * Sur l'accueil, en haut de page, les partenaires défilent sous le bouton, qui
 * flotte à cheval sur l'arc. Dès que la page défile, et partout ailleurs, il ne
 * reste que l'arc et le bouton posé dedans. Le dock s'efface quand l'appel
 * final de la page (`app-cta`) ou le pied de page arrive : ils ont leur bouton.
 */
@Component({
  selector: 'app-dock',
  imports: [TrustedByComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './dock.css',
  template: `
    <div class="dock" [class.is-compact]="compact()" [class.is-away]="away()">
      <div class="dock-arc" aria-hidden="true"></div>
      <div class="dock-inner">
        <a href="{{ dashboardUrl }}/create-project" class="inner-button button-sm dock-cta">
          <ng-container i18n="@@hero.tryForFree">Try for free</ng-container>
          <i class="pi pi-arrow-right" aria-hidden="true"></i>
        </a>
        @if (trust()) {
          <div class="dock-trust" [attr.aria-hidden]="compact() ? 'true' : null" [attr.inert]="compact() ? '' : null">
            <idem-trusted-by />
          </div>
        }
      </div>
    </div>
  `,
})
export class DockComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);

  /** Show the partners under the button (the home page only). */
  readonly trust = input(false);

  protected readonly dashboardUrl = environment.services.dashboard.url;
  private readonly scrolled = signal(false);
  protected readonly away = signal(false);

  /** Arc and button only: once the page scrolls, or wherever there are no partners. */
  protected compact(): boolean {
    return this.scrolled() || !this.trust();
  }

  private scrollRaf = 0;
  private endObserver?: IntersectionObserver;
  private readonly visibleEnds = new Set<Element>();
  private navSub?: { unsubscribe(): void };

  private readonly onScroll = () => {
    if (this.scrollRaf) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = 0;
      const past = window.scrollY > 24;
      if (past !== this.scrolled()) this.zone.run(() => this.scrolled.set(past));
    });
  };

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.onScroll();
    });
    this.watchEnds();
    // Each page has its own final call to action: watched again after every navigation.
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => setTimeout(() => this.watchEnds(), 0));
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.removeEventListener('scroll', this.onScroll);
    cancelAnimationFrame(this.scrollRaf);
    this.endObserver?.disconnect();
    this.navSub?.unsubscribe();
  }

  private watchEnds(): void {
    this.endObserver?.disconnect();
    this.visibleEnds.clear();
    this.zone.run(() => this.away.set(false));
    this.zone.runOutsideAngular(() => {
      this.endObserver = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) this.visibleEnds.add(e.target);
          else this.visibleEnds.delete(e.target);
        }
        const away = this.visibleEnds.size > 0;
        if (away !== this.away()) this.zone.run(() => this.away.set(away));
      });
      document.querySelectorAll('app-cta, app-footer').forEach((e) => this.endObserver!.observe(e));
    });
  }
}
