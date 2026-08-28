import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import type { ThemeMode } from '../../utils/theme-cookie';

/**
 * Compact light/dark/system theme switcher for the app shell. Changing the theme
 * writes the shared `idem_theme` cookie (via ThemeService), so the choice
 * propagates to every other Idem app. Token-based styling so it adapts to both
 * themes.
 */
@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center gap-0.5 rounded-md p-0.5"
      style="background: var(--glass-bg-subtle);"
      role="group"
      aria-label="Theme">
      @for (opt of options; track opt.mode) {
        <button
          type="button"
          class="px-2 py-1 rounded text-[11px] font-bold transition-opacity"
          [style.background]="
            theme.mode() === opt.mode
              ? 'color-mix(in srgb, var(--color-primary-500) 20%, transparent)'
              : 'transparent'
          "
          [style.color]="
            theme.mode() === opt.mode ? 'var(--color-primary-400)' : 'var(--color-text-tertiary)'
          "
          [attr.aria-pressed]="theme.mode() === opt.mode"
          [attr.title]="opt.label"
          (click)="theme.setMode(opt.mode)">
          <i class="fa-solid" [class]="opt.icon" aria-hidden="true"></i>
        </button>
      }
    </div>
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);

  protected readonly options: { mode: ThemeMode; icon: string; label: string }[] = [
    { mode: 'light', icon: 'fa-sun', label: 'Light' },
    { mode: 'dark', icon: 'fa-moon', label: 'Dark' },
    { mode: 'system', icon: 'fa-circle-half-stroke', label: 'System' },
  ];
}
