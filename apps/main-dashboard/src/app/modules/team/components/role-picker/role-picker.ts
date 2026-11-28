import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RoleOption, summarize } from '../../team-spaces';

let nextPickerId = 0;

/**
 * « Que pourra-t-elle faire ? » : des cartes, une seule choisie.
 *
 * Chaque carte porte un pictogramme, un nom que l'on comprend (« Associé »,
 * « Communication »), une phrase, et le compte de ce qu'elle ouvre
 * (« modifie 3 · voit 2 ») : on choisit sans ouvrir de réglage. Les groupes
 * du projet viennent après les rôles ; « Sur mesure » ouvre le réglage détaillé.
 * Boutons radio natifs sous les cartes : clavier et lecteurs d'écran inclus.
 */
@Component({
  selector: 'app-role-picker',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .rp-card {
      position: relative;
      display: flex;
      gap: 0.75rem;
      margin: 0;
      padding: 0.85rem;
      border: 1px solid var(--glass-border);
      border-radius: 1rem;
      background: var(--glass-bg-light);
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .rp-card:hover {
      border-color: var(--glass-border-medium);
    }
    .rp-card:has(input:checked) {
      border-color: var(--color-primary-500);
      background: color-mix(in oklab, var(--color-primary-500) 8%, transparent);
    }
    .rp-card:has(input:focus-visible) {
      outline: 2px solid var(--color-primary-500);
      outline-offset: 2px;
    }
    .rp-card input[type='radio'] {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .rp-icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.7rem;
      background: var(--glass-bg-medium);
      color: var(--color-text-secondary);
    }
    .rp-card:has(input:checked) .rp-icon {
      background: var(--color-primary-500);
      color: var(--color-on-primary);
    }
    .rp-check {
      position: absolute;
      top: 0.6rem;
      right: 0.6rem;
      color: var(--color-primary-500);
      opacity: 0;
    }
    .rp-card:has(input:checked) .rp-check {
      opacity: 1;
    }
  `,
  template: `
    <fieldset class="m-0 border-0 p-0">
      <legend class="mb-3 text-sm font-semibold text-text-primary">{{ legendKey() | translate }}</legend>
      <div class="grid gap-2 sm:grid-cols-2">
        @for (option of options(); track option.key) {
          <label class="rp-card">
            <input
              type="radio"
              [name]="uid"
              [value]="option.key"
              [checked]="selected() === option.key"
              [disabled]="disabled()"
              (change)="selectedChange.emit(option.key)"
            />
            <span class="rp-icon" aria-hidden="true"><i [class]="option.icon"></i></span>
            <span class="flex min-w-0 flex-col gap-0.5 pr-4">
              <span class="text-sm font-semibold text-text-primary">{{ option.label ?? (option.labelKey! | translate) }}</span>
              @if (option.hintKey) {
                <span class="text-xs leading-snug text-text-tertiary">{{ option.hintKey | translate }}</span>
              }
              @if (option.permissions; as permissions) {
                <span class="mt-1 text-[0.7rem] font-medium text-text-secondary">
                  {{ 'team.roles.counts' | translate: { write: count(permissions).write, read: count(permissions).read } }}
                </span>
              }
            </span>
            <i class="pi pi-check-circle rp-check" aria-hidden="true"></i>
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

  protected count(permissions: Parameters<typeof summarize>[0]): { write: number; read: number } {
    const { write, read } = summarize(permissions);
    return { write: write.length, read: read.length };
  }
}
