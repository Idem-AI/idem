import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { Order } from '../../core/models';
import { Illustration } from '../../shared/components/illustration';
import { XafPipe } from '../../shared/xaf.pipe';

/**
 * L'historique des commandes : ce qui a été payé, ce qui a été restitué. Le relevé détaillé du
 * portefeuille (recharges, débits) reste dans le compte IDEM, seul endroit où il est tenu.
 */
@Component({
  selector: 'idm-orders',
  imports: [DatePipe, RouterLink, TranslateModule, Illustration, XafPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-4xl px-4 py-10">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold">{{ 'orders.title' | translate }}</h1>
          <p class="mt-1 text-sm text-[var(--color-text-secondary)]">{{ 'orders.lead' | translate }}</p>
        </div>
        <a [href]="statementUrl" class="button-ghost button-sm inline-flex items-center gap-2"><i class="pi pi-wallet" aria-hidden="true"></i>{{ 'orders.statement' | translate }}</a>
      </div>

      @if (orders() === null) {
        <div class="mt-6 space-y-2">@for (i of [1, 2, 3]; track i) { <div class="skeleton h-16 rounded-xl"></div> }</div>
      } @else if (failed()) {
        <section class="glass-card mt-6 flex flex-col items-center p-8 text-center">
          <idm-illustration kind="cracked" [width]="110" />
          <p class="mt-4 text-sm">{{ 'common.loadError' | translate }}</p>
        </section>
      } @else if (!orders()!.length) {
        <section class="glass-card mt-6 flex flex-col items-center p-8 text-center">
          <idm-illustration kind="calabash" [width]="120" />
          <p class="mt-4 font-semibold">{{ 'orders.empty' | translate }}</p>
          <a routerLink="/" class="inner-button mt-5">{{ 'orders.findName' | translate }}</a>
        </section>
      } @else {
        <ul class="glass-card mt-6 divide-y divide-[var(--glass-border-subtle)]">
          @for (o of orders(); track o.id) {
            <li>
              <a [routerLink]="['/orders', o.id]" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-[var(--glass-bg-light)]">
                <span class="min-w-0 flex-1">
                  <span class="block break-all font-semibold">{{ o.items[0]?.domain }}</span>
                  <span class="block text-xs text-[var(--color-text-secondary)]">{{ o.createdAt | date: 'd MMM y, HH:mm' }} · {{ ('orders.status.' + o.status) | translate }}</span>
                </span>
                <span class="font-semibold">{{ o.totalXaf | xaf }}</span>
                <i class="pi pi-angle-right text-[var(--color-text-tertiary)]" aria-hidden="true"></i>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class OrdersPage {
  protected readonly orders = signal<Order[] | null>(null);
  protected readonly failed = signal(false);
  protected readonly statementUrl = `${environment.services.dashboard.url}/account/plans`;

  constructor() {
    inject(ApiService)
      .orders()
      .subscribe({
        next: (r) => this.orders.set(r.orders),
        error: () => {
          this.failed.set(true);
          this.orders.set([]);
        },
      });
  }
}
