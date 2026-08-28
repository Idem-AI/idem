import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { SimulationProgress } from '../../models';

/**
 * The run, made legible while it happens.
 *
 * A percentage alone tells the user nothing about what the engine is doing;
 * the stage list is what makes a multi-minute wait tolerable.
 */
@Component({
  selector: 'sim-pipeline-progress',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="mb-5 flex items-baseline justify-between gap-4">
        <p class="text-label font-medium text-ink-muted" role="status" aria-live="polite">
          {{ 'stage.' + activeStageId() | translate }}
        </p>
        <span class="text-label tabular-nums text-ink-subtle">{{ progress().percent }} %</span>
      </div>

      <div
        class="mb-6 h-1 w-full overflow-hidden rounded-full bg-panel-sunken"
        role="progressbar"
        [attr.aria-valuenow]="progress().percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-full bg-brand transition-[width] duration-500 ease-[var(--ease-out-quint)]"
          [style.width.%]="progress().percent"
        ></div>
      </div>

      <ol class="flex flex-col gap-0">
        @for (stage of progress().stages; track stage.id) {
          <li class="relative flex gap-3 pb-5 last:pb-0">
            @if (!$last) {
              <span
                class="absolute left-[0.4375rem] top-4 bottom-0 w-px"
                [class]="stage.state === 'done' ? 'bg-brand/50' : 'bg-line'"
                aria-hidden="true"
              ></span>
            }

            <span class="relative mt-0.5 grid size-3.5 shrink-0 place-items-center" aria-hidden="true">
              @switch (stage.state) {
                @case ('done') {
                  <svg viewBox="0 0 14 14" class="size-3.5 text-brand" fill="currentColor">
                    <circle cx="7" cy="7" r="7" opacity="0.18" />
                    <path
                      d="m4 7.2 2 2L10 5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                }
                @case ('active') {
                  <span class="size-3.5 animate-spin rounded-full border-2 border-line border-t-brand"></span>
                }
                @case ('failed') {
                  <span class="size-2 rounded-full bg-verdict-stop"></span>
                }
                @default {
                  <span class="size-2 rounded-full border border-line-strong"></span>
                }
              }
            </span>

            <div class="min-w-0 flex-1">
              <p
                class="text-sm font-medium"
                [class]="stage.state === 'pending' ? 'text-ink-subtle' : 'text-ink'"
              >
                {{ 'stage.' + stage.id | translate }}
              </p>
              @if (stage.note && stage.state !== 'pending') {
                <p class="mt-0.5 text-meta text-ink-subtle">{{ stage.note }}</p>
              }
            </div>
          </li>
        }
      </ol>
    </div>
  `,
})
export class PipelineProgress {
  readonly progress = input.required<SimulationProgress>();

  protected activeStageId(): string {
    const stages = this.progress().stages;
    return (stages.find((stage) => stage.state === 'active') ?? stages[stages.length - 1]).id;
  }
}
