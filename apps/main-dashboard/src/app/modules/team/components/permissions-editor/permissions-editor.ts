import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  ACCESS_LEVELS,
  AccessLevel,
  PROJECT_SPACES,
  ProjectPermissions,
  ProjectSpace,
  uniformPermissions,
} from '@idem/shared-models';
import { SPACE_ICONS } from '../../team-spaces';

let nextEditorId = 0;

/**
 * Le réglage détaillé : une ligne par espace du projet, trois choix par ligne.
 *
 * Trois mots que tout le monde comprend — « Pas d'accès », « Voir »,
 * « Modifier » — plutôt qu'une grille de cases « lecture/écriture ». Chaque
 * ligne est un groupe de boutons radio natifs : flèches au clavier, annonce
 * correcte par les lecteurs d'écran, sans code à nous.
 */
@Component({
  selector: 'app-permissions-editor',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .levels {
      display: inline-flex;
      border: 1px solid var(--glass-border-subtle);
      border-radius: 0.6rem;
      overflow: hidden;
    }
    .levels label {
      position: relative;
      margin: 0;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      cursor: pointer;
      color: var(--color-text-secondary);
      white-space: nowrap;
    }
    .levels label + label {
      border-left: 1px solid var(--glass-border-subtle);
    }
    .levels input[type='radio'] {
      position: absolute;
      opacity: 0;
      inset: 0;
      margin: 0;
      cursor: pointer;
    }
    .levels label:has(input:checked) {
      background: var(--color-primary-500);
      color: var(--color-on-primary);
      font-weight: 600;
    }
    .levels label:has(input:focus-visible) {
      outline: 2px solid var(--color-primary-500);
      outline-offset: -2px;
    }
  `,
  template: `
    <div class="flex flex-wrap items-center gap-2 pb-3">
      <span class="text-xs text-text-tertiary">{{ 'team.editor.quick' | translate }}</span>
      <button type="button" class="button-ghost button-sm" (click)="setAll('read')">{{ 'team.editor.allRead' | translate }}</button>
      <button type="button" class="button-ghost button-sm" (click)="setAll('write')">{{ 'team.editor.allWrite' | translate }}</button>
      <button type="button" class="button-ghost button-sm" (click)="setAll('none')">{{ 'team.editor.allNone' | translate }}</button>
    </div>

    <ul class="divide-y divide-[var(--glass-border-subtle)]">
      @for (space of spaces; track space) {
        <li class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <i [class]="icons[space] + ' mt-0.5 text-text-tertiary'" aria-hidden="true"></i>
            <div class="min-w-0">
              <p [id]="uid + '-' + space" class="text-sm font-medium text-text-primary">
                {{ 'team.spaces.' + space + '.label' | translate }}
              </p>
              <p class="text-xs text-text-tertiary">{{ 'team.spaces.' + space + '.hint' | translate }}</p>
            </div>
          </div>
          <div class="levels shrink-0" role="radiogroup" [attr.aria-labelledby]="uid + '-' + space">
            @for (level of levels; track level) {
              <label>
                <input
                  type="radio"
                  [name]="uid + '-' + space"
                  [value]="level"
                  [checked]="value()[space] === level"
                  [disabled]="disabled()"
                  (change)="set(space, level)"
                />
                {{ 'team.levels.' + level | translate }}
              </label>
            }
          </div>
        </li>
      }
    </ul>
  `,
})
export class PermissionsEditorComponent {
  readonly value = input.required<ProjectPermissions>();
  readonly disabled = input(false);
  readonly valueChange = output<ProjectPermissions>();

  protected readonly uid = `perm-${++nextEditorId}`;
  protected readonly spaces = PROJECT_SPACES;
  protected readonly levels = ACCESS_LEVELS;
  protected readonly icons = SPACE_ICONS;

  protected set(space: ProjectSpace, level: AccessLevel): void {
    this.valueChange.emit({ ...this.value(), [space]: level });
  }

  protected setAll(level: AccessLevel): void {
    this.valueChange.emit(uniformPermissions(level));
  }
}
