import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { SimulationStore } from '../../data-access';
import { LabName } from '../../models';

/**
 * Cadre commun des analyses complémentaires.
 *
 * Chaque laboratoire coûte une exécution d'agents : l'écran doit donc dire ce
 * qu'il produit avant de le lancer, et distinguer « jamais lancé » de
 * « lancé, sans résultat ».
 */
@Component({
  selector: 'sim-lab-panel',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 class="text-h2 font-semibold text-ink">{{ heading() }}</h2>
          <p class="mt-1 max-w-[70ch] text-sm leading-relaxed text-ink-muted">{{ body() }}</p>
        </div>
        @if (available()) {
          <button
            type="button"
            class="outer-button button-sm"
            [disabled]="pending()"
            (click)="run()"
          >
            <i class="pi pi-refresh text-xs" aria-hidden="true"></i>
            {{ (pending() ? 'lab.running' : 'lab.rerun') | translate }}
          </button>
        }
      </div>

      @if (pending()) {
        <div class="glass-card flex items-center gap-3 p-6" aria-live="polite">
          <span class="loader loader-sm" aria-hidden="true"></span>
          <p class="text-sm text-ink-muted">{{ 'lab.runningBody' | translate }}</p>
        </div>
      } @else if (available()) {
        <ng-content />
      } @else if (ready()) {
        <div class="glass-card flex flex-col items-start gap-3 p-6">
          <p class="max-w-[65ch] text-sm leading-relaxed text-ink-muted">
            {{ 'lab.notRun' | translate }}
          </p>
          <button type="button" class="inner-button" (click)="run()">
            <i class="pi pi-play text-xs" aria-hidden="true"></i>
            {{ 'lab.launch' | translate }}
          </button>
        </div>
      } @else {
        <p class="glass-card p-6 text-sm text-ink-muted">{{ 'lab.needsRun' | translate }}</p>
      }
    </section>
  `,
})
export class LabPanel {
  readonly lab = input.required<LabName>();
  readonly heading = input.required<string>();
  readonly body = input.required<string>();

  private readonly store = inject(SimulationStore);

  /** Un laboratoire ne s'exécute que sur une simulation terminée. */
  protected readonly ready = computed(() => Boolean(this.store.active()?.result));
  protected readonly available = computed(() => Boolean(this.store.labs()[this.lab()]));
  protected readonly pending = computed(() => this.store.runningLab() === this.lab());

  protected run(): void {
    void this.store.runLab(this.lab());
  }
}
