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
import { WORKSPACE_NAV, simulationNav } from '../nav/nav.model';

/**
 * Navigation permanente de l'espace de travail, au dessin de la colonne du
 * dashboard IDEM.
 *
 * Deux niveaux seulement : ce qui existe toujours (mes simulations), et ce que
 * la simulation ouverte rend accessible.
 */
@Component({
  selector: 'sim-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly store = inject(SimulationStore);

  /** Identifiant de la simulation ouverte, extrait de l'URL par la coquille. */
  readonly simulationId = input<string | null>(null);
  readonly collapsed = input(false);
  /** Vrai dans le tiroir mobile : la version repliée n'y a pas de sens. */
  readonly inDrawer = input(false);

  readonly navigate = output<void>();

  protected readonly workspaceNav = WORKSPACE_NAV;

  protected readonly groups = computed(() => {
    const id = this.simulationId();
    const active = this.store.active();
    const hasPrevious = Boolean(active && active.id === id && active.previousRunId);
    return id ? simulationNav(id, hasPrevious) : [];
  });

  protected readonly activeName = computed(() => this.store.active()?.name ?? null);

  /** Un test complémentaire tourne : la pastille le dit sur « Aller plus loin ». */
  protected readonly labRunning = computed(() => this.store.runningLab() !== null);

  protected isCompact(): boolean {
    return this.collapsed() && !this.inDrawer();
  }

  protected isLabs(route: string): boolean {
    return route.endsWith('/labs');
  }
}
