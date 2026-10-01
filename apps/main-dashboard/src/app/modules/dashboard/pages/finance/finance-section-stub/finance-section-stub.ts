import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { CookieService } from '../../../../../shared/services/cookie.service';
import { FinanceService } from '../../../services/finance.service';
import {
  FINANCE_PROJECTION_MONTHS,
  FINANCE_REPORTS,
  FINANCE_SETTINGS,
  FINANCE_STEPS,
  FIXED_CHARGE_OPTIONS,
  FinanceModel,
  FinanceSectionKey,
  FixedChargeCategory,
  FixedChargeLine,
  INVESTMENT_OPTIONS,
  InvestmentLine,
  LoanParams,
  ProductPricing,
  SalaryLine,
  VARIABLE_CHARGE_OPTIONS,
  VariableChargeCategory,
  VariableChargeLine,
  financeMonthLabels,
} from '../../../models/finance.model';
import { FinanceIllustrationComponent } from '../finance-illustration/finance-illustration';
import { MonthlyAmountEditorComponent } from '../monthly-amount-editor/monthly-amount-editor';

type PageKind = 'step' | 'setting' | 'report';
type LoanKey = 'compteCourantAssocies' | 'cmt' | 'creditBail';

const AUTOFILLABLE: readonly FinanceSectionKey[] = [
  'products',
  'salesObjectives',
  'revenueParams',
  'variableCharges',
  'fixedCharges',
  'taxesParams',
  'investments',
  'financing',
];

const zeros = (): number[] => Array<number>(FINANCE_PROJECTION_MONTHS).fill(0);
const newId = (prefix: string): string =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;

/**
 * Une page du module finance : une étape du parcours, un réglage, ou un
 * tableau calculé. La clé arrive par la route (`data.sectionKey`).
 *
 * Les étapes parlent la langue de l'utilisateur : « Ce que vous vendez »,
 * pas « Produits & Prix » ; « 150 000 par mois à partir de mars », pas 36
 * colonnes. Les modifications restent locales jusqu'à « Enregistrer » ; une
 * barre le rappelle dès qu'il y en a, et « Étape suivante » enregistre avant
 * de partir.
 */
@Component({
  selector: 'app-finance-section-stub',
  imports: [
    RouterLink,
    TranslateModule,
    IdemLoaderComponent,
    FinanceIllustrationComponent,
    MonthlyAmountEditorComponent,
  ],
  templateUrl: './finance-section-stub.html',
  styleUrl: './finance-section-stub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class FinanceSectionStubComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cookieService = inject(CookieService);
  private readonly financeService = inject(FinanceService);
  private readonly translate = inject(TranslateService);

  protected readonly sectionKey = signal<string>('');
  protected readonly finance = signal<FinanceModel | null>(null);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly loadError = signal<boolean>(false);
  protected readonly aiLoading = signal<boolean>(false);
  protected readonly saving = signal<boolean>(false);
  protected readonly dirty = signal<boolean>(false);
  protected readonly savedNotice = signal<boolean>(false);
  protected readonly saveError = signal<string>('');
  protected readonly selectedYear = signal<number>(0);
  /** Produits dont le prix varie d'une année à l'autre (affiche une case par an). */
  protected readonly pricesByYear = signal<ReadonlySet<string>>(new Set());

  private projectId = '';
  private savedTimer?: ReturnType<typeof setTimeout>;

  protected readonly variableOptions = VARIABLE_CHARGE_OPTIONS;
  protected readonly fixedOptions = FIXED_CHARGE_OPTIONS;
  protected readonly investmentOptions = Object.keys(INVESTMENT_OPTIONS);

  // -------------------------------------------------------------------
  // Où sommes-nous dans le parcours ?
  // -------------------------------------------------------------------

  protected readonly kind = computed<PageKind>(() => {
    const key = this.sectionKey();
    if (FINANCE_STEPS.some((s) => s.key === key)) return 'step';
    if (FINANCE_SETTINGS.some((s) => s.key === key)) return 'setting';
    return 'report';
  });

  protected readonly stepIndex = computed(() => FINANCE_STEPS.findIndex((s) => s.key === this.sectionKey()));
  protected readonly stepCount = FINANCE_STEPS.length;
  protected readonly previousStep = computed(() => FINANCE_STEPS[this.stepIndex() - 1] ?? null);
  protected readonly nextStep = computed(() => {
    const i = this.stepIndex();
    return i >= 0 ? (FINANCE_STEPS[i + 1] ?? null) : null;
  });
  protected readonly canAutoFill = computed(() =>
    AUTOFILLABLE.includes(this.sectionKey() as FinanceSectionKey),
  );
  protected readonly reportIcon = computed(
    () => FINANCE_REPORTS.find((r) => r.key === this.sectionKey())?.icon ?? 'pi pi-table',
  );

  // -------------------------------------------------------------------
  // Calendrier
  // -------------------------------------------------------------------

  protected readonly currency = computed(() => this.finance()?.meta?.currency || 'XAF');

  protected readonly fiscalCalendar = computed(
    () =>
      this.finance()?.fiscalCalendar ?? {
        firstYear: new Date().getFullYear(),
        activityStartMonth: 1,
        fiscalYearEndMonth: 12,
      },
  );

  /** Le serveur ramène la clôture à décembre là où la loi l'impose. */
  protected readonly calendarYearEnforced = computed(
    () => this.fiscalCalendar().fiscalYearEndMonth === 12,
  );

  protected readonly yearLabels = computed(() => {
    const first = this.fiscalCalendar().firstYear || new Date().getFullYear();
    const endMonth = this.fiscalCalendar().fiscalYearEndMonth ?? 12;
    return Array.from({ length: this.finance()?.projectionYears || 3 }, (_, i) =>
      endMonth === 12 ? String(first + i) : `${first + i}-${first + i + 1}`,
    );
  });

  protected readonly monthLabels = computed(() =>
    financeMonthLabels(this.finance()?.fiscalCalendar, this.translate.currentLang || 'fr'),
  );

  protected readonly monthNames = computed(() => {
    const format = new Intl.DateTimeFormat(this.translate.currentLang || 'fr', { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => format.format(new Date(2026, i, 1)));
  });

  protected readonly firstYearActiveMonths = computed(
    () => 13 - Math.min(12, Math.max(1, this.fiscalCalendar().activityStartMonth || 1)),
  );

  // -------------------------------------------------------------------
  // Données de l'étape
  // -------------------------------------------------------------------

  protected readonly products = computed(() => this.finance()?.products ?? []);
  protected readonly variableCharges = computed(() => this.finance()?.variableCharges);
  protected readonly fixedCharges = computed(() => this.finance()?.fixedCharges);
  protected readonly investments = computed(() => this.finance()?.investments ?? []);
  protected readonly financing = computed(() => this.finance()?.financing);
  protected readonly revenueParams = computed(() => this.finance()?.revenueParams);
  protected readonly taxesParams = computed(() => this.finance()?.taxesParams);
  protected readonly ratiosParams = computed(() => this.finance()?.ratiosParams);
  protected readonly computedData = computed(() => this.finance()?.computed);

  /** Ventes par produit, avec le chiffre d'affaires qu'elles donnent l'an 1. */
  protected readonly salesRows = computed(() => {
    const f = this.finance();
    if (!f) return [];
    return f.products.map((p) => {
      const quantities = f.salesObjectives.find((s) => s.productId === p.id)?.monthlyQuantities ?? zeros();
      const revenue = [0, 1, 2].map(
        (y) => quantities.slice(y * 12, y * 12 + 12).reduce((a, b) => a + (b || 0), 0) * (p.prices[y] ?? p.prices[0] ?? 0),
      );
      return { product: p, quantities, revenue };
    });
  });

  /** Total du financement trouvé, recalculé à chaque frappe. */
  protected readonly financingTotal = computed(() => {
    const f = this.financing();
    if (!f) return 0;
    return (
      (f.apportCapital || 0) +
      (f.compteCourantAssocies?.amount || 0) +
      (f.cmt?.amount || 0) +
      (f.creditBail?.amount || 0) +
      (f.subvention || 0)
    );
  });

  /** Le besoin vient du dernier calcul enregistré : investissements + fonds de roulement. */
  protected readonly financingNeed = computed(() => this.computedData()?.financing?.coutTotalProjet ?? 0);
  protected readonly financingGap = computed(() => this.financingNeed() - this.financingTotal());

  // -------------------------------------------------------------------
  // Cycle de vie
  // -------------------------------------------------------------------

  ngOnInit(): void {
    this.sectionKey.set((this.route.snapshot.data['sectionKey'] as string) || 'products');
    this.projectId = this.cookieService.get('projectId') || '';
    if (!this.projectId) {
      this.router.navigate(['/projects']);
      return;
    }
    this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.savedTimer);
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.financeService.getFinance(this.projectId).subscribe({
      next: (f) => {
        this.setFinance(f);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[FinanceSection] load failed', err);
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  private setFinance(f: FinanceModel): void {
    this.finance.set(f);
    this.dirty.set(false);
    // Un prix qui change d'une année à l'autre s'affiche année par année.
    this.pricesByYear.set(
      new Set(
        f.products
          .filter((p) => p.prices.some((v) => v !== p.prices[0]) || p.unitCosts.some((v) => v !== p.unitCosts[0]))
          .map((p) => p.id),
      ),
    );
  }

  private patch(update: (f: FinanceModel) => FinanceModel): void {
    const f = this.finance();
    if (!f) return;
    this.finance.set(update(f));
    this.dirty.set(true);
    this.savedNotice.set(false);
  }

  // -------------------------------------------------------------------
  // Étape 1 — ce que vous vendez
  // -------------------------------------------------------------------

  protected addProduct(): void {
    this.patch((f) => {
      const product: ProductPricing = {
        id: newId('p'),
        name: '',
        prices: Array(f.projectionYears).fill(0),
        unitCosts: Array(f.projectionYears).fill(0),
      };
      return { ...f, products: [...f.products, product] };
    });
  }

  protected removeProduct(id: string): void {
    this.patch((f) => ({
      ...f,
      products: f.products.filter((p) => p.id !== id),
      salesObjectives: f.salesObjectives.filter((s) => s.productId !== id),
    }));
  }

  protected setProductName(id: string, name: string): void {
    this.updateProduct(id, (p) => ({ ...p, name }));
  }

  /** Sans détail par année, un prix vaut pour les trois années. */
  protected setProductAmount(id: string, field: 'prices' | 'unitCosts', value: number, year?: number): void {
    const v = Number.isFinite(value) ? Math.max(0, value) : 0;
    this.updateProduct(id, (p) => ({
      ...p,
      [field]: year === undefined ? p[field].map(() => v) : p[field].map((x, i) => (i === year ? v : x)),
    }));
  }

  protected togglePricesByYear(id: string): void {
    const on = !this.pricesByYear().has(id);
    this.pricesByYear.update((set) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    // Revenir à un prix unique reprend celui de la première année.
    if (!on) {
      this.updateProduct(id, (p) => ({
        ...p,
        prices: p.prices.map(() => p.prices[0] || 0),
        unitCosts: p.unitCosts.map(() => p.unitCosts[0] || 0),
      }));
    }
  }

  protected margin(p: ProductPricing): { amount: number; pct: number } {
    const price = p.prices[0] || 0;
    const amount = price - (p.unitCosts[0] || 0);
    return { amount, pct: price > 0 ? (amount / price) * 100 : 0 };
  }

  private updateProduct(id: string, update: (p: ProductPricing) => ProductPricing): void {
    this.patch((f) => ({ ...f, products: f.products.map((p) => (p.id === id ? update(p) : p)) }));
  }

  // -------------------------------------------------------------------
  // Étape 2 — combien vous allez vendre
  // -------------------------------------------------------------------

  protected setSales(productId: string, quantities: number[]): void {
    this.patch((f) => {
      const exists = f.salesObjectives.some((s) => s.productId === productId);
      return {
        ...f,
        salesObjectives: exists
          ? f.salesObjectives.map((s) => (s.productId === productId ? { ...s, monthlyQuantities: quantities } : s))
          : [...f.salesObjectives, { productId, monthlyQuantities: quantities }],
      };
    });
  }

  // -------------------------------------------------------------------
  // Étapes 3 et 4 — vos dépenses
  // -------------------------------------------------------------------

  protected addVariableLine(): void {
    this.patch((f) => {
      const line: VariableChargeLine = { id: newId('v'), category: 'achatsMarchandises', label: '', monthlyValues: zeros() };
      return { ...f, variableCharges: { ...f.variableCharges, lines: [...f.variableCharges.lines, line] } };
    });
  }

  protected updateVariableLine(id: string, patch: Partial<VariableChargeLine>): void {
    this.patch((f) => ({
      ...f,
      variableCharges: {
        ...f.variableCharges,
        lines: f.variableCharges.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      },
    }));
  }

  protected removeVariableLine(id: string): void {
    this.patch((f) => ({
      ...f,
      variableCharges: { ...f.variableCharges, lines: f.variableCharges.lines.filter((l) => l.id !== id) },
    }));
  }

  protected addFixedLine(): void {
    this.patch((f) => {
      const line: FixedChargeLine = { id: newId('f'), category: 'locations', label: '', monthlyValues: zeros() };
      return { ...f, fixedCharges: { ...f.fixedCharges, lines: [...f.fixedCharges.lines, line] } };
    });
  }

  protected updateFixedLine(id: string, patch: Partial<FixedChargeLine>): void {
    this.patch((f) => ({
      ...f,
      fixedCharges: {
        ...f.fixedCharges,
        lines: f.fixedCharges.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      },
    }));
  }

  protected removeFixedLine(id: string): void {
    this.patch((f) => ({
      ...f,
      fixedCharges: { ...f.fixedCharges, lines: f.fixedCharges.lines.filter((l) => l.id !== id) },
    }));
  }

  protected addSalary(): void {
    this.patch((f) => {
      const salary: SalaryLine = { id: newId('s'), position: '', monthlyValues: zeros() };
      return { ...f, fixedCharges: { ...f.fixedCharges, salaries: [...f.fixedCharges.salaries, salary] } };
    });
  }

  protected updateSalary(id: string, patch: Partial<SalaryLine>): void {
    this.patch((f) => ({
      ...f,
      fixedCharges: {
        ...f.fixedCharges,
        salaries: f.fixedCharges.salaries.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
    }));
  }

  protected removeSalary(id: string): void {
    this.patch((f) => ({
      ...f,
      fixedCharges: { ...f.fixedCharges, salaries: f.fixedCharges.salaries.filter((s) => s.id !== id) },
    }));
  }

  // -------------------------------------------------------------------
  // Étape 5 — vos achats pour démarrer
  // -------------------------------------------------------------------

  protected addInvestment(): void {
    this.patch((f) => {
      const line: InvestmentLine = {
        id: newId('i'),
        category: 'autresMateriels',
        amortGroup: INVESTMENT_OPTIONS['autresMateriels'],
        label: '',
        monthlyValues: zeros(),
      };
      return { ...f, investments: [...f.investments, line] };
    });
  }

  /** Changer le type d'achat change sa durée d'amortissement, sans rien demander. */
  protected updateInvestment(id: string, patch: Partial<InvestmentLine>): void {
    if (patch.category && INVESTMENT_OPTIONS[patch.category]) {
      patch = { ...patch, amortGroup: INVESTMENT_OPTIONS[patch.category] };
    }
    this.patch((f) => ({ ...f, investments: f.investments.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  }

  protected removeInvestment(id: string): void {
    this.patch((f) => ({ ...f, investments: f.investments.filter((i) => i.id !== id) }));
  }

  // -------------------------------------------------------------------
  // Étape 6 — votre financement, et les réglages
  // -------------------------------------------------------------------

  protected setFinancingAmount(key: 'apportCapital' | 'subvention', value: number): void {
    this.patch((f) => ({ ...f, financing: { ...f.financing, [key]: Number.isFinite(value) ? Math.max(0, value) : 0 } }));
  }

  protected setLoan(key: LoanKey, field: keyof LoanParams, value: number | string): void {
    this.patch((f) => ({
      ...f,
      financing: { ...f.financing, [key]: { ...f.financing[key], [field]: value } },
    }));
  }

  /** Réglage simple : `section.field = value` (taux, régime, calendrier…). */
  protected setParam(section: 'revenueParams' | 'taxesParams' | 'ratiosParams' | 'fiscalCalendar' | 'variableCharges' | 'fixedCharges', field: string, value: unknown): void {
    if (typeof value === 'number' && !Number.isFinite(value)) value = 0;
    this.patch((f) => ({ ...f, [section]: { ...(f[section] as object), [field]: value } }));
  }

  // -------------------------------------------------------------------
  // Enregistrer, annuler, avancer
  // -------------------------------------------------------------------

  protected save(): void {
    this.persist()?.subscribe({ error: () => undefined });
  }

  /** « Étape suivante » enregistre d'abord : on ne perd jamais une saisie en avançant. */
  protected go(route: string | null): void {
    const target = route ? ['/project/finance', route] : ['/project/finance'];
    if (!this.dirty()) {
      this.router.navigate(target);
      return;
    }
    this.persist()?.subscribe({ next: () => this.router.navigate(target), error: () => undefined });
  }

  protected discard(): void {
    this.load();
  }

  protected confirmLeave(event: Event): void {
    if (this.dirty() && !window.confirm(this.translate.instant('dashboard.finance.save.leaveConfirm'))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  private persist(): Observable<FinanceModel> | null {
    const f = this.finance();
    const key = this.sectionKey() as FinanceSectionKey;
    const payload = f ? this.sectionPayload(f, key) : undefined;
    if (!f || payload === undefined) return null;

    const save = (section: FinanceSectionKey, data: unknown) =>
      this.financeService.updateSection(this.projectId, section, data as never);
    // Retirer un produit retire ses ventes : les deux listes partent ensemble.
    const before$: Observable<unknown> =
      key === 'products'
        ? save('salesObjectives', this.sectionPayload(f, 'salesObjectives'))
        : of(null);

    this.saving.set(true);
    this.saveError.set('');
    return before$.pipe(
      switchMap(() => save(key, payload)),
      tap((updated: FinanceModel) => {
        this.setFinance(updated);
        this.saving.set(false);
        this.flashSaved();
      }),
      catchError((err) => {
        console.error(`[FinanceSection] save(${key}) failed`, err);
        this.saving.set(false);
        this.saveError.set(this.translate.instant('dashboard.finance.save.error'));
        return throwError(() => err);
      }),
    );
  }

  private flashSaved(): void {
    this.savedNotice.set(true);
    clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => this.savedNotice.set(false), 3000);
  }

  private sectionPayload(f: FinanceModel, key: string): unknown {
    switch (key) {
      case 'products':
        return f.products.map((p) => ({ ...p, name: p.name.trim() || this.translate.instant('dashboard.finance.fields.unnamedProduct') }));
      case 'salesObjectives':
        return f.salesObjectives.filter((s) => f.products.some((p) => p.id === s.productId));
      case 'revenueParams':
        return f.revenueParams;
      case 'variableCharges':
        return f.variableCharges;
      case 'fixedCharges':
        return f.fixedCharges;
      case 'taxesParams':
        return f.taxesParams;
      case 'investments':
        return f.investments;
      case 'financing':
        return f.financing;
      case 'ratiosParams':
        return f.ratiosParams;
      case 'fiscalCalendar':
        return f.fiscalCalendar;
      default:
        return undefined;
    }
  }

  // -------------------------------------------------------------------
  // Proposition de l'IA pour cette étape
  // -------------------------------------------------------------------

  protected onAutoFill(): void {
    const key = this.sectionKey() as FinanceSectionKey;
    if (!this.canAutoFill()) return;
    if (this.sectionHasData() && !window.confirm(this.translate.instant('dashboard.finance.ai.replaceConfirm'))) return;

    this.aiLoading.set(true);
    this.saveError.set('');
    this.financeService.autoFillSection(this.projectId, key).subscribe({
      next: (result) => {
        this.setFinance(result.finance);
        this.aiLoading.set(false);
      },
      error: (err) => {
        console.error(`[FinanceSection] autoFill(${key}) failed`, err);
        this.aiLoading.set(false);
        this.saveError.set(
          typeof err?.error?.message === 'string' && err.status === 402
            ? err.error.message
            : this.translate.instant('dashboard.finance.errors.aiFillFailed'),
        );
      },
    });
  }

  private sectionHasData(): boolean {
    const f = this.finance();
    if (!f) return false;
    switch (this.sectionKey()) {
      case 'products':
        return f.products.length > 0;
      case 'salesObjectives':
        return f.salesObjectives.some((s) => s.monthlyQuantities.some((q) => q > 0));
      case 'variableCharges':
        return f.variableCharges.lines.length > 0;
      case 'fixedCharges':
        return f.fixedCharges.lines.length + f.fixedCharges.salaries.length > 0;
      case 'investments':
        return f.investments.length > 0;
      case 'financing':
        return this.financingTotal() > 0;
      default:
        return true;
    }
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

  /**
   * Libellé d'une catégorie. Les catégories hors de la liste proposée (venues
   * d'un import ou de l'IA) n'ont pas toutes une traduction : on rend alors le
   * nom technique lisible plutôt qu'une clé de traduction.
   */
  protected categoryLabel(group: 'variable' | 'fixed' | 'investment', key: string): string {
    const path = `dashboard.finance.categories.${group}.${key}`;
    const label = this.translate.instant(path);
    if (label !== path) return label;
    const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  protected optionsWith<T extends string>(options: readonly T[], current: string): string[] {
    return options.includes(current as T) ? [...options] : [...options, current];
  }

  protected yearTotal(values: number[], year: number): number {
    return values.slice(year * 12, year * 12 + 12).reduce((a, b) => a + (b || 0), 0);
  }

  protected toNumber(value: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  protected typeVariable(value: string): VariableChargeCategory {
    return value as VariableChargeCategory;
  }

  protected typeFixed(value: string): FixedChargeCategory {
    return value as FixedChargeCategory;
  }
}
