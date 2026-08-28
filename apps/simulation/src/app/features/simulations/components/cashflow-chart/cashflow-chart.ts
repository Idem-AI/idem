import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { FinancialPoint } from '../../models';

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 18, bottom: 28, left: 56 };

interface PlottedPoint {
  point: FinancialPoint;
  x: number;
  y: number;
}

/**
 * Cumulative cash across the simulated months.
 *
 * One series, so no legend: the caption names it. The zero line is the whole
 * point of the chart, so it is drawn explicitly rather than left to the grid.
 */
@Component({
  selector: 'sim-cashflow-chart',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="relative">
      <svg
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        class="w-full"
        role="img"
        [attr.aria-label]="'report.financials.chartLabel' | translate"
        (pointermove)="onPointerMove($event)"
        (pointerleave)="hovered.set(null)"
      >
        <!-- Horizontal grid, deliberately recessive. -->
        @for (tick of yTicks(); track tick.value) {
          <g>
            <line
              [attr.x1]="padding.left"
              [attr.x2]="width - padding.right"
              [attr.y1]="tick.y"
              [attr.y2]="tick.y"
              stroke="var(--sim-line)"
              stroke-width="1"
              [attr.stroke-opacity]="tick.value === 0 ? 1 : 0.45"
            />
            <text
              [attr.x]="padding.left - 8"
              [attr.y]="tick.y + 3"
              text-anchor="end"
              class="fill-ink-subtle"
              style="font-size: 10px"
            >
              {{ tick.label }}
            </text>
          </g>
        }

        <!-- Area under the curve, kept faint so the line stays the mark. -->
        <path [attr.d]="areaPath()" fill="var(--sim-brand)" fill-opacity="0.1" />
        <path
          [attr.d]="linePath()"
          fill="none"
          stroke="var(--sim-brand)"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        @if (breakEvenX(); as x) {
          <line
            [attr.x1]="x"
            [attr.x2]="x"
            [attr.y1]="padding.top"
            [attr.y2]="height - padding.bottom"
            stroke="var(--sim-verdict-go)"
            stroke-width="1.5"
            stroke-dasharray="3 3"
          />
          <text
            [attr.x]="x + 5"
            [attr.y]="padding.top + 10"
            class="fill-verdict-go"
            style="font-size: 10px; font-weight: 600"
          >
            {{ 'report.financials.breakEven' | translate }}
          </text>
        }

        @for (tick of xTicks(); track tick.month) {
          <text
            [attr.x]="tick.x"
            [attr.y]="height - 8"
            text-anchor="middle"
            class="fill-ink-subtle"
            style="font-size: 10px"
          >
            {{ 'report.financials.monthShort' | translate: { month: tick.month } }}
          </text>
        }

        @if (hovered(); as active) {
          <line
            [attr.x1]="active.x"
            [attr.x2]="active.x"
            [attr.y1]="padding.top"
            [attr.y2]="height - padding.bottom"
            stroke="var(--sim-line-strong)"
            stroke-width="1"
          />
          <circle
            [attr.cx]="active.x"
            [attr.cy]="active.y"
            r="4"
            fill="var(--sim-brand)"
            stroke="var(--sim-panel)"
            stroke-width="2"
          />
        }
      </svg>

      @if (hovered(); as active) {
        <div
          class="pointer-events-none absolute top-2 rounded-lg border border-line bg-panel-raised px-2.5 py-1.5 text-meta shadow-raised"
          [style.left.%]="(active.x / width) * 100"
          [style.transform]="'translateX(-50%)'"
        >
          <p class="font-semibold text-ink">
            {{ 'report.financials.monthShort' | translate: { month: active.point.month } }}
          </p>
          <p class="tabular-nums text-ink-muted">{{ format(active.point.cash) }}</p>
        </div>
      }

      <figcaption class="mt-2 text-meta text-ink-subtle">
        {{ 'report.financials.chartCaption' | translate: { currency: currency() } }}
      </figcaption>
    </figure>
  `,
})
export class CashflowChart {
  readonly points = input.required<readonly FinancialPoint[]>();
  readonly currency = input.required<string>();
  readonly breakEvenMonth = input<number | null>(null);

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly padding = PADDING;
  protected readonly hovered = signal<PlottedPoint | null>(null);

  private readonly bounds = computed(() => {
    const values = this.points().map((point) => point.cash);
    // Always include zero: the chart's job is showing when cash runs out.
    const max = Math.max(0, ...values);
    const min = Math.min(0, ...values);
    const span = max - min || 1;
    return { min, max, span };
  });

  protected readonly plotted = computed<PlottedPoint[]>(() => {
    const points = this.points();
    const { min, span } = this.bounds();
    const innerWidth = WIDTH - PADDING.left - PADDING.right;
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const lastIndex = Math.max(points.length - 1, 1);

    return points.map((point, index) => ({
      point,
      x: PADDING.left + (index / lastIndex) * innerWidth,
      y: PADDING.top + innerHeight - ((point.cash - min) / span) * innerHeight,
    }));
  });

  protected readonly linePath = computed(() =>
    this.plotted()
      .map((entry, index) => `${index === 0 ? 'M' : 'L'} ${entry.x.toFixed(1)} ${entry.y.toFixed(1)}`)
      .join(' '),
  );

  protected readonly areaPath = computed(() => {
    const plotted = this.plotted();
    if (!plotted.length) {
      return '';
    }
    const baseline = HEIGHT - PADDING.bottom;
    const first = plotted[0];
    const last = plotted[plotted.length - 1];
    return `${this.linePath()} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
  });

  protected readonly yTicks = computed(() => {
    const { min, max, span } = this.bounds();
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const values = [min, min + span / 2, max];
    if (min < 0 && max > 0) {
      values.push(0);
    }
    return [...new Set(values)]
      .sort((a, b) => a - b)
      .map((value) => ({
        value,
        y: PADDING.top + innerHeight - ((value - min) / span) * innerHeight,
        label: this.format(value),
      }));
  });

  protected readonly xTicks = computed(() => {
    const plotted = this.plotted();
    if (!plotted.length) {
      return [];
    }
    const step = Math.max(1, Math.round(plotted.length / 6));
    return plotted
      .filter((_, index) => index % step === 0 || index === plotted.length - 1)
      .map((entry) => ({ month: entry.point.month, x: entry.x }));
  });

  protected readonly breakEvenX = computed(() => {
    const month = this.breakEvenMonth();
    if (month === null) {
      return null;
    }
    return this.plotted().find((entry) => entry.point.month === month)?.x ?? null;
  });

  protected onPointerMove(event: PointerEvent): void {
    const target = event.currentTarget as SVGSVGElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const plotted = this.plotted();
    if (!plotted.length) {
      return;
    }
    const nearest = plotted.reduce((best, entry) =>
      Math.abs(entry.x - x) < Math.abs(best.x - x) ? entry : best,
    );
    this.hovered.set(nearest);
  }

  /** Compact money formatting: the axis needs magnitude, not exact francs. */
  protected format(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1).replace('.0', '')} M`;
    }
    if (abs >= 1000) {
      return `${Math.round(value / 1000)} k`;
    }
    return String(Math.round(value));
  }
}
