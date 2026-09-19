import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import {
  CommunicationPlan,
  Flyer,
  FlyerFormat,
  Publication,
  SocialNetwork,
  VisualOrigin,
} from '../../../../models/communication.model';
import { FLYER_FORMATS, formatAspect } from '../../communication-ui';

const NETWORKS: SocialNetwork[] = ['linkedin', 'x'];
const ORIGINS: VisualOrigin[] = ['plan', 'studio', 'occasion'];

/**
 * LA BIBLIOTHÈQUE — tous les visuels du projet, en un seul endroit.
 *
 * Elle répare le défaut le plus coûteux de la V1 : un visuel n'était atteignable
 * qu'à travers le contenu qui le possédait, si bien que régénérer le calendrier
 * rendait invisibles des visuels déjà payés. Ici, tout visuel reste accessible,
 * quelle que soit l'histoire de son contenu.
 */
@Component({
  selector: 'app-library-panel',
  imports: [FormsModule, TranslateModule],
  templateUrl: './library-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPanel {
  private readonly communication = inject(CommunicationService);
  private readonly router = inject(Router);

  readonly projectId = input.required<string>();
  readonly visuals = input<Flyer[]>([]);
  readonly plans = input<CommunicationPlan[]>([]);
  readonly publications = input<Publication[]>([]);

  readonly visualCreated = output<Flyer>();
  readonly publicationCreated = output<Publication>();
  readonly failed = output<string>();

  protected readonly formats = FLYER_FORMATS;
  protected readonly origins = ORIGINS;
  protected readonly networks = NETWORKS;
  protected readonly formatAspect = formatAspect;

  protected readonly filterFormat = signal<FlyerFormat | 'all'>('all');
  protected readonly filterOrigin = signal<VisualOrigin | 'all'>('all');
  protected readonly filterPlanId = signal<string>('all');

  protected readonly selected = signal<Flyer | null>(null);
  protected readonly declinatingId = signal<string | null>(null);
  protected readonly publishingKey = signal<string | null>(null);

  /**
   * Visuels déjà passés par une publication.
   *
   * Affiché sur la vignette : sans ce repère, rien ne distingue un visuel publié
   * d'un visuel oublié, et l'utilisateur republie ou hésite.
   */
  protected readonly publishedVisualIds = computed(() => {
    const ids = new Set<string>();
    for (const publication of this.publications()) {
      if (publication.flyerId && publication.status === 'published') ids.add(publication.flyerId);
    }
    return ids;
  });

  protected isPublished(visualId: string): boolean {
    return this.publishedVisualIds().has(visualId);
  }

  protected readonly plannedPlans = computed(() =>
    this.plans().filter((plan) => plan.status !== 'archived'),
  );

  protected readonly filtered = computed(() => {
    const format = this.filterFormat();
    const origin = this.filterOrigin();
    const planId = this.filterPlanId();
    return this.visuals().filter((visual) => {
      if (format !== 'all' && visual.format !== format) return false;
      if (origin !== 'all' && (visual.origin || 'plan') !== origin) return false;
      if (planId !== 'all' && visual.planId !== planId) return false;
      return true;
    });
  });

  protected setFilterFormat(value: string): void {
    this.filterFormat.set(value as FlyerFormat | 'all');
  }

  protected setFilterOrigin(value: string): void {
    this.filterOrigin.set(value as VisualOrigin | 'all');
  }

  protected setFilterPlan(value: string): void {
    this.filterPlanId.set(value);
  }

  protected open(visual: Flyer): void {
    this.selected.set(visual);
  }

  protected close(): void {
    this.selected.set(null);
  }

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
        for (const item of created) this.visualCreated.emit(item);
        this.declinatingId.set(null);
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || 'declinate');
        this.declinatingId.set(null);
      },
    });
  }

  /**
   * Publication assistée : Idem prépare la légende et le visuel, ouvre le
   * composeur du réseau, et l'utilisateur publie. Elle exige un contenu
   * propriétaire — c'est lui qui porte la légende et le rendez-vous. Un visuel
   * d'atelier doit donc d'abord être programmé.
   */
  protected publish(visual: Flyer, network: SocialNetwork): void {
    if (!visual.contentId || this.publishingKey()) return;
    const key = `${visual.id}:${network}`;
    this.publishingKey.set(key);

    this.communication
      .preparePublication(this.projectId(), {
        contentId: visual.contentId,
        network,
        flyerId: visual.id,
      })
      .subscribe({
        next: ({ publication, share }) => {
          this.publicationCreated.emit(publication);
          this.publishingKey.set(null);
          if (share.caption && navigator.clipboard) {
            navigator.clipboard.writeText(share.caption).catch(() => undefined);
          }
          if (share.shareUrl) window.open(share.shareUrl, '_blank', 'noopener');
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || 'publish');
          this.publishingKey.set(null);
        },
      });
  }

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

  /** Nom de la période d'un visuel — « — » quand il n'appartient à aucune. */
  protected planName(planId: string | undefined): string {
    if (!planId) return '—';
    return this.plans().find((plan) => plan.id === planId)?.name || '—';
  }
}
