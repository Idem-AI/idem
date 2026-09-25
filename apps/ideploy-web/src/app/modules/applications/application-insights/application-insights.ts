import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../shared/services/api.service';
import { ContainerUsage } from '../../../shared/models/ideploy.models';

/** How often the snapshot is refreshed while the page is open. */
const POLL_INTERVAL_MS = 10_000;

/**
 * Insights — what the application's containers are currently using.
 *
 * These are snapshots, not history: nothing in the schema records past usage,
 * so the screen polls and labels the reading as live rather than drawing a
 * trend line through a single sample. Polling stops when the page is left,
 * because each reading costs an SSH round trip.
 */
@Component({
  selector: 'app-application-insights',
  imports: [RouterLink, DecimalPipe, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="mb-4 inline-flex items-center gap-2 text-sm"
      style="color:var(--color-text-secondary);"
      [routerLink]="['/applications', uuid]"
    >
      <i class="pi pi-chevron-left text-[10px]"></i>
      {{ 'insights.backToApplication' | translate }}
    </a>

    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="heading-serif" style="font-size:32px;font-weight:700;color:var(--color-text-primary);">
          {{ 'insights.title' | translate }}
        </h1>
        <p class="mt-1 text-sm" style="color:var(--color-text-secondary);">
          {{ 'insights.liveHint' | translate }}
        </p>
      </div>
      <button class="outer-button" (click)="refresh()" [disabled]="loading()">
        {{ (loading() ? 'insights.refreshing' : 'insights.refresh') | translate }}
      </button>
    </div>

    @if (error()) {
      <p class="mb-4 text-sm" role="alert" style="color:var(--color-danger);">{{ error() }}</p>
    }

    @if (containers().length === 0) {
      <div class="glass-card p-4">
        <p>{{ loading() ? ('insights.loading' | translate) : ('insights.noContainers' | translate) }}</p>
      </div>
    } @else {
      <div class="grid gap-4 md:grid-cols-2">
        @for (c of containers(); track c.name) {
          <section class="glass-card p-4">
            <h2 class="mb-3 font-mono text-sm font-semibold">{{ c.name }}</h2>

            <div class="mb-3">
              <div class="mb-1 flex items-baseline justify-between gap-2">
                <span class="text-sm" style="color:var(--color-text-secondary);">{{ 'insights.cpu' | translate }}</span>
                <span class="text-sm font-semibold" style="font-variant-numeric:tabular-nums;" [style.color]="loadColor(c.cpuPercent)">
                  {{ c.cpuPercent !== null ? (c.cpuPercent | number: '1.1-1') + '%' : '—' }}
                </span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full" style="background:var(--color-surface-2);">
                <div
                  class="h-full rounded-full"
                  [style.width.%]="barWidth(c.cpuPercent)"
                  [style.background]="loadColor(c.cpuPercent)"
                ></div>
              </div>
            </div>

            <div class="mb-3">
              <div class="mb-1 flex items-baseline justify-between gap-2">
                <span class="text-sm" style="color:var(--color-text-secondary);">{{ 'insights.memory' | translate }}</span>
                <span class="text-sm font-semibold" style="font-variant-numeric:tabular-nums;" [style.color]="loadColor(c.memoryPercent)">
                  {{ formatBytes(c.memoryUsedBytes) }}
                  @if (c.memoryLimitBytes) {
                    <span style="color:var(--color-text-secondary);font-weight:400;"> / {{ formatBytes(c.memoryLimitBytes) }}</span>
                  }
                </span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full" style="background:var(--color-surface-2);">
                <div
                  class="h-full rounded-full"
                  [style.width.%]="barWidth(c.memoryPercent)"
                  [style.background]="loadColor(c.memoryPercent)"
                ></div>
              </div>
            </div>

            <dl class="flex gap-6 text-sm">
              <div>
                <dt style="color:var(--color-text-secondary);">{{ 'insights.networkIn' | translate }}</dt>
                <dd style="font-variant-numeric:tabular-nums;">{{ formatBytes(c.networkInBytes) }}</dd>
              </div>
              <div>
                <dt style="color:var(--color-text-secondary);">{{ 'insights.networkOut' | translate }}</dt>
                <dd style="font-variant-numeric:tabular-nums;">{{ formatBytes(c.networkOutBytes) }}</dd>
              </div>
            </dl>
          </section>
        }
      </div>
    }
  `,
})
export class ApplicationInsightsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  protected uuid = '';
  protected readonly containers = signal<ContainerUsage[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
    this.refresh();
    this.timer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
  }

  /** Each reading is an SSH round trip, so polling must not outlive the page. */
  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected refresh(): void {
    this.loading.set(true);
    this.api.appUsage(this.uuid).subscribe({
      next: (usage) => {
        this.containers.set(usage);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (e) => {
        const message = (e as { error?: { error?: { message?: string } } })?.error?.error?.message;
        this.error.set(message ?? this.translate.instant('insights.loadError'));
        this.loading.set(false);
      },
    });
  }

  /** Null reads as an empty bar rather than a full one. */
  protected barWidth(percent: number | null): number {
    if (percent === null) return 0;
    return Math.min(Math.max(percent, 0), 100);
  }

  protected loadColor(percent: number | null): string {
    if (percent === null) return 'var(--color-text-secondary)';
    if (percent >= 90) return 'var(--color-danger)';
    if (percent >= 70) return 'var(--color-warning)';
    return 'var(--color-success)';
  }

  protected formatBytes(bytes: number | null): string {
    if (bytes === null || !Number.isFinite(bytes)) return '—';
    const units = ['B', 'kB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }
}
