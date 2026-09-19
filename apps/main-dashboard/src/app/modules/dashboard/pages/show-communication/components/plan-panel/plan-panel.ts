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
  ContentChannel,
  ContentIdea,
  Flyer,
  MomentSuggestion,
} from '../../../../models/communication.model';
import {
  PLANNABLE_CHANNELS,
  channelIcon,
  daysBetweenIso,
  expectedItemCount,
  firstDayOfNextMonth,
  groupByWeek,
  lastDayOfMonth,
  planStatusPillClass,
  statusPillClass,
  todayIso,
} from '../../communication-ui';

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
 * LES PÉRIODES — ce que la marque raconte sur une fenêtre de temps donnée.
 *
 * Remplace l'onglet « Calendrier », qui ne savait produire qu'« à partir
 * d'aujourd'hui, sur 4 semaines » et écrasait le calendrier précédent à chaque
 * régénération. Ici les périodes s'empilent : « Novembre » et « Lancement
 * boutique » coexistent, et régénérer l'une ne touche pas l'autre.
 *
 * Absorbe aussi l'ancien onglet « Moments » : les occasions du calendrier réel
 * sont proposées AU MOMENT de créer la période, là où elles servent à décider.
 */
@Component({
  selector: 'app-plan-panel',
  imports: [FormsModule, TranslateModule],
  templateUrl: './plan-panel.html',
  styleUrls: ['./plan-panel.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanPanel {
  private readonly communication = inject(CommunicationService);
  private readonly router = inject(Router);

  readonly projectId = input.required<string>();
  readonly plans = input<CommunicationPlan[]>([]);
  /** Canaux priorisés par la boussole — servent de présélection. */
  readonly suggestedChannels = input<ContentChannel[]>([]);
  readonly visuals = input<Flyer[]>([]);

  readonly plansChange = output<CommunicationPlan[]>();
  readonly visualCreated = output<Flyer>();
  readonly failed = output<string>();

  protected readonly channelIcon = channelIcon;
  protected readonly statusPillClass = statusPillClass;
  protected readonly planStatusPillClass = planStatusPillClass;
  protected readonly plannableChannels = PLANNABLE_CHANNELS;
  protected readonly cadences = [1, 3, 5, 7];

  // ── Sélection et vues ────────────────────────────────────────────────────
  protected readonly selectedPlanId = signal<string | null>(null);
  protected readonly view = signal<'weeks' | 'month'>('weeks');
  protected readonly showArchived = signal(false);

  protected readonly visiblePlans = computed(() =>
    this.plans().filter((plan) => this.showArchived() || plan.status !== 'archived'),
  );

  /**
   * Période ouverte : celle choisie, sinon la première non archivée.
   *
   * Le tri vient du serveur (actives d'abord) : ouvrir la première revient donc à
   * ouvrir celle en cours, ce que l'utilisateur attend en arrivant.
   */
  protected readonly selectedPlan = computed<CommunicationPlan | null>(() => {
    const plans = this.visiblePlans();
    const id = this.selectedPlanId();
    return plans.find((plan) => plan.id === id) ?? plans[0] ?? null;
  });

  protected readonly weeks = computed(() => groupByWeek(this.selectedPlan()?.items ?? []));

  /** Le calendrier, mois par mois, sur l'étendue de la période. */
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
        label: cursor.toLocaleDateString(undefined, {
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

  // ── Formulaire de création ───────────────────────────────────────────────
  protected readonly showForm = signal(false);
  protected readonly formName = signal('');
  protected readonly formObjective = signal('');
  protected readonly formStart = signal('');
  protected readonly formEnd = signal('');
  protected readonly formKind = signal<'regular' | 'campaign'>('regular');
  protected readonly formPostsPerWeek = signal(3);
  protected readonly formChannels = signal<ContentChannel[]>([]);
  protected readonly formOccasions = signal<MomentSuggestion[]>([]);
  protected readonly isLoadingOccasions = signal(false);
  protected readonly isSubmitting = signal(false);

  /** Ce que la période produira — affiché avant de payer. */
  protected readonly formItemCount = computed(() =>
    this.formStart() && this.formEnd()
      ? expectedItemCount(this.formStart(), this.formEnd(), this.formPostsPerWeek())
      : 0,
  );

  protected readonly formDays = computed(() =>
    this.formStart() && this.formEnd() ? daysBetweenIso(this.formStart(), this.formEnd()) : 0,
  );

  protected readonly formValid = computed(
    () => !!this.formStart() && !!this.formEnd() && this.formChannels().length > 0,
  );

  // ── Génération ──────────────────────────────────────────────────────────
  protected readonly generatingPlanId = signal<string | null>(null);
  protected readonly stepLabel = signal('');
  protected readonly creatingVisualFor = signal<string | null>(null);

  // ==========================================================================
  // Sélection
  // ==========================================================================

  protected selectPlan(planId: string): void {
    this.selectedPlanId.set(planId);
  }

  protected setView(view: 'weeks' | 'month'): void {
    this.view.set(view);
  }

  protected toggleArchived(): void {
    this.showArchived.update((value) => !value);
  }

  // ==========================================================================
  // Création d'une période
  // ==========================================================================

  /**
   * Ouvre le formulaire avec des valeurs déjà utiles : le mois PROCHAIN complet.
   *
   * C'est le cas d'usage qui manquait le plus — préparer décembre en novembre.
   * Proposer « aujourd'hui + 4 semaines » reviendrait à reproduire la V1.
   */
  protected openForm(): void {
    const start = firstDayOfNextMonth();
    this.formName.set('');
    this.formObjective.set('');
    this.formStart.set(start);
    this.formEnd.set(lastDayOfMonth(start));
    this.formKind.set('regular');
    this.formPostsPerWeek.set(3);
    this.formChannels.set(
      this.suggestedChannels().length
        ? this.suggestedChannels().slice(0, 3)
        : ['instagram', 'facebook'],
    );
    this.formOccasions.set([]);
    this.showForm.set(true);
    this.loadOccasions();
  }

  protected closeForm(): void {
    this.showForm.set(false);
  }

  protected setStart(value: string): void {
    this.formStart.set(value);
    // La fin suit la borne de départ quand elle devient incohérente, plutôt que
    // de laisser l'utilisateur devant une période négative.
    if (this.formEnd() && this.formEnd() < value) {
      this.formEnd.set(lastDayOfMonth(value));
    }
    this.loadOccasions();
  }

  protected setEnd(value: string): void {
    this.formEnd.set(value);
    this.loadOccasions();
  }

  protected setCadence(postsPerWeek: number): void {
    this.formPostsPerWeek.set(postsPerWeek);
  }

  protected setKind(kind: 'regular' | 'campaign'): void {
    this.formKind.set(kind);
  }

  protected toggleChannel(channel: ContentChannel): void {
    this.formChannels.update((channels) =>
      channels.includes(channel)
        ? channels.filter((item) => item !== channel)
        : [...channels, channel],
    );
  }

  protected isChannelSelected(channel: ContentChannel): boolean {
    return this.formChannels().includes(channel);
  }

  /** Occasions qui tombent dans la fenêtre choisie. Gratuit, donc rechargé librement. */
  protected loadOccasions(): void {
    const start = this.formStart();
    const end = this.formEnd();
    if (!start || !end || end < start) return;

    this.isLoadingOccasions.set(true);
    this.communication.getOccasions(this.projectId(), start, end).subscribe({
      next: (occasions) => {
        this.formOccasions.set(occasions);
        this.isLoadingOccasions.set(false);
      },
      // Silencieux : les occasions sont un bonus d'aide à la décision. Une erreur
      // ici ne doit pas empêcher de créer la période.
      error: () => this.isLoadingOccasions.set(false),
    });
  }

  /**
   * Crée la période PUIS la génère.
   *
   * Deux appels, un seul geste : la création ne coûte rien et fixe les dates, la
   * génération est ce qui se facture. Les séparer dans l'interface ferait un
   * brouillon vide de plus à comprendre.
   */
  protected submitForm(): void {
    if (!this.formValid() || this.isSubmitting()) return;
    this.isSubmitting.set(true);

    this.communication
      .createPlan(this.projectId(), {
        name: this.formName().trim(),
        objective: this.formObjective().trim(),
        start: this.formStart(),
        end: this.formEnd(),
        kind: this.formKind(),
        postsPerWeek: this.formPostsPerWeek(),
        channels: this.formChannels(),
      })
      .subscribe({
        next: (plan) => {
          this.plansChange.emit([...this.plans(), plan]);
          this.selectedPlanId.set(plan.id);
          this.isSubmitting.set(false);
          this.showForm.set(false);
          this.generate(plan.id);
        },
        error: (err) => {
          this.failed.emit(err?.error?.message || 'plan-create');
          this.isSubmitting.set(false);
        },
      });
  }

  // ==========================================================================
  // Génération d'une période
  // ==========================================================================

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
  // Contenus
  // ==========================================================================

  /** Le visuel le plus récent d'un contenu, s'il en a un. */
  protected visualOf(item: ContentIdea): Flyer | undefined {
    if (!item.flyerIds?.length) return undefined;
    const wanted = new Set(item.flyerIds);
    return this.visuals().filter((visual) => wanted.has(visual.id)).slice(-1)[0];
  }

  protected createVisual(item: ContentIdea): void {
    if (this.creatingVisualFor()) return;
    this.creatingVisualFor.set(item.id);

    this.communication.generateFlyer(this.projectId(), item.id, 'square').subscribe({
      next: (visual) => {
        this.visualCreated.emit(visual);
        const plan = this.selectedPlan();
        if (plan) {
          this.replacePlan({
            ...plan,
            items: plan.items.map((candidate) =>
              candidate.id === item.id
                ? { ...candidate, flyerIds: [...(candidate.flyerIds || []), visual.id] }
                : candidate,
            ),
          });
        }
        this.creatingVisualFor.set(null);
      },
      error: (err) => {
        this.failed.emit(err?.error?.message || 'visual');
        this.creatingVisualFor.set(null);
      },
    });
  }

  /**
   * Adaptateur d'événement DOM.
   *
   * `strictTemplates` type `$event.target` en `EventTarget | null` : le déballage
   * se fait donc ici plutôt que dans le gabarit, où il ne compilerait pas.
   */
  protected onItemDateChange(item: ContentIdea, event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value;
    if (value) this.changeItemDate(item, value);
  }

  protected changeItemDate(item: ContentIdea, date: string): void {
    const plan = this.selectedPlan();
    if (!plan || !date || date === item.scheduledFor) return;

    this.communication
      .updatePlanItem(this.projectId(), plan.id, item.id, { scheduledFor: date })
      .subscribe({
        next: (updated) => this.replacePlan(updated),
        error: (err) => this.failed.emit(err?.error?.message || 'content-update'),
      });
  }

  protected removeItem(item: ContentIdea): void {
    const plan = this.selectedPlan();
    if (!plan) return;

    this.communication.removePlanItem(this.projectId(), plan.id, item.id).subscribe({
      next: () =>
        this.replacePlan({
          ...plan,
          items: plan.items.filter((candidate) => candidate.id !== item.id),
        }),
      error: (err) => this.failed.emit(err?.error?.message || 'content-remove'),
    });
  }

  protected openVisual(visualId: string): void {
    this.router.navigate(['/project/communication/flyer/edit'], {
      queryParams: { flyerId: visualId },
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
