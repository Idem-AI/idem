import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { FinanceService } from '../../../services/finance.service';
import {
  FINANCE_SECTIONS,
  FinanceModel,
  FinanceSectionKey,
  ProductPricing,
  SalesObjective,
  VariableChargeLine,
  FixedChargeLine,
  SalaryLine,
  InvestmentLine,
  FINANCE_PROJECTION_MONTHS,
} from '../../../models/finance.model';
import { AiFillButtonComponent } from '../../../components/ai-fill-button/ai-fill-button';

/**
 * Finance sub-section page — renders data & CRUD for each section.
 * The sectionKey is provided via route data.
 */
@Component({
  selector: 'app-finance-section-stub',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslateModule, AiFillButtonComponent],
  templateUrl: './finance-section-stub.html',
  styleUrl: './finance-section-stub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinanceSectionStubComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly financeService = inject(FinanceService);
  private readonly translate = inject(TranslateService);

  protected readonly sectionKey = signal<string>('');
  protected readonly finance = signal<FinanceModel | null>(null);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly aiLoading = signal<boolean>(false);
  protected readonly saving = signal<boolean>(false);
  protected readonly dirty = signal<boolean>(false);
  protected readonly selectedYear = signal<number>(0); // 0-indexed year tab

  protected readonly descriptor = computed(() => {
    const key = this.sectionKey();
    return FINANCE_SECTIONS.find((s) => s.key === key);
  });

  protected readonly projectionYears = computed(() => this.finance()?.projectionYears || 3);
  protected readonly currency = computed(() => this.finance()?.meta?.currency || 'XAF');
  protected readonly months = computed(() => {
    const years = this.projectionYears();
    return Array.from({ length: years * 12 }, (_, i) => i);
  });

  // ----- Year-based month slicing (for selected year tab) -----
  protected readonly yearMonths = computed(() => {
    const y = this.selectedYear();
    const start = y * 12;
    return Array.from({ length: 12 }, (_, i) => start + i);
  });

  protected readonly yearLabels = computed(() => {
    return Array.from({ length: this.projectionYears() }, (_, i) => `An ${i + 1}`);
  });

  // ----- Products -----
  protected readonly products = computed(() => this.finance()?.products || []);
  protected readonly salesObjectives = computed(() => this.finance()?.salesObjectives || []);

  // ----- Charges -----
  protected readonly variableCharges = computed(() => this.finance()?.variableCharges);
  protected readonly fixedCharges = computed(() => this.finance()?.fixedCharges);

  // ----- Investments -----
  protected readonly investments = computed(() => this.finance()?.investments || []);

  // ----- Financing -----
  protected readonly financing = computed(() => this.finance()?.financing);

  // ----- Params -----
  protected readonly revenueParams = computed(() => this.finance()?.revenueParams);
  protected readonly taxesParams = computed(() => this.finance()?.taxesParams);
  protected readonly ratiosParams = computed(() => this.finance()?.ratiosParams);

  // ----- Computed (read-only) -----
  protected readonly computedData = computed(() => this.finance()?.computed);

  ngOnInit(): void {
    const sectionKey = this.route.snapshot.data['sectionKey'] as string;
    this.sectionKey.set(sectionKey || 'overview');

    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.router.navigate(['/projects']);
      return;
    }
    this.loadFinance(projectId);
  }

  private loadFinance(projectId: string): void {
    this.isLoading.set(true);
    this.financeService.getFinance(projectId).subscribe({
      next: (f) => {
        this.finance.set(f);
        this.isLoading.set(false);
      },
      error: (err) => {
        if (err?.status !== 404) {
          console.error('[FinanceSection] load failed', err);
        }
        this.finance.set(null);
        this.isLoading.set(false);
      },
    });
  }

  // ============================================================
  // CRUD — Products
  // ============================================================

  protected addProduct(): void {
    const f = this.finance();
    if (!f) return;
    const years = f.projectionYears;
    const newProduct: ProductPricing = {
      id: `p-${Date.now()}`,
      name: '',
      prices: Array(years).fill(0),
      unitCosts: Array(years).fill(0),
    };
    const updated = { ...f, products: [...f.products, newProduct] };
    this.finance.set(updated);
    this.dirty.set(true);
  }

  protected removeProduct(idx: number): void {
    const f = this.finance();
    if (!f) return;
    const products = [...f.products];
    const removedId = products[idx].id;
    products.splice(idx, 1);
    // Also remove related sales objective
    const salesObjectives = f.salesObjectives.filter(s => s.productId !== removedId);
    this.finance.set({ ...f, products, salesObjectives });
    this.dirty.set(true);
  }

  // ============================================================
  // CRUD — Variable Charge Lines
  // ============================================================

  protected addVariableChargeLine(): void {
    const f = this.finance();
    if (!f?.variableCharges) return;
    const newLine: VariableChargeLine = {
      id: `v-${Date.now()}`,
      category: 'autresChargesExternes',
      label: '',
      monthlyValues: Array(FINANCE_PROJECTION_MONTHS).fill(0),
    };
    const updated = {
      ...f,
      variableCharges: {
        ...f.variableCharges,
        lines: [...f.variableCharges.lines, newLine],
      },
    };
    this.finance.set(updated);
    this.dirty.set(true);
  }

  protected removeVariableChargeLine(idx: number): void {
    const f = this.finance();
    if (!f?.variableCharges) return;
    const lines = [...f.variableCharges.lines];
    lines.splice(idx, 1);
    this.finance.set({
      ...f,
      variableCharges: { ...f.variableCharges, lines },
    });
    this.dirty.set(true);
  }

  // ============================================================
  // CRUD — Fixed Charge Lines
  // ============================================================

  protected addFixedChargeLine(): void {
    const f = this.finance();
    if (!f?.fixedCharges) return;
    const newLine: FixedChargeLine = {
      id: `f-${Date.now()}`,
      category: 'locations',
      label: '',
      monthlyValues: Array(FINANCE_PROJECTION_MONTHS).fill(0),
    };
    this.finance.set({
      ...f,
      fixedCharges: {
        ...f.fixedCharges,
        lines: [...f.fixedCharges.lines, newLine],
      },
    });
    this.dirty.set(true);
  }

  protected removeFixedChargeLine(idx: number): void {
    const f = this.finance();
    if (!f?.fixedCharges) return;
    const lines = [...f.fixedCharges.lines];
    lines.splice(idx, 1);
    this.finance.set({
      ...f,
      fixedCharges: { ...f.fixedCharges, lines },
    });
    this.dirty.set(true);
  }

  protected addSalary(): void {
    const f = this.finance();
    if (!f?.fixedCharges) return;
    const newSalary: SalaryLine = {
      id: `s-${Date.now()}`,
      position: '',
      monthlyValues: Array(FINANCE_PROJECTION_MONTHS).fill(0),
    };
    this.finance.set({
      ...f,
      fixedCharges: {
        ...f.fixedCharges,
        salaries: [...f.fixedCharges.salaries, newSalary],
      },
    });
    this.dirty.set(true);
  }

  protected removeSalary(idx: number): void {
    const f = this.finance();
    if (!f?.fixedCharges) return;
    const salaries = [...f.fixedCharges.salaries];
    salaries.splice(idx, 1);
    this.finance.set({
      ...f,
      fixedCharges: { ...f.fixedCharges, salaries },
    });
    this.dirty.set(true);
  }

  // ============================================================
  // CRUD — Investments
  // ============================================================

  protected addInvestment(): void {
    const f = this.finance();
    if (!f) return;
    const newInv: InvestmentLine = {
      id: `i-${Date.now()}`,
      category: 'logiciels',
      amortGroup: 'incorporelles',
      label: '',
      monthlyValues: Array(FINANCE_PROJECTION_MONTHS).fill(0),
    };
    this.finance.set({ ...f, investments: [...f.investments, newInv] });
    this.dirty.set(true);
  }

  protected removeInvestment(idx: number): void {
    const f = this.finance();
    if (!f) return;
    const investments = [...f.investments];
    investments.splice(idx, 1);
    this.finance.set({ ...f, investments });
    this.dirty.set(true);
  }

  // ============================================================
  // Save section
  // ============================================================

  protected saveSection(): void {
    const f = this.finance();
    const projectId = this.cookieService.get('projectId');
    const key = this.sectionKey() as FinanceSectionKey;
    if (!f || !projectId) return;

    // Map section key to the correct payload
    const sectionData = this.getSectionPayload(f, key);
    if (sectionData === undefined) return;

    this.saving.set(true);
    this.financeService.updateSection(projectId, key, sectionData).subscribe({
      next: (updated) => {
        this.finance.set(updated);
        this.dirty.set(false);
        this.saving.set(false);
      },
      error: (err) => {
        console.error(`[FinanceSection] save(${key}) failed`, err);
        this.saving.set(false);
      },
    });
  }

  private getSectionPayload(f: FinanceModel, key: string): any {
    switch (key) {
      case 'products': return f.products;
      case 'salesObjectives': return f.salesObjectives;
      case 'revenueParams': return f.revenueParams;
      case 'variableCharges': return f.variableCharges;
      case 'fixedCharges': return f.fixedCharges;
      case 'taxesParams': return f.taxesParams;
      case 'investments': return f.investments;
      case 'financing': return f.financing;
      case 'ratiosParams': return f.ratiosParams;
      default: return undefined;
    }
  }

  // ============================================================
  // AI auto-fill
  // ============================================================

  protected onAutoFill(): void {
    const projectId = this.cookieService.get('projectId');
    const key = this.sectionKey() as FinanceSectionKey;
    const AUTOFILLABLE: FinanceSectionKey[] = [
      'products', 'salesObjectives', 'revenueParams',
      'variableCharges', 'fixedCharges', 'taxesParams',
      'investments', 'financing', 'ratiosParams',
    ];
    if (!projectId || !AUTOFILLABLE.includes(key)) return;

    this.aiLoading.set(true);
    this.financeService.autoFillSection(projectId, key).subscribe({
      next: (result) => {
        this.finance.set(result.finance);
        this.aiLoading.set(false);
        this.dirty.set(false);
      },
      error: (err) => {
        console.error(`[FinanceSection] autoFill(${key}) failed`, err);
        this.aiLoading.set(false);
      },
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  protected markDirty(): void {
    this.dirty.set(true);
  }

  protected formatCurrency(value: number | undefined): string {
    return FinanceService.formatCurrency(value || 0, this.currency());
  }

  protected formatPercent(value: number | undefined): string {
    return FinanceService.formatPercent(value || 0);
  }

  protected monthLabel(monthIndex: number): string {
    const m = (monthIndex % 12) + 1;
    const y = Math.floor(monthIndex / 12) + 1;
    return `M${m}A${y}`;
  }

  protected productNameById(id: string): string {
    const p = this.products().find(pr => pr.id === id);
    return p?.name || id;
  }

  protected selectYear(y: number): void {
    this.selectedYear.set(y);
  }

  protected trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  protected trackByIdx(idx: number): number {
    return idx;
  }

  protected trackByYear(_: number, item: { year: number }): number {
    return item.year;
  }

  protected trackByCategory(_: number, item: { category: string }): string {
    return item.category;
  }
}
