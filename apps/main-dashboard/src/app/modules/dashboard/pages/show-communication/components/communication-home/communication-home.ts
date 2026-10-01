import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CommunicationPlan,
  CommunicationStrategy,
  ContentIdea,
  Flyer,
  Publication,
} from '../../../../models/communication.model';
import { channelIcon, channelLabelKey, todayIso } from '../../communication-ui';
import { VisualThumb } from '../visual-thumb/visual-thumb';

/** Les étapes du parcours, dans l'ordre où on les conseille. */
export type JourneyStepId = 'voice' | 'plan' | 'visuals' | 'publish';

export type JourneyStepState = 'done' | 'next' | 'todo';

interface JourneyStep {
  id: JourneyStepId;
  icon: string;
  state: JourneyStepState;
  /** Avancement « 3 / 8 » quand l'étape se compte, sinon absent. */
  progress?: { done: number; total: number };
}

/** Une publication à venir, avec de quoi la retrouver dans son planning. */
interface UpcomingPost {
  planId: string;
  item: ContentIdea;
  hasVisual: boolean;
  /** « Aujourd'hui », « Demain » — sinon la date écrite. */
  whenKey: string | null;
  whenLabel: string;
}

/** Ce que l'accueil demande à la coquille de faire. */
export type HomeAction =
  | { kind: 'voice' }
  | { kind: 'studio' }
  | { kind: 'library' }
  | { kind: 'plans' }
  | { kind: 'newPlan' }
  | { kind: 'openPost'; planId: string; itemId: string };

/**
 * ACCUEIL — où j'en suis, et quoi faire ensuite.
 *
 * Arriver directement dans le fil de l'atelier déroutait : face à une zone de
 * saisie, quelqu'un qui ne vient pas de la tech tape au hasard, ou repart. Et
 * « Créer / Mon planning / Mes visuels » ne disait pas dans quel ordre s'en
 * servir. Cet écran répond à la seule question qu'on se pose en arrivant :
 * « qu'est-ce que je fais maintenant ? ».
 *
 * Le parcours se lit sur les DONNÉES, jamais sur une case cochée à la main :
 * une étape est faite quand son résultat existe. Aucune étape n'est
 * verrouillée — imposer la stratégie avant le premier visuel était la première
 * raison pour laquelle le module n'était pas utilisé —, on signale seulement
 * la suivante conseillée.
 */
@Component({
  selector: 'app-communication-home',
  imports: [TranslateModule, VisualThumb],
  templateUrl: './communication-home.html',
  styleUrl: './communication-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunicationHome {
  private readonly translate = inject(TranslateService);

  readonly strategy = input<CommunicationStrategy | null>(null);
  readonly plans = input<CommunicationPlan[]>([]);
  readonly visuals = input<Flyer[]>([]);
  readonly publications = input<Publication[]>([]);

  readonly action = output<HomeAction>();

  protected readonly channelIcon = channelIcon;
  protected readonly channelLabelKey = channelLabelKey;

  /** Plannings vivants : un planning archivé ne compte plus dans l'avancement. */
  private readonly livePlans = computed(() =>
    this.plans().filter((plan) => plan.status !== 'archived'),
  );

  private readonly liveItems = computed(() => this.livePlans().flatMap((plan) => plan.items));

  private readonly visualIds = computed(() => new Set(this.visuals().map((visual) => visual.id)));

  /** Visuels déjà publiés, d'après le journal des publications. */
  private readonly publishedVisualIds = computed(() => {
    const ids = new Set<string>();
    for (const publication of this.publications()) {
      if (publication.flyerId && publication.status === 'published') ids.add(publication.flyerId);
    }
    return ids;
  });

  private hasVisual(item: ContentIdea): boolean {
    const known = this.visualIds();
    return !!item.flyerIds?.some((id) => known.has(id));
  }

  private isPublished(item: ContentIdea): boolean {
    if (item.status === 'published') return true;
    const published = this.publishedVisualIds();
    return !!item.flyerIds?.some((id) => published.has(id));
  }

  protected readonly steps = computed<JourneyStep[]>(() => {
    const items = this.liveItems();
    const withVisual = items.filter((item) => this.hasVisual(item)).length;
    const published = items.filter((item) => this.isPublished(item)).length;

    const done: Record<JourneyStepId, boolean> = {
      voice: !!this.strategy(),
      plan: items.length > 0,
      visuals: items.length > 0 && withVisual === items.length,
      publish: items.length > 0 && published === items.length,
    };

    const order: { id: JourneyStepId; icon: string; progress?: JourneyStep['progress'] }[] = [
      { id: 'voice', icon: 'pi pi-user-edit' },
      { id: 'plan', icon: 'pi pi-calendar' },
      {
        id: 'visuals',
        icon: 'pi pi-image',
        progress: items.length ? { done: withVisual, total: items.length } : undefined,
      },
      {
        id: 'publish',
        icon: 'pi pi-send',
        progress: items.length ? { done: published, total: items.length } : undefined,
      },
    ];

    const nextId = order.find((step) => !done[step.id])?.id;
    return order.map((step) => ({
      ...step,
      state: done[step.id] ? 'done' : step.id === nextId ? 'next' : 'todo',
    }));
  });

  protected readonly nextStep = computed(() => this.steps().find((step) => step.state === 'next'));

  protected readonly doneCount = computed(
    () => this.steps().filter((step) => step.state === 'done').length,
  );

  /**
   * Les prochaines publications, datées d'aujourd'hui ou plus tard.
   *
   * C'est ce qu'on vient chercher au quotidien une fois le calendrier fait :
   * « qu'est-ce que je publie aujourd'hui ? ». Les publiées sont écartées.
   */
  protected readonly upcoming = computed<UpcomingPost[]>(() => {
    const today = todayIso();
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);

    return this.livePlans()
      .flatMap((plan) => plan.items.map((item) => ({ plan, item })))
      .filter(({ item }) => {
        const date = (item.scheduledFor || '').slice(0, 10);
        return date >= today && !this.isPublished(item);
      })
      .sort((a, b) => a.item.scheduledFor.localeCompare(b.item.scheduledFor))
      .slice(0, 4)
      .map(({ plan, item }) => {
        const date = item.scheduledFor.slice(0, 10);
        const whenKey = date === today ? 'today' : date === tomorrowIso ? 'tomorrow' : null;
        return {
          planId: plan.id,
          item,
          hasVisual: this.hasVisual(item),
          whenKey,
          whenLabel: new Date(`${date}T00:00:00Z`).toLocaleDateString(this.translate.currentLang, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          }),
        };
      });
  });

  /** Les derniers visuels produits, du plus récent au plus ancien. */
  protected readonly recentVisuals = computed(() => this.visuals().slice(-4).reverse());

  protected runStep(step: JourneyStep): void {
    switch (step.id) {
      case 'voice':
        this.action.emit({ kind: 'voice' });
        return;
      case 'plan':
        this.action.emit({ kind: step.state === 'done' ? 'plans' : 'newPlan' });
        return;
      default:
        // Visuels et publication se font PUBLICATION PAR PUBLICATION, depuis le
        // calendrier : c'est là que chaque post a son texte, sa date et son réseau.
        this.action.emit({ kind: this.liveItems().length ? 'plans' : 'newPlan' });
    }
  }

  protected openPost(post: UpcomingPost): void {
    this.action.emit({ kind: 'openPost', planId: post.planId, itemId: post.item.id });
  }

  protected go(kind: 'studio' | 'library' | 'plans' | 'newPlan'): void {
    this.action.emit({ kind });
  }
}
