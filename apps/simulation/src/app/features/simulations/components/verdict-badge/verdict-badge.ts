import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Verdict } from '../../models';

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
    <span
      class="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-2.5 text-meta font-semibold"
      [class]="classes()"
    >
      <!-- Une icône plutôt qu'une pastille : dans une liste, l'état se lit
           avant le texte, et il reste lisible sans la couleur. -->
      @switch (verdict()) {
        @case ('go') {
          <svg viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
            <path d="m5 13 4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        }
        @case ('no-go') {
          <svg viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        }
        @default {
          <svg viewBox="0 0 24 24" class="size-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
            <path d="M12 7v6" stroke-linecap="round" />
            <circle cx="12" cy="17" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        }
      }
      {{ 'verdictShort.' + verdict() | translate }}
    </span>
  `,
})
export class VerdictBadge {
  readonly verdict = input.required<Verdict>();

  protected readonly classes = computed(() => {
    switch (this.verdict()) {
      case 'go':
        return 'border-verdict-go/40 bg-verdict-go/10 text-verdict-go';
      case 'no-go':
        return 'border-verdict-stop/40 bg-verdict-stop/10 text-verdict-stop';
      default:
        return 'border-verdict-warn/40 bg-verdict-warn/10 text-verdict-warn';
    }
  });
}
