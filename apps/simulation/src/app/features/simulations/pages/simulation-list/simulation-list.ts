import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '@ngx-translate/core';

import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { SkeletonList } from '../../../../shared/components/skeleton-list/skeleton-list';
import { SimulationStore } from '../../data-access';
import { SimulationSummary } from '../../models';
import { VerdictBadge } from '../../components/verdict-badge/verdict-badge';
import { scoreTone } from '../../ui/tones';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

@Component({
  selector: 'sim-simulation-list',
  imports: [
    RouterLink,
    DatePipe,
    TranslatePipe,
    PageHeader,
    EmptyState,
    SkeletonList,
    VerdictBadge,
    DisclaimerNote, IdemLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-list.html',
})
export class SimulationList {
  private readonly store = inject(SimulationStore);

  protected readonly simulations = this.store.simulations;
  protected readonly isLoading = this.store.isListLoading;
  protected readonly isEmpty = this.store.isEmpty;
  protected readonly error = this.store.error;

  /** Runs still in flight, surfaced first so the user can pick them back up. */
  protected readonly running = computed(() =>
    this.simulations().filter((simulation) => simulation.status === 'running'),
  );
  protected readonly finished = computed(() =>
    this.simulations().filter((simulation) => simulation.status !== 'running'),
  );

  protected readonly project = this.store.project;
  protected readonly lang = inject(LanguageService).language;

  constructor() {
    // Le projet actif peut changer depuis la barre supérieure sans que la page
    // soit recréée : on relit la liste à chaque changement.
    effect(() => {
      this.store.projectId();
      untracked(() => this.store.loadList());
    });
  }

  protected reload(): void {
    void this.store.loadList();
  }

  protected sourceLabel(simulation: SimulationSummary): string {
    return simulation.projectName ?? simulation.documentName ?? '';
  }

  /** Le cercle de la note prend la couleur de la jauge : vert, orange ou rouge. */
  protected scoreColor(value: number): string {
    const tone = scoreTone(value);
    return tone === 'go'
      ? 'var(--color-success)'
      : tone === 'warn'
        ? 'var(--color-warning)'
        : 'var(--color-danger)';
  }

  protected routeFor(simulation: SimulationSummary): string {
    return `/simulations/${simulation.id}`;
  }
}
