import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';

@Component({
  selector: 'app-subscription-page',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">{{ 'subscription.title' | translate }}</h1>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    @if (subscription(); as s) {
      <div class="glass-card p-4 mb-6">
        <div class="flex items-center justify-between gap-3">
          <div class="text-lg font-semibold">{{ 'subscription.currentPlan' | translate }} {{ s.plan }}</div>
          <div class="flex gap-2">
            <button class="outer-button" (click)="openPortal()" [disabled]="portalLoading()">
              {{ (portalLoading() ? 'subscription.opening' : 'subscription.managePayment') | translate }}
            </button>
            @if (s.plan !== 'free') {
              <button class="text-xs" style="color:var(--color-danger);" (click)="cancel()">
                {{ 'subscription.cancel' | translate }}
              </button>
            }
          </div>
        </div>
        @if (quota(); as q) {
          <div class="mt-2 text-sm">
            {{ 'subscription.apps' | translate }} {{ q.apps.used }}/{{ q.apps.limit || '∞' }}
            <span [class.text-red-400]="!q.apps.ok">{{ q.apps.ok ? '' : ('subscription.limitReached' | translate) }}</span>
          </div>
          <div class="text-sm">
            {{ 'subscription.servers' | translate }} {{ q.servers.used }}/{{ q.servers.limit || '∞' }}
            <span [class.text-red-400]="!q.servers.ok">{{ q.servers.ok ? '' : ('subscription.limitReached' | translate) }}</span>
          </div>
        }
      </div>
    }

    <h2 class="mb-3 font-semibold">{{ 'subscription.plans' | translate }}</h2>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      @for (plan of plans(); track plan['name']) {
        <div class="glass-card p-4 flex flex-col">
          <div class="text-lg font-semibold">{{ plan['display_name'] }}</div>
          <div class="my-2 text-2xl">{{ plan['price'] }} {{ plan['currency'] }}<span class="text-sm">/{{ plan['billing_period'] }}</span></div>
          <div class="text-sm" style="color: var(--color-text-secondary)">
            {{ 'subscription.apps' | translate }} {{ plan['app_limit'] || '∞' }} · {{ 'subscription.servers' | translate }} {{ plan['server_limit'] || '∞' }}
          </div>
          <div class="mt-3">
            @if (subscription()?.plan === plan['name']) {
              <span class="status-badge" style="background:color-mix(in srgb, var(--color-success) 12%, transparent);color:var(--color-success);border:1px solid color-mix(in srgb, var(--color-success) 28%, transparent);">{{ 'subscription.current' | translate }}</span>
            } @else {
              <button class="inner-button w-full" (click)="select(plan)">{{ plan['price'] && +(plan['price'] || 0) > 0 ? ('subscription.subscribe' | translate) : ('subscription.switch' | translate) }}</button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class SubscriptionPageComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  protected readonly subscription = signal<{ plan: string; appLimit: number; serverLimit: number; expiresAt: string | null } | null>(null);
  protected readonly quota = signal<{ apps: { used: number; limit: number; ok: boolean }; servers: { used: number; limit: number; ok: boolean } } | null>(null);
  protected readonly plans = signal<Record<string, unknown>[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly portalLoading = signal(false);

  private report(err: unknown): void {
    const message = (err as { error?: { error?: { message?: string } } })?.error?.error?.message;
    this.error.set(message ?? this.translate.instant('subscription.genericError'));
  }

  ngOnInit(): void {
    this.reload();
    this.api.getQuota().subscribe((q) => this.quota.set(q));
    this.api.listPlans().subscribe((p) => this.plans.set(p));
  }

  private reload(): void {
    this.api.getSubscription().subscribe((s) => this.subscription.set(s));
  }

  /** Stripe's own billing portal — invoices, payment method, cancellation. */
  protected openPortal(): void {
    this.portalLoading.set(true);
    this.error.set(null);
    this.api.billingPortal().subscribe({
      next: (r) => {
        if (r.url) window.location.href = r.url;
        this.portalLoading.set(false);
      },
      error: (e) => {
        this.report(e);
        this.portalLoading.set(false);
      },
    });
  }

  protected cancel(): void {
    this.error.set(null);
    this.api.cancelSubscription().subscribe({
      next: () => this.reload(),
      error: (e) => this.report(e),
    });
  }

  /** Paid plan → Stripe checkout; free/switch → direct plan change. */
  protected select(plan: Record<string, unknown>): void {
    const price = Number(plan['price'] ?? 0);
    const priceId = plan['stripe_price_id'] as string | undefined;
    if (price > 0 && priceId) {
      this.api.checkout(priceId).subscribe((r) => {
        if (r.url) window.location.href = r.url;
      });
    } else {
      this.api.changePlan(String(plan['name'])).subscribe(() => this.reload());
    }
  }
}
