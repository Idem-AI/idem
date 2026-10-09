import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Creativity } from '../../core/models';

/**
 * La jauge de créativité, en sélecteur compact posé près du bouton d'envoi (mêmes crans et mêmes
 * multiplicateurs que dans IDEM : Low et Medium ×1, High ×1,25, Max ×1,5, Ultra ×2).
 */
@Component({
  selector: 'iv-creativity-select',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="sr-only" for="iv-creativity">{{ 'creativity.label' | translate }}</label>
    <select id="iv-creativity" class="!w-auto !py-1.5 !text-sm" (change)="value.set($any($event.target).value)" [attr.title]="'creativity.hint' | translate">
      @for (level of levels; track level) {
        <option [value]="level" [selected]="level === value()">{{ 'creativity.levels.' + level | translate }}</option>
      }
    </select>
  `,
})
export class CreativitySelect {
  readonly value = model<Creativity>('medium');
  protected readonly levels: Creativity[] = ['low', 'medium', 'high', 'max', 'ultra'];
}
