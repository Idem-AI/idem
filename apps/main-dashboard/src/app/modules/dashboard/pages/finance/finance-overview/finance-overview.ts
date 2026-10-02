import { hasGeneratedDeliverable } from '../../../models/deliverable-document.model';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { Subscription } from 'rxjs';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { FinanceService } from '../../../services/finance.service';
import { ProjectService } from '../../../services/project.service';
import { ProjectModel } from '@idem/shared-models';
import {
  FINANCE_REPORTS,
  FINANCE_SETTINGS,
  FINANCE_STEPS,
  FinanceModel,
  FinanceSummary,
  FinanceSummaryResponse,
  SectionCompletionStatus,
} from '../../../models/finance.model';
import {
  AgentResearchConsoleComponent,
  PlannedSection,
} from '../../../../../shared/components/agent-research-console/agent-research-console';
import { GenerationService } from '../../../../../shared/services/generation.service';
import { SSEGenerationState } from '../../../../../shared/models/sse-step.model';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { ErrorStateComponent } from '../../../../../shared/components/error-state/error-state';
import { FinanceIllustrationComponent } from '../finance-illustration/finance-illustration';
import { FinanceImportDialogComponent } from '../finance-import-dialog/finance-import-dialog';
import { FinanceModeSwitchComponent } from '../finance-mode-switch/finance-mode-switch';

/** Sujets de recherche marché (noms alignés sur le backend financeAIService). */
const FINANCE_RESEARCH_TOPICS: { name: string; labelKey: string }[] = [
  { name: 'Prix de marché', labelKey: 'dashboard.researchConsole.financeTopics.pricing' },
  { name: 'Structure de coûts', labelKey: 'dashboard.researchConsole.financeTopics.costs' },
  { name: 'Fiscalité & charges sociales', labelKey: 'dashboard.researchConsole.financeTopics.taxes' },
  { name: 'Croissance & adoption', labelKey: 'dashboard.researchConsole.financeTopics.growth' },
];

interface StepVM {
  number: number;
  key: string;
  route: string;
  icon: string;
  status: SectionCompletionStatus;
}

/**
 * Accueil du module finance.
 *
 * Deux visages :
 *  - prévisionnel vide : trois façons de commencer, chacune dite en une
 *    phrase — importer un fichier, laisser l'IA proposer, remplir pas à pas ;
 *  - prévisionnel commencé : quatre réponses en langage courant (combien je
 *    vends, combien je gagne, combien il me reste, quand je deviens rentable),
 *    puis les six étapes, et enfin ce qui sert à la banque.
 *
 * Les sigles (VAN, TRI, BFR) ne disparaissent pas : ils descendent dans la
 * partie « pour votre banque », chacun avec sa phrase d'explication.
 */
@Component({
  selector: 'app-finance-overview',
  imports: [
    ErrorStateComponent,
    RouterLink,
    TranslateModule,
    AgentResearchConsoleComponent,
    DialogModule,
    IdemLoaderComponent,
    FinanceIllustrationComponent,
    FinanceImportDialogComponent,
    FinanceModeSwitchComponent,
  ],
  templateUrl: './finance-overview.html',
  styleUrl: './finance-overview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceOverviewComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly cookieService = inject(CookieService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly generationService = inject(GenerationService);

  protected readonly projectId = signal<string>('');
  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly bpMissingDialogVisible = signal<boolean>(false);
  protected readonly importOpen = signal<boolean>(false);
  protected readonly importedNotice = signal<boolean>(false);

  // Salle de contrôle de l'auto-fill sourcé (équipe d'agents).
  protected readonly researchVisible = signal<boolean>(false);
  protected readonly genState = signal<SSEGenerationState | null>(null);
  protected readonly researchState = computed(() => this.genState()?.research ?? null);
  protected readonly researchDone = computed(() => this.genState()?.completed ?? false);
  protected readonly researchPhase = computed<'running' | 'finalizing' | 'done'>(() =>
    this.researchDone() ? 'done' : 'running',
  );
  protected readonly financePlanned = computed<PlannedSection[]>(() =>
    FINANCE_RESEARCH_TOPICS.map((t) => ({
      name: t.name,
      label: this.translate.instant(t.labelKey),
    })),
  );
  private researchSub?: Subscription;

  protected readonly isLoading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly finance = signal<FinanceModel | null>(null);
  protected readonly summary = signal<FinanceSummary | null>(null);
  protected readonly aiGlobalLoading = signal<boolean>(false);
  protected readonly pdfLoading = signal<boolean>(false);

  protected readonly settings = FINANCE_SETTINGS;
  protected readonly reports = FINANCE_REPORTS;

  protected readonly currency = computed(() => this.finance()?.meta.currency || 'XAF');

  /**
   * Un prévisionnel « commencé » a au moins une étape renseignée. Le serveur
   * calcule toujours un résultat, même sur un modèle vide : on ne peut donc
   * pas s'en remettre à la présence de chiffres calculés.
   */
  protected readonly hasData = computed(() => {
    const f = this.finance();
    if (!f) return false;
    return (
      f.products.length > 0 ||
      Object.values(f.meta.completionStatus).some((s) => s !== 'empty')
    );
  });

  protected readonly steps = computed<StepVM[]>(() => {
    const status = this.finance()?.meta.completionStatus;
    return FINANCE_STEPS.map((s, i) => ({
      number: i + 1,
      key: s.key,
      route: s.route,
      icon: s.icon,
      status: status?.[s.completion] ?? 'empty',
    }));
  });

  protected readonly doneCount = computed(
    () => this.steps().filter((s) => s.status === 'completed').length,
  );

  /** La prochaine étape à faire : c'est elle que le bouton principal ouvre. */
  protected readonly nextStep = computed(
    () => this.steps().find((s) => s.status !== 'completed') ?? null,
  );

  /** Libellés des exercices (« 2026 » ou « 2026-2027 »). */
  protected readonly yearLabels = computed(() => {
    const cal = this.finance()?.fiscalCalendar;
    const first = cal?.firstYear || new Date().getFullYear();
    const end = cal?.fiscalYearEndMonth ?? 12;
    return [0, 1, 2].map((i) => (end === 12 ? String(first + i) : `${first + i}-${first + i + 1}`));
  });

  /**
   * « Rentable à partir de » : le point mort en jours devient un mois de
   * l'exercice, ce que tout le monde comprend. Au-delà de l'année, on le dit.
   */
  protected readonly breakEven = computed<{ key: string; params: Partial<Record<string, string>> }>(() => {
    const days = this.summary()?.pointMortJours ?? 0;
    const rows = this.finance()?.computed?.seuilRentabilite ?? [];
    if (!Number.isFinite(days) || days <= 0) {
      return { key: 'dashboard.finance.home.brief.breakEvenUnknown', params: {} };
    }
    if (days > 365) {
      const year = rows.findIndex((r) => r.pointMortJours > 0 && r.pointMortJours <= 365);
      return year > 0
        ? { key: 'dashboard.finance.home.brief.breakEvenYear', params: { year: this.yearLabels()[year] } }
        : { key: 'dashboard.finance.home.brief.breakEvenLater', params: {} };
    }
    return {
      key: 'dashboard.finance.home.brief.breakEvenMonth',
      params: { month: String(Math.max(1, Math.ceil(days / 30.4))) },
    };
  });

  /** Points pour le graphique des ventes sur 36 mois. */
  protected readonly revenueChartPoints = computed<string>(() => {
    const monthly = this.finance()?.computed?.revenue.monthlyTotal || [];
    if (!monthly.some((v) => v > 0)) return '';
    const max = Math.max(...monthly, 1);
    return monthly
      .map((v, i) => {
        const x = (i / Math.max(monthly.length - 1, 1)) * 600;
        const y = 120 - (v / max) * 110 - 5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  /** Trésorerie de fin d'exercice, pour savoir si la caisse reste positive. */
  protected readonly treasury = computed(() => {
    const flux = this.finance()?.computed?.fluxTresorerie || [];
    const max = Math.max(...flux.map((f) => Math.abs(f.tresorerieCloture)), 1);
    return flux.slice(0, 3).map((f, i) => ({
      label: this.yearLabels()[i],
      value: f.tresorerieCloture,
      pct: (Math.abs(f.tresorerieCloture) / max) * 100,
    }));
  });

  ngOnInit(): void {
    this.loadSummary();
  }

  protected retry(): void {
    this.error.set(null);
    this.isLoading.set(true);
    this.loadSummary();
  }

  private loadSummary(): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.error.set(this.translate.instant('dashboard.finance.errors.noProjectSelected'));
      this.isLoading.set(false);
      this.router.navigate(['/projects']);
      return;
    }
    this.projectId.set(projectId);

    if (!this.project()) {
      this.projectService.getProjectById(projectId).subscribe({
        next: (proj) => this.project.set(proj),
        error: (err) => console.error('[FinanceOverview] Failed to load project', err),
      });
    }

    this.financeService.getSummary(projectId).subscribe({
      next: (response: FinanceSummaryResponse) => {
        this.finance.set(response.finance);
        this.summary.set(response.summary);
        this.isLoading.set(false);
      },
      error: (err) => {
        // 404 = pas encore de finance : on montre les trois façons de commencer.
        if (err?.status === 404) {
          this.finance.set(null);
          this.summary.set(null);
          this.isLoading.set(false);
          return;
        }
        console.error('[FinanceOverview] Failed to load summary', err);
        this.error.set(this.translate.instant('dashboard.finance.errors.failedToLoad'));
        this.isLoading.set(false);
      },
    });
  }

  // -------------------------------------------------------------------
  // Trois façons de commencer
  // -------------------------------------------------------------------

  protected openImport(): void {
    this.importedNotice.set(false);
    this.importOpen.set(true);
  }

  protected openSheet(): void {
    this.router.navigate(['/project/finance/sheet']);
  }

  protected onImported(finance: FinanceModel): void {
    this.finance.set(finance);
    this.importedNotice.set(true);
    this.loadSummary();
  }

  protected startManually(): void {
    this.router.navigate(['/project/finance', FINANCE_STEPS[0].route]);
  }

  protected onAutoFillGlobal(): void {
    const projectId = this.projectId();
    if (!projectId) return;

    if (!hasGeneratedDeliverable(this.project()?.analysisResultModel, 'businessPlan')) {
      this.bpMissingDialogVisible.set(true);
      return;
    }

    // Flux sourcé : une équipe d'agents recherche des références réelles
    // (grounding) puis cale les prévisions dessus. La salle de contrôle
    // s'affiche en direct.
    this.aiGlobalLoading.set(true);
    this.researchVisible.set(true);
    this.genState.set(null);

    const connection = this.financeService.autoFillAllStream(projectId);
    this.researchSub?.unsubscribe();
    this.researchSub = this.generationService.startGeneration('finance-fill', connection).subscribe({
      next: (state) => {
        this.genState.set(state);
        if (state.completed) {
          this.aiGlobalLoading.set(false);
          this.loadSummary();
        }
      },
      error: (err) => {
        console.error('[FinanceOverview] autoFillAll (sourced) failed', err);
        this.aiGlobalLoading.set(false);
        this.researchVisible.set(false);
        this.error.set(this.translate.instant('dashboard.finance.errors.aiFillFailed'));
      },
    });
  }

  protected closeResearchConsole(): void {
    this.researchVisible.set(false);
    this.researchSub?.unsubscribe();
    this.financeService.closeAutoFillStream();
    this.aiGlobalLoading.set(false);
  }

  protected navigateToBpGeneration(): void {
    this.bpMissingDialogVisible.set(false);
    this.router.navigate(['/project/business-plan/generate']);
  }

  // -------------------------------------------------------------------
  // Rapport PDF
  // -------------------------------------------------------------------

  protected onDownloadPdf(): void {
    const projectId = this.projectId();
    if (!projectId || this.pdfLoading()) return;
    this.pdfLoading.set(true);
    this.financeService.downloadFinancePdf(projectId).subscribe({
      next: (blob) => {
        FinanceService.triggerPdfDownload(blob, `rapport-financier-${projectId}.pdf`);
        this.pdfLoading.set(false);
      },
      error: (err) => {
        console.error('[FinanceOverview] downloadFinancePdf failed', err);
        this.pdfLoading.set(false);
      },
    });
  }

  // -------------------------------------------------------------------
  // Affichage
  // -------------------------------------------------------------------

  protected formatCurrency(value: number | undefined): string {
    return FinanceService.formatCurrency(value || 0, this.currency());
  }

  protected formatPercent(value: number | undefined): string {
    return FinanceService.formatPercent(value || 0);
  }

  protected statusLabelKey(status: SectionCompletionStatus): string {
    switch (status) {
      case 'completed':
        return 'dashboard.finance.home.status.done';
      case 'in_progress':
        return 'dashboard.finance.home.status.started';
      default:
        return 'dashboard.finance.home.status.todo';
    }
  }
}
