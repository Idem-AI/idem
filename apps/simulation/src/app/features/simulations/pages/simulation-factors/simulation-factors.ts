import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EvidenceChip } from '../../components/evidence-chip/evidence-chip';
import { SimulationStore } from '../../data-access';
import { Factor, FactorTier } from '../../models';

type TierFilter = FactorTier | 'all';

const FILTERS: readonly TierFilter[] = ['all', 'critical', 'important', 'secondary', 'unknown'];
const TIER_ORDER: Record<FactorTier, number> = {
  critical: 0,
  important: 1,
  secondary: 2,
  unknown: 3,
};

/**
 * Tous les facteurs découverts, pas une liste fixe.
 *
 * Le tri se fait d'abord par niveau puis par impact : l'ordre est
 * l'information principale, le filtre ne sert qu'à réduire le bruit.
 */
@Component({
  selector: 'sim-simulation-factors',
  imports: [TranslatePipe, EvidenceChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simulation-factors.html',
})
export class SimulationFactors {
  private readonly store = inject(SimulationStore);

  protected readonly filters = FILTERS;
  protected readonly filter = signal<TierFilter>('all');
  protected readonly expanded = signal<string | null>(null);

  protected readonly factors = computed(() => this.store.active()?.factors ?? []);

  protected readonly counts = computed<Record<TierFilter, number>>(() => {
    const factors = this.factors();
    return {
      all: factors.length,
      critical: factors.filter((factor) => factor.tier === 'critical').length,
      important: factors.filter((factor) => factor.tier === 'important').length,
      secondary: factors.filter((factor) => factor.tier === 'secondary').length,
      unknown: factors.filter((factor) => factor.tier === 'unknown').length,
    };
  });

  protected readonly visible = computed<readonly Factor[]>(() => {
    const filter = this.filter();
    return [...this.factors()]
      .filter((factor) => filter === 'all' || factor.tier === filter)
      .sort(
        (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.impact - a.impact,
      );
  });

  protected toggle(id: string): void {
    this.expanded.update((current) => (current === id ? null : id));
  }
}
