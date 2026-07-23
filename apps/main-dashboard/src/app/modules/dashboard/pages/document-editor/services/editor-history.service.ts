import { computed, Injectable, signal } from '@angular/core';
import { EditableSection } from '../models/editor.types';

/**
 * Pile d'annulation/rétablissement (Ctrl+Z / Ctrl+Y) opérant sur des snapshots
 * de l'ensemble des sections. Fournie au niveau du composant éditeur.
 *
 * On enregistre l'état AVANT chaque mutation (`record`), avec coalescence
 * optionnelle pour éviter un snapshot par micro-changement (ex: glissement d'un
 * curseur de style).
 */
@Injectable()
export class EditorHistoryService {
  private static readonly MAX = 100;

  private readonly past = signal<EditableSection[][]>([]);
  private readonly future = signal<EditableSection[][]>([]);

  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  private lastKey: string | null = null;
  private lastAt = 0;

  reset(): void {
    this.past.set([]);
    this.future.set([]);
    this.lastKey = null;
  }

  /**
   * Enregistre l'état courant avant mutation. `coalesceKey` fusionne les
   * enregistrements successifs identiques survenant dans les 600 ms.
   */
  record(snapshot: EditableSection[], coalesceKey?: string): void {
    const now = Date.now();
    if (coalesceKey && coalesceKey === this.lastKey && now - this.lastAt < 600) {
      this.lastAt = now;
      return;
    }
    this.lastKey = coalesceKey ?? null;
    this.lastAt = now;
    this.past.update((stack) => {
      const next = [...stack, snapshot];
      return next.length > EditorHistoryService.MAX ? next.slice(next.length - EditorHistoryService.MAX) : next;
    });
    this.future.set([]);
  }

  /** Renvoie le snapshot à restaurer, en poussant l'état courant dans le futur. */
  undo(current: EditableSection[]): EditableSection[] | null {
    const stack = this.past();
    if (stack.length === 0) return null;
    const snapshot = stack[stack.length - 1];
    this.past.set(stack.slice(0, -1));
    this.future.update((f) => [...f, current]);
    this.lastKey = null;
    return snapshot;
  }

  /** Renvoie le snapshot à rétablir, en poussant l'état courant dans le passé. */
  redo(current: EditableSection[]): EditableSection[] | null {
    const stack = this.future();
    if (stack.length === 0) return null;
    const snapshot = stack[stack.length - 1];
    this.future.set(stack.slice(0, -1));
    this.past.update((p) => [...p, current]);
    this.lastKey = null;
    return snapshot;
  }
}
