import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Evidence } from '../../models';

/**
 * Renders a value together with what it actually is: a measurement, a
 * derivation, or a guess. The product's credibility rests on never blurring
 * the three.
 */
@Component({
  selector: 'sim-evidence-chip',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span class="text-sm font-semibold text-ink">{{ evidence().value }}</span>
      <span
        class="inline-flex items-center rounded border px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide"
        [class]="kindClasses()"
      >
        {{ 'evidenceKind.' + evidence().kind | translate }}
      </span>
      <span class="text-meta text-ink-subtle">
        {{ 'result.confidence' | translate }}:
        {{ 'confidence.' + evidence().confidence | translate }}
      </span>
    </div>

    @if (evidence().source) {
      <p class="mt-1 text-meta leading-relaxed text-ink-subtle">
        @if (evidence().sourceUrl) {
          <a
            [href]="evidence().sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="underline underline-offset-2 hover:text-ink-muted"
          >
            {{ evidence().source }}
          </a>
        } @else {
          {{ evidence().source }}
        }
        @if (evidence().asOf) {
          <span class="text-ink-subtle"> · {{ evidence().asOf }}</span>
        }
      </p>
    }

    @if (evidence().note) {
      <p class="mt-1 text-meta leading-relaxed text-ink-subtle">{{ evidence().note }}</p>
    }
  `,
})
export class EvidenceChip {
  readonly evidence = input.required<Evidence>();

  protected readonly kindClasses = computed(() => {
    switch (this.evidence().kind) {
      case 'data':
        return 'border-verdict-go/40 text-verdict-go';
      case 'estimate':
        return 'border-verdict-info/40 text-verdict-info';
      default:
        return 'border-verdict-warn/40 text-verdict-warn';
    }
  });
}
