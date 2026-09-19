import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FontHints } from '../../../document-editor/models/editor.types';
import {
  CommunicationPlan,
  Flyer,
  FlyerFormat,
  Publication,
  VisualOrigin,
} from '../../../../models/communication.model';
import { FLYER_FORMATS, formatAspect } from '../../communication-ui';
import { VisualDialog } from '../visual-dialog/visual-dialog';

const ORIGINS: VisualOrigin[] = ['plan', 'studio', 'occasion'];

/**
 * MES VISUELS — tout ce qui a été produit, en un seul endroit.
 *
 * Répare le défaut le plus coûteux de la V1 : un visuel n'était atteignable qu'à
 * travers le contenu qui le possédait, si bien que régénérer le calendrier
 * rendait invisibles des visuels déjà payés. Ici, tout visuel reste accessible,
 * quelle que soit l'histoire de son contenu.
 *
 * L'écran ne fait que CHERCHER et MONTRER : tout ce qu'on peut faire d'un visuel
 * vit dans la fenêtre d'aperçu partagée, la même que dans le chat.
 */
@Component({
  selector: 'app-library-panel',
  imports: [FormsModule, TranslateModule, VisualDialog],
  templateUrl: './library-panel.html',
  styleUrl: './library-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPanel {
  readonly projectId = input.required<string>();
  readonly visuals = input<Flyer[]>([]);
  readonly plans = input<CommunicationPlan[]>([]);
  readonly publications = input<Publication[]>([]);
  readonly fonts = input<FontHints>({});

  readonly visualCreated = output<Flyer>();
  readonly publicationCreated = output<Publication>();
  readonly failed = output<string>();

  protected readonly formats = FLYER_FORMATS;
  protected readonly origins = ORIGINS;
  protected readonly formatAspect = formatAspect;

  protected readonly filterFormat = signal<FlyerFormat | 'all'>('all');
  protected readonly filterOrigin = signal<VisualOrigin | 'all'>('all');
  protected readonly filterPlanId = signal<string>('all');
  protected readonly openVisualId = signal<string | null>(null);

  protected readonly openVisual = computed<Flyer | null>(() => {
    const id = this.openVisualId();
    return id ? (this.visuals().find((visual) => visual.id === id) ?? null) : null;
  });

  /**
   * Visuels déjà publiés.
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

  protected isPublished(visualId: string): boolean {
    return this.publishedVisualIds().has(visualId);
  }

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
    this.openVisualId.set(visual.id);
  }

  protected close(): void {
    this.openVisualId.set(null);
  }

  /** Nom du planning d'un visuel — « — » quand il n'appartient à aucun. */
  protected planName(planId: string | undefined): string {
    if (!planId) return '—';
    return this.plans().find((plan) => plan.id === planId)?.name || '—';
  }
}
