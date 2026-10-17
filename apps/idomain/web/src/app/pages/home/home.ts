import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { CatalogEntry, Quote } from '../../core/models';
import { DomainSearch } from '../../shared/components/domain-search';
import { Illustration } from '../../shared/components/illustration';
import { XafPipe } from '../../shared/xaf.pipe';

/**
 * L'accueil : chercher son nom, voir son prix (et celui du renouvellement), le prendre. Ouvert à
 * tous ; la connexion n'est demandée qu'au moment de commander.
 */
@Component({
  selector: 'idm-home',
  imports: [TranslateModule, DomainSearch, Illustration, XafPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-12 md:grid-cols-[1fr_260px] md:pt-20">
      <div>
        <h1 class="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {{ 'home.titleStart' | translate }} <span class="i-underline">{{ 'home.titleStrong' | translate }}</span>
        </h1>
        <p class="mt-4 max-w-xl text-base leading-relaxed text-[var(--color-text-secondary)]">{{ 'home.lead' | translate }}</p>
        <idm-domain-search class="mt-8" [initial]="initialQuery" (chosen)="choose($event)" />
      </div>
      <idm-illustration kind="facade" [width]="240" class="mx-auto hidden md:block" />
    </section>

    <section class="mx-auto max-w-6xl px-4 py-10" aria-labelledby="prices-title">
      <h2 id="prices-title" class="text-xl font-semibold">{{ 'home.pricesTitle' | translate }}</h2>
      <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'home.pricesLead' | translate }}</p>
      @if (catalog(); as rows) {
        @if (!rows.length) {
          <p class="mt-4 text-sm text-[var(--color-text-secondary)]">{{ 'home.pricesUnavailable' | translate }}</p>
        } @else {
        <div class="glass-card mt-4 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-[var(--color-text-tertiary)]">
                <th scope="col" class="px-5 py-3 font-medium">{{ 'home.extension' | translate }}</th>
                <th scope="col" class="px-5 py-3 font-medium">{{ 'home.firstYear' | translate }}</th>
                <th scope="col" class="px-5 py-3 font-medium">{{ 'home.renewal' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.tld) {
                <tr class="border-t border-[var(--glass-border-subtle)]">
                  <td class="px-5 py-3 font-semibold">.{{ row.tld }}</td>
                  <td class="px-5 py-3">{{ row.registerXaf | xaf }}</td>
                  <td class="px-5 py-3">{{ row.renewXaf | xaf }} <span class="text-xs text-[var(--color-text-tertiary)]">{{ 'home.perYear' | translate }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        }
      } @else {
        <div class="skeleton mt-4 h-32 rounded-xl"></div>
      }
    </section>

    <section class="mx-auto max-w-6xl px-4 py-10">
      <h2 class="text-xl font-semibold">{{ 'home.howTitle' | translate }}</h2>
      <ol class="mt-6 grid gap-6 md:grid-cols-3">
        @for (step of steps; track step; let i = $index) {
          <li>
            <span class="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--glass-border-subtle)] text-sm font-semibold">{{ i + 1 }}</span>
            <h3 class="mt-3 font-semibold">{{ 'home.steps.' + step + '.title' | translate }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">{{ 'home.steps.' + step + '.body' | translate }}</p>
          </li>
        }
      </ol>
    </section>
  `,
})
export class HomePage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly catalog = signal<CatalogEntry[] | null>(null);
  protected readonly steps = ['find', 'pay', 'connect'];
  protected readonly initialQuery = inject(ActivatedRoute).snapshot.queryParamMap.get('q') ?? '';

  constructor() {
    this.api.catalog().subscribe({ next: (c) => this.catalog.set(c.extensions), error: () => this.catalog.set([]) });
  }

  protected async choose(q: Quote): Promise<void> {
    const target = `/checkout?domain=${encodeURIComponent(q.domain)}`;
    if (await this.auth.ensureLoaded()) void this.router.navigateByUrl(target);
    else this.auth.redirectToLogin(`${window.location.origin}${target}`);
  }
}
