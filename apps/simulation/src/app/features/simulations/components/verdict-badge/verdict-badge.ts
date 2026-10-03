import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Verdict } from '../../models';
import { verdictTone } from '../../ui/tones';

/**
 * Le verdict en pastille, dans les listes et les en-têtes.
 *
 * La forme courte, et non celle de l'écran de résultats : « Le modèle tient,
 * sous conditions » déborderait d'une pastille de liste. Les capitales ont
 * disparu avec « GO » — une phrase criée se lit moins bien qu'une phrase.
 */
@Component({
  selector: 'sim-verdict-badge',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="'sim-pill sim-pill--' + tone()">
      <i
        class="pi text-xs"
        [class.pi-check]="verdict() === 'go'"
        [class.pi-times]="verdict() === 'no-go'"
        [class.pi-exclamation-circle]="verdict() === 'go-with-conditions'"
        aria-hidden="true"
      ></i>
      {{ 'verdictShort.' + verdict() | translate }}
    </span>
  `,
})
export class VerdictBadge {
  readonly verdict = input.required<Verdict>();

  protected readonly tone = computed(() => verdictTone(this.verdict()));
}
