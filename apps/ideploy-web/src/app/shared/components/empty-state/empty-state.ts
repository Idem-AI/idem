import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IllustrationComponent, type IllustrationName } from '../illustration/illustration';

/**
 * The empty state every list screen shows before anything exists.
 *
 * The drawing comes from `<app-illustration>`, which the rest of the UI uses
 * too; `kind` picks which scene fits what this list was going to hold.
 */
@Component({
  selector: 'app-empty-state',
  imports: [IllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center text-center px-6 py-12">
      <app-illustration [name]="kind()" [width]="140" class="mb-6 block" />

      <p class="text-[1rem] font-bold mb-1.5">{{ title() }}</p>
      @if (body()) {
        <p class="text-sm max-w-sm leading-relaxed" style="color: var(--color-text-secondary);">{{ body() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly body = input<string | null>(null);
  /** Which motif to draw: `box` (default), `server`, `store`, `activity`. */
  readonly kind = input<IllustrationName>('box');
}
