import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ApiService } from '../../core/api.service';
import { DomainSummary } from '../../core/models';
import { Illustration } from '../../shared/components/illustration';
import { XafPipe } from '../../shared/xaf.pipe';

/**
 * Mes domaines : ce qui est actif, quand ça expire et ce que coûtera le renouvellement, à quelle
 * application c'est relié et si ça marche. Une échéance proche est signalée avant d'arriver.
 */
@Component({
  selector: 'idm-domains',
  imports: [DatePipe, RouterLink, TranslateModule, Illustration, XafPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl px-4 py-10">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-2xl font-semibold">{{ 'domains.title' | translate }}</h1>
        <div class="flex gap-2">
          <a routerLink="/contact" class="button-ghost button-sm inline-flex items-center gap-2"><i class="pi pi-id-card" aria-hidden="true"></i>{{ 'domains.holder' | translate }}</a>
          <a routerLink="/" class="inner-button button-sm inline-flex items-center gap-2"><i class="pi pi-plus" aria-hidden="true"></i>{{ 'domains.add' | translate }}</a>
        </div>
      </div>

      @if (domains() === null) {
        <div class="mt-6 space-y-2">@for (i of [1, 2]; track i) { <div class="skeleton h-20 rounded-xl"></div> }</div>
      } @else if (failed()) {
        <section class="glass-card mt-6 flex flex-col items-center p-8 text-center">
          <idm-illustration kind="cracked" [width]="110" />
          <p class="mt-4 text-sm">{{ 'common.loadError' | translate }}</p>
        </section>
      } @else if (!domains()!.length) {
        <section class="glass-card mt-6 grid items-center gap-6 p-6 md:grid-cols-[180px_1fr]">
          <idm-illustration kind="facade" [width]="170" class="mx-auto" />
          <div>
            <p class="text-lg font-semibold">{{ 'domains.emptyTitle' | translate }}</p>
            <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'domains.emptyBody' | translate }}</p>
            <a routerLink="/" class="inner-button mt-5 inline-block">{{ 'domains.findName' | translate }}</a>
          </div>
        </section>
      } @else {
        <ul class="glass-card mt-6 divide-y divide-[var(--glass-border-subtle)]">
          @for (d of domains(); track d.id) {
            <li>
              <a [routerLink]="['/domains', d.id]" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-[var(--glass-bg-light)]">
                <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="dot(d)" aria-hidden="true"></span>
                <span class="min-w-0 flex-1">
                  <span class="block break-all font-semibold">{{ d.name }}</span>
                  <span class="block text-xs text-[var(--color-text-secondary)]">
                    @if (d.connection) { {{ ('connection.status.' + d.connection.status) | translate }} } @else { {{ 'domains.notConnected' | translate }} }
                  </span>
                </span>
                <span class="text-right text-xs">
                  @if (d.expiresAt) {
                    <span class="block" [style.color]="(d.daysLeft ?? 99) <= 30 ? 'var(--color-warning)' : null">{{ 'domains.expires' | translate: { date: (d.expiresAt | date: 'd MMM y') } }}</span>
                  }
                  @if (d.renewalXaf) { <span class="block text-[var(--color-text-tertiary)]">{{ 'domains.renewal' | translate: { price: (d.renewalXaf | xaf) } }}</span> }
                </span>
                <i class="pi pi-angle-right text-[var(--color-text-tertiary)]" aria-hidden="true"></i>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class DomainsPage {
  protected readonly domains = signal<DomainSummary[] | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    inject(ApiService)
      .domains()
      .subscribe({
        next: (r) => this.domains.set(r.domains),
        error: () => {
          this.failed.set(true);
          this.domains.set([]);
        },
      });
  }

  protected dot(d: DomainSummary): string {
    if (d.connection?.status === 'active') return 'var(--color-success)';
    if (d.connection?.status === 'failed' || (d.daysLeft ?? 99) <= 30) return 'var(--color-warning)';
    return 'var(--color-text-tertiary)';
  }
}
