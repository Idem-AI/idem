import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { SimulationStore } from '../../features/simulations/data-access';
import { LabName } from '../../features/simulations/models';
import { NavItem, WORKSPACE_NAV, simulationNav } from '../nav/nav.model';

/**
 * Navigation permanente de l'espace de travail.
 *
 * Ni marque ni réglages : la barre supérieure les porte pour toutes les
 * coquilles, y compris celles qui n'ont pas de colonne.
 *
 * Deux niveaux seulement : ce qui existe toujours (les exécutions), et ce que
 * l'exécution ouverte rend accessible. Les laboratoires portent une pastille
 * quand ils ont déjà tourné, pour distinguer « pas encore lancé » de « vide ».
 */
@Component({
  selector: 'sim-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly store = inject(SimulationStore);

  /** Identifiant de l'exécution ouverte, extrait de l'URL par la coquille. */
  readonly simulationId = input<string | null>(null);
  readonly collapsed = input(false);
  /** Vrai dans le tiroir mobile : la version repliée n'y a pas de sens. */
  readonly inDrawer = input(false);

  readonly navigate = output<void>();

  protected readonly workspaceNav = WORKSPACE_NAV;
  protected readonly labs = this.store.labs;
  protected readonly runningLab = this.store.runningLab;

  protected readonly groups = computed(() => {
    const id = this.simulationId();
    return id ? simulationNav(id) : [];
  });

  protected readonly activeName = computed(() => this.store.active()?.name ?? null);

  protected isCompact(): boolean {
    return this.collapsed() && !this.inDrawer();
  }

  /** Vrai quand le laboratoire a déjà produit un résultat. */
  protected hasRun(item: NavItem): boolean {
    const lab = item.lab as LabName | undefined;
    return Boolean(lab && this.labs()[lab]);
  }

  protected isPending(item: NavItem): boolean {
    return Boolean(item.lab && this.runningLab() === item.lab);
  }
}
