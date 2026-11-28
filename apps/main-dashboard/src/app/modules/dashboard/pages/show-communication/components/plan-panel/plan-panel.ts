import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  viewChild,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommunicationService } from '../../../../services/ai-agents/communication.service';
import { FontHints } from '@idem/shared-document-editor/angular';
import {
  CommunicationPlan,
  CommunicationStreamEvent,
  ContentChannel,
  ContentIdea,
  Flyer,
} from '../../../../models/communication.model';
import { injectCompactViewport } from '../../compact-viewport';
import {
  addDaysIso,
  channelIcon,
  channelLabelKey,
  formatDay,
  formatRange,
  groupByWeek,
  todayIso,
} from '../../communication-ui';
import { ContentDetail } from '../content-detail/content-detail';
import { PlanWizard, PlanWizardResult } from '../plan-wizard/plan-wizard';
import { VisualThumb } from '../visual-thumb/visual-thumb';
import { EMPTY_PLAN_PROGRESS, PlanComposing, PlanProgressState, PlanStage } from '../plan-composing/plan-composing';
import { urlChoice, urlFlag, urlParam } from '../../url-state';
import { WriteOnlyDirective } from '../../../../../team/directives/write-only.directive';

/**
 * Ce qu'un autre écran demande au planning en y envoyant l'utilisateur :
 * ouvrir la création, ou ouvrir une publication précise.
 */
export type PlanIntent =
  | { kind: 'create' }
  | { kind: 'open'; planId: string; itemId: string };

/** Une case du calendrier mensuel (les jours des mois voisins complètent la grille). */
interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
  inPeriod: boolean;
  isToday: boolean;
  isPast: boolean;
  items: ContentIdea[];
}

interface MonthView {
  /** `AAAA-MM` : la clé de l'adresse (`?m=`). */
  key: string;
  label: string;
  weeks: DayCell[][];
}

/** Au-delà, une case du calendrier se replie sur « +N ». */
const DAY_PREVIEW = 3;

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

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
  imports: [WriteOnlyDirective, 
    TranslateModule,
    ContentDetail,
    PlanWizard,
    VisualThumb,
    PlanComposing,
  ],
  templateUrl: './plan-panel.html',
  styleUrls: ['./plan-panel.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
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
  /** Demande venue de l'accueil ; consommée une fois, puis signalée au parent. */
  readonly intent = input<PlanIntent | null>(null);

  readonly plansChange = output<CommunicationPlan[]>();
  readonly intentHandled = output<void>();
  readonly visualCreated = output<Flyer>();
  readonly failed = output<string>();
  /** Ouvrir la vidéo d'un contenu dans l'écran Vidéos. */
  readonly openVideo = output<string>();
  readonly needsCredits = output<{ cost: number; balance: number }>();

  /** Contenu vidéo (reel, vidéo courte, ou type de vidéo posé). */
  protected isVideo(item: ContentIdea): boolean {
    return item.format === 'reel' || item.format === 'short-video' || !!item.videoType;
  }

  /** « 1 min 30 » : la durée d'une vidéo du calendrier. */
  protected videoLength(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m} min ${s}` : `${m} min`;
  }

  /** « 0:30 », « 1:15 » : la durée d'une vidéo sur sa carte. */
  protected clock(sec: number): string {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  protected readonly channelIcon = channelIcon;
  protected readonly channelLabelKey = channelLabelKey;
  protected readonly weekdays = WEEKDAYS;
  protected readonly dayPreview = DAY_PREVIEW;
  protected readonly today = todayIso();

  // ── Sélection et vues ────────────────────────────────────────────────────
  // Tout est dans l'adresse (`?plan=…&post=…&cal=month&new=1`) : une actualisation garde le planning, la
  // publication ouverte, la vue et l'assistant de création.
  protected readonly selectedPlanId = urlParam<string | null>('plan', { fallback: null, push: true });
  protected readonly view = urlChoice<'weeks' | 'month'>('cal', ['weeks', 'month'], 'month');
  protected readonly isCompact = injectCompactViewport();

  /**
   * Vue affichée. Au téléphone, toujours la liste : la grille du mois demande
   * 40rem de large et se lisait en faisant défiler de côté, case par case.
   */
  protected readonly shownView = computed(() => (this.isCompact() ? 'weeks' : this.view()));
  protected readonly showArchived = urlFlag('archived');
  protected readonly showWizard = urlFlag('new', { push: true });
  /** Publication ouverte en détail. */
  protected readonly openItemId = urlParam<string | null>('post', { fallback: null, push: true });

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

  /** Les semaines de la période, chacune avec ses dates en clair (« 1 – 7 déc. »). */
  protected readonly weeks = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return [];
    return groupByWeek(plan.items).map((group) => {
      const from = addDaysIso(plan.period.start, (group.week - 1) * 7);
      const end = addDaysIso(from, 6);
      const to = end > plan.period.end ? plan.period.end : end;
      return { ...group, range: this.shortRange(from, to) };
    });
  });

  // ── Période : sélecteur, idée de la période ──────────────────────────────

  /** Le menu des périodes (un menu passager : il n'a pas sa place dans l'adresse). */
  protected readonly periodMenuOpen = signal(false);
  /** Le panneau de droite « L'idée de la période » : `?brief=1`. */
  protected readonly briefOpen = urlFlag('brief', { push: true });

  private readonly drawerClose = viewChild<ElementRef<HTMLButtonElement>>('drawerClose');

  /** Échap referme le menu ou le panneau — pas la publication ouverte, qui gère le sien. */
  protected onEscape(): void {
    if (this.openItemId()) return;
    if (this.periodMenuOpen()) this.periodMenuOpen.set(false);
    else if (this.briefOpen()) this.briefOpen.set(false);
  }

  protected togglePeriodMenu(): void {
    this.periodMenuOpen.update((open) => !open);
  }

  protected closePeriodMenu(): void {
    this.periodMenuOpen.set(false);
  }

  /** « 1 déc. → 31 déc. » */
  protected planRange(plan: CommunicationPlan): string {
    return this.shortRange(plan.period.start, plan.period.end);
  }

  private shortRange(from: string, to: string): string {
    const format = (iso: string) =>
      new Date(`${iso}T00:00:00Z`).toLocaleDateString(this.translate.currentLang, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
    return `${format(from)} – ${format(to)}`;
  }

  /** Où en est la période : combien de publications ont leur visuel ou leur vidéo. */
  protected readonly stats = computed(() => {
    const items = this.selectedPlan()?.items ?? [];
    const ready = items.filter((item) => this.isReady(item)).length;
    return {
      total: items.length,
      ready,
      videos: items.filter((item) => this.isVideo(item)).length,
      percent: items.length ? Math.round((ready / items.length) * 100) : 0,
    };
  });

  /** Une publication est prête quand son visuel (ou sa vidéo) existe. */
  protected isReady(item: ContentIdea): boolean {
    return this.isVideo(item) ? !!item.videoIds?.length : !!this.visualOf(item);
  }

  // ── Calendrier : mois affiché, jours dépliés, glisser-déposer ────────────

  /** Le mois affiché : `?m=AAAA-MM`, sinon celui d'aujourd'hui, sinon le premier de la période. */
  protected readonly monthKey = urlParam<string | null>('m', { fallback: null });
  protected readonly expandedDay = signal<string | null>(null);
  protected readonly dragItemId = signal<string | null>(null);
  protected readonly dropIso = signal<string | null>(null);

  protected readonly shownMonthIndex = computed(() => {
    const months = this.months();
    const wanted = this.monthKey() ?? this.today.slice(0, 7);
    const index = months.findIndex((month) => month.key === wanted);
    return index >= 0 ? index : 0;
  });

  protected readonly shownMonth = computed<MonthView | null>(
    () => this.months()[this.shownMonthIndex()] ?? null,
  );

  protected readonly todayInPlan = computed(() => {
    const plan = this.selectedPlan();
    return !!plan && this.today >= plan.period.start && this.today <= plan.period.end;
  });

  protected stepMonth(delta: number): void {
    const month = this.months()[this.shownMonthIndex() + delta];
    if (month) {
      this.monthKey.set(month.key);
      this.expandedDay.set(null);
    }
  }

  protected goToday(): void {
    this.monthKey.set(this.today.slice(0, 7));
  }

  protected toggleDay(iso: string): void {
    this.expandedDay.update((current) => (current === iso ? null : iso));
  }

  protected onDragStart(item: ContentIdea, event: DragEvent): void {
    this.dragItemId.set(item.id);
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', item.id);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  protected onDragEnd(): void {
    this.dragItemId.set(null);
    this.dropIso.set(null);
  }

  protected onDragOver(cell: DayCell, event: DragEvent): void {
    if (!this.dragItemId() || !cell.inPeriod) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropIso.set(cell.iso);
  }

  protected onDragLeave(cell: DayCell): void {
    if (this.dropIso() === cell.iso) this.dropIso.set(null);
  }

  protected onDrop(cell: DayCell, event: DragEvent): void {
    event.preventDefault();
    const itemId = this.dragItemId();
    this.onDragEnd();
    if (itemId && cell.inPeriod) this.moveItem(itemId, cell.iso);
  }

  /**
   * Une publication change de jour : affichée tout de suite à sa nouvelle place,
   * enregistrée ensuite, remise à l'ancienne si l'enregistrement échoue.
   */
  private moveItem(itemId: string, iso: string): void {
    const plan = this.selectedPlan();
    const item = plan?.items.find((candidate) => candidate.id === itemId);
    if (!plan || !item || (item.scheduledFor || '').slice(0, 10) === iso) return;
    // L'heure éventuelle est gardée : seul le jour change.
    const scheduledFor = `${iso}${(item.scheduledFor || '').slice(10)}`;
    this.replacePlan({
      ...plan,
      items: plan.items.map((candidate) =>
        candidate.id === itemId ? { ...candidate, scheduledFor } : candidate,
      ),
    });
    this.communication.updatePlanItem(this.projectId(), plan.id, itemId, { scheduledFor }).subscribe({
      next: (saved) => this.replacePlan(saved),
      error: (err) => {
        this.replacePlan(plan);
        this.failed.emit(err?.error?.message || 'content-update');
      },
    });
  }

  /** Dates du planning ouvert, écrites en clair. */
  protected readonly selectedRange = computed(() => {
    const plan = this.selectedPlan();
    return plan ? formatRange(plan.period.start, plan.period.end, this.translate.currentLang) : '';
  });

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

    const today = this.today;
    const start = new Date(`${plan.period.start}T00:00:00Z`);
    const end = new Date(`${plan.period.end}T00:00:00Z`);
    const months: MonthView[] = [];

    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      const year = cursor.getUTCFullYear();
      const month = cursor.getUTCMonth();
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      // Semaine commençant le lundi : `getUTCDay()` rend 0 pour dimanche, d'où le décalage.
      const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
      const count = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

      const cells: DayCell[] = [];
      for (let index = 0; index < count; index++) {
        const date = new Date(Date.UTC(year, month, 1 - firstWeekday + index));
        const iso = date.toISOString().slice(0, 10);
        const inPeriod = iso >= plan.period.start && iso <= plan.period.end;
        cells.push({
          iso,
          day: date.getUTCDate(),
          inMonth: date.getUTCMonth() === month,
          inPeriod,
          isToday: iso === today,
          isPast: iso < today,
          items: inPeriod ? (byDate.get(iso) ?? []) : [],
        });
      }

      const weeks: DayCell[][] = [];
      for (let index = 0; index < cells.length; index += 7) {
        weeks.push(cells.slice(index, index + 7));
      }

      months.push({
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
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
  /** Ce que le flux a déjà livré : alimente la vue « en direct » de la génération. */
  protected readonly progress = signal<PlanProgressState>(EMPTY_PLAN_PROGRESS);
  protected readonly generatingPlan = computed<CommunicationPlan | null>(() => {
    const id = this.generatingPlanId();
    return id ? (this.plans().find((plan) => plan.id === id) ?? null) : null;
  });

  /** La recherche se ferme quand le web ET le calendrier ont répondu. */
  private readonly researchIn = new Set<string>();

  /** Range un événement du flux dans l'état affiché. */
  private applyEvent(event: CommunicationStreamEvent): void {
    const stageOf: Partial<Record<string, PlanStage>> = { context: 'context', trends: 'research', occasions: 'research', brief: 'brief', content: 'content', videos: 'videos' };
    const step = event.step ?? '';
    const stage = stageOf[step];
    this.progress.update((state) => {
      const next: PlanProgressState = { ...state, stages: { ...state.stages } };
      const payload = event.payload;
      if (event.type === 'step-start' && stage) {
        next.stages[stage] = 'running';
      } else if (event.type === 'step-complete') {
        if (step === 'trends' && Array.isArray(payload)) next.trends = payload;
        else if (step === 'occasions' && Array.isArray(payload)) next.occasions = payload;
        else if (step === 'brief' && payload) next.brief = payload;
        else if (step === 'content-batch' && Array.isArray(payload)) next.items = [...state.items, ...payload];
        else if (step === 'videos-count' && Array.isArray(payload)) next.videos = payload.map((v: { id: string; title: string }) => ({ id: v.id, title: v.title, done: false }));
        else if (step === 'video-plan' && payload?.id) next.videos = state.videos.map((v) => (v.id === payload.id ? { ...v, done: true } : v));

        if (step === 'trends' || step === 'occasions') {
          this.researchIn.add(step);
          if (this.researchIn.size === 2) next.stages.research = 'done';
        } else if (stage) {
          next.stages[stage] = 'done';
        }
      }
      return next;
    });
  }

  constructor() {
    // Le panneau s'ouvre : le focus y entre (clavier, lecteur d'écran).
    effect(() => this.drawerClose()?.nativeElement.focus());

    // Une demande de l'accueil (« Créer mon calendrier », une publication
    // cliquée) arrive par une entrée : on l'exécute, puis on le dit au parent
    // pour qu'elle ne rejoue pas au prochain passage sur l'écran.
    effect(() => {
      const intent = this.intent();
      if (!intent) return;
      untracked(() => {
        if (intent.kind === 'create') {
          this.openWizard();
        } else {
          this.selectedPlanId.set(intent.planId);
          this.openItemId.set(intent.itemId);
        }
        this.intentHandled.emit();
      });
    });
  }

  // ==========================================================================
  // Navigation
  // ==========================================================================

  /** « Lun. 12 oct. » plutôt que la date ISO (majuscule à la première lettre seulement). */
  protected day(iso: string): string {
    return this.cap(formatDay(iso, this.translate.currentLang));
  }

  /** « décembre 2026 » → « Décembre 2026 », sans toucher aux autres mots (« Lancement boutique »). */
  protected cap(text: string): string {
    return text ? text.charAt(0).toLocaleUpperCase(this.translate.currentLang) + text.slice(1) : text;
  }

  protected selectPlan(planId: string): void {
    this.selectedPlanId.set(planId);
    this.openItemId.set(null);
    this.monthKey.set(null);
    this.expandedDay.set(null);
    this.periodMenuOpen.set(false);
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
    this.researchIn.clear();
    this.progress.set({ ...EMPTY_PLAN_PROGRESS, stages: { context: 'running' } });

    this.communication.streamPlanGeneration(this.projectId(), planId).subscribe({
      next: (event) => {
        this.applyEvent(event);
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
