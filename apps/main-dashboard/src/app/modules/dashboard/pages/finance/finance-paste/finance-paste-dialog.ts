import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import {
  FIXED_CHARGE_OPTIONS,
  FinanceModel,
  INVESTMENT_OPTIONS,
  VARIABLE_CHARGE_OPTIONS,
} from '../../../models/finance.model';
import { FinanceService } from '../../../services/finance.service';
import { FinanceIllustrationComponent } from '../finance-illustration/finance-illustration';
import {
  guessCategory,
  isHeaderRow,
  normalizeText,
  parseAmount,
  parseClipboard,
  parseFunding,
  parseMonth,
  parseSection,
  PLAN_COLUMNS,
  PLAN_SECTIONS,
  PlanColumn,
  PlanSection,
} from './finance-paste.parser';
import { PlanRow, rowsToDraft } from './finance-paste.draft';

type CellError = 'required' | 'section' | 'number' | 'positive' | 'month' | 'product' | 'funding';

interface RowCheck {
  empty: boolean;
  errors: Partial<Record<PlanColumn, CellError>>;
  row: PlanRow | null;
}

const MIN_ROWS = 10;
const WIDTH = PLAN_COLUMNS.length;
const CATEGORY_GROUP: Partial<Record<PlanSection, 'variable' | 'fixed' | 'investment'>> = {
  variable: 'variable',
  fixed: 'fixed',
  purchase: 'investment',
};

/**
 * Coller tout son prévisionnel d'un coup, depuis Excel ou une IA.
 *
 * Un seul tableau, un format imposé : une ligne par élément, six colonnes
 * toujours dans le même ordre — Rubrique, Nom, Montant, Coût unitaire, Mois
 * de début, Hausse. La rubrique dit où ranger la ligne (produit, vente,
 * dépense, salaire, achat, financement). Ce format fixe se lit sans IA, donc
 * sans crédit : chaque cellule est vérifiée, rien n'entre tant qu'une cellule
 * est en rouge.
 *
 * Pour un tableau qui ne suit pas le format, « Laisser l'IA le ranger » le
 * confie à l'import IA — payant, et annoncé comme tel.
 */
@Component({
  selector: 'app-finance-paste-dialog',
  imports: [TranslateModule, IdemLoaderComponent, FinanceIllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-paste-dialog.html',
  styleUrl: './finance-paste-dialog.css',
})
export class FinancePasteDialogComponent {
  private readonly translate = inject(TranslateService);
  private readonly financeService = inject(FinanceService);

  readonly open = input<boolean>(false);
  readonly projectId = input.required<string>();
  readonly finance = input<FinanceModel | null>(null);
  readonly monthLabels = input<string[]>([]);

  readonly closed = output<void>();
  readonly imported = output<FinanceModel>();
  /** Tableau hors format : on le confie à l'IA d'import (payant). */
  readonly aiFallback = output<string>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  private static nextId = 0;
  protected readonly uid = `fp-${FinancePasteDialogComponent.nextId++}`;
  protected readonly columns = PLAN_COLUMNS;

  protected readonly grid = signal<string[][]>([]);
  protected readonly focus = signal<{ row: number; col: number } | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly copied = signal(false);
  private rawPaste = '';

  // -------------------------------------------------------------------
  // Libellés
  // -------------------------------------------------------------------

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
  // Vérification
  // -------------------------------------------------------------------

  protected readonly checks = computed<RowCheck[]>(() => {
    const grid = this.grid();
    // Les produits collés comptent pour reconnaître les ventes, où qu'ils soient.
    const pastedProducts = new Set(
      grid
        .filter((r) => this.section(r[0]) === 'product' && r[1]?.trim())
        .map((r) => normalizeText(r[1])),
    );
    const known = new Set([...(this.finance()?.products ?? []).map((p) => normalizeText(p.name)), ...pastedProducts]);
    return grid.map((cells) => this.check(cells, known));
  });

  protected readonly filled = computed(() => this.checks().filter((c) => !c.empty));
  protected readonly invalidCount = computed(() => this.filled().filter((c) => !c.row).length);
  protected readonly readyCount = computed(() => this.filled().length - this.invalidCount());

  private section(raw: string | undefined): PlanSection | null {
    const s = normalizeText(raw ?? '');
    if (!s) return null;
    const exact = this.sectionLabels().findIndex((label) => normalizeText(label) === s);
    return exact >= 0 ? PLAN_SECTIONS[exact] : parseSection(s);
  }

  private check(cells: string[], knownProducts: Set<string>): RowCheck {
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

    if (section === 'sale' && name && !knownProducts.has(normalizeText(name))) errors.name = 'product';
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

  protected errorOf(row: number, col: PlanColumn): CellError | undefined {
    return this.checks()[row]?.errors[col];
  }

  /** La raison de la première erreur de la ligne, en clair. */
  protected rowError(row: number): string {
    const errors = this.checks()[row]?.errors ?? {};
    const first = PLAN_COLUMNS.find((c) => errors[c]);
    return first ? this.translate.instant(`dashboard.finance.paste.errors.${errors[first]}`) : '';
  }

  /** Où la ligne va être rangée, en clair : l'utilisateur voit ce qui a été compris. */
  protected understood(row: number): string {
    const r = this.checks()[row]?.row;
    if (!r) return '';
    const group = CATEGORY_GROUP[r.section];
    const where = group
      ? this.categoryLabels()[group][r.category ?? '']
      : r.funding
        ? this.translate.instant(`dashboard.finance.import.items.financing.${FUNDING_ITEM[r.funding]}`)
        : this.translate.instant(`dashboard.finance.paste.sections.${r.section}`);
    const month = r.section !== 'product' && r.section !== 'funding' ? this.monthLabels()[r.start - 1] : '';
    return [where, month].filter(Boolean).join(' · ');
  }

  // -------------------------------------------------------------------
  // Grille
  // -------------------------------------------------------------------

  constructor() {
    effect(() => {
      const dialog = this.dialog().nativeElement;
      if (this.open() && !dialog.open) {
        this.reset();
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected cell(row: number, col: number): string {
    return this.grid()[row]?.[col] ?? '';
  }

  protected setCell(row: number, col: number, value: string): void {
    this.grid.update((g) => this.ensureRows(g.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : r))));
  }

  protected onFocus(row: number, col: number): void {
    this.focus.set({ row, col });
  }

  /** Entrée descend d'une ligne, comme dans un tableur. */
  protected onEnter(event: Event, row: number, col: number): void {
    event.preventDefault();
    this.dialog().nativeElement.querySelector<HTMLInputElement>(`[data-cell="${row + 1}-${col}"]`)?.focus();
  }

  /** Un bloc collé remplit la grille à partir de la cellule active. */
  protected onPaste(event: ClipboardEvent): void {
    const html = event.clipboardData?.getData('text/html') ?? '';
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const matrix = parseClipboard(html, text);
    if (matrix.length <= 1 && (matrix[0]?.length ?? 0) <= 1) return;
    event.preventDefault();
    this.rawPaste = text || matrix.map((r) => r.join('\t')).join('\n');

    const body = isHeaderRow(matrix[0]) ? matrix.slice(1) : matrix;
    const at = this.focus() ?? { row: this.firstEmptyRow(), col: 0 };
    // Un tableau complet (6 colonnes ou plus) se cale toujours sur la première colonne.
    const startCol = body.some((r) => r.length >= WIDTH) ? 0 : at.col;

    this.grid.update((g) => {
      const next = this.ensureRows(g, at.row + body.length).map((r) => [...r]);
      body.forEach((source, i) =>
        source.slice(0, WIDTH - startCol).forEach((value, j) => (next[at.row + i][startCol + j] = value)),
      );
      return this.ensureRows(next);
    });
    this.saveError.set('');
  }

  protected showExample(): void {
    const rows = (this.translate.instant('dashboard.finance.paste.exampleData') as string)
      .split('\n')
      .map((line) => line.split('\t'));
    this.grid.set(this.ensureRows(rows));
  }

  /** Le modèle vide, à coller dans Excel pour préparer ses chiffres. */
  protected async copyTemplate(): Promise<void> {
    const header = PLAN_COLUMNS.map((c) => this.translate.instant(`dashboard.finance.paste.columns.${c}`)).join('\t');
    try {
      await navigator.clipboard.writeText(`${header}\n${this.translate.instant('dashboard.finance.paste.exampleData')}`);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      // Presse-papiers refusé : le bouton « Voir un exemple » montre le même modèle.
    }
  }

  protected clear(): void {
    this.grid.set(this.ensureRows([]));
    this.rawPaste = '';
    this.saveError.set('');
  }

  protected removeRow(row: number): void {
    this.grid.update((g) => this.ensureRows(g.filter((_, i) => i !== row)));
  }

  // -------------------------------------------------------------------
  // Enregistrement
  // -------------------------------------------------------------------

  protected add(): void {
    if (this.invalidCount() > 0 || this.readyCount() === 0 || this.saving()) return;
    const rows = this.filled().map((c) => c.row!);
    this.saving.set(true);
    this.saveError.set('');
    this.financeService
      .applyImport(this.projectId(), rowsToDraft(rows, this.finance()), [], 'merge')
      .subscribe({
        next: (finance) => {
          this.saving.set(false);
          this.imported.emit(finance);
          this.close();
        },
        error: (err: HttpErrorResponse) => {
          console.error('[FinancePaste] apply failed', err);
          this.saving.set(false);
          this.saveError.set(this.translate.instant('dashboard.finance.save.error'));
        },
      });
  }

  protected askAi(): void {
    const header = PLAN_COLUMNS.map((c) => this.translate.instant(`dashboard.finance.paste.columns.${c}`)).join('\t');
    const body =
      this.rawPaste ||
      this.grid()
        .filter((r) => r.some((c) => c.trim()))
        .map((r) => r.join('\t'))
        .join('\n');
    if (!body) return;
    this.aiFallback.emit(this.rawPaste ? body : `${header}\n${body}`);
    this.close();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && !this.saving()) this.close();
  }

  // -------------------------------------------------------------------

  private reset(): void {
    this.clear();
    this.focus.set(null);
    this.copied.set(false);
    this.saving.set(false);
  }

  /** Toujours au moins deux lignes vides sous la dernière remplie. */
  private ensureRows(g: string[][], min = 0): string[][] {
    const rows = g.map((r) => Array.from({ length: WIDTH }, (_, i) => r[i] ?? ''));
    const lastFilled = rows.reduce((last, r, i) => (r.some((c) => c.trim()) ? i : last), -1);
    const target = Math.max(MIN_ROWS, min, lastFilled + 3);
    while (rows.length < target) rows.push(Array(WIDTH).fill(''));
    return rows;
  }

  private firstEmptyRow(): number {
    const index = this.grid().findIndex((r) => r.every((c) => !c.trim()));
    return index < 0 ? this.grid().length : index;
  }
}

const FUNDING_ITEM = {
  apportCapital: 'capital',
  compteCourantAssocies: 'partners',
  cmt: 'bank',
  creditBail: 'leasing',
  subvention: 'grant',
} as const;
