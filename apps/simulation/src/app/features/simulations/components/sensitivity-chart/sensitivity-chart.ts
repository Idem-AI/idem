import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { SensitivityEntry } from '../../models';

/**
 * How much each move changes the viability index.
 *
 * Diverging around zero, with a cool/warm pair rather than green/red: the
 * polarity has to stay readable for colour-blind readers, and the sign is
 * also carried by the bar's direction and its label.
 */
@Component({
  selector: 'sim-sensitivity-chart',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <ul class="flex flex-col gap-2.5">
        @for (row of rows(); track row.entry.factorId + row.entry.change) {
          <li class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-ink">{{ row.entry.factorName }}</p>
              <p class="truncate text-meta text-ink-subtle">{{ row.entry.change }}</p>
            </div>

            <div class="relative h-5" aria-hidden="true">
              <span class="absolute inset-y-0 left-1/2 w-px bg-line"></span>
              <span
                class="absolute top-1/2 h-2.5 -translate-y-1/2 rounded"
                [class]="row.positive ? 'bg-brand' : 'bg-verdict-stop'"
                [style.left.%]="row.left"
                [style.width.%]="row.width"
              ></span>
            </div>

            <span class="w-12 text-right text-sm font-semibold tabular-nums text-ink">
              {{ row.positive ? '+' : '' }}{{ row.entry.viabilityDelta }}
            </span>
          </li>
        }
      </ul>

      <p class="mt-3 text-meta text-ink-subtle">
        {{ 'report.sensitivity.unit' | translate }}
      </p>
    </div>
  `,
})
export class SensitivityChart {
  readonly entries = input.required<readonly SensitivityEntry[]>();

  protected readonly rows = computed(() => {
    const entries = [...this.entries()].sort(
      (a, b) => Math.abs(b.viabilityDelta) - Math.abs(a.viabilityDelta),
    );
    const scale = Math.max(1, ...entries.map((entry) => Math.abs(entry.viabilityDelta)));

    return entries.map((entry) => {
      const positive = entry.viabilityDelta >= 0;
      // Half the track per side, so zero sits exactly at the centre line.
      const width = (Math.abs(entry.viabilityDelta) / scale) * 50;
      return {
        entry,
        positive,
        width,
        left: positive ? 50 : 50 - width,
      };
    });
  });
}
