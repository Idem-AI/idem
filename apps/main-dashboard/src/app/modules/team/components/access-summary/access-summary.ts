import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectPermissions } from '@idem/shared-models';
import { summarize } from '../../team-spaces';

/**
 * Les droits en une phrase lisible : « Peut modifier : Communication ·
 * Peut consulter : Identité visuelle ». Ce qui est fermé n'est pas listé.
 */
@Component({
  selector: 'app-access-summary',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1 text-xs text-text-secondary">
      @if (groups().write.length) {
        <p>
          <span class="font-semibold text-text-primary">{{ 'team.summary.write' | translate }}</span>
          @for (space of groups().write; track space; let last = $last) {
            {{ 'team.spaces.' + space + '.label' | translate }}@if (!last) {<span>, </span>}
          }
        </p>
      }
      @if (groups().read.length) {
        <p>
          <span class="font-semibold text-text-primary">{{ 'team.summary.read' | translate }}</span>
          @for (space of groups().read; track space; let last = $last) {
            {{ 'team.spaces.' + space + '.label' | translate }}@if (!last) {<span>, </span>}
          }
        </p>
      }
      @if (!groups().write.length && !groups().read.length) {
        <p>{{ 'team.summary.nothing' | translate }}</p>
      }
    </div>
  `,
})
export class AccessSummaryComponent {
  readonly permissions = input.required<ProjectPermissions>();
  protected readonly groups = computed(() => summarize(this.permissions()));
}
