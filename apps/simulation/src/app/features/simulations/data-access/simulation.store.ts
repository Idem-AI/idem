import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, firstValueFrom } from 'rxjs';

import {
  CreateSimulationInput,
  LabName,
  LinkedProject,
  Simulation,
  SimulationReport,
  SimulationSummary,
} from '../models';
import { SimulationGateway } from './simulation.gateway';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const ACTIVE_PROJECT_KEY = 'idem-sim-active-project';

/**
 * Source unique de vérité des écrans de simulation.
 *
 * Toutes les ressources sont portées par un projet IDEM : le projet actif est
 * donc un état du magasin, et les pages n'ont jamais à le transporter
 * elles-mêmes dans les appels.
 */
@Injectable({ providedIn: 'root' })
export class SimulationStore {
  private readonly gateway = inject(SimulationGateway);
  private readonly destroyRef = inject(DestroyRef);

  private readonly projectItems = signal<readonly LinkedProject[]>([]);
  private readonly projectsState = signal<LoadState>('idle');
  private readonly activeProject = signal<string | null>(readStoredProject());

  private readonly listItems = signal<readonly SimulationSummary[]>([]);
  private readonly listState = signal<LoadState>('idle');
  private readonly activeItem = signal<Simulation | null>(null);
  private readonly activeState = signal<LoadState>('idle');
  private readonly busyLab = signal<LabName | null>(null);
  private readonly failure = signal<string | null>(null);

  private watcher?: Subscription;

  readonly projects = this.projectItems.asReadonly();
  readonly projectsStatus = this.projectsState.asReadonly();
  readonly projectId = this.activeProject.asReadonly();
  readonly simulations = this.listItems.asReadonly();
  readonly listStatus = this.listState.asReadonly();
  readonly active = this.activeItem.asReadonly();
  readonly activeStatus = this.activeState.asReadonly();
  readonly runningLab = this.busyLab.asReadonly();
  readonly error = this.failure.asReadonly();

  readonly project = computed(() => {
    const id = this.activeProject();
    return this.projectItems().find((item) => item.id === id) ?? null;
  });

  readonly isListLoading = computed(() => this.listState() === 'loading');
  readonly isEmpty = computed(() => this.listState() === 'ready' && this.listItems().length === 0);
  readonly labs = computed(() => this.activeItem()?.labs ?? {});

  /** Vrai tant que l'exécution consultée n'a pas atteint un état terminal. */
  readonly isRunning = computed(() => {
    const status = this.activeItem()?.status;
    return status === 'running' || status === 'awaiting-confirmation';
  });

  // -------------------------------------------------------------------
  // Projets
  // -------------------------------------------------------------------

  async loadProjects(): Promise<void> {
    if (this.projectsState() === 'loading') {
      return;
    }
    this.projectsState.set('loading');
    try {
      const projects = await firstValueFrom(this.gateway.listProjects());
      this.projectItems.set(projects);
      this.projectsState.set('ready');
      // Un projet actif effacé côté serveur ne doit pas bloquer l'écran.
      const current = this.activeProject();
      if (!current || !projects.some((project) => project.id === current)) {
        this.selectProject(projects[0]?.id ?? null);
      }
    } catch (error) {
      this.failure.set(messageOf(error));
      this.projectsState.set('error');
    }
  }

  selectProject(projectId: string | null): void {
    if (projectId === this.activeProject()) {
      return;
    }
    this.activeProject.set(projectId);
    storeProject(projectId);
    this.listItems.set([]);
    this.listState.set('idle');
    this.clearActive();
  }

  // -------------------------------------------------------------------
  // Exécutions
  // -------------------------------------------------------------------

  async loadList(): Promise<void> {
    const projectId = this.activeProject();
    if (!projectId) {
      this.listItems.set([]);
      this.listState.set('ready');
      return;
    }
    this.listState.set('loading');
    this.failure.set(null);
    try {
      this.listItems.set(await firstValueFrom(this.gateway.listSimulations(projectId)));
      this.listState.set('ready');
    } catch (error) {
      this.failure.set(messageOf(error));
      this.listState.set('error');
    }
  }

  async loadOne(simulationId: string, projectId = this.activeProject()): Promise<Simulation | null> {
    if (!projectId) {
      return null;
    }
    this.activeState.set('loading');
    this.failure.set(null);
    try {
      const simulation = await firstValueFrom(this.gateway.getSimulation(projectId, simulationId));
      this.adopt(simulation);
      return simulation;
    } catch (error) {
      this.failure.set(messageOf(error));
      this.activeState.set('error');
      return null;
    }
  }

  /**
   * Suit une exécution jusqu'à son état terminal. Appelable plusieurs fois :
   * la surveillance précédente est abandonnée d'abord.
   */
  watch(simulationId: string, projectId = this.activeProject()): void {
    this.watcher?.unsubscribe();
    if (!projectId) {
      return;
    }
    this.activeState.set('loading');
    this.watcher = this.gateway
      .watchSimulation(projectId, simulationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (simulation) => this.adopt(simulation),
        error: (error: unknown) => {
          this.failure.set(messageOf(error));
          this.activeState.set('error');
        },
      });
  }

  stopWatching(): void {
    this.watcher?.unsubscribe();
    this.watcher = undefined;
  }

  async create(input: CreateSimulationInput): Promise<Simulation> {
    const simulation = await firstValueFrom(this.gateway.createSimulation(input));
    this.adopt(simulation);
    this.listItems.update((items) => [toSummary(simulation), ...items]);
    return simulation;
  }

  async remove(simulationId: string): Promise<void> {
    const projectId = this.activeProject();
    if (!projectId) {
      return;
    }
    await firstValueFrom(this.gateway.deleteSimulation(projectId, simulationId));
    this.listItems.update((items) => items.filter((item) => item.id !== simulationId));
    if (this.activeItem()?.id === simulationId) {
      this.clearActive();
    }
  }

  // -------------------------------------------------------------------
  // Rapport et laboratoires
  // -------------------------------------------------------------------

  async generateReport(simulationId: string): Promise<SimulationReport | null> {
    const projectId = this.activeProject();
    if (!projectId) {
      return null;
    }
    try {
      const report = await firstValueFrom(this.gateway.generateReport(projectId, simulationId));
      this.activeItem.update((current) =>
        current && current.id === simulationId ? { ...current, report, hasReport: true } : current,
      );
      this.listItems.update((items) =>
        items.map((item) => (item.id === simulationId ? { ...item, hasReport: true } : item)),
      );
      return report;
    } catch (error) {
      this.failure.set(messageOf(error));
      return null;
    }
  }

  /**
   * Lance une analyse complémentaire. Le laboratoire en cours est exposé pour
   * que l'écran puisse montrer l'attente au bon endroit plutôt que globalement.
   */
  async runLab(lab: LabName, simulationId = this.activeItem()?.id): Promise<void> {
    const projectId = this.activeProject();
    if (!projectId || !simulationId || this.busyLab()) {
      return;
    }
    this.busyLab.set(lab);
    this.failure.set(null);
    try {
      this.adopt(await firstValueFrom(this.gateway.runLab(projectId, simulationId, lab)));
    } catch (error) {
      this.failure.set(messageOf(error));
    } finally {
      this.busyLab.set(null);
    }
  }

  clearActive(): void {
    this.stopWatching();
    this.activeItem.set(null);
    this.activeState.set('idle');
  }

  dismissError(): void {
    this.failure.set(null);
  }

  private adopt(simulation: Simulation): void {
    this.activeItem.set(simulation);
    this.activeState.set('ready');
    this.listItems.update((items) =>
      items.map((item) => (item.id === simulation.id ? toSummary(simulation) : item)),
    );
  }
}

function toSummary(simulation: Simulation): SimulationSummary {
  return {
    id: simulation.id,
    projectId: simulation.projectId,
    name: simulation.name,
    origin: simulation.origin,
    projectName: simulation.projectName,
    documentName: simulation.documentName,
    status: simulation.status,
    tier: simulation.tier,
    createdAt: simulation.createdAt,
    updatedAt: simulation.updatedAt,
    hasReport: simulation.hasReport,
    revision: simulation.revision,
    viabilityIndex: simulation.result?.viabilityIndex,
    verdict: simulation.result?.verdict,
  };
}

function readStoredProject(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

function storeProject(projectId: string | null): void {
  try {
    if (projectId) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  } catch {
    // Navigation privée : le projet actif reste simplement en mémoire.
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
