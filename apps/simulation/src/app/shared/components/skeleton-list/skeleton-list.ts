import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Placeholder rows that match the shape of what is loading. */
@Component({
  selector: 'sim-skeleton-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2" role="status" [attr.aria-label]="label()" aria-live="polite">
      @for (row of rows(); track $index) {
        <div class="glass-card flex items-center gap-4 p-4">
          <div class="skeleton size-10 shrink-0 rounded-lg"></div>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="skeleton h-3.5 w-2/5"></div>
            <div class="skeleton h-3 w-1/4"></div>
          </div>
          <div class="skeleton h-8 w-16 rounded-lg"></div>
        </div>
      }
    </div>
  `,
})
export class SkeletonList {
  readonly count = input(3);
  readonly label = input('Loading');
  protected rows(): number[] {
    return Array.from({ length: this.count() }, (_, index) => index);
  }
}
