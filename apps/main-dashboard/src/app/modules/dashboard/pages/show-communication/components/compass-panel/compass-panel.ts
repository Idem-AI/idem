import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import {
  CommunicationStrategy,
  StrategyBlock,
} from '../../../../models/communication.model';

/**
 * LA BOUSSOLE — la stratégie de marque.
 *
 * Un PANNEAU et non un onglet : on la définit une fois et on la relit rarement.
 * Elle occupait pourtant le premier onglet du module, ce qui plaçait 40 crédits
 * et sept blocs de prose entre l'utilisateur et son premier visuel.
 *
 * Elle reste importante : c'est d'elle que dérive le brief de chaque période.
 */
@Component({
  selector: 'app-compass-panel',
  imports: [FormsModule, TranslateModule],
  templateUrl: './compass-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompassPanel {
  private readonly communication = inject(CommunicationService);

  readonly projectId = input.required<string>();
  readonly strategy = input<CommunicationStrategy | null>(null);

  readonly strategyChange = output<CommunicationStrategy>();
  readonly closed = output<void>();
  readonly failed = output<string>();

  protected readonly isGenerating = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly isEditing = signal(false);
  protected readonly stepLabel = signal('');
  protected readonly savedAt = signal<number | null>(null);

  /**
   * Copie de travail. L'édition ne touche pas l'entrée : abandonner ses
   * modifications doit être possible, et une entrée mutée serait réécrite par le
   * parent au premier rechargement.
   */
  protected readonly draft = signal<CommunicationStrategy | null>(null);

  protected readonly blocks = computed<StrategyBlock[]>(
    () => this.draft()?.blocks ?? this.strategy()?.blocks ?? [],
  );
  protected readonly summary = computed(
    () => this.draft()?.summary ?? this.strategy()?.summary ?? '',
  );

  protected generate(force: boolean): void {
    this.isGenerating.set(true);
    this.stepLabel.set('dashboard.showCommunication.steps.context');

    this.communication.streamStrategy(this.projectId(), { force }).subscribe({
      next: (event) => {
        if (event.type === 'step-start' && event.step) {
          this.stepLabel.set(`dashboard.showCommunication.steps.${event.step}`);
        } else if (event.type === 'step-complete' && event.step === 'strategy' && event.payload) {
          this.emit(event.payload as CommunicationStrategy);
        } else if (event.type === 'complete') {
          if (event.payload?.strategy) this.emit(event.payload.strategy);
          this.isGenerating.set(false);
        } else if (event.type === 'error') {
          this.failed.emit(event.message || 'strategy');
          this.isGenerating.set(false);
        }
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || err?.message || 'strategy');
        this.isGenerating.set(false);
      },
      complete: () => this.isGenerating.set(false),
    });
  }

  protected startEditing(): void {
    const current = this.strategy();
    if (!current) return;
    // Copie PROFONDE des blocs : un `{...current}` laisserait le tableau partagé,
    // et taper dans un bloc modifierait l'entrée du parent au fil des frappes.
    this.draft.set({ ...current, blocks: current.blocks.map((block) => ({ ...block })) });
    this.isEditing.set(true);
  }

  protected cancelEditing(): void {
    this.draft.set(null);
    this.isEditing.set(false);
  }

  protected updateSummary(value: string): void {
    const draft = this.draft();
    if (!draft) return;
    this.draft.set({ ...draft, summary: value });
  }

  protected updateBlock(id: string, value: string): void {
    const draft = this.draft();
    if (!draft) return;
    this.draft.set({
      ...draft,
      blocks: draft.blocks.map((block) => (block.id === id ? { ...block, body: value } : block)),
    });
  }

  protected save(): void {
    const draft = this.draft();
    if (!draft) return;
    this.isSaving.set(true);
    this.communication.updateStrategy(this.projectId(), draft).subscribe({
      next: (model) => {
        if (model.strategy) this.strategyChange.emit(model.strategy);
        this.isSaving.set(false);
        this.isEditing.set(false);
        this.draft.set(null);
        this.savedAt.set(Date.now());
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || 'strategy-save');
        this.isSaving.set(false);
      },
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected blockLabelKey(kind: StrategyBlock['kind']): string {
    return `dashboard.showCommunication.compass.blockKinds.${kind}`;
  }

  private emit(strategy: CommunicationStrategy): void {
    this.strategyChange.emit(strategy);
    this.draft.set(null);
    this.isEditing.set(false);
  }
}
