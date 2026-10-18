import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CatalogEntry, Quote } from '../../core/models';
import { DomainSearch } from '../../shared/components/domain-search';
import { AppsSection } from './apps-section';
import { FacadeScene } from './facade-scene';
import { FeaturesSection } from './features-section';
import { PricesSection } from './prices-section';
import { SetupTimeline } from './setup-timeline';

/**
 * L'accueil d'iDomain, ouvert à tous. Une idée par écran :
 *   1. le nom — le champ (résultats en direct), et la maison ndebele dont la plaque prend le nom tapé ;
 *   2. ce qui se passe après le paiement — l'installation, étape par étape ;
 *   3. ce qui vient avec un nom — inclus pour tous, et les options payantes ;
 *   4. les prix — la première année ET le renouvellement, puis les garanties ;
 *   5. pour qui est déjà en ligne avec IDEM — le même achat dans iDeploy et iCode.
 * La connexion n'est demandée qu'au moment de prendre un nom.
 */
@Component({
  selector: 'idm-home',
  imports: [TranslateModule, DomainSearch, FacadeScene, SetupTimeline, PricesSection, FeaturesSection, AppsSection],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-x-clip' },
  template: `
    <!-- 1. Le nom : le champ à gauche, la maison à son nom à droite. -->
    <section id="chercher" class="idm-wrap grid gap-10 pb-20 pt-10 sm:pt-14 lg:min-h-[calc(100svh_-_4rem)] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12 lg:pb-24">
      <div class="min-w-0">
        <h1 class="idm-hero-title text-[var(--color-heading)]">
          <span class="block">{{ 'home.hero.title1' | translate }}</span>
          <span class="block"><span class="i-underline">{{ 'home.hero.title2' | translate }}</span></span>
        </h1>
        <p class="mt-8 max-w-md text-lg leading-relaxed text-[var(--color-text-secondary)] sm:text-xl">{{ 'home.hero.lead' | translate }}</p>
        <idm-domain-search #search class="mt-10" [initial]="initialQuery" [catalog]="catalog() ?? []" (queryChange)="typed.set($event)" (chosen)="choose($event)" />
      </div>
      <idm-facade-scene class="mx-auto w-full max-w-[38rem] lg:sticky lg:top-24 lg:-mr-12 lg:w-[calc(100%_+_3rem)] lg:max-w-none xl:-mr-20 xl:w-[calc(100%_+_5rem)]" [query]="typed()" [suffix]="catalog()?.[0]?.tld ?? 'africa'" />
    </section>

    <!-- 2. Après le paiement. -->
    <section id="comment" class="border-t border-[var(--glass-border-subtle)] py-24 sm:py-32">
      <div class="idm-wrap"><idm-setup-timeline /></div>
    </section>

    <!-- 3. Ce qui vient avec un nom : inclus et en option. -->
    <section id="services" class="border-t border-[var(--glass-border-subtle)] py-24 sm:py-32">
      <div class="idm-wrap"><idm-features-section /></div>
    </section>

    <!-- 4. Les prix et les garanties. -->
    <section id="prix" class="border-t border-[var(--glass-border-subtle)] py-24 sm:py-32">
      <div class="idm-wrap"><idm-prices-section [catalog]="catalog()" (pick)="searchTld($event)" /></div>
    </section>

    <!-- 5. Déjà en ligne avec IDEM. -->
    <section id="applications" class="border-t border-[var(--glass-border-subtle)] py-24 sm:py-32">
      <div class="idm-wrap"><idm-apps-section /></div>
    </section>

    <!-- Fin : revenir au geste principal. -->
    <section class="border-t border-[var(--glass-border-subtle)] py-24 sm:py-32">
      <div class="idm-wrap flex flex-col items-start gap-8 lg:flex-row lg:items-end lg:justify-between">
        <h2 class="idm-section-title text-[var(--color-heading)]">
          <span class="block">{{ 'home.closing.title1' | translate }}</span>
          <span class="block"><span class="i-underline">{{ 'home.closing.title2' | translate }}</span></span>
        </h2>
        <button type="button" class="inner-button button-lg" (click)="backToSearch()">{{ 'home.closing.cta' | translate }}</button>
      </div>
    </section>

    <footer class="border-t border-[var(--glass-border-subtle)] py-8">
      <div class="idm-wrap flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--color-text-tertiary)]">
        <span>{{ 'home.footer.by' | translate }}</span>
        <span>{{ 'home.footer.currency' | translate }}</span>
      </div>
    </footer>
  `,
})
export class HomePage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly search = viewChild.required<DomainSearch>('search');
  protected readonly catalog = signal<CatalogEntry[] | null>(null);
  protected readonly typed = signal('');
  protected readonly initialQuery = inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '';

  constructor() {
    this.api.catalog().subscribe({ next: (c) => this.catalog.set(c.extensions), error: () => this.catalog.set([]) });
  }

  protected async choose(q: Quote): Promise<void> {
    const target = `/checkout?domain=${encodeURIComponent(q.domain)}`;
    if (await this.auth.ensureLoaded()) void this.router.navigateByUrl(target);
    else this.auth.redirectToLogin(`${window.location.origin}${target}`);
  }

  protected backToSearch(): void {
    document.getElementById('chercher')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    this.search().focus();
  }

  /** « Chercher en .africa » depuis la grille des prix : le champ du haut, avec cette extension. */
  protected searchTld(tld: string): void {
    this.backToSearch();
    const label = this.typed().trim().split('.')[0];
    if (label) this.search().searchFor(`${label}.${tld}`);
  }
}
