import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Scenario, ScenarioKind } from '../../models';

const KIND_ORDER: ScenarioKind[] = ['baseline', 'favourable', 'adverse', 'stress', 'extreme'];

/**
 * Scenarios as a table, not as cards: the reader is comparing numbers across
 * rows, and a grid of cards makes that comparison harder.
 */
@Component({
  selector: 'sim-scenario-table',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto">
      <table class="w-full min-w-[42rem] border-collapse text-sm">
        <caption class="sr-only">{{ caption() }}</caption>
        <thead>
          <tr class="border-b border-line text-left">
            <th scope="col" class="py-2 pr-4 font-medium text-ink-subtle">
              {{ 'scenario.name' | translate }}
            </th>
            <th scope="col" class="py-2 pr-4 font-medium text-ink-subtle">
              {{ 'scenario.kind' | translate }}
            </th>
            <th scope="col" class="py-2 pr-4 text-right font-medium text-ink-subtle">
              {{ 'scenario.viability' | translate }}
            </th>
            <th scope="col" class="py-2 pr-4 text-right font-medium text-ink-subtle">
              {{ 'scenario.breakEven' | translate }}
            </th>
            <th scope="col" class="py-2 pr-4 text-right font-medium text-ink-subtle">
              {{ 'scenario.runway' | translate }}
            </th>
            <th scope="col" class="py-2 font-medium text-ink-subtle">
              {{ 'scenario.holds' | translate }}
            </th>
          </tr>
        </thead>
        <tbody>
          @for (scenario of sorted(); track scenario.id) {
            <tr class="border-b border-line align-top last:border-0">
              <td class="py-3 pr-4">
                <button
                  type="button"
                  class="text-left font-medium text-ink underline-offset-4 hover:underline"
                  [attr.aria-expanded]="expanded() === scenario.id"
                  (click)="toggle(scenario.id)"
                >
                  {{ scenario.name }}
                </button>
                <p class="mt-0.5 max-w-[40ch] text-meta leading-relaxed text-ink-subtle">
                  {{ scenario.question }}
                </p>

                @if (expanded() === scenario.id) {
                  <div class="mt-2.5 rounded-lg border border-line bg-panel-sunken p-3">
                    @if (scenario.shifts.length) {
                      <ul class="mb-2 flex flex-col gap-1">
                        @for (shift of scenario.shifts; track shift.factorId + shift.label) {
                          <li class="flex items-baseline justify-between gap-3 text-meta">
                            <span class="text-ink-muted">{{ shift.label }}</span>
                            <span class="font-semibold tabular-nums text-ink">{{ shift.delta }}</span>
                          </li>
                        }
                      </ul>
                    }
                    <p class="max-w-[65ch] text-meta leading-relaxed text-ink-muted">
                      {{ scenario.outcome }}
                    </p>
                  </div>
                }
              </td>
              <td class="py-3 pr-4 text-ink-muted">{{ 'scenarioKind.' + scenario.kind | translate }}</td>
              <td class="py-3 pr-4 text-right font-semibold tabular-nums text-ink">
                {{ scenario.viability }}
              </td>
              <td class="py-3 pr-4 text-right tabular-nums text-ink-muted">
                {{
                  scenario.breakEvenMonth === null
                    ? ('scenario.never' | translate)
                    : ('scenario.monthN' | translate: { month: scenario.breakEvenMonth })
                }}
              </td>
              <td class="py-3 pr-4 text-right tabular-nums text-ink-muted">
                {{
                  scenario.runwayMonths === null
                    ? '—'
                    : ('scenario.monthsN' | translate: { months: scenario.runwayMonths })
                }}
              </td>
              <td class="py-3">
                <span
                  class="inline-flex items-center gap-1.5 text-meta font-semibold"
                  [class]="scenario.survives ? 'text-verdict-go' : 'text-verdict-stop'"
                >
                  <span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
                  {{ (scenario.survives ? 'scenario.holdsYes' : 'scenario.holdsNo') | translate }}
                </span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class ScenarioTable {
  readonly scenarios = input.required<readonly Scenario[]>();
  readonly caption = input('');

  protected readonly expanded = signal<string | null>(null);

  protected readonly sorted = computed(() =>
    [...this.scenarios()].sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.viability - a.viability,
    ),
  );

  protected toggle(id: string): void {
    this.expanded.update((current) => (current === id ? null : id));
  }
}
