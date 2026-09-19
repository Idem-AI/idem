import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import {
  CommunicationStrategy,
  StrategyBlock,
} from '../../../../models/communication.model';

/**
 * MA FAÇON DE COMMUNIQUER — à qui la marque parle, sur quel ton, sur quels réseaux.
 *
 * C'est la stratégie de marque, appelée par ce qu'elle sert plutôt que par son
 * nom de métier : « stratégie de communication » — et a fortiori « la boussole »,
 * son premier intitulé — ne dit pas à quoi ça sert à quelqu'un qui n'a jamais
 * fait de marketing.
 *
 * Un PANNEAU et non un onglet : on la définit une fois et on la relit rarement.
 * Elle occupait pourtant le premier onglet du module, ce qui plaçait 40 crédits
 * et sept blocs de prose entre l'utilisateur et son premier visuel.
 *
 * Elle reste importante : c'est d'elle que chaque planning tire son angle.
 */
@Component({
  selector: 'app-brand-voice-panel',
  imports: [FormsModule, TranslateModule],
  templateUrl: './brand-voice-panel.html',
  styleUrl: './brand-voice-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandVoicePanel {
  private readonly communication = inject(CommunicationService);

  readonly projectId = input.required<string>();
  readonly strategy = input<CommunicationStrategy | null>(null);

  readonly strategyChange = output<CommunicationStrategy>();
  readonly closed = output<void>();
  readonly failed = output<string>();

  protected readonly isGenerating = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly stepLabel = signal('');
  protected readonly savedAt = signal<number | null>(null);

  /**
   * Section en cours de modification : `'summary'`, l'id d'un bloc, ou rien.
   *
   * Une seule à la fois, et chacune a son propre crayon. Le bouton « Modifier »
   * global obligeait à basculer TOUTE la page en édition pour corriger une phrase,
   * et poussait l'action utile — « Tout réécrire » — en bas de l'écran.
   */
  protected readonly editingId = signal<string | null>(null);
  /** Texte en cours de saisie pour la section ouverte. */
  protected readonly draft = signal('');

  protected readonly blocks = computed<StrategyBlock[]>(() => this.strategy()?.blocks ?? []);
  protected readonly summary = computed(() => this.strategy()?.summary ?? '');

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

  protected startEdit(id: string, current: string): void {
    this.editingId.set(id);
    this.draft.set(current);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.draft.set('');
  }

  /**
   * Enregistre la seule section modifiée.
   *
   * La stratégie complète est renvoyée à l'API (son contrat est un remplacement),
   * mais construite depuis l'entrée courante : les autres sections ne sont jamais
   * réécrites de mémoire, donc jamais perdues si elles ont changé entre-temps.
   */
  protected saveEdit(): void {
    const current = this.strategy();
    const id = this.editingId();
    if (!current || !id || this.isSaving()) return;

    const value = this.draft();
    const next: CommunicationStrategy =
      id === 'summary'
        ? { ...current, summary: value }
        : {
            ...current,
            blocks: current.blocks.map((block) =>
              block.id === id ? { ...block, body: value } : block,
            ),
          };

    this.isSaving.set(true);
    this.communication.updateStrategy(this.projectId(), next).subscribe({
      next: (model) => {
        if (model.strategy) this.strategyChange.emit(model.strategy);
        this.isSaving.set(false);
        this.editingId.set(null);
        this.draft.set('');
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
    return `dashboard.showCommunication.voice.blockKinds.${kind}`;
  }

  private emit(strategy: CommunicationStrategy): void {
    this.strategyChange.emit(strategy);
    this.editingId.set(null);
    this.draft.set('');
  }
}
