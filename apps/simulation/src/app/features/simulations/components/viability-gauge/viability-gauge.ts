import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ConfidenceLevel } from '../../models';
import { Robustness } from '../../models';

const ARC_LENGTH = Math.PI * 80;

/**
 * The simulated viability index.
 *
 * The band behind the value is the spread of the index across the scenarios
 * that were run. It is the point of the component: 68 with a wide band and 68
 * with a narrow one are not the same result, and a bare number hides that.
 */
@Component({
  selector: 'sim-viability-gauge',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="flex flex-col items-center gap-1">
      <svg viewBox="0 0 200 116" class="w-full max-w-[15rem]" role="img" [attr.aria-label]="label()">
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--color-surface-3)"
          stroke-width="14"
          stroke-linecap="round"
        />
        @if (hasRange()) {
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--color-primary)"
            stroke-opacity="0.22"
            stroke-width="14"
            [attr.stroke-dasharray]="bandDash()"
            [attr.stroke-dashoffset]="bandOffset()"
          />
        }
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          [attr.stroke]="strokeColour()"
          stroke-width="14"
          stroke-linecap="round"
          [attr.stroke-dasharray]="valueDash()"
        />
        <text
          x="100"
          y="88"
          text-anchor="middle"
          class="fill-ink"
          style="font-size: 34px; font-weight: 700; letter-spacing: -0.02em"
        >
          {{ value() }}
        </text>
        <text x="100" y="108" text-anchor="middle" class="fill-ink-subtle" style="font-size: 11px">
          / 100
        </text>
      </svg>

      <figcaption class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-meta">
        <span class="text-ink-subtle">
          {{ 'result.robustness' | translate }}
          <span class="ml-1 font-semibold text-ink-muted">
            {{ 'robustness.' + robustness() | translate }}
          </span>
        </span>
        <span class="text-ink-subtle">
          {{ 'result.confidence' | translate }}
          <span class="ml-1 font-semibold text-ink-muted">
            {{ 'confidence.' + confidence() | translate }}
          </span>
        </span>
      </figcaption>

      @if (hasRange()) {
        <p class="text-meta text-ink-subtle">
          {{ 'result.scenarioRange' | translate: { min: rangeMin(), max: rangeMax() } }}
        </p>
      }
    </figure>
  `,
})
export class ViabilityGauge {
  readonly value = input.required<number>();
  readonly robustness = input.required<Robustness>();
  readonly confidence = input.required<ConfidenceLevel>();
  readonly label = input<string>('');
  /** Lowest and highest index observed across the scenarios that were run. */
  readonly rangeMin = input<number | null>(null);
  readonly rangeMax = input<number | null>(null);

  protected readonly hasRange = computed(() => this.rangeMin() !== null && this.rangeMax() !== null);

  protected readonly valueDash = computed(() => {
    const filled = (clamp(this.value()) / 100) * ARC_LENGTH;
    return `${filled} ${ARC_LENGTH}`;
  });

  protected readonly bandDash = computed(() => {
    const from = clamp(this.rangeMin() ?? 0) / 100;
    const to = clamp(this.rangeMax() ?? 0) / 100;
    return `${Math.max(to - from, 0) * ARC_LENGTH} ${ARC_LENGTH}`;
  });

  protected readonly bandOffset = computed(() => -(clamp(this.rangeMin() ?? 0) / 100) * ARC_LENGTH);

  protected readonly strokeColour = computed(() => {
    const value = this.value();
    if (value >= 65) {
      return 'var(--color-success)';
    }
    return value >= 45 ? 'var(--color-warning)' : 'var(--color-danger)';
  });
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
