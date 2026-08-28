import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Factor } from '../../models';

/**
 * Ranked factors with their relative influence.
 *
 * A list with proportional bars rather than a chart: the ordering is the
 * information, and the bar only has to make the gaps between ranks legible.
 */
@Component({
  selector: 'sim-factor-impact-list',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col divide-y divide-line">
      @for (factor of factors(); track factor.id) {
        <li class="py-3 first:pt-0 last:pb-0">
          <div class="flex items-baseline justify-between gap-4">
            <span class="text-sm font-medium text-ink">{{ factor.name }}</span>
            <span class="shrink-0 text-meta tabular-nums text-ink-subtle">{{ factor.impact }}</span>
          </div>
          <div
            class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-panel-sunken"
            role="meter"
            [attr.aria-valuenow]="factor.impact"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-label]="factor.name"
          >
            <div class="h-full rounded-full bg-brand" [style.width.%]="factor.impact"></div>
          </div>
          @if (showDescription()) {
            <p class="mt-1.5 max-w-[70ch] text-meta leading-relaxed text-ink-muted">
              {{ factor.description }}
            </p>
          }
          <p class="mt-1 text-meta text-ink-subtle">
            {{ factor.category }} · {{ 'factorTier.' + factor.tier | translate }}
          </p>
        </li>
      }
    </ul>
  `,
})
export class FactorImpactList {
  readonly factors = input.required<readonly Factor[]>();
  readonly showDescription = input(false);
}
