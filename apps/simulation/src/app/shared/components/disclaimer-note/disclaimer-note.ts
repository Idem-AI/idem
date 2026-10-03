import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * La mise en garde obligatoire sous toute note simulée.
 *
 * Un composant plutôt qu'un texte recopié : elle ne peut ni dériver ni être
 * oubliée sur un écran qui affiche un résultat.
 */
@Component({
  selector: 'sim-disclaimer-note',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (compact()) {
      <p class="flex items-start gap-2 text-xs leading-relaxed text-text-tertiary">
        <i class="pi pi-info-circle mt-0.5 shrink-0" aria-hidden="true"></i>
        {{ 'disclaimer.short' | translate }}
      </p>
    } @else {
      <aside
        class="flex items-start gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-subtle)] p-4"
        [attr.aria-label]="'disclaimer.heading' | translate"
      >
        <i class="pi pi-info-circle mt-0.5 shrink-0 text-primary-500" aria-hidden="true"></i>
        <div class="space-y-1">
          <p class="text-sm font-semibold text-text-primary">{{ 'disclaimer.heading' | translate }}</p>
          <p class="max-w-[70ch] text-sm leading-relaxed text-text-secondary">
            {{ 'disclaimer.body' | translate }} {{ 'disclaimer.bothWays' | translate }}
          </p>
        </div>
      </aside>
    }
  `,
})
export class DisclaimerNote {
  /** Une seule ligne, pour une place juste sous une note. */
  readonly compact = input(false);
}
