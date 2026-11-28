import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import {
  CommunicationPlan,
  CommunicationStrategy,
  ContentIdea,
  Flyer,
  StudioRequest,
} from '../../../../models/communication.model';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { PromptBox } from '../prompt-box/prompt-box';
import { WriteOnlyDirective } from '../../../../../team/directives/write-only.directive';

/** Les trois étapes, dans l'ordre où on les conseille. */
export type JourneyStepId = 'strategy' | 'calendar' | 'content';

type JourneyStepState = 'done' | 'next' | 'todo';

interface JourneyStep {
  id: JourneyStepId;
  state: JourneyStepState;
  /** « 3 sur 8 prêts » quand l'étape se compte. */
  progress?: { done: number; total: number };
}

/** Ce que l'accueil demande à la coquille de faire. */
export type HomeAction =
  | { kind: 'voice' }
  | { kind: 'plans' }
  | { kind: 'newPlan' }
  | { kind: 'conversations' }
  | { kind: 'prompt'; request: StudioRequest };

/**
 * ACCUEIL — deux choses, et rien d'autre.
 *
 * 1. Un champ : « besoin d'un visuel ? Dites-le. » Pour une demande ponctuelle
 *    (bonne année, Noël, un événement), on écrit une phrase et le visuel sort.
 *    Plus de catégories à choisir ; le format est un réglage avancé, replié.
 * 2. Le parcours complet, en trois étapes : la stratégie, puis le calendrier
 *    éditorial, puis les visuels et vidéos — générés depuis le calendrier.
 *
 * Le parcours se lit sur les DONNÉES : une étape est faite quand son résultat
 * existe. Aucune n'est verrouillée ; seule la suivante conseillée est mise en
 * avant. Ce qui était affiché en plus (à publier bientôt, derniers visuels)
 * vit dans les onglets Calendrier et Visuels.
 */
@Component({
  selector: 'app-communication-home',
  imports: [WriteOnlyDirective, TranslateModule, PromptBox],
  templateUrl: './communication-home.html',
  styleUrl: './communication-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunicationHome {
  private readonly communication = inject(CommunicationService);

  readonly projectId = input.required<string>();
  readonly strategy = input<CommunicationStrategy | null>(null);
  readonly plans = input<CommunicationPlan[]>([]);
  readonly visuals = input<Flyer[]>([]);

  readonly action = output<HomeAction>();

  /** Combien de conversations reprendre : le lien n'apparaît que s'il y en a. */
  protected readonly conversationCount = signal(0);

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (!projectId) return;
      untracked(() =>
        this.communication.listStudioThreads(projectId).subscribe({
          next: (threads) => this.conversationCount.set(threads.length),
          error: () => this.conversationCount.set(0),
        }),
      );
    });
  }

  protected openConversations(): void {
    this.action.emit({ kind: 'conversations' });
  }

  /** Un calendrier archivé ne compte plus dans l'avancement. */
  private readonly liveItems = computed(() =>
    this.plans()
      .filter((plan) => plan.status !== 'archived')
      .flatMap((plan) => plan.items),
  );

  private readonly visualIds = computed(() => new Set(this.visuals().map((visual) => visual.id)));

  private hasVisual(item: ContentIdea): boolean {
    const known = this.visualIds();
    return !!item.flyerIds?.some((id) => known.has(id)) || !!item.videoIds?.length;
  }

  protected readonly steps = computed<JourneyStep[]>(() => {
    const items = this.liveItems();
    const ready = items.filter((item) => this.hasVisual(item)).length;

    const done: Record<JourneyStepId, boolean> = {
      strategy: !!this.strategy(),
      calendar: items.length > 0,
      content: items.length > 0 && ready === items.length,
    };

    const order: { id: JourneyStepId; progress?: JourneyStep['progress'] }[] = [
      { id: 'strategy' },
      { id: 'calendar' },
      { id: 'content', progress: items.length ? { done: ready, total: items.length } : undefined },
    ];

    const nextId = order.find((step) => !done[step.id])?.id;
    return order.map((step) => ({
      ...step,
      state: done[step.id] ? 'done' : step.id === nextId ? 'next' : 'todo',
    }));
  });

  protected ask(request: StudioRequest): void {
    this.action.emit({ kind: 'prompt', request });
  }

  protected runStep(step: JourneyStep): void {
    switch (step.id) {
      case 'strategy':
        this.action.emit({ kind: 'voice' });
        return;
      case 'calendar':
        this.action.emit({ kind: step.state === 'done' ? 'plans' : 'newPlan' });
        return;
      default:
        // Visuels et vidéos se font PUBLICATION PAR PUBLICATION, depuis le
        // calendrier : c'est là que chaque post a son texte, sa date et son réseau.
        this.action.emit({ kind: this.liveItems().length ? 'plans' : 'newPlan' });
    }
  }
}
