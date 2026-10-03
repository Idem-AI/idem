import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

import { Illustration } from '../../../../shared/components/illustration/illustration';
import { SimulationStore } from '../../data-access';
import { LabName, labEntry } from '../../models';

/**
 * Cadre commun des tests complémentaires.
 *
 * Un test coûte un passage des agents : l'écran dit donc ce qu'il apporte
 * AVANT de le lancer, avec un seul bouton, et distingue « jamais fait » de
 * « fait ». Le titre, la question et l'explication viennent de `lab.<nom>.*`.
 */
@Component({
  selector: 'sim-lab-panel',
  imports: [RouterLink, TranslatePipe, IdemLoaderComponent, Illustration],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-col gap-6">
      <a routerLink="../labs" class="sim-link w-fit">
        <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
        {{ 'lab.backToLabs' | translate }}
      </a>

      <header class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <sim-illustration [name]="illustration()" class="w-24 sm:w-28" />
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold md:text-3xl">{{ 'lab.' + lab() + '.heading' | translate }}</h1>
          <p class="mt-1 text-base font-medium text-text-primary">
            {{ 'lab.' + lab() + '.question' | translate }}
          </p>
          <p class="mt-1 max-w-2xl text-sm leading-relaxed text-text-secondary">
            {{ 'lab.' + lab() + '.body' | translate }}
          </p>
        </div>
        @if (available()) {
          <button
            type="button"
            class="outer-button button-sm self-start sm:self-center"
            [disabled]="pending()"
            (click)="run()"
          >
            <i class="pi pi-refresh text-xs" aria-hidden="true"></i>
            {{ 'lab.rerun' | translate }}
          </button>
        }
      </header>

      @if (pending()) {
        <div class="glass-card flex flex-col items-center gap-3 p-8 text-center" aria-live="polite">
          <idem-loader size="md" />
          <p class="text-base font-semibold text-text-primary">{{ 'lab.running' | translate }}</p>
          <p class="max-w-md text-sm text-text-secondary">{{ 'lab.runningBody' | translate }}</p>
        </div>
      } @else if (available()) {
        <ng-content />
      } @else if (ready()) {
        <div class="glass-card flex flex-col items-center gap-3 p-8 text-center">
          <p class="max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
            {{ 'lab.notRun' | translate }}
          </p>
          <button type="button" class="inner-button button-lg mt-2" (click)="run()">
            <i class="pi pi-play" aria-hidden="true"></i>
            {{ 'lab.launch' | translate }}
          </button>
          <p class="text-xs text-text-tertiary">{{ 'lab.duration' | translate }}</p>
        </div>
      } @else {
        <p class="glass-card flex items-start gap-3 p-5 text-sm leading-relaxed text-text-secondary">
          <i class="pi pi-clock mt-0.5 text-primary-500" aria-hidden="true"></i>
          {{ 'lab.needsRun' | translate }}
        </p>
      }
    </section>
  `,
})
export class LabPanel {
  readonly lab = input.required<LabName>();

  private readonly store = inject(SimulationStore);

  protected readonly illustration = computed(() => labEntry(this.lab()).illustration);

  /** Un test ne se lance que sur une simulation terminée. */
  protected readonly ready = computed(() => Boolean(this.store.active()?.result));
  protected readonly available = computed(() => Boolean(this.store.labs()[this.lab()]));
  protected readonly pending = computed(() => this.store.runningLab() === this.lab());

  protected run(): void {
    void this.store.runLab(this.lab());
  }
}
