import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ThemeService } from '../../../core/theme/theme.service';

/**
 * Two-state control on purpose: "system" stays available as the stored
 * default, but the visible affordance is the one people reach for.
 */
@Component({
  selector: 'sim-theme-toggle',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="button-ghost button-sm"
      [attr.aria-label]="
        (theme() === 'dark' ? 'theme.switchToLight' : 'theme.switchToDark') | translate
      "
      [attr.aria-pressed]="theme() === 'light'"
      (click)="toggle()"
    >
      @if (theme() === 'dark') {
        <svg viewBox="0 0 24 24" class="size-4.5" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke-linecap="round" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" class="size-4.5" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <path d="M21 13.2A8.6 8.6 0 1 1 10.8 3a7 7 0 0 0 10.2 10.2Z" stroke-linejoin="round" />
        </svg>
      }
    </button>
  `,
})
export class ThemeToggle {
  private readonly service = inject(ThemeService);
  protected readonly theme = this.service.theme;

  protected toggle(): void {
    this.service.toggle();
  }
}
