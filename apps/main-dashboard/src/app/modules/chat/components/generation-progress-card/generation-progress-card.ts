import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { GenerationProgressData } from '../../models/chat.model';

/**
 * Carte de progression d'une génération SSE dans le fil de conversation :
 * barre de progression, compteur d'étapes, étape(s) en cours mises en avant,
 * états terminé / échec. Design minimaliste aligné sur les autres cartes.
 */
@Component({
  selector: 'app-generation-progress-card',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './generation-progress-card.html',
  styleUrl: './generation-progress-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerationProgressCardComponent {
  readonly data = input.required<GenerationProgressData>();

  protected readonly completedCount = computed(() => this.data().completedSteps.length);

  protected readonly totalCount = computed(() => {
    const data = this.data();
    const known = data.totalSteps ?? 0;
    const observed = data.completedSteps.length + data.stepsInProgress.length;
    return Math.max(known, observed, 1);
  });

  protected readonly percent = computed(() => {
    if (this.data().status === 'done') return 100;
    return Math.min(99, Math.round((this.completedCount() / this.totalCount()) * 100));
  });
}
