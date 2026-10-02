import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Les deux façons de remplir ses finances, toujours visibles en tête de page.
 *
 * Un interrupteur plutôt qu'un bouton enfoui : on comprend d'un coup d'œil
 * qu'il existe une vue « tableur » où tout se saisit — ou se colle — d'un
 * bloc, et qu'on peut y passer et en revenir sans rien perdre.
 */
@Component({
  selector: 'app-finance-mode-switch',
  imports: [RouterLink, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="fms" role="group" [attr.aria-label]="'dashboard.finance.mode.label' | translate">
      <a
        routerLink="/project/finance"
        class="fms__option"
        [class.fms__option--on]="mode() === 'steps'"
        [attr.aria-current]="mode() === 'steps' ? 'page' : null"
      >
        <i class="pi pi-list" aria-hidden="true"></i>
        {{ 'dashboard.finance.mode.steps' | translate }}
      </a>
      <a
        routerLink="/project/finance/sheet"
        class="fms__option"
        [class.fms__option--on]="mode() === 'sheet'"
        [attr.aria-current]="mode() === 'sheet' ? 'page' : null"
      >
        <i class="pi pi-table" aria-hidden="true"></i>
        {{ 'dashboard.finance.mode.sheet' | translate }}
      </a>
    </div>
    <p class="mt-1.5 text-xs text-text-tertiary">
      {{ (mode() === 'sheet' ? 'dashboard.finance.mode.sheetHint' : 'dashboard.finance.mode.stepsHint') | translate }}
    </p>
  `,
  styles: `
    .fms {
      display: inline-flex;
      padding: 0.25rem;
      gap: 0.25rem;
      border: 1px solid var(--glass-border);
      border-radius: 0.875rem;
      background: var(--glass-bg-subtle);
    }

    .fms__option {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 1rem;
      border-radius: 0.625rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text-secondary);
      transition: background-color 150ms ease-out, color 150ms ease-out;
    }

    .fms__option:hover,
    .fms__option:focus-visible {
      color: var(--color-text-primary);
      background: var(--glass-bg-light);
    }

    .fms__option--on,
    .fms__option--on:hover {
      color: var(--color-on-primary);
      background: var(--color-primary-500);
    }
  `,
})
export class FinanceModeSwitchComponent {
  readonly mode = input.required<'steps' | 'sheet'>();
}
