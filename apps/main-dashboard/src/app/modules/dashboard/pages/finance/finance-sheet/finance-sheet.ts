import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import { CookieService } from '../../../../../shared/services/cookie.service';
import {
  FIXED_CHARGE_OPTIONS,
  financeMonthLabels,
  FinanceModel,
  INVESTMENT_OPTIONS,
  VARIABLE_CHARGE_OPTIONS,
} from '../../../models/finance.model';
import { FinanceService } from '../../../services/finance.service';
import { FinanceIllustrationComponent } from '../finance-illustration/finance-illustration';
import { FinanceImportDialogComponent } from '../finance-import-dialog/finance-import-dialog';
import { FinanceModeSwitchComponent } from '../finance-mode-switch/finance-mode-switch';
import { FinanceSheetGridComponent, RowNote } from './finance-sheet-grid';
import {
  guessCategory,
  normalizeText,
  parseAmount,
  parseFunding,
  parseMonth,
  parseSection,
  PLAN_COLUMNS,
  PLAN_SECTIONS,
  PlanColumn,
  PlanSection,
} from '../finance-paste/finance-paste.parser';
import {
  buildSheetDraft,
  exportRows,
  isUnchanged,
  PlanRow,
  SheetRow,
} from '../finance-paste/finance-paste.draft';

type CellError = 'required' | 'section' | 'number' | 'positive' | 'month' | 'product' | 'funding';

interface RowCheck {
  empty: boolean;
  errors: Partial<Record<PlanColumn, CellError>>;
  row: PlanRow | null;
}

const CATEGORY_GROUP: Partial<Record<PlanSection, 'variable' | 'fixed' | 'investment'>> = {
  variable: 'variable',
  fixed: 'fixed',
  purchase: 'investment',
};
const FUNDING_ITEM = {
  apportCapital: 'capital',
  compteCourantAssocies: 'partners',
  cmt: 'bank',
  creditBail: 'leasing',
  subvention: 'grant',
} as const;

/**
 * Le mode tableur du prévisionnel.
 *
 * Tout le prévisionnel sur une seule grille, une ligne par élément, six
 * colonnes dans un ordre imposé : Rubrique, Nom, Montant, Coût unitaire, Mois
 * de début, Hausse. On y voit ce qui est déjà saisi, on modifie, on supprime,
 * on ajoute — ou on colle d'un coup un bloc copié dans Excel ou une IA.
 *
 * Le format fixe se lit sans IA, donc sans crédit. Chaque case est vérifiée ;
 * l'enregistrement est refusé tant qu'une case est en rouge. Pour un tableau
 * qui ne suit pas le format, « Laisser l'IA le ranger » le confie à l'import
 * IA — payant, et annoncé comme tel.
 *
 * À l'enregistrement, le tableur fait foi (`sync`) : une ligne effacée ici
 * disparaît du prévisionnel. Une ligne restée intacte repart à l'identique,
 * détail mois par mois compris.
 */
@Component({
  selector: 'app-finance-sheet',
  imports: [
    RouterLink,
    TranslateModule,
    IdemLoaderComponent,
    FinanceIllustrationComponent,
    FinanceImportDialogComponent,
    FinanceModeSwitchComponent,
    FinanceSheetGridComponent,
  ],
  templateUrl: './finance-sheet.html',
  styleUrl: './finance-sheet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class FinanceSheetComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly financeService = inject(FinanceService);
  private readonly cookieService = inject(CookieService);
  private readonly router = inject(Router);

  protected readonly columns = PLAN_COLUMNS;
  protected readonly projectId = signal('');
  protected readonly finance = signal<FinanceModel | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly rows = signal<SheetRow[]>([]);
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly savedNotice = signal(false);
  protected readonly saveError = signal('');
  protected readonly copied = signal(false);
  protected readonly importOpen = signal(false);
  protected readonly importText = signal('');
  /** Repart l'historique d'annulation à chaque chargement ou enregistrement. */
  protected readonly resetToken = signal(0);
  private readonly grid = viewChild(FinanceSheetGridComponent);
  private rawPaste = '';

  protected readonly columnLabels = computed(() =>
    PLAN_COLUMNS.map((c) => this.translate.instant(`dashboard.finance.paste.columns.${c}`) as string),
  );

  protected readonly monthLabels = computed(() =>
    financeMonthLabels(this.finance()?.fiscalCalendar, this.translate.currentLang || 'fr'),
  );

  protected readonly sectionLabels = computed(() =>
    PLAN_SECTIONS.map((s) => this.translate.instant(`dashboard.finance.paste.sections.${s}`) as string),
  );

  private readonly categoryLabels = computed(() => {
    const labels = (group: string, keys: readonly string[]) =>
      Object.fromEntries(keys.map((k) => [k, this.translate.instant(`dashboard.finance.categories.${group}.${k}`) as string]));
    return {
      variable: labels('variable', VARIABLE_CHARGE_OPTIONS),
      fixed: labels('fixed', FIXED_CHARGE_OPTIONS),
      investment: labels('investment', Object.keys(INVESTMENT_OPTIONS)),
    };
  });

  // -------------------------------------------------------------------
  // Chargement
  // -------------------------------------------------------------------

  ngOnInit(): void {
    const projectId = this.cookieService.get('projectId');
    if (!projectId) {
      this.router.navigate(['/projects']);
      return;
    }
    this.projectId.set(projectId);
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.financeService.getFinance(this.projectId()).subscribe({
      next: (f) => {
        this.setFinance(f);
        this.isLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        // Pas encore de prévisionnel : le tableur part vide.
        if (err?.status === 404) {
          this.setFinance(null);
        } else {
          console.error('[FinanceSheet] load failed', err);
          this.loadError.set(true);
        }
        this.isLoading.set(false);
      },
    });
  }

  private setFinance(f: FinanceModel | null): void {
    this.finance.set(f);
    const exported = exportRows(f, {
      section: (s) => this.translate.instant(`dashboard.finance.paste.sections.${s}`),
      funding: (k) => this.translate.instant(`dashboard.finance.import.items.financing.${FUNDING_ITEM[k]}`),
      month: (i) => this.monthLabels()[i] ?? String(i + 1),
    });
    this.rows.set(exported);
    this.dirty.set(false);
    this.rawPaste = '';
    this.resetToken.update((n) => n + 1);
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }

  // -------------------------------------------------------------------
  // Vérification
  // -------------------------------------------------------------------

  protected readonly checks = computed<RowCheck[]>(() => {
    const rows = this.rows();
    // Le tableur fait foi : une vente doit viser un produit présent dans la grille.
    const products = new Set(
      rows.filter((r) => this.section(r.cells[0]) === 'product' && r.cells[1]?.trim()).map((r) => normalizeText(r.cells[1])),
    );
    return rows.map((r) => this.check(r.cells, products));
  });

  protected readonly filledCount = computed(() => this.checks().filter((c) => !c.empty).length);
  protected readonly invalidCount = computed(() => this.checks().filter((c) => !c.empty && !c.row).length);

  private section(raw: string | undefined): PlanSection | null {
    const s = normalizeText(raw ?? '');
    if (!s) return null;
    const exact = this.sectionLabels().findIndex((label) => normalizeText(label) === s);
    return exact >= 0 ? PLAN_SECTIONS[exact] : parseSection(s);
  }

  private check(cells: string[], products: Set<string>): RowCheck {
    const errors: RowCheck['errors'] = {};
    if (cells.every((c) => !c.trim())) return { empty: true, errors, row: null };
    const [sectionCell, name, amountCell, costCell, startCell, growthCell] = cells.map((c) => (c ?? '').trim());

    const section = this.section(sectionCell);
    if (!sectionCell) errors.section = 'required';
    else if (!section) errors.section = 'section';
    if (!name) errors.name = 'required';

    const amount = parseAmount(amountCell);
    if (!amountCell) errors.amount = 'required';
    else if (!Number.isFinite(amount)) errors.amount = 'number';
    else if (amount <= 0) errors.amount = 'positive';

    const unitCost = costCell ? parseAmount(costCell) : 0;
    if (costCell && !Number.isFinite(unitCost)) errors.unitCost = 'number';

    const start = parseMonth(startCell, this.finance()?.fiscalCalendar);
    if (Number.isNaN(start)) errors.start = 'month';

    const growth = growthCell ? parseAmount(growthCell) : 0;
    if (growthCell && !Number.isFinite(growth)) errors.growth = 'number';

    if (section === 'sale' && name && !products.has(normalizeText(name))) errors.name = 'product';
    const funding = section === 'funding' ? parseFunding(name) : null;
    if (section === 'funding' && name && !funding) errors.name = 'funding';

    if (Object.keys(errors).length || !section) return { empty: false, errors, row: null };
    const group = CATEGORY_GROUP[section];
    return {
      empty: false,
      errors,
      row: {
        section,
        name,
        amount,
        unitCost: Math.max(0, unitCost),
        start,
        growth: Math.max(0, growth),
        category: group ? guessCategory(group, '', name, this.categoryLabels()[group]) : undefined,
        funding: funding ?? undefined,
      },
    };
  }

  /** Pour la grille : quelles cases sont en rouge. */
  protected readonly cellErrors = computed(() =>
    this.checks().map((c) => PLAN_COLUMNS.map((col) => !!c.errors[col])),
  );

  /** Pour la grille : la note de bout de ligne — l'erreur, ou où la ligne sera rangée. */
  protected readonly notes = computed<(RowNote | null)[]>(() =>
    this.checks().map((c, i) => {
      if (c.empty) return null;
      const error = this.rowError(i);
      return error ? { text: error, error: true } : { text: this.understood(i), error: false };
    }),
  );

  protected rowError(row: number): string {
    const errors = this.checks()[row]?.errors ?? {};
    const first = PLAN_COLUMNS.find((c) => errors[c]);
    return first ? this.translate.instant(`dashboard.finance.paste.errors.${errors[first]}`) : '';
  }

  /** Où la ligne est rangée, en clair. */
  protected understood(index: number): string {
    const r = this.checks()[index]?.row;
    if (!r) return '';
    const sheet = this.rows()[index];
    if (sheet?.detailed && isUnchanged(sheet)) {
      return this.translate.instant('dashboard.finance.sheet.detailKept');
    }
    const origin = sheet?.origin;
    const keptCategory =
      origin && (origin.kind === 'variable' || origin.kind === 'fixed' || origin.kind === 'purchase') ? origin.line.category : undefined;
    const group = CATEGORY_GROUP[r.section];
    const where = group
      ? (this.categoryLabels()[group][keptCategory ?? r.category ?? ''] ?? '')
      : r.funding
        ? this.translate.instant(`dashboard.finance.import.items.financing.${FUNDING_ITEM[r.funding]}`)
        : '';
    const month = r.section !== 'product' && r.section !== 'funding' ? this.monthLabels()[r.start - 1] : '';
    return [where, month].filter(Boolean).join(' · ');
  }

  // -------------------------------------------------------------------
  // Grille
  // -------------------------------------------------------------------

  protected onRowsChange(rows: SheetRow[]): void {
    this.rows.set(rows);
    this.touch();
  }

  protected onPasted(raw: string): void {
    this.rawPaste = raw;
  }

  protected showExample(): void {
    const example = (this.translate.instant('dashboard.finance.paste.exampleData') as string)
      .split('\n')
      .map((line) => ({ cells: line.split('\t') }));
    // Par la grille : « Annuler » retire l'exemple.
    this.grid()?.replaceAll(example);
  }

  /** Le modèle, à coller dans Excel pour préparer ses chiffres. */
  protected async copyTemplate(): Promise<void> {
    const header = PLAN_COLUMNS.map((c) => this.translate.instant(`dashboard.finance.paste.columns.${c}`)).join('\t');
    try {
      await navigator.clipboard.writeText(`${header}\n${this.translate.instant('dashboard.finance.paste.exampleData')}`);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      // Presse-papiers refusé : « Voir un exemple » montre le même modèle.
    }
  }

  // -------------------------------------------------------------------
  // Enregistrement
  // -------------------------------------------------------------------

  protected save(): void {
    if (this.invalidCount() > 0 || this.saving()) return;
    const checked = this.checks()
      .map((c, i) => (c.row ? { row: c.row, sheet: this.rows()[i] } : null))
      .filter((c): c is { row: PlanRow; sheet: SheetRow } => !!c);
    this.saving.set(true);
    this.saveError.set('');
    this.financeService
      .applyImport(this.projectId(), buildSheetDraft(checked, this.finance()), [], 'sync')
      .subscribe({
        next: (finance) => {
          this.saving.set(false);
          this.setFinance(finance);
          this.savedNotice.set(true);
          setTimeout(() => this.savedNotice.set(false), 3000);
        },
        error: (err: HttpErrorResponse) => {
          console.error('[FinanceSheet] save failed', err);
          this.saving.set(false);
          this.saveError.set(this.translate.instant('dashboard.finance.save.error'));
        },
      });
  }

  protected discard(): void {
    this.setFinance(this.finance());
  }

  /** Tableau hors format : l'IA le range (payant, annoncé). */
  protected askAi(): void {
    const header = PLAN_COLUMNS.map((c) => this.translate.instant(`dashboard.finance.paste.columns.${c}`)).join('\t');
    const body =
      this.rawPaste ||
      this.rows()
        .filter((r) => r.cells.some((c) => c.trim()))
        .map((r) => r.cells.join('\t'))
        .join('\n');
    if (!body) return;
    this.importText.set(this.rawPaste ? body : `${header}\n${body}`);
    this.importOpen.set(true);
  }

  protected onImported(finance: FinanceModel): void {
    this.setFinance(finance);
  }

  // -------------------------------------------------------------------

  private touch(): void {
    this.dirty.set(true);
    this.savedNotice.set(false);
    this.saveError.set('');
  }
}
