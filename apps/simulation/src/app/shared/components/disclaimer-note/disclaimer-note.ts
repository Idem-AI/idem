import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * The mandatory caveat on every surface that shows a simulated number.
 *
 * It is a component rather than copy-pasted markup so it cannot drift, and so
 * it cannot be forgotten on a screen that shows a score.
 */
@Component({
  selector: 'sim-disclaimer-note',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compact()) {
      <p class="text-meta leading-relaxed text-ink-subtle">
        {{ 'disclaimer.short' | translate }}
      </p>
    } @else {
      <aside
        class="rounded-xl border border-line bg-panel-sunken p-4"
        [attr.aria-label]="'disclaimer.heading' | translate"
      >
        <div class="flex items-start gap-3">
          <svg
            viewBox="0 0 24 24"
            class="mt-0.5 size-4.5 shrink-0 text-verdict-warn"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" stroke-linecap="round" />
            <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
          </svg>
          <div class="space-y-2">
            <h2 class="text-label font-semibold text-ink">{{ 'disclaimer.heading' | translate }}</h2>
            <p class="max-w-[70ch] text-sm leading-relaxed text-ink-muted">
              {{ 'disclaimer.body' | translate }}
            </p>
            <p class="max-w-[70ch] text-sm leading-relaxed text-ink-muted">
              {{ 'disclaimer.bothWays' | translate }}
            </p>
          </div>
        </div>
      </aside>
    }
  `,
})
export class DisclaimerNote {
  /** Single-line variant, for placement directly under a score. */
  readonly compact = input(false);
}
