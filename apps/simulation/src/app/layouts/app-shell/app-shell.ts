import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';

import { environment } from '@env';

import { AuthService } from '../../core/auth';
import { SimulationStore } from '../../features/simulations/data-access';
import { LinkedProject } from '../../features/simulations/models';
import { Sidebar } from '../sidebar/sidebar';

const COLLAPSE_KEY = 'idem-sim-sidebar-collapsed';

/**
 * Coquille de la surface authentifiée.
 *
 * Barre supérieure fixe pour le contexte (projet, compte), colonne de gauche
 * pour la navigation : le produit a une quinzaine de destinations, une barre
 * horizontale ne les tient plus.
 */
@Component({
  selector: 'sim-app-shell',
  imports: [RouterOutlet, TranslatePipe, Sidebar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)', '(document:keydown.escape)': 'closeMenus()' },
  templateUrl: './app-shell.html',
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly store = inject(SimulationStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly dashboardUrl = environment.services.dashboard.url;
  protected readonly user = this.auth.user;
  protected readonly projects = this.store.projects;
  protected readonly activeProject = this.store.project;

  protected readonly menuOpen = signal(false);
  protected readonly projectMenuOpen = signal(false);
  protected readonly drawerOpen = signal(false);
  protected readonly collapsed = signal(readCollapsed());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** L'exécution ouverte, lue dans l'URL : la coquille ne la charge pas. */
  protected readonly simulationId = computed(() => {
    const segment = /^\/simulations\/([^/?#]+)/.exec(this.url())?.[1];
    return segment && segment !== 'new' ? decodeURIComponent(segment) : null;
  });

  protected readonly initials = computed(() => {
    const user = this.user();
    const source = user?.displayName || user?.email || '';
    const parts = source.split(/[\s.@]+/).filter(Boolean);
    return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
  });

  constructor() {
    void this.store.loadProjects();
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
    try {
      localStorage.setItem(COLLAPSE_KEY, String(this.collapsed()));
    } catch {
      // Navigation privée : la préférence ne survit pas à la session.
    }
  }

  protected chooseProject(project: LinkedProject): void {
    this.projectMenuOpen.set(false);
    this.store.selectProject(project.id);
    void this.router.navigate(['/simulations']);
  }

  protected closeMenus(): void {
    this.menuOpen.set(false);
    this.projectMenuOpen.set(false);
    this.drawerOpen.set(false);
  }

  protected async signOut(): Promise<void> {
    this.closeMenus();
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuOpen() && !this.projectMenuOpen()) {
      return;
    }
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
      this.projectMenuOpen.set(false);
    }
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}
