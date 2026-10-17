import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { AppMeter, MeterCatalog, MeterService, MeterTier, UserDomain } from '../../../shared/services/meter.service';
import { environment } from '../../../../environments/environment';
import { IllustrationComponent } from '../../../shared/components/illustration/illustration';

/**
 * Les compteurs : « Faire tourner », au jour, depuis le portefeuille IDEM.
 *
 * Plus de forfait à choisir : chaque application a son compteur (Veille gratuite, Vitrine
 * 10 F/jour, Application 50 F/jour…), qu'on change d'un geste, et des options à la journée.
 * L'écran répond à trois questions :
 *  1. « Combien de temps mon solde tient-il ? » — le solde et les jours couverts ;
 *  2. « Que me coûte chaque application ? » — son compteur, ses options, son état ;
 *  3. « Comment avoir mon nom ? » — commander un domaine.
 */
@Component({
  selector: 'app-subscription-page',
  imports: [TranslateModule, FormsModule, DecimalPipe, DatePipe, IdemLoaderComponent, IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="mb-1 text-2xl font-bold">{{ 'meters.title' | translate }}</h1>
    <p class="mb-6 text-sm" style="color: var(--color-text-secondary)">{{ 'meters.subtitle' | translate }}</p>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    @if (view(); as v) {
      <!-- 1. Le solde -->
      <section class="glass-card mb-6 flex flex-wrap items-center gap-6 p-5">
        <app-illustration name="cowries" [width]="96" />
        <div class="min-w-0 flex-1">
          <p class="text-sm" style="color: var(--color-text-tertiary)">{{ 'meters.wallet' | translate }}</p>
          <p class="text-2xl font-bold tabular-nums">{{ v.walletXaf | number: '1.0-0' }} F</p>
          <p class="text-sm" style="color: var(--color-text-secondary)">
            @if (v.daysCovered === null) {
              {{ 'meters.nothingToPay' | translate }}
            } @else {
              {{ 'meters.daysCovered' | translate: { days: v.daysCovered, perDay: (dailyTotal() | number: '1.0-0') } }}
            }
          </p>
        </div>
        <a class="inner-button" [href]="topUpUrl()">{{ 'meters.topUp' | translate }}</a>
      </section>

      <!-- 2. Une application = un compteur -->
      <h2 class="mb-3 font-semibold">{{ 'meters.apps' | translate }}</h2>
      @if (v.meters.length === 0) {
        <p class="glass-card p-5 text-sm" style="color: var(--color-text-secondary)">{{ 'meters.noApps' | translate }}</p>
      }
      <div class="space-y-3">
        @for (meter of v.meters; track meter.appUuid) {
          <section class="glass-card p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold">{{ meter.appName }}</p>
                @if (meter.fqdn) {
                  <p class="truncate text-xs" style="color: var(--color-text-tertiary)">{{ meter.fqdn }}</p>
                }
                <p class="mt-1 text-xs" [style.color]="meter.status === 'active' ? 'var(--color-success)' : 'var(--color-warning)'">
                  {{ 'meters.status.' + meter.status | translate }}
                  @if (meter.freeUntil && meter.tier === 'veille') {
                    · {{ 'meters.freeUntil' | translate: { date: (meter.freeUntil | date: 'd MMMM') } }}
                  }
                  @if (meter.coveredBy) {
                    · {{ 'meters.coveredBy.' + meter.coveredBy | translate }}
                  }
                </p>
              </div>
              <div class="text-right">
                <p class="text-lg font-semibold tabular-nums">{{ meter.perDayXaf | number: '1.0-0' }} F</p>
                <p class="text-xs" style="color: var(--color-text-tertiary)">{{ 'meters.perDay' | translate }}</p>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap items-end gap-3">
              <label class="text-xs" style="color: var(--color-text-tertiary)">
                {{ 'meters.tier' | translate }}
                <select class="!w-56" [ngModel]="meter.tier" (ngModelChange)="setTier(meter, $event)" [disabled]="busy() === meter.appUuid">
                  @for (tier of catalog()?.meters ?? []; track tier.tier) {
                    <option [value]="tier.tier">{{ tier.label }} — {{ tier.perDayXaf | number: '1.0-0' }} F/{{ 'meters.day' | translate }}</option>
                  }
                </select>
              </label>
              @if (meter.status !== 'active') {
                <button type="button" class="inner-button button-sm" [disabled]="busy() === meter.appUuid" (click)="wake(meter)">
                  @if (busy() === meter.appUuid) {
                    <idem-loader size="xs" />
                  }
                  {{ 'meters.wake' | translate }}
                </button>
              }
              @if (busy() === meter.appUuid && meter.status === 'active') {
                <idem-loader size="xs" />
              }
            </div>
            @if (tierDescription(meter.tier); as description) {
              <p class="mt-2 text-xs" style="color: var(--color-text-secondary)">{{ description }}</p>
            }

            @if (meter.tier !== 'veille') {
              <fieldset class="mt-3">
                <legend class="text-xs" style="color: var(--color-text-tertiary)">{{ 'meters.options' | translate }}</legend>
                <div class="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  @for (option of catalog()?.meterOptions ?? []; track option.code) {
                    <label class="flex items-center gap-2 text-xs">
                      <input type="checkbox" [checked]="meter.options.includes(option.code)" (change)="toggleOption(meter, option.code)" [disabled]="busy() === meter.appUuid" />
                      <span>{{ option.label }} · {{ option.perDayXaf | number: '1.0-0' }} F/{{ 'meters.day' | translate }}</span>
                    </label>
                  }
                </div>
              </fieldset>
            }
          </section>
        }
      </div>

      <!-- 3. Le nom de domaine -->
      <section class="glass-card mt-8 p-5">
        <div class="flex flex-wrap items-center gap-4">
          <app-illustration name="facade" [width]="72" />
          <div class="min-w-0 flex-1">
            <h2 class="font-semibold">{{ 'meters.domainTitle' | translate }}</h2>
            <p class="text-xs" style="color: var(--color-text-secondary)">
              @for (entry of domainPrices(); track entry.ext) {
                <span class="mr-3">.{{ entry.ext }} : {{ entry.priceXaf | number: '1.0-0' }} F {{ 'meters.firstYear' | translate }} · {{ entry.renewalXaf | number: '1.0-0' }} F/{{ 'meters.year' | translate }}</span>
              }
            </p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-end gap-2">
          <a [href]="idomainUrl" class="outer-button">{{ 'meters.orderDomain' | translate }}</a>
        </div>
        @if (orders().length) {
          <ul class="mt-3 space-y-1 text-xs">
            @for (order of orders(); track order.id) {
              <li class="flex justify-between gap-3">
                <a [href]="idomainUrl + '/domains/' + order.id" class="hover:underline">{{ order.name }}</a>
                <span style="color: var(--color-text-tertiary)">{{ 'meters.domainStatus.' + order.status | translate }}</span>
              </li>
            }
          </ul>
        }
      </section>
    } @else if (!error()) {
      <idem-loader block [label]="'meters.loading' | translate" />
    }
  `,
})
export class SubscriptionPageComponent implements OnInit {
  private readonly meters = inject(MeterService);
  private readonly translate = inject(TranslateService);

  protected readonly view = signal<{ meters: AppMeter[]; walletXaf: number; daysCovered: number | null } | null>(null);
  protected readonly catalog = signal<MeterCatalog | null>(null);
  protected readonly orders = signal<UserDomain[]>([]);
  /** Les noms de domaine s'achètent et se gèrent sur iDomain. */
  protected readonly idomainUrl = environment.services.idomain.url;
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);

  protected readonly dailyTotal = computed(() =>
    (this.view()?.meters ?? []).filter((m) => m.status === 'active').reduce((sum, m) => sum + m.perDayXaf, 0),
  );

  protected readonly domainPrices = computed(() =>
    Object.entries(this.catalog()?.domains ?? {}).map(([ext, price]) => ({ ext, ...price })),
  );

  ngOnInit(): void {
    this.reload();
    this.meters.catalog().subscribe({ next: (catalog) => this.catalog.set(catalog), error: (e) => this.report(e) });
    this.meters.domains().subscribe({ next: (r) => this.orders.set(r.domains), error: () => this.orders.set([]) });
  }

  protected topUpUrl(): string {
    return this.meters.topUpUrl();
  }

  protected tierDescription(tier: MeterTier): string | null {
    return this.catalog()?.meters.find((m) => m.tier === tier)?.description ?? null;
  }

  protected setTier(meter: AppMeter, tier: MeterTier): void {
    this.apply(meter, () => this.meters.configure(meter.appUuid, { tier }));
  }

  protected toggleOption(meter: AppMeter, code: string): void {
    const options = meter.options.includes(code) ? meter.options.filter((o) => o !== code) : [...meter.options, code];
    this.apply(meter, () => this.meters.configure(meter.appUuid, { options }));
  }

  protected wake(meter: AppMeter): void {
    this.apply(meter, () => this.meters.wake(meter.appUuid));
  }

  private apply(meter: AppMeter, call: () => ReturnType<MeterService['wake']>): void {
    this.busy.set(meter.appUuid);
    this.error.set(null);
    call().subscribe({
      next: () => {
        this.busy.set(null);
        this.reload();
      },
      error: (e) => {
        this.busy.set(null);
        this.report(e);
        this.reload();
      },
    });
  }

  private reload(): void {
    this.meters.list().subscribe({ next: (view) => this.view.set(view), error: (e) => this.report(e) });
  }

  /** Un solde insuffisant (402) dit ce qui manque et renvoie vers la recharge. */
  private report(err: unknown): void {
    const body = (err as { status?: number; error?: { message?: string; missingXaf?: number } })?.error;
    const status = (err as { status?: number })?.status;
    if (status === 402 && body?.missingXaf) {
      this.error.set(this.translate.instant('meters.missing', { missing: body.missingXaf }));
      return;
    }
    this.error.set(body?.message ?? this.translate.instant('subscription.genericError'));
  }
}
