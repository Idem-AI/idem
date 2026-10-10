import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

export interface StageState {
  stage: string;
  state: 'running' | 'done';
}

/** Les étapes RÉELLES d'une création vidéo, cochées au fur et à mesure (flux du serveur). */
@Component({
  selector: 'iv-progress-list',
  imports: [TranslateModule, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex flex-col gap-1.5 text-sm" [attr.aria-label]="'chat.progress.label' | translate">
      @for (s of rows(); track s.stage) {
        <li class="flex items-center gap-2" [class]="s.state === 'done' ? 'text-[var(--color-text-secondary)]' : ''">
          @if (s.state === 'done') {
            <i class="pi pi-check text-[var(--color-success)]" aria-hidden="true"></i>
          } @else {
            <idem-loader size="xs" />
          }
          {{ 'chat.progress.stages.' + s.stage | translate }}
        </li>
      }
    </ol>
  `,
})
export class ProgressList {
  readonly stages = input.required<StageState[]>();
  /** Une étape par ligne, dans l'ordre d'arrivée (une étape relancée garde sa place). */
  protected readonly rows = computed(() => {
    const seen = new Map<string, StageState>();
    for (const s of this.stages()) seen.set(s.stage, s);
    return [...seen.values()];
  });
}
