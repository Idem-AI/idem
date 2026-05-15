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
import { CookieService } from '../../../../../shared/services/cookie.service';
import { FinanceService } from '../../../services/finance.service';
import {
  FINANCE_SECTIONS,
  FinanceModel,
  FinanceSummary,
  FinanceSummaryResponse,
  SectionCompletionStatus,
} from '../../../models/finance.model';
import { AiFillButtonComponent } from '../../../components/ai-fill-button/ai-fill-button';

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
  imports: [CommonModule, RouterLink, TranslateModule, AiFillButtonComponent],
  templateUrl: './finance-overview.html',
  styleUrl: './finance-overview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceOverviewComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly cookieService = inject(CookieService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  protected readonly isLoading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly finance = signal<FinanceModel | null>(null);
  protected readonly summary = signal<FinanceSummary | null>(null);
  protected readonly aiGlobalLoading = signal<boolean>(false);
  protected readonly aiSectionLoading = signal<Record<string, boolean>>({});

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
  protected readonly chargesDonutData = computed<{ fixed: number; variable: number; fixedPct: number; variablePct: number }>(() => {
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
    this.aiGlobalLoading.set(true);
    // TODO Phase 3: appeler l'endpoint IA réel.
    setTimeout(() => {
      this.aiGlobalLoading.set(false);
      this.loadSummary();
    }, 1500);
  }

  protected onAutoFillSection(sectionKey: string): void {
    this.aiSectionLoading.update((m) => ({ ...m, [sectionKey]: true }));
    // TODO Phase 3: appeler l'endpoint IA pour cette section uniquement.
    setTimeout(() => {
      this.aiSectionLoading.update((m) => ({ ...m, [sectionKey]: false }));
      this.loadSummary();
    }, 1200);
  }

  protected sectionLoading(key: string): boolean {
    return !!this.aiSectionLoading()[key];
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
        return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
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
