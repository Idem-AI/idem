import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import {
  CommunicationPlan,
  Flyer,
  FlyerFormat,
  StudioMessage,
  StudioRequest,
  StudioThreadSummary,
} from '../../../../models/communication.model';
import { FontHints } from '@idem/shared-document-editor/angular';
import { VisualComposing } from '../visual-composing/visual-composing';
import { PromptBox } from '../prompt-box/prompt-box';
import { VisualDialog } from '../visual-dialog/visual-dialog';
import { VisualThumb } from '../visual-thumb/visual-thumb';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { CommunicationUrl, urlFlag, urlParam } from '../../url-state';

/**
 * Retouches proposées sous le dernier visuel.
 *
 * Après un premier visuel, la question devient « et maintenant, je dis quoi ? ».
 * Ces suggestions montrent ce qu'on PEUT demander, dans les mots de tous les
 * jours ; elles remplissent la saisie sans l'envoyer, comme les amorces.
 */
const FOLLOW_UPS = ['simpler', 'bigger', 'story', 'caption'] as const;

/**
 * Une carte de visuel dans le fil.
 *
 * Le moteur compose souvent DEUX propositions pour une demande : la retenue
 * (le visuel) et une autre, rangée dans `alternatives`. Les deux sont montrées
 * côte à côte ; cliquer l'autre la fait devenir le visuel.
 */
interface VisualCard {
  key: string;
  /** Ce que la vignette affiche (pour une autre proposition : le visuel, avec l'image de celle-ci). */
  shown: Flyer;
  /** Le visuel dont la carte fait partie. */
  visual: Flyer;
  /** Absent : c'est la proposition retenue. */
  alternativeId?: string;
}

interface MessageView {
  message: StudioMessage;
  cards: VisualCard[];
  /** Plus d'une proposition dans ce message : les étiquettes « Retenue » / « Garder celle-ci » ont un sens. */
  hasChoice: boolean;
}

/**
 * L'ATELIER — on décrit ce qu'on veut, le visuel sort à la charte.
 *
 * Plusieurs conversations par projet, comme dans une messagerie : l'historique
 * est une colonne à gauche (un panneau sur téléphone), la conversation ouverte
 * est dans l'adresse (`?chat=`). Une actualisation la retrouve.
 *
 * Converser ne coûte rien ; produire un visuel se facture. L'interface le dit
 * avant, pas après.
 *
 * On y arrive le plus souvent depuis l'accueil, où la demande a été tapée :
 * elle arrive par `prompt` et ouvre une NOUVELLE conversation.
 */
@Component({
  selector: 'app-studio-panel',
  imports: [
    TranslateModule,
    DatePipe,
    PromptBox,
    VisualComposing,
    VisualDialog,
    VisualThumb,
    IdemLoaderComponent,
  ],
  templateUrl: './studio-panel.html',
  styleUrl: './studio-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudioPanel {
  private readonly communication = inject(CommunicationService);
  private readonly translate = inject(TranslateService);
  private readonly url = inject(CommunicationUrl);

  readonly projectId = input.required<string>();
  /** Visuels déjà connus du parent — résolvent les `visualIds` des anciens messages. */
  readonly visuals = input<Flyer[]>([]);
  readonly plans = input<CommunicationPlan[]>([]);
  readonly fonts = input<FontHints>({});
  /**
   * Demande tapée sur l'accueil, à envoyer dès l'arrivée dans une nouvelle conversation.
   *
   * Jamais dans l'adresse : une actualisation ne doit pas refacturer le visuel.
   */
  readonly prompt = input<StudioRequest | null>(null);
  readonly promptHandled = output<void>();

  readonly visualCreated = output<Flyer>();
  readonly failed = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  protected readonly followUps = FOLLOW_UPS;

  /** La conversation ouverte : `?chat=`. Absente = une nouvelle conversation. */
  protected readonly chatId = urlParam<string | null>('chat', { fallback: null, push: true });
  /** L'historique ouvert en panneau, sur téléphone : `?history=1`. */
  protected readonly historyOpen = urlFlag('history', { push: true });

  protected readonly threads = signal<StudioThreadSummary[]>([]);
  protected readonly threadsLoading = signal(true);
  /** La conversation dont on demande la suppression (un second clic confirme). */
  protected readonly confirmDeleteId = signal<string | null>(null);

  /**
   * Format et nombre de propositions en cours de composition.
   *
   * Sert à l'écran d'attente : il prend la forme du visuel demandé dès la
   * première seconde, plutôt que d'afficher un disque qui tourne pendant deux
   * minutes — le moment précis où l'on quitte la page.
   */
  protected readonly composingFormat = signal<FlyerFormat>('square');
  protected readonly composingVariants = signal(1);
  protected readonly isComposing = signal(false);

  protected readonly messages = signal<StudioMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly isLoading = signal(false);
  protected readonly isSending = signal(false);
  protected readonly thinkingLabel = signal('');

  /**
   * La conversation que le fil AFFICHE. Elle suit `chatId`, sauf pendant le
   * premier tour d'une nouvelle conversation : son id arrive par le flux, et
   * l'adresse est alors réécrite sans recharger le fil.
   */
  private readonly shownThreadId = signal<string | null>(null);
  /**
   * La conversation du tour en cours (`null` : une conversation neuve dont l'id n'est pas encore
   * arrivé). Un seul tour à la fois : `isSending` verrouille l'envoi partout, pour ne pas lancer
   * un second achat ; l'attente ne s'affiche que dans la conversation du tour.
   */
  private readonly turnThreadId = signal<string | null>(null);
  protected readonly showsTurn = computed(
    () => this.isSending() && this.turnThreadId() === this.shownThreadId(),
  );

  /** Visuels produits dans cette session, avant que le parent ne les connaisse. */
  private readonly localVisuals = signal<Flyer[]>([]);

  /**
   * Visuel ouvert en grand.
   *
   * Les actions d'un visuel (télécharger, décliner, programmer, publier) vivent
   * dans cette fenêtre plutôt que sous chaque vignette du fil : une rangée de six
   * boutons par visuel rendait la conversation illisible, et c'est là qu'on
   * retrouve le survol qui désigne les éléments.
   */
  protected readonly openVisualId = signal<string | null>(null);
  protected readonly copiedId = signal<string | null>(null);
  /** L'autre proposition en train de devenir le visuel. */
  protected readonly choosingId = signal<string | null>(null);

  /** Table de résolution des visuels, locale d'abord (elle est plus fraîche). */
  private readonly visualIndex = computed(() => {
    const index = new Map<string, Flyer>();
    for (const visual of this.visuals()) index.set(visual.id, visual);
    for (const visual of this.localVisuals()) index.set(visual.id, visual);
    return index;
  });

  protected readonly view = computed<MessageView[]>(() => {
    const index = this.visualIndex();
    return this.messages().map((message) => {
      const visuals = (message.visualIds ?? [])
        .map((id) => index.get(id))
        .filter((visual): visual is Flyer => !!visual);
      const cards: VisualCard[] = visuals.flatMap((visual) => [
        { key: visual.id, shown: visual, visual },
        ...(visual.alternatives ?? [])
          .filter((alt) => !!alt.imageUrl)
          .map((alt) => ({
            key: alt.id,
            shown: { ...visual, id: alt.id, imageUrl: alt.imageUrl },
            visual,
            alternativeId: alt.id,
          })),
      ]);
      return { message, cards, hasChoice: cards.some((card) => !!card.alternativeId) };
    });
  });

  /** Le dernier message de l'assistant porte-t-il un visuel ? Alors on propose des retouches. */
  protected readonly canRetouch = computed(() => {
    const last = [...this.view()].reverse().find((item) => item.message.role === 'assistant');
    return !!last && last.cards.length > 0;
  });

  protected readonly openVisual = computed<Flyer | null>(() => {
    const id = this.openVisualId();
    return id ? (this.visualIndex().get(id) ?? null) : null;
  });

  /** La vignette d'une conversation de l'historique : son dernier visuel, s'il est connu. */
  protected coverOf(thread: StudioThreadSummary): Flyer | null {
    return thread.coverVisualId ? (this.visualIndex().get(thread.coverVisualId) ?? null) : null;
  }

  constructor() {
    // `effect` et non `ngOnInit` : `projectId` est une entrée signal, donc elle
    // peut arriver après la construction (le parent attend la vérification de la
    // charte avant de la fournir).
    effect(() => {
      const projectId = this.projectId();
      if (projectId) untracked(() => this.loadThreads(projectId));
    });

    // La conversation de l'adresse change (clic dans l'historique, Précédent, actualisation).
    effect(() => {
      const projectId = this.projectId();
      const chatId = this.chatId();
      if (!projectId) return;
      untracked(() => {
        // Une demande venue de l'accueil ouvre toujours une conversation neuve.
        if (this.prompt()) {
          this.sendPendingPrompt();
          return;
        }
        if (chatId === this.shownThreadId()) return;
        this.openThread(projectId, chatId);
      });
    });
  }

  // ── Conversations ────────────────────────────────────────────────────────

  private loadThreads(projectId: string): void {
    this.threadsLoading.set(true);
    this.communication.listStudioThreads(projectId).subscribe({
      next: (threads) => {
        this.threads.set(threads);
        this.threadsLoading.set(false);
      },
      error: () => {
        // L'historique illisible ne bloque pas l'atelier : on peut toujours écrire.
        this.threads.set([]);
        this.threadsLoading.set(false);
      },
    });
  }

  private openThread(projectId: string, threadId: string | null): void {
    this.shownThreadId.set(threadId);
    this.confirmDeleteId.set(null);
    if (!threadId) {
      this.messages.set([]);
      this.isLoading.set(false);
      return;
    }
    this.isLoading.set(true);
    this.communication.getStudioThread(projectId, threadId).subscribe({
      next: (thread) => {
        if (this.shownThreadId() !== threadId) return;
        this.messages.set(thread.messages || []);
        this.isLoading.set(false);
      },
      error: () => {
        if (this.shownThreadId() !== threadId) return;
        // Conversation supprimée ou lien périmé : on repart d'une conversation neuve.
        this.messages.set([]);
        this.isLoading.set(false);
        this.chatId.set(null);
        this.shownThreadId.set(null);
      },
    });
  }

  /** Ouvre une conversation de l'historique (le panneau du téléphone se referme). */
  protected selectThread(thread: StudioThreadSummary): void {
    this.historyOpen.set(false);
    if (thread.id !== this.chatId()) this.chatId.set(thread.id);
  }

  protected newConversation(): void {
    this.historyOpen.set(false);
    this.draft.set('');
    if (this.chatId() !== null) {
      this.chatId.set(null);
    } else if (this.shownThreadId() !== null || this.messages().length) {
      this.openThread(this.projectId(), null);
    }
  }

  protected toggleHistory(): void {
    this.historyOpen.update((open) => !open);
  }

  protected askDelete(thread: StudioThreadSummary): void {
    this.confirmDeleteId.set(thread.id);
  }

  protected cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  protected deleteThread(thread: StudioThreadSummary): void {
    this.confirmDeleteId.set(null);
    this.communication.deleteStudioThread(this.projectId(), thread.id).subscribe({
      next: () => {
        this.threads.update((threads) => threads.filter((item) => item.id !== thread.id));
        if (this.shownThreadId() === thread.id) this.newConversation();
      },
      error: (err) => this.failed.emit(err?.error?.message || 'studio-clear'),
    });
  }

  /** La conversation remonte en tête de l'historique (ou y entre), avec son titre et sa vignette. */
  private touchThread(summary: StudioThreadSummary): void {
    this.threads.update((threads) => [summary, ...threads.filter((item) => item.id !== summary.id)]);
  }

  // ── Fil ──────────────────────────────────────────────────────────────────

  /** Une demande de l'accueil : une conversation neuve, envoyée tout de suite. */
  private sendPendingPrompt(): void {
    const request = this.prompt();
    if (!request) return;
    this.promptHandled.emit();
    this.shownThreadId.set(null);
    this.messages.set([]);
    this.isLoading.set(false);
    if (this.chatId() !== null) this.url.write({ chat: null });
    this.send(request);
  }

  protected useFollowUp(key: string): void {
    this.draft.set(
      this.translate.instant(`dashboard.showCommunication.studio.followUps.${key}.text`) as string,
    );
  }

  protected send(request: StudioRequest): void {
    if ((!request.text && !request.attachments.length) || this.isSending()) return;

    const projectId = this.projectId();
    const threadId = this.shownThreadId();
    this.turnThreadId.set(threadId);
    this.isSending.set(true);
    this.thinkingLabel.set('dashboard.showCommunication.studio.thinking');

    // Le message de l'utilisateur est affiché tout de suite : attendre la réponse
    // du serveur pour l'afficher donne l'impression que la saisie a été perdue.
    const optimistic: StudioMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: request.text,
      ...(request.attachments.length ? { attachments: request.attachments } : {}),
      createdAt: new Date(),
    };
    this.messages.update((messages) => [...messages, optimistic]);

    /** Le fil regarde-t-il encore la conversation de ce tour ? */
    const watching = () => this.shownThreadId() === this.turnThreadId();

    this.communication
      .streamStudioMessage(projectId, {
        content: request.text,
        threadId,
        creativity: request.creativity,
        attachments: request.attachments,
      })
      .subscribe({
        next: (event) => {
          if (event.type === 'thread') {
            // La conversation neuve a son id : l'adresse la désigne, sans recharger le fil.
            const wasWatching = watching();
            this.turnThreadId.set(event.thread.id);
            this.touchThread(event.thread);
            if (wasWatching) {
              this.shownThreadId.set(event.thread.id);
              this.url.write({ chat: event.thread.id });
            }
          } else if (event.type === 'thinking') {
            if (!watching()) return;
            const step = event.label.split('.')[1];
            this.thinkingLabel.set(`dashboard.showCommunication.studio.${step}`);
            // Seule la composition mérite l'écran de fabrication : les autres
            // étapes durent quelques secondes et une ligne de texte suffit.
            this.isComposing.set(step === 'composing' || step === 'composingVariants');
            this.composingVariants.set(step === 'composingVariants' ? 3 : 1);
          } else if (event.type === 'visual') {
            this.composingFormat.set(event.visual.format);
            // Le visuel apparaît AVANT le message qui l'accompagne : c'est lui que
            // l'utilisateur attend, et il arrive plusieurs secondes plus tôt.
            this.localVisuals.update((visuals) => [...visuals, event.visual]);
            this.visualCreated.emit(event.visual);
          } else if (event.type === 'complete') {
            if (event.payload.thread) this.touchThread(event.payload.thread);
            if (watching()) {
              this.messages.update((messages) => [
                ...messages.filter((message) => message.id !== optimistic.id),
                event.payload.userMessage,
                event.payload.assistantMessage,
              ]);
            }
            this.endTurn();
          } else if (event.type === 'error') {
            if (event.code === 'payment_required') {
              this.needsCredits.emit({ cost: event.cost || 0, balance: event.balance || 0 });
            } else {
              this.failed.emit(event.message || 'studio');
            }
            this.endTurn();
          }
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || err?.message || 'studio');
          this.endTurn();
        },
        complete: () => this.endTurn(),
      });
  }

  private endTurn(): void {
    this.isSending.set(false);
    this.turnThreadId.set(null);
    this.thinkingLabel.set('');
    this.isComposing.set(false);
  }

  // ── Actions sur un visuel ────────────────────────────────────────────────

  protected openCard(card: VisualCard): void {
    if (card.alternativeId) {
      this.chooseAlternative(card);
      return;
    }
    this.openVisualId.set(card.visual.id);
  }

  /** L'autre proposition (déjà payée) devient le visuel ; la retenue passe à côté. */
  private chooseAlternative(card: VisualCard): void {
    const alternativeId = card.alternativeId;
    if (!alternativeId || this.choosingId()) return;
    this.choosingId.set(alternativeId);
    this.communication
      .chooseFlyerVariant(this.projectId(), card.visual.id, alternativeId)
      .subscribe({
        next: (updated) => {
          this.onVisualChanged(updated);
          this.choosingId.set(null);
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || 'variant');
          this.choosingId.set(null);
        },
      });
  }

  /** Retouché ou changé de proposition dans l'aperçu : le fil montre la nouvelle image. */
  protected onVisualChanged(updated: Flyer): void {
    this.localVisuals.update((visuals) => [
      ...visuals.filter((visual) => visual.id !== updated.id),
      updated,
    ]);
    this.visualCreated.emit(updated);
  }

  protected closeDialog(): void {
    this.openVisualId.set(null);
  }

  protected copy(text: string, id: string): void {
    if (!text || !navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.copiedId.set(id);
        setTimeout(() => this.copiedId.set(null), 2000);
      })
      .catch(() => {
        /* presse-papiers indisponible — silencieux */
      });
  }
}
