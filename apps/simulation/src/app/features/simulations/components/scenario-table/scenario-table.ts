import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Scenario, ScenarioKind } from '../../models';

const KIND_ORDER: ScenarioKind[] = ['baseline', 'favourable', 'adverse', 'stress', 'extreme'];

/**
 * Les situations testées, une carte par situation.
 *
 * Une table de six colonnes défilait de côté sur téléphone et demandait de
 * savoir lire « point mort » ou « autonomie ». Chaque carte dit d'abord si le
 * projet tient, en toutes lettres, puis les deux chiffres qui comptent ; le
 * détail s'ouvre sur demande.
 */
@Component({
  selector: 'sim-scenario-table',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="flex flex-col gap-3" [attr.aria-label]="caption()">
      @for (scenario of sorted(); track scenario.id) {
        <li class="glass-card p-4 sm:p-5">
          <div class="flex flex-wrap items-center gap-2">
            @if (scenario.outcome; as outcome) {
              <span class="sim-pill" [class.sim-pill--go]="outcome.survives" [class.sim-pill--stop]="!outcome.survives">
                <i class="pi text-xs" [class.pi-check]="outcome.survives" [class.pi-times]="!outcome.survives" aria-hidden="true"></i>
                {{ (outcome.survives ? 'scenario.holdsYes' : 'scenario.holdsNo') | translate }}
              </span>
            } @else {
              <span class="sim-pill sim-pill--muted">{{ 'scenario.notComputed' | translate }}</span>
            }
            <span class="text-xs text-text-tertiary">{{ 'scenarioKind.' + scenario.kind | translate }}</span>
          </div>

          <h3 class="mt-2.5 text-base font-semibold">{{ scenario.name }}</h3>
          @if (scenario.question) {
            <p class="mt-0.5 text-sm leading-relaxed text-text-secondary">{{ scenario.question }}</p>
          }

          @if (scenario.outcome; as outcome) {
            <dl class="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[var(--glass-bg-subtle)] p-3">
              <div>
                <dt class="text-xs text-text-tertiary">{{ 'scenario.viability' | translate }}</dt>
                <dd class="text-base font-bold tabular-nums text-text-primary">{{ outcome.viability }}<span class="text-xs font-normal text-text-tertiary">/100</span></dd>
              </div>
              <div>
                <dt class="text-xs text-text-tertiary">{{ 'scenario.breakEven' | translate }}</dt>
                <dd class="text-sm font-semibold text-text-primary">
                  {{
                    outcome.breakEvenMonth === null
                      ? ('scenario.never' | translate)
                      : ('scenario.monthN' | translate: { month: outcome.breakEvenMonth })
                  }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-text-tertiary">{{ 'scenario.runway' | translate }}</dt>
                <dd class="text-sm font-semibold text-text-primary">
                  {{
                    outcome.runwayMonths === null
                      ? ('scenario.enough' | translate)
                      : ('scenario.monthsN' | translate: { months: outcome.runwayMonths })
                  }}
                </dd>
              </div>
            </dl>
          }

          @if (scenario.shifts.length || scenario.outcome?.narrative) {
            <button
              type="button"
              class="sim-link mt-3"
              [attr.aria-expanded]="expanded() === scenario.id"
              (click)="toggle(scenario.id)"
            >
              {{ (expanded() === scenario.id ? 'action.seeLess' : 'action.seeMore') | translate }}
              <i class="pi text-xs" [class.pi-chevron-down]="expanded() !== scenario.id" [class.pi-chevron-up]="expanded() === scenario.id" aria-hidden="true"></i>
            </button>
          }

          @if (expanded() === scenario.id) {
            <div class="rise mt-3 flex flex-col gap-3 border-t border-[var(--glass-border-subtle)] pt-3">
              @if (scenario.shifts.length) {
                <div>
                  <p class="text-sm font-semibold text-text-primary">{{ 'scenario.changes' | translate }}</p>
                  <ul class="mt-1.5 flex flex-col gap-1">
                    @for (shift of scenario.shifts; track shift.factorId + shift.label) {
                      <li class="flex items-baseline justify-between gap-3 text-sm">
                        <span class="text-text-secondary">{{ shift.label }}</span>
                        <span class="font-semibold tabular-nums text-text-primary">{{ shift.delta }}</span>
                      </li>
                    }
                  </ul>
                </div>
              }
              @if (scenario.outcome; as outcome) {
                @if (outcome.narrative) {
                  <div>
                    <p class="text-sm font-semibold text-text-primary">{{ 'scenario.whatHappens' | translate }}</p>
                    <p class="mt-1 text-sm leading-relaxed text-text-secondary">{{ outcome.narrative }}</p>
                  </div>
                }
              }
            </div>
          }
        </li>
      }
    </ul>
  `,
})
export class ScenarioTable {
  readonly scenarios = input.required<readonly Scenario[]>();
  readonly caption = input('');

  protected readonly expanded = signal<string | null>(null);

  protected readonly sorted = computed(() =>
    [...this.scenarios()].sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
        (b.outcome?.viability ?? 0) - (a.outcome?.viability ?? 0),
    ),
  );

  protected toggle(id: string): void {
    this.expanded.update((current) => (current === id ? null : id));
  }
}
