import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectPermissions } from '@idem/shared-models';
import { LEVEL_ICONS, SPACE_ICONS, summarize } from '../../team-spaces';

/**
 * Les accès en pastilles : « ✎ Communication » (modifie), « 👁 Identité
 * visuelle » (voit). Ce qui est fermé n'apparaît pas. Les pastilles « modifie »
 * sont teintées de la couleur primaire, celles « voit » restent au trait : la
 * différence se voit avant de se lire, et le mot la dit quand même.
 */
@Component({
  selector: 'app-access-summary',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .as-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      line-height: 1.4;
      white-space: nowrap;
    }
    .as-chip--write {
      background: color-mix(in oklab, var(--color-primary-500) 14%, transparent);
      color: var(--color-primary-500);
      border: 1px solid color-mix(in oklab, var(--color-primary-500) 30%, transparent);
    }
    .as-chip--read {
      color: var(--color-text-secondary);
      border: 1px solid var(--glass-border);
    }
    .as-chip .as-level {
      font-size: 0.65rem;
    }
  `,
  template: `
    @if (groups().write.length || groups().read.length) {
      <ul class="flex flex-wrap gap-1.5" [attr.aria-label]="'team.summary.label' | translate">
        @for (space of groups().write; track space) {
          <li class="as-chip as-chip--write">
            <i [class]="levelIcons.write + ' as-level'" aria-hidden="true"></i>
            <span class="sr-only">{{ 'team.summary.write' | translate }}</span>
            <i [class]="spaceIcons[space] + ' text-xs'" aria-hidden="true"></i>
            {{ 'team.spaces.' + space + '.label' | translate }}
          </li>
        }
        @for (space of groups().read; track space) {
          <li class="as-chip as-chip--read">
            <i [class]="levelIcons.read + ' as-level'" aria-hidden="true"></i>
            <span class="sr-only">{{ 'team.summary.read' | translate }}</span>
            <i [class]="spaceIcons[space] + ' text-xs'" aria-hidden="true"></i>
            {{ 'team.spaces.' + space + '.label' | translate }}
          </li>
        }
      </ul>
    } @else {
      <p class="text-xs text-text-tertiary">{{ 'team.summary.nothing' | translate }}</p>
    }
  `,
})
export class AccessSummaryComponent {
  readonly permissions = input.required<ProjectPermissions>();
  protected readonly groups = computed(() => summarize(this.permissions()));
  protected readonly levelIcons = LEVEL_ICONS;
  protected readonly spaceIcons = SPACE_ICONS;
}
