import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { FinanceService } from '../../../services/finance.service';
import { ProjectService } from '../../../services/project.service';
import { ProjectModel } from '@idem/shared-models';
import {
  FINANCE_SECTIONS,
  FinanceModel,
  FinanceSectionKey,
  FinanceSummary,
  FinanceSummaryResponse,
  SectionCompletionStatus,
} from '../../../models/finance.model';
import { AiFillButtonComponent } from '../../../components/ai-fill-button/ai-fill-button';
import { AgentResearchConsoleComponent } from '../../../../../shared/components/agent-research-console/agent-research-console';
import { GenerationService } from '../../../../../shared/services/generation.service';
import { SSEGenerationState } from '../../../../../shared/models/sse-step.model';
import { Subscription } from 'rxjs';

interface SectionCardVM {
  key: string;
  route: string;
  labelKey: string;
  icon: string;
  status: SectionCompletionStatus | 'computed';
  editable: boolean;
}

@Component({
  selector: 'app-finance-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    AiFillButtonComponent,
    AgentResearchConsoleComponent,
    DialogModule,
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

  protected readonly project = signal<ProjectModel | null>(null);
  protected readonly bpMissingDialogVisible = signal<boolean>(false);

  // Salle de contrôle de l'auto-fill sourcé (équipe d'agents).
  protected readonly researchVisible = signal<boolean>(false);
  protected readonly genState = signal<SSEGenerationState | null>(null);
  protected readonly researchState = computed(() => this.genState()?.research ?? null);
  protected readonly researchLive = computed(() => this.genState()?.isGenerating ?? false);
  protected readonly researchDone = computed(() => this.genState()?.completed ?? false);
  private researchSub?: Subscription;

  protected readonly isLoading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly finance = signal<FinanceModel | null>(null);
  protected readonly summary = signal<FinanceSummary | null>(null);
  protected readonly aiGlobalLoading = signal<boolean>(false);
  protected readonly aiSectionLoading = signal<Record<string, boolean>>({});
  protected readonly pdfLoading = signal<boolean>(false);

  /** Devise utilisée pour l'affichage des montants */
  protected readonly currency = computed(() => this.finance()?.meta.currency || 'XAF');

  /** Cartes de sections affichées sous les KPIs */
  protected readonly sectionCards = computed<SectionCardVM[]>(() => {
    const f = this.finance();
    return FINANCE_SECTIONS.filter((s) => s.route !== '').map((s) => {
      const isInput = s.editable;
      let status: SectionCompletionStatus | 'computed' = 'empty';
      if (!isInput) {
        status = 'computed';
      } else if (f) {
        const key = s.key as keyof FinanceModel['meta']['completionStatus'];
        status = f.meta.completionStatus[key] || 'empty';
      }
      return {
        key: s.key,
        route: s.route,
        labelKey: s.labelKey,
        icon: s.icon,
        status,
        editable: isInput,
      };
    });
  });

  /** Points pour le graphique de CA sur 36 mois (line chart inline) */
  protected readonly revenueChartPoints = computed<string>(() => {
    const finance = this.finance();
    const monthly = finance?.computed?.revenue.monthlyTotal || [];
    if (monthly.length === 0) return '';
    const max = Math.max(...monthly, 1);
    const width = 600;
    const height = 120;
    return monthly
      .map((v, i) => {
        const x = (i / Math.max(monthly.length - 1, 1)) * width;
        const y = height - (v / max) * (height - 10) - 5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  /** Donut: répartition charges fixes / variables (An 1) */
  protected readonly chargesDonutData = computed<{
    fixed: number;
    variable: number;
    fixedPct: number;
    variablePct: number;
  }>(() => {
    const f = this.finance();
    if (!f?.computed) return { fixed: 0, variable: 0, fixedPct: 0, variablePct: 0 };
    const y1 = f.computed.compteExploitation[0];
    if (!y1) return { fixed: 0, variable: 0, fixedPct: 0, variablePct: 0 };
    const total = y1.chargesFixes + y1.chargesVariables;
    if (total <= 0) return { fixed: 0, variable: 0, fixedPct: 0, variablePct: 0 };
    return {
      fixed: y1.chargesFixes,
      variable: y1.chargesVariables,
      fixedPct: (y1.chargesFixes / total) * 100,
      variablePct: (y1.chargesVariables / total) * 100,
    };
  });

  /** Trésorerie sur 3 ans (line chart) */
  protected readonly treasuryChartPoints = computed<string>(() => {
    const finance = this.finance();
    const flux = finance?.computed?.fluxTresorerie || [];
    if (flux.length === 0) return '';
    const values = flux.map((f) => f.tresorerieCloture);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const width = 300;
    const height = 100;
    return values
      .map((v, i) => {
        const x = (i / Math.max(values.length - 1, 1)) * width;
        const y = height - ((v - min) / range) * (height - 10) - 5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  /** Résultats nets sur 3 ans (bars) */
  protected readonly netResults = computed(() => {
    const f = this.finance();
    return (f?.computed?.compteExploitation || []).slice(0, 3).map((row) => ({
      year: row.year,
      value: row.resultatNet,
    }));
  });

  protected readonly maxNetResult = computed(() => {
    const values = this.netResults().map((r) => Math.abs(r.value));
    return Math.max(...values, 1);
  });

  ngOnInit(): void {
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

    this.isLoading.set(true);
    this.projectService.getProjectById(projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
      },
      error: (err) => {
        console.error('[FinanceOverview] Failed to load project', err);
      }
    });

    this.financeService.getSummary(projectId).subscribe({
      next: (response: FinanceSummaryResponse) => {
        this.finance.set(response.finance);
        this.summary.set(response.summary);
        this.isLoading.set(false);
      },
      error: (err) => {
        // 404 = pas encore de finance => créer un modèle vide (preview)
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
  // Auto-fill IA (Phase 3 — pour l'instant un placeholder simulé)
  // -------------------------------------------------------------------

  protected onAutoFillGlobal(): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) return;

    // Check if Business Plan is generated
    const project = this.project();
    const hasBp = !!(project?.analysisResultModel?.businessPlan?.sections &&
                    project.analysisResultModel.businessPlan.sections.length > 0);

    if (!hasBp) {
      this.bpMissingDialogVisible.set(true);
      return;
    }

    // Flux sourcé: une équipe d'agents recherche des benchmarks réels (grounding)
    // puis cale les prévisions dessus. La salle de contrôle s'affiche en direct.
    this.aiGlobalLoading.set(true);
    this.researchVisible.set(true);
    this.genState.set(null);

    const connection = this.financeService.autoFillAllStream(projectId);
    this.researchSub?.unsubscribe();
    this.researchSub = this.generationService
      .startGeneration('finance-fill', connection)
      .subscribe({
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
          this.error.set(
            this.translate.instant('dashboard.finance.errors.aiFillFailed') || 'AI auto-fill failed',
          );
        },
      });
  }

  /** Ferme la salle de contrôle de l'auto-fill sourcé. */
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

  protected onAutoFillSection(sectionKey: string): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) return;
    // Mapping: les clés "computed" ne sont pas auto-fillables, on ignore.
    const AUTOFILLABLE: FinanceSectionKey[] = [
      'products',
      'salesObjectives',
      'revenueParams',
      'variableCharges',
      'fixedCharges',
      'taxesParams',
      'investments',
      'financing',
      'ratiosParams',
    ];
    if (!AUTOFILLABLE.includes(sectionKey as FinanceSectionKey)) return;

    this.aiSectionLoading.update((m) => ({ ...m, [sectionKey]: true }));
    this.financeService.autoFillSection(projectId, sectionKey as FinanceSectionKey).subscribe({
      next: () => {
        this.aiSectionLoading.update((m) => ({ ...m, [sectionKey]: false }));
        this.loadSummary();
      },
      error: (err) => {
        console.error(`[FinanceOverview] autoFillSection(${sectionKey}) failed`, err);
        this.aiSectionLoading.update((m) => ({ ...m, [sectionKey]: false }));
      },
    });
  }

  protected sectionLoading(key: string): boolean {
    return !!this.aiSectionLoading()[key];
  }

  // -------------------------------------------------------------------
  // PDF report
  // -------------------------------------------------------------------

  protected onDownloadPdf(): void {
    const projectId = this.cookieService.get('projectId');
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
  // Formatters (utilisés depuis le template)
  // -------------------------------------------------------------------

  protected formatCurrency(value: number | undefined): string {
    return FinanceService.formatCurrency(value || 0, this.currency());
  }

  protected formatPercent(value: number | undefined): string {
    return FinanceService.formatPercent(value || 0);
  }

  protected formatDays(value: number | undefined): string {
    if (!Number.isFinite(value || 0)) return '—';
    return `${Math.round(value || 0)} j`;
  }

  protected statusBadgeClass(status: SectionCompletionStatus | 'computed'): string {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'in_progress':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'computed':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      default:
        return 'bg-[var(--glass-bg-subtle)] text-text-tertiary border-gray-500/30';
    }
  }

  protected statusLabelKey(status: SectionCompletionStatus | 'computed'): string {
    switch (status) {
      case 'completed':
        return 'dashboard.finance.status.completed';
      case 'in_progress':
        return 'dashboard.finance.status.inProgress';
      case 'computed':
        return 'dashboard.finance.status.computed';
      default:
        return 'dashboard.finance.status.empty';
    }
  }

  /** Helper pour les @for trackBy */
  protected trackByKey = (_: number, item: { key: string }): string => item.key;
}
