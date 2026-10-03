import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

import { Illustration } from '../../../../../shared/components/illustration/illustration';
import { PageHeader } from '../../../../../shared/components/page-header/page-header';
import { SimulationStore } from '../../../data-access';
import { LAB_CATALOG, LabEntry } from '../../../models';

/**
 * « Aller plus loin » : les sept tests complémentaires sur une seule page.
 *
 * Chaque carte pose la question à laquelle le test répond, dans les mots de la
 * personne, et dit s'il a déjà été fait. Un clic ouvre le test ; on n'a jamais
 * à connaître son nom de module.
 */
@Component({
  selector: 'sim-labs-home',
  imports: [RouterLink, TranslatePipe, Illustration, PageHeader, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <sim-page-header
        [heading]="'lab.hub.heading' | translate"
        [description]="'lab.hub.lead' | translate"
      />

      @if (!ready()) {
        <p class="glass-card flex items-start gap-3 p-5 text-sm leading-relaxed text-text-secondary">
          <i class="pi pi-clock mt-0.5 text-primary-500" aria-hidden="true"></i>
          {{ 'lab.needsRun' | translate }}
        </p>
      }

      <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (entry of catalog; track entry.lab; let i = $index) {
          <li class="rise-stagger" [style.--i]="i">
            <a
              [routerLink]="entry.path"
              class="glass-card sim-choice flex h-full flex-col gap-2 p-5"
            >
              <div class="flex items-start justify-between gap-3">
                <sim-illustration [name]="entry.illustration" class="w-20" />
                @if (running() === entry.lab) {
                  <span class="sim-pill sim-pill--info">
                    <idem-loader size="xs" />
                    {{ 'lab.running' | translate }}
                  </span>
                } @else if (isDone(entry)) {
                  <span class="sim-pill sim-pill--go">
                    <i class="pi pi-check text-xs" aria-hidden="true"></i>
                    {{ 'lab.done' | translate }}
                  </span>
                } @else {
                  <span class="sim-pill sim-pill--muted">{{ 'lab.notDone' | translate }}</span>
                }
              </div>
              <h2 class="mt-2 text-lg font-semibold">
                {{ 'lab.' + entry.lab + '.heading' | translate }}
              </h2>
              <p class="text-sm leading-relaxed text-text-secondary">
                {{ 'lab.' + entry.lab + '.question' | translate }}
              </p>
              <span class="sim-link mt-auto pt-3">
                {{ (isDone(entry) ? 'lab.hub.open' : 'lab.hub.start') | translate }}
                <i class="pi pi-arrow-right text-xs" aria-hidden="true"></i>
              </span>
            </a>
          </li>
        }
      </ul>
    </div>
  `,
})
export class LabsHome {
  private readonly store = inject(SimulationStore);

  protected readonly catalog = LAB_CATALOG;
  protected readonly ready = computed(() => Boolean(this.store.active()?.result));
  protected readonly running = this.store.runningLab;

  protected isDone(entry: LabEntry): boolean {
    return Boolean(this.store.labs()[entry.lab]);
  }
}
