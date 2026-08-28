import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { DisclaimerNote } from '../../../../shared/components/disclaimer-note/disclaimer-note';
import { PipelineProgress } from '../../components/pipeline-progress/pipeline-progress';
import { SimulationStore } from '../../data-access';

/**
 * The run in progress.
 *
 * A simulation takes minutes, so the wait is a screen of its own rather than
 * a spinner: the user can leave, come back, and see where the engine is.
 */
@Component({
  selector: 'sim-simulation-run',
  imports: [RouterLink, TranslatePipe, PipelineProgress, DisclaimerNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-6">
      <a
        routerLink="/simulations"
        class="inline-flex items-center gap-1.5 text-meta text-ink-subtle transition-colors hover:text-ink-muted"
      >
        <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ 'nav.simulations' | translate }}
      </a>

      @if (simulation(); as run) {
        <div>
          <h1 class="text-h1 font-semibold text-ink">{{ run.name }}</h1>
          <p class="mt-1 text-sm text-ink-muted">{{ 'run.description' | translate }}</p>
        </div>

        <div class="sim-panel-flat p-5">
          <sim-pipeline-progress [progress]="run.progress" />
        </div>

        @if (run.status === 'failed') {
          <div class="sim-panel-flat p-5" role="alert">
            <p class="text-sm font-medium text-ink">{{ 'run.failed' | translate }}</p>
            <p class="mt-1 text-meta text-ink-muted">{{ 'run.failedBody' | translate }}</p>
          </div>
        }

        <sim-disclaimer-note />
      } @else if (status() === 'error') {
        <div class="sim-panel-flat p-5" role="alert">
          <p class="text-sm font-medium text-ink">{{ 'error.loadFailed' | translate }}</p>
          <p class="mt-1 text-meta text-ink-muted">{{ error() }}</p>
        </div>
      } @else {
        <div class="sim-skeleton h-64 rounded-xl"></div>
      }
    </div>
  `,
})
export class SimulationRun {
  /** Bound from the `:id` route parameter via `withComponentInputBinding`. */
  readonly id = input.required<string>();

  private readonly store = inject(SimulationStore);
  private readonly router = inject(Router);

  protected readonly simulation = this.store.active;
  protected readonly status = this.store.activeStatus;
  protected readonly error = this.store.error;

  constructor() {
    effect((onCleanup) => {
      this.store.watch(this.id());
      onCleanup(() => this.store.stopWatching());
    });

    // Move on as soon as there is something to read, rather than making the
    // user notice the run finished.
    effect(() => {
      const run = this.simulation();
      if (run?.status === 'completed' && run.id === this.id()) {
        void this.router.navigate(['/simulations', run.id, 'results'], { replaceUrl: true });
      }
    });
  }
}
