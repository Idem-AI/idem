import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Verdict } from '../../models';

@Component({
  selector: 'sim-verdict-badge',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-meta font-semibold uppercase tracking-wide"
      [class]="classes()"
    >
      <span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
      {{ 'verdict.' + verdict() | translate }}
    </span>
  `,
})
export class VerdictBadge {
  readonly verdict = input.required<Verdict>();

  protected readonly classes = computed(() => {
    switch (this.verdict()) {
      case 'go':
        return 'border-verdict-go/40 bg-verdict-go/10 text-verdict-go';
      case 'no-go':
        return 'border-verdict-stop/40 bg-verdict-stop/10 text-verdict-stop';
      default:
        return 'border-verdict-warn/40 bg-verdict-warn/10 text-verdict-warn';
    }
  });
}
