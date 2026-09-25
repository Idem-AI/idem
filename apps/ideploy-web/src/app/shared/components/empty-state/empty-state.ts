import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The empty state every list screen shows before anything exists.
 *
 * The illustration is drawn inline rather than shipped as an asset: it is line
 * art built from `currentColor` and the brand accent, so it costs no request,
 * follows the theme without a second file, and stays crisp at any size. Four
 * motifs cover what this product actually lists — a deployable thing, a
 * machine, a store, an event log — picked with `kind`.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center text-center px-6 py-12">
      <svg
        [attr.viewBox]="'0 0 120 88'"
        class="w-[140px] h-auto mb-6"
        fill="none"
        aria-hidden="true"
        style="color: var(--color-text-tertiary);">
        <!-- ground line, shared by every motif -->
        <path d="M14 78h92" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".35" />

        @switch (kind()) {
          @case ('server') {
            @for (row of [0, 1, 2]; track row) {
              <rect
                [attr.x]="34"
                [attr.y]="20 + row * 18"
                width="52"
                height="14"
                rx="3"
                stroke="currentColor"
                stroke-width="1.5"
                opacity=".55" />
              <circle
                [attr.cx]="42"
                [attr.cy]="27 + row * 18"
                r="2"
                [attr.fill]="row === 0 ? 'var(--color-primary-500)' : 'currentColor'"
                [attr.opacity]="row === 0 ? 1 : 0.4" />
            }
          }
          @case ('store') {
            <rect x="30" y="26" width="60" height="42" rx="5" stroke="currentColor" stroke-width="1.5" opacity=".55" />
            <path d="M30 40h60" stroke="currentColor" stroke-width="1.5" opacity=".35" />
            <circle cx="40" cy="33" r="2" fill="var(--color-primary-500)" />
            <path d="M44 52h20M44 59h32" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".3" />
          }
          @case ('activity') {
            <path
              d="M18 58l14-14 12 10 14-22 12 16 12-8 20 12"
              stroke="var(--color-primary-500)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round" />
            <circle cx="58" cy="32" r="3" fill="var(--color-primary-500)" />
          }
          @default {
            <!-- a box: the thing you deploy -->
            <path
              d="M60 18l30 15v30L60 78 30 63V33z"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
              opacity=".55" />
            <path d="M30 33l30 15 30-15M60 48v30" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" opacity=".35" />
            <circle cx="60" cy="48" r="3.5" fill="var(--color-primary-500)" />
          }
        }
      </svg>

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
  readonly kind = input<'box' | 'server' | 'store' | 'activity'>('box');
}
