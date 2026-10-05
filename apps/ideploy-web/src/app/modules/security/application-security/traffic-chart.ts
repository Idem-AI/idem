import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FirewallTrafficStats } from '../../../shared/models/ideploy.models';

/** Ranges the chart offers, in hours. */
export const TRAFFIC_RANGES = [1, 24, 24 * 7] as const;

/**
 * Incoming requests over time, allowed and blocked.
 *
 * Every interval of the range is drawn, empty ones included, so time is to
 * scale: a single busy minute is a thin bar at its place, not the whole chart.
 * Bars stack allowed (primary) under blocked (danger) on one axis; the
 * headline numbers sit above, the y scale and a few time ticks frame the
 * plot, and hovering an interval shows its exact figures. The same figures
 * are in a table for screen readers.
 */
@Component({
  selector: 'app-traffic-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, PercentPipe, TranslateModule],
  template: `
    <!-- Headline numbers and range -->
    <div class="mb-4 flex flex-wrap items-end gap-6">
      <div>
        <p class="text-xs" style="color:var(--color-text-secondary);">{{ 'security.app.trafficRequests' | translate }}</p>
        <p class="text-2xl font-semibold" style="font-variant-numeric:tabular-nums;">{{ totals().requests | number }}</p>
      </div>
      <div>
        <p class="flex items-center gap-1.5 text-xs" style="color:var(--color-text-secondary);">
          <span class="inline-block h-2 w-2 rounded-sm" style="background:var(--color-danger);" aria-hidden="true"></span>{{ 'security.app.trafficBlocked' | translate }}
        </p>
        <p class="text-2xl font-semibold" style="font-variant-numeric:tabular-nums;">
          {{ totals().blocked | number }}
          @if (totals().requests > 0) {
            <span class="text-sm font-normal" style="color:var(--color-text-secondary);">· {{ totals().blocked / totals().requests | percent: '1.0-1' }}</span>
          }
        </p>
      </div>
      <div class="ml-auto flex rounded-lg p-0.5" style="background:var(--color-surface-2);" role="group" [attr.aria-label]="'security.app.trafficRange' | translate">
        @for (r of ranges; track r) {
          <button type="button" class="rounded-md px-3 py-1 text-xs transition-colors"
                  [style.background]="r === hours() ? 'var(--color-surface-1, var(--glass-bg))' : 'transparent'"
                  [style.color]="r === hours() ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'"
                  [attr.aria-pressed]="r === hours()" (click)="rangeChange.emit(r)">
            {{ 'security.app.range.' + r | translate }}
          </button>
        }
      </div>
    </div>

    @if (bars().length === 0) {
      <p class="py-10 text-center text-sm" style="color:var(--color-text-secondary);">{{ 'security.app.noTraffic' | translate }}</p>
    } @else {
      <div class="relative" (mouseleave)="hovered.set(null)">
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="block w-full" style="height:200px;overflow:visible;" preserveAspectRatio="none" role="img" [attr.aria-label]="'security.app.trafficChart' | translate">
          <!-- recessive grid with its scale -->
          @for (t of yTicks(); track t.value) {
            <line [attr.x1]="PAD_LEFT" [attr.x2]="W" [attr.y1]="t.y" [attr.y2]="t.y" stroke="var(--color-surface-2)" stroke-width="1" [attr.stroke-dasharray]="t.value === 0 ? null : '3 4'" vector-effect="non-scaling-stroke" />
          }
          @for (b of bars(); track b.at) {
            <g (mouseenter)="hovered.set(b)">
              <!-- the whole column is the hover target, wider than the mark -->
              <rect [attr.x]="b.x" y="0" [attr.width]="b.slot" [attr.height]="PLOT_H" fill="transparent" />
              @if (hovered() === b) {
                <rect [attr.x]="b.x" y="0" [attr.width]="b.slot" [attr.height]="PLOT_H" fill="var(--color-surface-2)" opacity="0.5" />
              }
              @if (b.allowedH > 0) {
                <rect [attr.x]="b.barX" [attr.y]="PLOT_H - b.allowedH" [attr.width]="b.barW" [attr.height]="b.allowedH" rx="1.5" fill="var(--color-primary)" />
              }
              @if (b.blockedH > 0) {
                <rect [attr.x]="b.barX" [attr.y]="PLOT_H - b.allowedH - b.blockedH - (b.allowedH > 0 ? 1.5 : 0)" [attr.width]="b.barW" [attr.height]="b.blockedH" rx="1.5" fill="var(--color-danger)" />
              }
            </g>
          }
        </svg>
        <!-- y scale, in HTML so it is not stretched with the plot -->
        @for (t of yTicks(); track t.value) {
          <span class="pointer-events-none absolute left-0 -translate-y-1/2 text-[10px]" [style.top.%]="(t.y / H) * 100" style="color:var(--color-text-tertiary);font-variant-numeric:tabular-nums;">{{ t.value | number }}</span>
        }
        <!-- tooltip -->
        @if (hovered(); as h) {
          <div class="pointer-events-none absolute top-0 z-10 rounded-lg px-3 py-2 text-xs shadow-lg"
               [style.left.%]="tooltipLeft(h)" [style.transform]="tooltipShift(h)"
               style="background:var(--color-surface-1, #111);border:1px solid var(--color-surface-2);font-variant-numeric:tabular-nums;white-space:nowrap;">
            <p class="mb-1 font-semibold">{{ h.at | date: (hours() > 24 ? 'EEE d MMM, HH:mm' : 'HH:mm') }}</p>
            <p class="flex items-center gap-1.5"><span class="inline-block h-2 w-2 rounded-sm" style="background:var(--color-primary);"></span>{{ 'security.app.trafficAllowed' | translate }} <strong class="ml-auto pl-3">{{ h.allowed | number }}</strong></p>
            <p class="flex items-center gap-1.5"><span class="inline-block h-2 w-2 rounded-sm" style="background:var(--color-danger);"></span>{{ 'security.app.trafficBlocked' | translate }} <strong class="ml-auto pl-3">{{ h.blocked | number }}</strong></p>
          </div>
        }
        <!-- time ticks -->
        <div class="relative mt-1 h-4 text-[10px]" style="color:var(--color-text-tertiary);">
          @for (t of xTicks(); track t.at) {
            <span class="absolute -translate-x-1/2 whitespace-nowrap" [style.left.%]="t.left">{{ t.at | date: (hours() > 24 ? 'EEE d' : 'HH:mm') }}</span>
          }
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-4 text-xs" style="color:var(--color-text-secondary);">
        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm" style="background:var(--color-primary);"></span>{{ 'security.app.trafficAllowed' | translate }}</span>
        <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm" style="background:var(--color-danger);"></span>{{ 'security.app.trafficBlocked' | translate }}</span>
      </div>
      <table class="sr-only">
        <caption>{{ 'security.app.trafficChart' | translate }}</caption>
        <thead><tr><th scope="col">{{ 'security.app.trafficTime' | translate }}</th><th scope="col">{{ 'security.app.trafficAllowed' | translate }}</th><th scope="col">{{ 'security.app.trafficBlocked' | translate }}</th></tr></thead>
        <tbody>
          @for (b of bars(); track b.at) {
            @if (b.allowed || b.blocked) {
              <tr><td>{{ b.at | date: 'short' }}</td><td>{{ b.allowed }}</td><td>{{ b.blocked }}</td></tr>
            }
          }
        </tbody>
      </table>
    }
  `,
})
export class TrafficChartComponent {
  readonly stats = input<FirewallTrafficStats | null>(null);
  readonly hours = input<number>(24);
  readonly rangeChange = output<number>();

  protected readonly ranges = TRAFFIC_RANGES;
  protected readonly W = 800;
  protected readonly H = 200;
  /** Room on the left for the y scale. */
  protected readonly PAD_LEFT = 28;
  protected readonly PLOT_H = 196;
  protected readonly hovered = signal<Bar | null>(null);

  protected readonly totals = computed(() => this.stats()?.totals ?? { requests: 0, blocked: 0 });

  /** A rounded top of scale (1, 2, 5 × 10ⁿ), so the grid reads in round numbers. */
  private readonly top = computed(() => {
    const max = Math.max(0, ...(this.stats()?.buckets ?? []).map((b) => b.allowed + b.blocked));
    if (max <= 4) return 4;
    const magnitude = 10 ** Math.floor(Math.log10(max));
    return [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= max) ?? max;
  });

  protected readonly yTicks = computed(() => {
    const top = this.top();
    return [0, top / 2, top].map((value) => ({ value, y: this.PLOT_H - (value / top) * this.PLOT_H }));
  });

  protected readonly bars = computed<Bar[]>(() => {
    const buckets = this.stats()?.buckets ?? [];
    if (buckets.length === 0) return [];
    const top = this.top();
    const slot = (this.W - this.PAD_LEFT) / buckets.length;
    // A 2px gap between bars, never thinner than 1px.
    const barW = Math.max(slot - 2, 1);
    return buckets.map((b, i) => {
      const x = this.PAD_LEFT + i * slot;
      return {
        ...b,
        x,
        slot,
        barX: x + (slot - barW) / 2,
        barW,
        allowedH: b.allowed > 0 ? Math.max((b.allowed / top) * this.PLOT_H, 1) : 0,
        blockedH: b.blocked > 0 ? Math.max((b.blocked / top) * this.PLOT_H, 2) : 0,
      };
    });
  });

  /** About six evenly spaced time labels. */
  protected readonly xTicks = computed(() => {
    const bars = this.bars();
    if (bars.length === 0) return [];
    const step = Math.max(1, Math.round(bars.length / 6));
    return bars
      .filter((_, i) => i % step === 0)
      .map((b) => ({ at: b.at, left: ((b.x + b.slot / 2) / this.W) * 100 }));
  });

  protected tooltipLeft(b: Bar): number {
    return ((b.x + b.slot / 2) / this.W) * 100;
  }

  /** Keep the tooltip inside the chart near its edges. */
  protected tooltipShift(b: Bar): string {
    const left = this.tooltipLeft(b);
    return left > 75 ? 'translateX(calc(-100% - 8px))' : left < 25 ? 'translateX(8px)' : 'translateX(-50%)';
  }
}

interface Bar {
  at: string;
  allowed: number;
  blocked: number;
  x: number;
  slot: number;
  barX: number;
  barW: number;
  allowedH: number;
  blockedH: number;
}
