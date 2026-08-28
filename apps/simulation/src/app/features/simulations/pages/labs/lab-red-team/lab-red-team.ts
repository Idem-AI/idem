import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LabPanel } from '../../../components/lab-panel/lab-panel';
import { SimulationStore } from '../../../data-access';
import { RedTeamRole, Vulnerability } from '../../../models';

type RoleFilter = RedTeamRole | 'all';

const ROLES: readonly RoleFilter[] = [
  'all',
  'competitor',
  'skeptical-customer',
  'investor',
  'regulator',
  'cfo',
  'operations',
];

const SEVERITY_ORDER: Record<Vulnerability['severity'], number> = {
  critical: 0,
  important: 1,
  secondary: 2,
};

/** « Attaquez mon business » : six rôles cherchent où le projet casse. */
@Component({
  selector: 'sim-lab-red-team',
  imports: [TranslatePipe, LabPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lab-red-team.html',
})
export class LabRedTeam {
  private readonly store = inject(SimulationStore);

  protected readonly roles = ROLES;
  protected readonly role = signal<RoleFilter>('all');

  protected readonly report = computed(() => this.store.labs().redTeam ?? null);

  protected readonly visible = computed<readonly Vulnerability[]>(() => {
    const role = this.role();
    return [...(this.report()?.vulnerabilities ?? [])]
      .filter((item) => role === 'all' || item.role === role)
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  });
}
