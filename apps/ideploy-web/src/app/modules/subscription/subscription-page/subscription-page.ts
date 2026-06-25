import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { ApiService } from '../../../shared/services/api.service';

@Component({
  selector: 'app-subscription-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-6 text-2xl font-bold">Subscription</h1>

    @if (subscription(); as s) {
      <div class="box mb-6">
        <div class="text-lg font-semibold">Current plan: {{ s.plan }}</div>
        @if (quota(); as q) {
          <div class="mt-2 text-sm">
            Apps: {{ q.apps.used }}/{{ q.apps.limit || '∞' }}
            <span [class.text-red-400]="!q.apps.ok">{{ q.apps.ok ? '' : '(limit reached)' }}</span>
          </div>
          <div class="text-sm">
            Servers: {{ q.servers.used }}/{{ q.servers.limit || '∞' }}
            <span [class.text-red-400]="!q.servers.ok">{{ q.servers.ok ? '' : '(limit reached)' }}</span>
          </div>
        }
      </div>
    }

    <h2 class="mb-3 font-semibold">Plans</h2>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      @for (plan of plans(); track plan['name']) {
        <div class="box">
          <div class="text-lg font-semibold">{{ plan['display_name'] }}</div>
          <div class="my-2 text-2xl">{{ plan['price'] }} {{ plan['currency'] }}<span class="text-sm">/{{ plan['billing_period'] }}</span></div>
          <div class="text-sm" style="color: var(--color-text-secondary)">
            Apps: {{ plan['app_limit'] || '∞' }} · Servers: {{ plan['server_limit'] || '∞' }}
          </div>
        </div>
      }
    </div>
  `,
})
export class SubscriptionPageComponent implements OnInit {
  private api = inject(ApiService);

  protected readonly subscription = signal<{ plan: string; appLimit: number; serverLimit: number; expiresAt: string | null } | null>(null);
  protected readonly quota = signal<{ apps: { used: number; limit: number; ok: boolean }; servers: { used: number; limit: number; ok: boolean } } | null>(null);
  protected readonly plans = signal<Record<string, unknown>[]>([]);

  ngOnInit(): void {
    this.api.getSubscription().subscribe((s) => this.subscription.set(s));
    this.api.getQuota().subscribe((q) => this.quota.set(q));
    this.api.listPlans().subscribe((p) => this.plans.set(p));
  }
}
