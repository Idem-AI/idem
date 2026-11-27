import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { CurrentProjectService } from '../../../../shared/services/current-project.service';
import { ProjectAccessUiService } from '../../services/project-access-ui.service';

/**
 * « Vous consultez cet espace en lecture seule. »
 *
 * Flotte en haut au centre avec les autres rappels, sur les pages d'un espace
 * qu'un membre peut voir sans le modifier. Il dit pourquoi les actions
 * échoueront et à qui demander plus. Fermé, il ne revient pas pour cet espace
 * pendant la session.
 */
@Component({
  selector: 'app-read-only-notice',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible(); as space) {
      <div class="glass-card flex items-start gap-3 px-4 py-3 text-sm" role="status">
        <i class="pi pi-eye mt-0.5 text-primary-500" aria-hidden="true"></i>
        <p class="min-w-0 flex-1 text-text-primary">
          <strong>{{ 'team.readOnly.title' | translate }}</strong>
          · {{ 'team.readOnly.body' | translate: { space: ('team.spaces.' + space + '.label' | translate), owner: ownerName() } }}
        </p>
        <button
          type="button"
          class="button-icon button-sm"
          [attr.aria-label]="'common.close' | translate"
          (click)="dismiss(space)"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>
    }
  `,
})
export class ReadOnlyNoticeComponent {
  private readonly projects = inject(CurrentProjectService);
  private readonly dismissed = signal<ReadonlySet<string>>(new Set());

  private readonly ui = inject(ProjectAccessUiService);

  protected readonly ownerName = computed(() => this.projects.access()?.ownerName ?? '');

  protected readonly visible = computed(() => {
    if (!this.ui.readOnly()) return null;
    const space = this.ui.space();
    return space && !this.dismissed().has(space) ? space : null;
  });

  protected dismiss(space: string): void {
    this.dismissed.update((set) => new Set([...set, space]));
  }
}
