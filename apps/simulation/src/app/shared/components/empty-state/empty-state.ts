import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Empty states teach the screen they replace: what this list is for, and the
 * one action that fills it.
 */
@Component({
  selector: 'sim-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div class="grid size-11 place-items-center rounded-xl border border-line bg-panel-sunken text-ink-subtle">
        <ng-content select="[icon]" />
      </div>
      <h2 class="text-h3 font-semibold text-ink">{{ heading() }}</h2>
      <p class="max-w-md text-sm leading-relaxed text-ink-muted">{{ body() }}</p>
      <div class="mt-2 flex flex-wrap items-center justify-center gap-2">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyState {
  readonly heading = input.required<string>();
  readonly body = input.required<string>();
}
