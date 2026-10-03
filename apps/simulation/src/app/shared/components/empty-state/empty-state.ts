import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Illustration, IllustrationName } from '../illustration/illustration';

/**
 * Un écran sans contenu dit à quoi il sert, et propose l'action qui le remplit.
 * L'illustration est l'objet qui dit la même chose que l'écran (AGENTS.md § 4).
 */
@Component({
  selector: 'sim-empty-state',
  imports: [Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <sim-illustration [name]="illustration()" class="w-40" />
      <h2 class="mt-2 text-xl font-bold">{{ heading() }}</h2>
      <p class="max-w-md text-sm leading-relaxed text-text-secondary md:text-base">{{ body() }}</p>
      <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyState {
  readonly heading = input.required<string>();
  readonly body = input.required<string>();
  readonly illustration = input<IllustrationName>('calabash-empty');
}
