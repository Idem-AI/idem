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
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import {
  CommunicationPlan,
  Flyer,
  FlyerFormat,
  StudioMessage,
} from '../../../../models/communication.model';
import { FLYER_FORMATS, formatAspect, todayIso } from '../../communication-ui';

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
  imports: [FormsModule, TranslateModule],
  templateUrl: './studio-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudioPanel {
  private readonly communication = inject(CommunicationService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly projectId = input.required<string>();
  /** Visuels déjà connus du parent — résolvent les `visualIds` des anciens messages. */
  readonly visuals = input<Flyer[]>([]);
  readonly plans = input<CommunicationPlan[]>([]);

  readonly visualCreated = output<Flyer>();
  readonly failed = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  protected readonly formats = FLYER_FORMATS;
  protected readonly formatAspect = formatAspect;
  protected readonly starters = STARTERS;
  protected readonly today = todayIso();

  protected readonly messages = signal<StudioMessage[]>([]);
  protected readonly draft = signal('');
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly thinkingLabel = signal('');

  /** Visuels produits dans cette session, avant que le parent ne les connaisse. */
  private readonly localVisuals = signal<Flyer[]>([]);

  /** Programmation en cours : id du visuel → formulaire ouvert. */
  protected readonly schedulingVisualId = signal<string | null>(null);
  protected readonly scheduleDate = signal(todayIso());
  protected readonly schedulePlanId = signal('');
  protected readonly copiedId = signal<string | null>(null);
  protected readonly declinatingId = signal<string | null>(null);

  protected readonly schedulablePlans = computed(() =>
    this.plans().filter((plan) => plan.status !== 'archived'),
  );

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
          this.thinkingLabel.set(`dashboard.showCommunication.studio.${event.label.split('.')[1]}`);
        } else if (event.type === 'visual') {
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
        } else if (event.type === 'error') {
          if (event.code === 'payment_required') {
            this.needsCredits.emit({ cost: event.cost || 0, balance: event.balance || 0 });
          } else {
            this.failed.emit(event.message || 'studio');
          }
          this.isSending.set(false);
          this.thinkingLabel.set('');
        }
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || err?.message || 'studio');
        this.isSending.set(false);
        this.thinkingLabel.set('');
      },
      complete: () => {
        this.isSending.set(false);
        this.thinkingLabel.set('');
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

  protected openEditor(visualId: string): void {
    this.router.navigate(['/project/communication/flyer/edit'], {
      queryParams: { flyerId: visualId },
    });
  }

  protected declinate(visual: Flyer, format: FlyerFormat): void {
    if (this.declinatingId()) return;
    this.declinatingId.set(visual.id);

    this.communication.declinateVisual(this.projectId(), visual.id, [format]).subscribe({
      next: (created) => {
        this.localVisuals.update((visuals) => [...visuals, ...created]);
        for (const item of created) this.visualCreated.emit(item);
        this.declinatingId.set(null);
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || 'declinate');
        this.declinatingId.set(null);
      },
    });
  }

  protected openSchedule(visualId: string): void {
    this.schedulingVisualId.set(visualId);
    this.scheduleDate.set(todayIso());
    this.schedulePlanId.set(this.schedulablePlans()[0]?.id || '');
  }

  protected cancelSchedule(): void {
    this.schedulingVisualId.set(null);
  }

  protected confirmSchedule(): void {
    const visualId = this.schedulingVisualId();
    const planId = this.schedulePlanId();
    const date = this.scheduleDate();
    if (!visualId || !planId || !date) return;

    this.communication.scheduleVisual(this.projectId(), visualId, { planId, date }).subscribe({
      next: () => this.schedulingVisualId.set(null),
      error: (err) => {
        this.failed.emit(err?.error?.message || 'schedule');
        this.schedulingVisualId.set(null);
      },
    });
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

  /**
   * Enregistre le PNG d'un visuel.
   *
   * On télécharge le blob plutôt que de poser un `<a download>` sur l'URL : le
   * PNG est servi par l'API, et un lien direct ouvrirait un onglet au lieu
   * d'enregistrer le fichier.
   */
  protected download(visual: Flyer): void {
    if (!visual.imageUrl) return;
    this.communication.downloadFlyerImage(visual.imageUrl).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${visual.id}.png`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.failed.emit(err?.error?.message || 'download'),
    });
  }
}
