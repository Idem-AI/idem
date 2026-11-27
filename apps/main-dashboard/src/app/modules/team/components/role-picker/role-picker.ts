import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RoleOption } from '../../team-spaces';

let nextPickerId = 0;

/**
 * « Ce qu'elle pourra faire » : des cartes à choisir, une seule à la fois.
 *
 * La plupart des propriétaires pensent en rôles (« mon associé », « ma
 * communication ») ; les groupes du projet viennent ensuite, puis « Sur
 * mesure » pour régler espace par espace. Boutons radio natifs sous des
 * cartes : sélection au clavier et annonce correcte sans code à nous.
 */
@Component({
  selector: 'app-role-picker',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .role-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      margin: 0;
      padding: 0.75rem 0.9rem;
      border: 1px solid var(--glass-border-subtle);
      border-radius: 0.75rem;
      cursor: pointer;
      transition: border-color 0.15s ease;
    }
    .role-card:hover {
      border-color: var(--color-primary-500);
    }
    .role-card:has(input:checked) {
      border-color: var(--color-primary-500);
      box-shadow: inset 0 0 0 1px var(--color-primary-500);
    }
    .role-card:has(input:focus-visible) {
      outline: 2px solid var(--color-primary-500);
      outline-offset: 2px;
    }
    .role-card input[type='radio'] {
      position: absolute;
      opacity: 0;
      inset: 0;
      margin: 0;
      cursor: pointer;
    }
  `,
  template: `
    <fieldset class="m-0 border-0 p-0">
      <legend class="mb-2 text-sm font-medium text-text-primary">{{ legendKey() | translate }}</legend>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        @for (option of options(); track option.key) {
          <label class="role-card">
            <input
              type="radio"
              [name]="uid"
              [value]="option.key"
              [checked]="selected() === option.key"
              [disabled]="disabled()"
              (change)="selectedChange.emit(option.key)"
            />
            <span class="flex items-center gap-2 text-sm font-semibold text-text-primary">
              @if (option.roleKey === 'group') {
                <i class="pi pi-users text-xs text-text-tertiary" aria-hidden="true"></i>
              }
              {{ option.label ?? (option.labelKey! | translate) }}
            </span>
            @if (option.hintKey) {
              <span class="text-xs text-text-tertiary">{{ option.hintKey | translate }}</span>
            }
          </label>
        }
      </div>
    </fieldset>
  `,
})
export class RolePickerComponent {
  readonly options = input.required<RoleOption[]>();
  readonly selected = input.required<string>();
  readonly disabled = input(false);
  readonly legendKey = input('team.invite.roleLegend');
  readonly selectedChange = output<string>();

  protected readonly uid = `role-${++nextPickerId}`;
}
