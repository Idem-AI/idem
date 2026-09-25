import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { FontHints } from '../../../document-editor/models/editor.types';
import {
  CommunicationPlan,
  ContentChannel,
  ContentIdea,
  Flyer,
} from '../../../../models/communication.model';
import {
  channelIcon,
  formatRange,
  groupByWeek,
  planStatusPillClass,
  statusPillClass,
  todayIso,
} from '../../communication-ui';
import { ContentDetail } from '../content-detail/content-detail';
import { PlanWizard, PlanWizardResult } from '../plan-wizard/plan-wizard';
import { VisualThumb } from '../visual-thumb/visual-thumb';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';

/** Une case du calendrier mensuel. */
interface DayCell {
  iso: string;
  day: number;
  inPeriod: boolean;
  isToday: boolean;
  items: ContentIdea[];
}

interface MonthView {
  label: string;
  weeks: DayCell[][];
}

/**
 * MON PLANNING — ce qu'il y a à publier, et quand.
 *
 * Remplace l'onglet « Calendrier », qui ne savait produire qu'« à partir
 * d'aujourd'hui, sur 4 semaines » et écrasait le précédent à chaque
 * régénération. Les plannings s'empilent désormais : « Novembre » et
 * « Lancement boutique » coexistent, et régénérer l'un ne touche pas l'autre.
 *
 * Deux gestes structurent l'écran, et deux seulement :
 *  - une carte se CLIQUE pour voir tout ce qu'elle contient (texte du post,
 *    mots-clés, date) et le corriger — ces informations étaient produites et
 *    payées, mais restaient invisibles derrière un titre ;
 *  - un planning se CRÉE par trois questions, pas par un formulaire.
 */
@Component({
  selector: 'app-plan-panel',
  imports: [TranslateModule, ContentDetail, PlanWizard, VisualThumb, IdemLoaderComponent],
  templateUrl: './plan-panel.html',
  styleUrls: ['./plan-panel.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanPanel {
  private readonly communication = inject(CommunicationService);
  private readonly translate = inject(TranslateService);

  readonly projectId = input.required<string>();
  readonly plans = input<CommunicationPlan[]>([]);
  /** Réseaux déjà priorisés pour cette marque — présélectionnés à la création. */
  readonly suggestedChannels = input<ContentChannel[]>([]);
  readonly visuals = input<Flyer[]>([]);
  readonly fonts = input<FontHints>({});

  readonly plansChange = output<CommunicationPlan[]>();
  readonly visualCreated = output<Flyer>();
  readonly failed = output<string>();

  protected readonly channelIcon = channelIcon;
  protected readonly statusPillClass = statusPillClass;
  protected readonly planStatusPillClass = planStatusPillClass;

  // ── Sélection et vues ────────────────────────────────────────────────────
  protected readonly selectedPlanId = signal<string | null>(null);
  protected readonly view = signal<'weeks' | 'month'>('weeks');
  protected readonly showArchived = signal(false);
  protected readonly showWizard = signal(false);
  /** Publication ouverte en détail. */
  protected readonly openItemId = signal<string | null>(null);

  protected readonly visiblePlans = computed(() =>
    this.plans().filter((plan) => this.showArchived() || plan.status !== 'archived'),
  );

  /**
   * Planning ouvert : celui choisi, sinon le premier non archivé.
   *
   * Le tri vient du serveur (actifs d'abord) : ouvrir le premier revient donc à
   * ouvrir celui en cours, ce que l'utilisateur attend en arrivant.
   */
  protected readonly selectedPlan = computed<CommunicationPlan | null>(() => {
    const plans = this.visiblePlans();
    const id = this.selectedPlanId();
    return plans.find((plan) => plan.id === id) ?? plans[0] ?? null;
  });

  /** La publication ouverte, relue dans le planning pour rester à jour. */
  protected readonly openItem = computed<ContentIdea | null>(() => {
    const id = this.openItemId();
    if (!id) return null;
    return this.selectedPlan()?.items.find((item) => item.id === id) ?? null;
  });

  protected readonly weeks = computed(() => groupByWeek(this.selectedPlan()?.items ?? []));

  /** Dates du planning ouvert, écrites en clair. */
  protected readonly selectedRange = computed(() => {
    const plan = this.selectedPlan();
    return plan ? formatRange(plan.period.start, plan.period.end, this.translate.currentLang) : '';
  });

  /** Le calendrier, mois par mois, sur l'étendue du planning. */
  protected readonly months = computed<MonthView[]>(() => {
    const plan = this.selectedPlan();
    if (!plan) return [];

    const byDate = new Map<string, ContentIdea[]>();
    for (const item of plan.items) {
      const key = (item.scheduledFor || '').slice(0, 10);
      const list = byDate.get(key) ?? [];
      list.push(item);
      byDate.set(key, list);
    }

    const today = todayIso();
    const start = new Date(`${plan.period.start}T00:00:00Z`);
    const end = new Date(`${plan.period.end}T00:00:00Z`);
    const months: MonthView[] = [];

    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

      // Semaine commençant le lundi : `getUTCDay()` rend 0 pour dimanche, d'où le
      // décalage. Sans lui, la grille commencerait un dimanche — pas la
      // convention des pays où Idem est utilisé.
      const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

      const cells: DayCell[] = [];
      for (let blank = 0; blank < firstWeekday; blank++) {
        cells.push({ iso: '', day: 0, inPeriod: false, isToday: false, items: [] });
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const iso = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
        cells.push({
          iso,
          day,
          inPeriod: iso >= plan.period.start && iso <= plan.period.end,
          isToday: iso === today,
          items: byDate.get(iso) ?? [],
        });
      }
      while (cells.length % 7 !== 0) {
        cells.push({ iso: '', day: 0, inPeriod: false, isToday: false, items: [] });
      }

      const weeks: DayCell[][] = [];
      for (let index = 0; index < cells.length; index += 7) {
        weeks.push(cells.slice(index, index + 7));
      }

      months.push({
        label: cursor.toLocaleDateString(this.translate.currentLang, {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        weeks,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return months;
  });

  // ── Génération ──────────────────────────────────────────────────────────
  protected readonly generatingPlanId = signal<string | null>(null);
  protected readonly stepLabel = signal('');

  // ==========================================================================
  // Navigation
  // ==========================================================================

  protected selectPlan(planId: string): void {
    this.selectedPlanId.set(planId);
    this.openItemId.set(null);
  }

  protected setView(view: 'weeks' | 'month'): void {
    this.view.set(view);
  }

  protected toggleArchived(): void {
    this.showArchived.update((value) => !value);
  }

  protected openDetail(item: ContentIdea): void {
    this.openItemId.set(item.id);
  }

  protected closeDetail(): void {
    this.openItemId.set(null);
  }

  // ==========================================================================
  // Création
  // ==========================================================================

  protected openWizard(): void {
    this.showWizard.set(true);
  }

  protected closeWizard(): void {
    this.showWizard.set(false);
  }

  /**
   * Crée le planning PUIS le génère.
   *
   * Deux appels, un seul geste : la création ne coûte rien et fixe les dates, la
   * génération est ce qui se facture. Les séparer dans l'interface laisserait un
   * brouillon vide de plus à comprendre.
   */
  protected onWizardSubmit(result: PlanWizardResult): void {
    this.showWizard.set(false);
    this.communication.createPlan(this.projectId(), result).subscribe({
      next: (plan) => {
        this.plansChange.emit([...this.plans(), plan]);
        this.selectedPlanId.set(plan.id);
        this.generate(plan.id);
      },
      error: (err) => this.failed.emit(err?.error?.message || 'plan-create'),
    });
  }

  protected generate(planId: string): void {
    this.generatingPlanId.set(planId);
    this.stepLabel.set('dashboard.showCommunication.steps.context');

    this.communication.streamPlanGeneration(this.projectId(), planId).subscribe({
      next: (event) => {
        if (event.type === 'step-start' && event.step) {
          this.stepLabel.set(`dashboard.showCommunication.steps.${event.step}`);
        } else if (event.type === 'complete' && event.payload?.plan) {
          this.replacePlan(event.payload.plan as CommunicationPlan);
          this.generatingPlanId.set(null);
        } else if (event.type === 'error') {
          this.failed.emit(event.message || 'plan-generate');
          this.generatingPlanId.set(null);
        }
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || err?.message || 'plan-generate');
        this.generatingPlanId.set(null);
      },
      complete: () => this.generatingPlanId.set(null),
    });
  }

  protected archive(planId: string): void {
    this.communication.archivePlan(this.projectId(), planId).subscribe({
      next: () => {
        this.plansChange.emit(
          this.plans().map((plan) =>
            plan.id === planId ? { ...plan, status: 'archived' as const } : plan,
          ),
        );
      },
      error: (err) => this.failed.emit(err?.error?.message || 'plan-archive'),
    });
  }

  // ==========================================================================
  // Publications
  // ==========================================================================

  /** Le visuel le plus récent d'une publication, s'il en a un. */
  protected visualOf(item: ContentIdea): Flyer | undefined {
    if (!item.flyerIds?.length) return undefined;
    const wanted = new Set(item.flyerIds);
    return this.visuals().filter((visual) => wanted.has(visual.id)).slice(-1)[0];
  }

  /** Remontée du détail : une publication a changé. */
  protected onItemChange(updated: ContentIdea): void {
    const plan = this.selectedPlan();
    if (!plan) return;
    this.replacePlan({
      ...plan,
      items: plan.items.map((item) => (item.id === updated.id ? updated : item)),
    });
  }

  protected onItemDeleted(itemId: string): void {
    const plan = this.selectedPlan();
    if (!plan) return;
    this.openItemId.set(null);
    this.communication.removePlanItem(this.projectId(), plan.id, itemId).subscribe({
      next: () =>
        this.replacePlan({
          ...plan,
          items: plan.items.filter((item) => item.id !== itemId),
        }),
      error: (err) => this.failed.emit(err?.error?.message || 'content-remove'),
    });
  }

  // ==========================================================================
  // Internes
  // ==========================================================================

  private replacePlan(plan: CommunicationPlan): void {
    this.plansChange.emit(
      this.plans().map((candidate) => (candidate.id === plan.id ? plan : candidate)),
    );
  }
}
