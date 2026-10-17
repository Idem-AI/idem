import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ApiService, apiMessage } from '../../core/api.service';
import { Connection, Order } from '../../core/models';
import { Illustration } from '../../shared/components/illustration';
import { XafPipe } from '../../shared/xaf.pipe';

/** Ce que voit l'utilisateur, dans l'ordre : payé → enregistré → relié → en ligne. */
type Step = 'paid' | 'registered' | 'connected' | 'live';

/**
 * Le suivi d'une commande. L'enregistrement, la propagation DNS et le certificat prennent du
 * temps : la page se met à jour seule, et on peut la quitter puis revenir sans rien perdre.
 */
@Component({
  selector: 'idm-order',
  imports: [RouterLink, TranslateModule, IdemLoaderComponent, Illustration, XafPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-2xl px-4 py-10">
      @if (error()) {
        <section class="glass-card flex flex-col items-center p-8 text-center">
          <idm-illustration kind="cracked" [width]="120" />
          <p class="mt-4 font-semibold">{{ error() }}</p>
          <a routerLink="/orders" class="outer-button mt-5">{{ 'order.allOrders' | translate }}</a>
        </section>
      } @else if (!order()) {
        <div class="space-y-3"><div class="skeleton h-24 rounded-xl"></div><div class="skeleton h-48 rounded-xl"></div></div>
      } @else {
        @let o = order()!;
        @let item = o.items[0];
        <section class="glass-card flex flex-col items-center p-8 text-center">
          <idm-illustration [kind]="illustration()" [width]="150" />
          <h1 class="mt-4 break-all text-2xl font-semibold">{{ item?.domain }}</h1>
          <p class="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">{{ ('order.headline.' + headline()) | translate }}</p>
          @if (busy()) { <idem-loader size="sm" class="mt-4" [label]="'order.updating' | translate" /> }
        </section>

        @if (!failed()) {
          <ol class="glass-card mt-4 divide-y divide-[var(--glass-border-subtle)]" [attr.aria-label]="'order.progress' | translate">
            @for (step of steps(); track step) {
              <li class="flex items-center gap-3 px-5 py-4">
                @if (done(step)) {
                  <i class="pi pi-check-circle text-[var(--color-success)]" aria-hidden="true"></i>
                } @else if (current() === step) {
                  <idem-loader size="xs" />
                } @else {
                  <i class="pi pi-circle text-[var(--color-text-tertiary)]" aria-hidden="true"></i>
                }
                <span class="text-sm" [style.color]="!done(step) && current() !== step ? 'var(--color-text-tertiary)' : null">{{ ('order.steps.' + step) | translate }}</span>
                <span class="sr-only">{{ (done(step) ? 'order.stepDone' : current() === step ? 'order.stepCurrent' : 'order.stepTodo') | translate }}</span>
              </li>
            }
          </ol>
        }

        <section class="glass-card mt-4 p-5 text-sm">
          <div class="flex justify-between"><span class="text-[var(--color-text-secondary)]">{{ 'order.paid' | translate }}</span><span class="font-semibold">{{ o.totalXaf | xaf }}</span></div>
          @if (item?.renewalXaf) {
            <div class="mt-2 flex justify-between"><span class="text-[var(--color-text-secondary)]">{{ 'order.renewal' | translate }}</span><span>{{ item!.renewalXaf | xaf }}</span></div>
          }
          @if (o.status === 'refunded' || item?.status === 'failed') {
            <p class="mt-3 text-[var(--color-text-secondary)]">{{ 'order.refunded' | translate }}</p>
          }
        </section>

        <div class="mt-6 flex flex-wrap gap-2">
          @if (item?.domainId) { <a [routerLink]="['/domains', item!.domainId]" class="inner-button">{{ 'order.manage' | translate }}</a> }
          @if (connection()?.status === 'active') { <a [href]="'https://' + connection()!.host" target="_blank" rel="noopener" class="outer-button">{{ 'order.visit' | translate }}</a> }
          @if (o.status === 'on_hold') { <button type="button" class="outer-button" [disabled]="cancelling()" (click)="cancel()">{{ 'order.cancelRefund' | translate }}</button> }
          @if (failed()) { <a routerLink="/" class="inner-button">{{ 'order.searchAgain' | translate }}</a> }
        </div>
      }
    </div>
  `,
})
export class OrderPage {
  private readonly api = inject(ApiService);
  private readonly translate = inject(TranslateService);
  readonly id = input.required<string>();

  protected readonly order = signal<Order | null>(null);
  protected readonly connection = signal<Connection | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly cancelling = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  protected readonly failed = computed(() => ['failed', 'refunded', 'cancelled'].includes(this.order()?.status ?? ''));
  protected readonly registered = computed(() => this.order()?.items[0]?.status === 'registered');
  protected readonly steps = computed<Step[]>(() => (this.connection() ? ['paid', 'registered', 'connected', 'live'] : ['paid', 'registered']));
  protected readonly current = computed<Step | null>(() => {
    const o = this.order();
    if (!o) return null;
    if (['awaiting_payment', 'awaiting_contact'].includes(o.status)) return 'paid';
    if (!this.registered()) return 'registered';
    const c = this.connection();
    if (!c) return null;
    if (c.status === 'active') return null;
    return ['waiting_dns', 'activating_tls'].includes(c.status) ? 'live' : 'connected';
  });
  protected readonly busy = computed(() => !this.failed() && this.current() !== null && this.order()?.status !== 'on_hold');
  protected readonly headline = computed(() => {
    const o = this.order()!;
    if (o.status === 'awaiting_contact') return 'awaitingContact';
    if (o.status === 'on_hold' || o.status === 'needs_review') return 'onHold';
    if (this.failed()) return 'failed';
    if (!this.registered()) return 'registering';
    const c = this.connection();
    if (!c) return 'registered';
    if (c.status === 'active') return 'live';
    if (c.status === 'failed') return 'connectionFailed';
    return 'connecting';
  });
  protected readonly illustration = computed(() => (this.failed() ? 'cracked' : this.connection() && this.connection()!.status !== 'active' && this.registered() ? 'pirogue' : 'facade'));

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    queueMicrotask(() => this.load());
  }

  protected done(step: Step): boolean {
    const order: Step[] = ['paid', 'registered', 'connected', 'live'];
    const o = this.order();
    if (!o) return false;
    if (step === 'paid') return !['awaiting_payment', 'awaiting_contact'].includes(o.status);
    if (step === 'registered') return this.registered();
    const c = this.connection();
    if (!c) return false;
    if (c.status === 'active') return true;
    const cur = this.current();
    return cur !== null && order.indexOf(step) < order.indexOf(cur);
  }

  private load(): void {
    this.api.order(this.id()).subscribe({
      next: (o) => {
        this.order.set(o);
        const item = o.items[0];
        if (item) {
          this.api.connections().subscribe({
            next: (r) => {
              this.connection.set(r.connections.find((c) => c.host === item.domain) ?? null);
              this.schedule();
            },
            error: () => this.schedule(),
          });
        } else this.schedule();
      },
      error: (e) => this.error.set(apiMessage(e, this.translate.instant('order.loadError'))),
    });
  }

  /** Relire toutes les 5 s tant que quelque chose avance (puis 20 s pendant l'attente du DNS). */
  private schedule(): void {
    clearTimeout(this.timer);
    if (!this.busy()) return;
    const slow = this.current() === 'live' || this.current() === 'connected';
    this.timer = setTimeout(() => this.load(), slow ? 20_000 : 5_000);
  }

  protected cancel(): void {
    this.cancelling.set(true);
    this.api.cancelOrder(this.id()).subscribe({
      next: (o) => {
        this.cancelling.set(false);
        this.order.set(o);
      },
      error: (e) => {
        this.cancelling.set(false);
        this.error.set(apiMessage(e, this.translate.instant('order.cancelError')));
      },
    });
  }
}
