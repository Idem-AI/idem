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
import { LEVEL_ICONS, SPACE_ICONS } from '../../team-spaces';

let nextEditorId = 0;

/**
 * Le réglage espace par espace : une ligne par espace, un sélecteur à trois
 * crans — « Aucun », « Voir », « Modifier » — qu'on lit d'un coup d'œil.
 *
 * Chaque sélecteur est un groupe de boutons radio natifs (flèches au clavier,
 * annonce correcte), habillés en pilule : le cran choisi se remplit de la
 * couleur primaire. Une ligne ouverte (voir ou modifier) se distingue d'une
 * ligne fermée, estompée : la liste dit d'elle-même ce qui est partagé.
 */
@Component({
  selector: 'app-permissions-editor',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .pe-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      padding: 0.75rem;
      border: 1px solid var(--glass-border);
      border-radius: 0.9rem;
      transition: border-color 0.15s ease, opacity 0.15s ease;
    }
    .pe-row--off {
      opacity: 0.72;
    }
    .pe-row--write {
      border-color: color-mix(in oklab, var(--color-primary-500) 45%, var(--glass-border));
    }
    .pe-icon {
      display: grid;
      place-items: center;
      flex-shrink: 0;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.7rem;
      background: var(--glass-bg-light);
      color: var(--color-text-secondary);
    }
    .pe-row--write .pe-icon,
    .pe-row--read .pe-icon {
      background: color-mix(in oklab, var(--color-primary-500) 14%, transparent);
      color: var(--color-primary-500);
    }
    .pe-seg {
      display: inline-flex;
      gap: 0.2rem;
      padding: 0.2rem;
      margin-left: auto;
      border-radius: 999px;
      background: var(--glass-bg-light);
      border: 1px solid var(--glass-border);
    }
    .pe-seg label {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      margin: 0;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--color-text-secondary);
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .pe-seg label:hover {
      color: var(--color-text-primary);
    }
    .pe-seg input[type='radio'] {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .pe-seg label:has(input:checked) {
      background: var(--color-primary-500);
      color: var(--color-on-primary);
    }
    .pe-seg label:has(input:focus-visible) {
      outline: 2px solid var(--color-primary-500);
      outline-offset: 2px;
    }
    .pe-seg label:has(input:disabled) {
      cursor: not-allowed;
    }
    @media (max-width: 30rem) {
      .pe-seg {
        width: 100%;
        margin-left: 0;
      }
      .pe-seg label {
        flex: 1;
        justify-content: center;
      }
    }
  `,
  template: `
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-text-tertiary">{{ 'team.editor.quick' | translate }}</p>
      <div class="flex gap-1">
        @for (level of levels; track level) {
          <button type="button" class="tag" [disabled]="disabled()" (click)="setAll(level)">
            <i [class]="levelIcons[level]" aria-hidden="true"></i>
            {{ 'team.levels.' + level | translate }}
          </button>
        }
      </div>
    </div>

    <ul class="flex flex-col gap-2">
      @for (space of spaces; track space) {
        <li class="pe-row" [class]="'pe-row--' + (value()[space] === 'none' ? 'off' : value()[space])">
          <span class="pe-icon" aria-hidden="true"><i [class]="icons[space]"></i></span>
          <div class="min-w-0 flex-1">
            <p [id]="uid + '-' + space" class="text-sm font-medium text-text-primary">
              {{ 'team.spaces.' + space + '.label' | translate }}
            </p>
            <p class="text-xs text-text-tertiary">{{ 'team.spaces.' + space + '.hint' | translate }}</p>
          </div>
          <div class="pe-seg" role="radiogroup" [attr.aria-labelledby]="uid + '-' + space">
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
                <i [class]="levelIcons[level] + ' text-xs'" aria-hidden="true"></i>
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
  protected readonly levelIcons = LEVEL_ICONS;

  protected set(space: ProjectSpace, level: AccessLevel): void {
    this.valueChange.emit({ ...this.value(), [space]: level });
  }

  protected setAll(level: AccessLevel): void {
    this.valueChange.emit(uniformPermissions(level));
  }
}
