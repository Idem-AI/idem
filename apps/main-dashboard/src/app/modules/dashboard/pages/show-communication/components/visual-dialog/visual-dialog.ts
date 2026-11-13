import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { FontHints } from '@idem/shared-document-editor/angular';
import {
  CommunicationPlan,
  Flyer,
  FlyerFormat,
  Publication,
  SocialNetwork,
} from '../../../../models/communication.model';
import { FLYER_FORMATS, channelIcon, todayIso } from '../../communication-ui';
import { VisualPreview } from '../visual-preview/visual-preview';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

const NETWORKS: SocialNetwork[] = ['linkedin', 'x'];

/**
 * Un visuel en grand, avec tout ce qu'on peut en faire.
 *
 * Ouverte depuis une vignette — dans l'atelier comme dans « Mes visuels ». Une
 * seule fenêtre partagée plutôt qu'un aperçu par écran, pour deux raisons :
 *
 *  - **le geste est le même partout** : survoler désigne, cliquer propose
 *    « Modifier ». Une interaction qui change d'un écran à l'autre s'apprend
 *    deux fois ;
 *  - **un seul aperçu vivant à la fois** : l'aperçu interactif est une iframe,
 *    et en poser une par vignette dans un fil de conversation ralentirait la page
 *    à chaque visuel produit.
 */
@Component({
  selector: 'app-visual-dialog',
  imports: [FormsModule, TranslateModule, VisualPreview, IdemLoaderComponent],
  templateUrl: './visual-dialog.html',
  styleUrl: './visual-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisualDialog {
  private readonly communication = inject(CommunicationService);

  readonly projectId = input.required<string>();
  readonly visual = input.required<Flyer>();
  readonly fonts = input<FontHints>({});
  /** Plannings où ce visuel peut être programmé. */
  readonly plans = input<CommunicationPlan[]>([]);

  readonly closed = output<void>();
  /** Le visuel a changé ici (une autre proposition choisie) : l'écran parent remplace le sien. */
  readonly visualChanged = output<Flyer>();
  readonly visualCreated = output<Flyer>();
  readonly publicationCreated = output<Publication>();
  readonly failed = output<string>();

  protected readonly formats = FLYER_FORMATS;
  protected readonly networks = NETWORKS;
  protected readonly channelIcon = channelIcon;

  /** Le visuel montré : celui reçu, puis celui choisi parmi les propositions. */
  protected readonly shown = linkedSignal(() => this.visual());
  protected readonly choosingId = signal<string | null>(null);
  protected readonly isBusy = signal(false);
  protected readonly publishingNetwork = signal<SocialNetwork | null>(null);
  protected readonly scheduling = signal(false);
  protected readonly scheduleDate = signal(todayIso());
  protected readonly schedulePlanId = signal('');

  protected readonly schedulablePlans = computed(() =>
    this.plans().filter((plan) => plan.status !== 'archived'),
  );

  /** Publier suppose une publication planifiée : c'est elle qui porte la légende. */
  protected readonly canPublish = computed(() => !!this.shown().contentId);

  protected close(): void {
    this.closed.emit();
  }

  /** Une autre composition proposée (déjà payée) devient le visuel ; l'actuelle rejoint les propositions. */
  protected chooseProposal(variantId: string): void {
    if (this.choosingId()) return;
    this.choosingId.set(variantId);
    this.communication.chooseFlyerVariant(this.projectId(), this.shown().id, variantId).subscribe({
      next: (updated) => {
        this.shown.set(updated);
        this.visualChanged.emit(updated);
        this.choosingId.set(null);
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || 'variant');
        this.choosingId.set(null);
      },
    });
  }

  protected download(): void {
    const visual = this.shown();
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

  protected declinate(format: FlyerFormat): void {
    if (this.isBusy()) return;
    this.isBusy.set(true);
    this.communication.declinateVisual(this.projectId(), this.shown().id, [format]).subscribe({
      next: (created) => {
        for (const item of created) this.visualCreated.emit(item);
        this.isBusy.set(false);
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || 'declinate');
        this.isBusy.set(false);
      },
    });
  }

  protected openSchedule(): void {
    this.scheduling.set(true);
    this.scheduleDate.set(todayIso());
    this.schedulePlanId.set(this.schedulablePlans()[0]?.id || '');
  }

  protected cancelSchedule(): void {
    this.scheduling.set(false);
  }

  protected confirmSchedule(): void {
    const planId = this.schedulePlanId();
    const date = this.scheduleDate();
    if (!planId || !date) return;
    this.isBusy.set(true);
    this.communication
      .scheduleVisual(this.projectId(), this.shown().id, { planId, date })
      .subscribe({
        next: () => {
          this.scheduling.set(false);
          this.isBusy.set(false);
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || 'schedule');
          this.isBusy.set(false);
        },
      });
  }

  /**
   * Publication assistée : Idem copie la légende et ouvre le réseau ; c'est
   * l'utilisateur qui publie. Rien n'est envoyé en son nom.
   */
  protected publish(network: SocialNetwork): void {
    const contentId = this.shown().contentId;
    if (!contentId || this.publishingNetwork()) return;
    this.publishingNetwork.set(network);

    this.communication
      .preparePublication(this.projectId(), {
        contentId,
        network,
        flyerId: this.shown().id,
      })
      .subscribe({
        next: ({ publication, share }) => {
          this.publicationCreated.emit(publication);
          this.publishingNetwork.set(null);
          if (share.caption && navigator.clipboard) {
            navigator.clipboard.writeText(share.caption).catch(() => undefined);
          }
          if (share.shareUrl) window.open(share.shareUrl, '_blank', 'noopener');
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || 'publish');
          this.publishingNetwork.set(null);
        },
      });
  }
}
