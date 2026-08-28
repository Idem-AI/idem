import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'sim-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <ng-content select="[breadcrumb]" />
        <h1 class="text-h1 font-semibold text-ink">{{ heading() }}</h1>
        @if (description()) {
          <p class="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{{ description() }}</p>
        }
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <ng-content select="[actions]" />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly description = input<string>();
}
