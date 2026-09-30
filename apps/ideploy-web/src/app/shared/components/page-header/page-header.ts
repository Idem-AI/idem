import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The top of every list page: what this page holds, in one plain sentence,
 * and the one or two things you can do from here.
 *
 * One component so the pages read as one product — same title face, same
 * rhythm, same place for the main action — instead of eight variations on
 * an `<h1>`. Actions are projected, the primary one last so it sits right.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0 max-w-2xl">
        <h1 class="heading-serif" style="font-size:30px;font-weight:700;line-height:1.15;color:var(--color-text-primary);">
          {{ title() }}
          @if (count() !== null) {
            <span class="ml-1 align-middle text-base font-normal" style="color:var(--color-text-tertiary);">{{ count() }}</span>
          }
        </h1>
        @if (subtitle()) {
          <p class="mt-2 text-sm leading-relaxed" style="color:var(--color-text-secondary);">{{ subtitle() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  /** Shown beside the title once the list has loaded; null hides it. */
  readonly count = input<number | null>(null);
}
