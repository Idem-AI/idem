import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The shape of a list before it arrives — rows or cards, so the page doesn't
 * jump when the data lands. A skeleton, not a spinner: it says what is coming.
 */
@Component({
  selector: 'app-list-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (variant() === 'cards') {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        @for (i of items(); track i) {
          <div class="glass-card space-y-3 p-5">
            <div class="flex items-center gap-3">
              <div class="skeleton h-10 w-10 rounded-lg"></div>
              <div class="skeleton h-4 w-1/2 rounded"></div>
            </div>
            <div class="skeleton h-3 w-5/6 rounded"></div>
            <div class="skeleton h-3 w-2/3 rounded"></div>
          </div>
        }
      </div>
    } @else {
      <div class="glass-card overflow-hidden" aria-hidden="true">
        @for (i of items(); track i; let last = $last) {
          <div class="flex items-center gap-4 px-5 py-4" [style.border-bottom]="last ? 'none' : '1px solid var(--glass-border-subtle)'">
            <div class="skeleton h-10 w-10 flex-shrink-0 rounded-lg"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-1/3 rounded"></div>
              <div class="skeleton h-3 w-1/2 rounded"></div>
            </div>
            <div class="skeleton h-8 w-24 rounded-lg"></div>
          </div>
        }
      </div>
    }
  `,
})
export class ListSkeletonComponent {
  readonly variant = input<'rows' | 'cards'>('rows');
  readonly count = input(3);
  protected readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
