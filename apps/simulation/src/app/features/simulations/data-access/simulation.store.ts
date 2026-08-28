import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, firstValueFrom } from 'rxjs';

import { CreateSimulationInput, Simulation, SimulationSummary } from '../models';
import { SimulationGateway } from './simulation.gateway';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Holds the simulations the current screens are looking at.
 *
 * Pages read signals and call intents; nothing else in the feature touches
 * the gateway directly.
 */
@Injectable({ providedIn: 'root' })
export class SimulationStore {
  private readonly gateway = inject(SimulationGateway);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listItems = signal<readonly SimulationSummary[]>([]);
  private readonly listState = signal<LoadState>('idle');
  private readonly activeItem = signal<Simulation | null>(null);
  private readonly activeState = signal<LoadState>('idle');
  private readonly failure = signal<string | null>(null);

  private watcher?: Subscription;

  readonly simulations = this.listItems.asReadonly();
  readonly listStatus = this.listState.asReadonly();
  readonly active = this.activeItem.asReadonly();
  readonly activeStatus = this.activeState.asReadonly();
  readonly error = this.failure.asReadonly();

  readonly isListLoading = computed(() => this.listState() === 'loading');
  readonly isEmpty = computed(() => this.listState() === 'ready' && this.listItems().length === 0);

  async loadList(): Promise<void> {
    this.listState.set('loading');
    this.failure.set(null);
    try {
      this.listItems.set(await firstValueFrom(this.gateway.listSimulations()));
      this.listState.set('ready');
    } catch (error) {
      this.failure.set(messageOf(error));
      this.listState.set('error');
    }
  }

  async loadOne(id: string): Promise<Simulation | null> {
    this.activeState.set('loading');
    this.failure.set(null);
    try {
      const simulation = await firstValueFrom(this.gateway.getSimulation(id));
      this.activeItem.set(simulation);
      this.activeState.set('ready');
      return simulation;
    } catch (error) {
      this.failure.set(messageOf(error));
      this.activeState.set('error');
      return null;
    }
  }

  /**
   * Follows a running simulation until it reaches a terminal state. Safe to
   * call repeatedly: the previous watch is dropped first.
   */
  watch(id: string): void {
    this.watcher?.unsubscribe();
    this.activeState.set('loading');
    this.watcher = this.gateway
      .watchSimulation(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (simulation) => {
          this.activeItem.set(simulation);
          this.activeState.set('ready');
        },
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
    this.activeItem.set(simulation);
    this.activeState.set('ready');
    this.listItems.update((items) => [toSummary(simulation), ...items]);
    return simulation;
  }

  async purchaseReport(id: string): Promise<Simulation> {
    const simulation = await firstValueFrom(this.gateway.purchaseReport(id));
    this.activeItem.set(simulation);
    this.listItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, hasReport: true } : item)),
    );
    return simulation;
  }

  clearActive(): void {
    this.stopWatching();
    this.activeItem.set(null);
    this.activeState.set('idle');
  }
}

function toSummary(simulation: Simulation): SimulationSummary {
  return {
    id: simulation.id,
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

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
