import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Des lignes fantômes, à la forme de ce qui arrive. */
@Component({
  selector: 'sim-skeleton-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3" role="status" [attr.aria-label]="label()" aria-live="polite">
      @for (row of rows(); track $index) {
        <div class="glass-card flex items-center gap-4 p-5">
          <div class="skeleton size-14 shrink-0 rounded-full"></div>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="skeleton h-4 w-2/5 rounded"></div>
            <div class="skeleton h-3 w-1/4 rounded"></div>
          </div>
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
