import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import {
  CommunicationPlan,
  Flyer,
  FlyerFormat,
  StudioMessage,
} from '../../../../models/communication.model';
import { FontHints } from '../../../document-editor/models/editor.types';
import { VisualComposing } from '../visual-composing/visual-composing';
import { VisualDialog } from '../visual-dialog/visual-dialog';
import { VisualThumb } from '../visual-thumb/visual-thumb';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/** Amorces proposées sur un fil vide — des phrases, pas des catégories. */
const STARTERS = ['announce', 'promotion', 'celebration', 'recruitment'] as const;

/**
 * L'ATELIER — on décrit ce qu'on veut, le visuel sort à la charte.
 *
 * C'est la porte d'entrée du module. Avant, obtenir un visuel supposait une
 * stratégie (40 crédits) puis un calendrier (15) puis le choix d'un contenu :
 * trois écrans et 55 crédits avant de voir quoi que ce soit. Ici, une phrase.
 *
 * Converser ne coûte rien ; produire un visuel se facture. L'interface le dit
 * avant, pas après.
 */
@Component({
  selector: 'app-studio-panel',
  imports: [FormsModule, TranslateModule, VisualComposing, VisualDialog, VisualThumb, IdemLoaderComponent],
  templateUrl: './studio-panel.html',
  styleUrl: './studio-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudioPanel {
  private readonly communication = inject(CommunicationService);
  private readonly translate = inject(TranslateService);

  readonly projectId = input.required<string>();
  /** Visuels déjà connus du parent — résolvent les `visualIds` des anciens messages. */
  readonly visuals = input<Flyer[]>([]);
  readonly plans = input<CommunicationPlan[]>([]);
  readonly fonts = input<FontHints>({});

  readonly visualCreated = output<Flyer>();
  readonly failed = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  protected readonly starters = STARTERS;

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
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly thinkingLabel = signal('');

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

  protected readonly openVisual = computed<Flyer | null>(() => {
    const id = this.openVisualId();
    return id ? (this.visualIndex().get(id) ?? null) : null;
  });

  /** Table de résolution des visuels, locale d'abord (elle est plus fraîche). */
  private readonly visualIndex = computed(() => {
    const index = new Map<string, Flyer>();
    for (const visual of this.visuals()) index.set(visual.id, visual);
    for (const visual of this.localVisuals()) index.set(visual.id, visual);
    return index;
  });

  constructor() {
    // `effect` et non `ngOnInit` : `projectId` est une entrée signal, donc elle
    // peut arriver après la construction (le parent attend la vérification de la
    // charte avant de la fournir).
    effect(() => {
      const projectId = this.projectId();
      if (projectId) this.load(projectId);
    });
  }

  private load(projectId: string): void {
    this.isLoading.set(true);
    this.communication.getStudio(projectId).subscribe({
      next: (conversation) => {
        this.messages.set(conversation.messages || []);
        this.isLoading.set(false);
      },
      error: () => {
        // Un fil illisible ne doit pas bloquer l'atelier : on repart d'un fil vide.
        this.messages.set([]);
        this.isLoading.set(false);
      },
    });
  }

  protected visualsOf(message: StudioMessage): Flyer[] {
    if (!message.visualIds?.length) return [];
    const index = this.visualIndex();
    return message.visualIds
      .map((id) => index.get(id))
      .filter((visual): visual is Flyer => !!visual);
  }

  /**
   * Remplit la saisie avec une amorce traduite, SANS l'envoyer.
   *
   * Ne pas envoyer d'emblée est délibéré : une amorce est un point de départ à
   * compléter (« …pour dire qu'on ouvre le samedi »), et un envoi immédiat
   * facturerait un visuel que l'utilisateur n'a pas fini de décrire.
   */
  protected useStarter(key: string): void {
    this.draft.set(
      this.translate.instant(`dashboard.showCommunication.studio.starters.${key}`) as string,
    );
  }

  /**
   * Entrée = envoyer, Maj+Entrée = retour à la ligne.
   *
   * Un visuel se décrit parfois en deux phrases : interdire le retour à la ligne
   * forcerait à tout écrire d'un trait, et envoyer sur Maj+Entrée enverrait des
   * messages incomplets — donc facturerait des visuels à moitié décrits.
   */
  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    event.preventDefault();
    this.send();
  }

  protected send(): void {
    const content = this.draft().trim();
    if (!content || this.isSending()) return;

    const projectId = this.projectId();
    this.isSending.set(true);
    this.thinkingLabel.set('dashboard.showCommunication.studio.thinking');
    this.draft.set('');

    // Le message de l'utilisateur est affiché tout de suite : attendre la réponse
    // du serveur pour l'afficher donne l'impression que la saisie a été perdue.
    const optimistic: StudioMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    this.messages.update((messages) => [...messages, optimistic]);

    this.communication.streamStudioMessage(projectId, content).subscribe({
      next: (event) => {
        if (event.type === 'thinking') {
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
          this.messages.update((messages) => [
            ...messages.filter((message) => message.id !== optimistic.id),
            event.payload.userMessage,
            event.payload.assistantMessage,
          ]);
          this.isSending.set(false);
          this.thinkingLabel.set('');
          this.isComposing.set(false);
        } else if (event.type === 'error') {
          if (event.code === 'payment_required') {
            this.needsCredits.emit({ cost: event.cost || 0, balance: event.balance || 0 });
          } else {
            this.failed.emit(event.message || 'studio');
          }
          this.isSending.set(false);
          this.thinkingLabel.set('');
          this.isComposing.set(false);
        }
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || err?.message || 'studio');
        this.isSending.set(false);
        this.thinkingLabel.set('');
        this.isComposing.set(false);
      },
      complete: () => {
        this.isSending.set(false);
        this.thinkingLabel.set('');
        this.isComposing.set(false);
      },
    });
  }

  protected clear(): void {
    this.communication.clearStudio(this.projectId()).subscribe({
      next: () => this.messages.set([]),
      error: (err) => this.failed.emit(err?.error?.message || 'studio-clear'),
    });
  }

  // ── Actions sur un visuel ────────────────────────────────────────────────

  protected openDialog(visual: Flyer): void {
    this.openVisualId.set(visual.id);
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
