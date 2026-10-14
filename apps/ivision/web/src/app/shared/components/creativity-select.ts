import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Creativity } from '../../core/models';

/**
 * La jauge de créativité, en sélecteur compact posé près du bouton d'envoi (mêmes crans et mêmes
 * multiplicateurs que dans IDEM : Low et Medium ×1, High ×1,25, Max ×1,5, Ultra ×2). En vidéo, le cran
 * choisit la PUISSANCE du modèle : l'aide et les libellés le disent.
 */
@Component({
  selector: 'iv-creativity-select',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="sr-only" for="iv-creativity">{{ 'creativity.label' | translate }}</label>
    <select id="iv-creativity" class="!w-auto !py-1.5 !text-sm" (change)="value.set($any($event.target).value)" [attr.title]="hintKey() | translate">
      @for (level of levels; track level) {
        <option [value]="level" [selected]="level === value()">{{ levelsKey() + level | translate }}</option>
      }
    </select>
  `,
})
export class CreativitySelect {
  readonly value = model<Creativity>('medium');
  /** Le mode de la conversation : en vidéo, les crans désignent des modèles plus ou moins puissants. */
  readonly mode = input<'video' | 'image'>('image');
  protected readonly hintKey = computed(() => (this.mode() === 'video' ? 'creativity.videoHint' : 'creativity.hint'));
  protected readonly levelsKey = computed(() => (this.mode() === 'video' ? 'creativity.videoLevels.' : 'creativity.levels.'));
  protected readonly levels: Creativity[] = ['low', 'medium', 'high', 'max', 'ultra'];
}
