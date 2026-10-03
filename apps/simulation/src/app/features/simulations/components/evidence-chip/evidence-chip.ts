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
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span class="text-base font-semibold text-text-primary">{{ evidence().value }}</span>
      <span [class]="'sim-pill sim-pill--' + tone()">{{ 'evidenceKind.' + evidence().kind | translate }}</span>
    </div>
    <p class="mt-1 text-xs leading-relaxed text-text-tertiary">
      {{ 'evidence.reliability' | translate: { level: ('confidence.' + evidence().confidence | translate) } }}
      @if (evidence().source) {
        ·
        @if (evidence().sourceUrl) {
          <a [href]="evidence().sourceUrl" target="_blank" rel="noopener noreferrer" class="underline underline-offset-2 hover:text-text-secondary">{{ evidence().source }}</a>
        } @else {
          {{ evidence().source }}
        }
      }
      @if (evidence().asOf) {
        · {{ evidence().asOf }}
      }
    </p>
    @if (evidence().note) {
      <p class="mt-1 text-sm leading-relaxed text-text-secondary">{{ evidence().note }}</p>
    }
  `,
})
export class EvidenceChip {
  readonly evidence = input.required<Evidence>();

  /** Vérifié en vert, estimé en bleu, supposé en orange : toujours avec le mot. */
  protected readonly tone = computed(() => {
    switch (this.evidence().kind) {
      case 'data':
        return 'go';
      case 'estimate':
        return 'info';
      default:
        return 'warn';
    }
  });
}
