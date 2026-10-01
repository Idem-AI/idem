import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { IdemLoaderComponent } from '@idem/shared-loader/angular';
import {
  FINANCE_IMPORT_ACCEPT,
  FINANCE_IMPORT_MAX_BYTES,
  FinanceImportDraft,
  FinanceImportMode,
  FinanceImportPreview,
  FinanceModel,
} from '../../../models/finance.model';
import { FinanceService } from '../../../services/finance.service';
import { FinanceIllustrationComponent } from '../finance-illustration/finance-illustration';

type ImportStage = 'pick' | 'reading' | 'preview' | 'saving' | 'error';

/** Les groupes que l'utilisateur peut écarter avant d'enregistrer. */
type ImportGroup =
  | 'products'
  | 'sales'
  | 'variable'
  | 'fixed'
  | 'salaries'
  | 'investments'
  | 'financing'
  | 'params';

interface GroupItem {
  label: string;
  value: string;
}

interface GroupVM {
  key: ImportGroup;
  titleKey: string;
  items: GroupItem[];
  more: number;
}

const VISIBLE_ITEMS = 5;

/**
 * Import d'un fichier financier : déposer, laisser l'IA lire, relire, ranger.
 *
 * Rien n'est enregistré avant la dernière étape : l'aperçu montre, groupe par
 * groupe, ce que l'IA a compris, ce qui manque et ce qui l'a fait hésiter.
 * L'utilisateur peut écarter un groupe, puis choisir de compléter ses données
 * ou de remplacer les éléments concernés.
 */
@Component({
  selector: 'app-finance-import-dialog',
  imports: [TranslateModule, IdemLoaderComponent, FinanceIllustrationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance-import-dialog.html',
  styleUrl: './finance-import-dialog.css',
})
export class FinanceImportDialogComponent implements OnDestroy {
  private readonly financeService = inject(FinanceService);
  private readonly translate = inject(TranslateService);

  readonly open = input<boolean>(false);
  readonly projectId = input.required<string>();
  /** Le prévisionnel a-t-il déjà des données ? Sinon, pas de choix à faire. */
  readonly hasExistingData = input<boolean>(false);
  readonly currency = input<string>('XAF');

  readonly closed = output<void>();
  readonly imported = output<FinanceModel>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly accept = FINANCE_IMPORT_ACCEPT;
  protected readonly stage = signal<ImportStage>('pick');
  protected readonly fileName = signal('');
  protected readonly dragging = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly preview = signal<FinanceImportPreview | null>(null);
  protected readonly mode = signal<FinanceImportMode>('merge');
  protected readonly excluded = signal<ReadonlySet<ImportGroup>>(new Set());

  private request?: Subscription;

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

  ngOnDestroy(): void {
    this.request?.unsubscribe();
  }

  // -------------------------------------------------------------------
  // Aperçu
  // -------------------------------------------------------------------

  protected readonly groups = computed<GroupVM[]>(() => {
    const p = this.preview();
    if (!p) return [];
    const d = p.draft;
    const money = (v: number) => FinanceService.formatCurrency(v, p.report.currency || this.currency());
    const firstAmount = (values: number[]) => values.find((v) => v > 0) ?? 0;
    const t = (key: string, params?: object) => this.translate.instant(`dashboard.finance.import.items.${key}`, params);
    const groups: GroupVM[] = [];

    const push = (key: ImportGroup, titleKey: string, items: GroupItem[]) => {
      if (items.length) {
        groups.push({ key, titleKey, items: items.slice(0, VISIBLE_ITEMS), more: Math.max(0, items.length - VISIBLE_ITEMS) });
      }
    };

    push(
      'products',
      'dashboard.finance.import.groups.products',
      d.products.map((x) => ({
        label: x.name,
        value: t('price', { price: money(x.prices[0] || 0), cost: money(x.unitCosts[0] || 0) }),
      })),
    );
    push(
      'sales',
      'dashboard.finance.import.groups.sales',
      d.salesObjectives.map((s) => ({
        label: d.products.find((x) => x.id === s.productId)?.name ?? '—',
        value: t('quantity', { count: Math.round(s.monthlyQuantities.slice(0, 12).reduce((a, b) => a + b, 0)) }),
      })),
    );
    push(
      'variable',
      'dashboard.finance.import.groups.variable',
      d.variableChargeLines.map((l) => ({
        label: l.label,
        value: t('perYear', { amount: money(l.monthlyValues.slice(0, 12).reduce((a, b) => a + b, 0)) }),
      })),
    );
    push(
      'fixed',
      'dashboard.finance.import.groups.fixed',
      d.fixedChargeLines.map((l) => ({ label: l.label, value: t('perMonth', { amount: money(firstAmount(l.monthlyValues)) }) })),
    );
    push(
      'salaries',
      'dashboard.finance.import.groups.salaries',
      d.salaries.map((s) => ({ label: s.position, value: t('perMonth', { amount: money(firstAmount(s.monthlyValues)) }) })),
    );
    push(
      'investments',
      'dashboard.finance.import.groups.investments',
      d.investments.map((i) => ({ label: i.label, value: money(i.monthlyValues.reduce((a, b) => a + b, 0)) })),
    );
    if (d.financing) {
      const f = d.financing;
      const lines: [string, number][] = [
        ['capital', f.apportCapital],
        ['partners', f.compteCourantAssocies.amount],
        ['bank', f.cmt.amount],
        ['leasing', f.creditBail.amount],
        ['grant', f.subvention],
      ];
      push(
        'financing',
        'dashboard.finance.import.groups.financing',
        lines.filter(([, v]) => v > 0).map(([k, v]) => ({ label: t(`financing.${k}`), value: money(v) })),
      );
    }
    const params: GroupItem[] = [];
    if (d.params.socialChargesRatePct !== undefined) params.push({ label: t('social'), value: `${d.params.socialChargesRatePct} %` });
    if (d.params.clientReceivablesRatePct !== undefined) params.push({ label: t('receivables'), value: `${d.params.clientReceivablesRatePct} %` });
    if (d.params.isRatePct !== undefined) params.push({ label: t('tax'), value: `${d.params.isRatePct} %` });
    push('params', 'dashboard.finance.import.groups.params', params);

    return groups;
  });

  protected readonly selectedCount = computed(
    () => this.groups().filter((g) => !this.excluded().has(g.key)).length,
  );

  protected isIncluded(key: ImportGroup): boolean {
    return !this.excluded().has(key);
  }

  protected toggleGroup(key: ImportGroup): void {
    this.excluded.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Sans produits, les ventes n'ont plus rien à quoi se rattacher.
      if (key === 'products' && next.has('products')) next.add('sales');
      if (key === 'sales' && !next.has('sales')) next.delete('products');
      return next;
    });
  }

  // -------------------------------------------------------------------
  // Fichier
  // -------------------------------------------------------------------

  protected onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.read(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.read(file);
  }

  protected chooseFile(): void {
    this.fileInput()?.nativeElement.click();
  }

  private read(file: File): void {
    this.fileName.set(file.name);
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (extension === '.xls') {
      this.fail(this.translate.instant('dashboard.finance.import.errors.xls'));
      return;
    }
    if (!this.accept.split(',').includes(extension)) {
      this.fail(this.translate.instant('dashboard.finance.import.errors.format'));
      return;
    }
    if (file.size > FINANCE_IMPORT_MAX_BYTES) {
      this.fail(this.translate.instant('dashboard.finance.import.errors.size'));
      return;
    }

    this.stage.set('reading');
    this.request?.unsubscribe();
    this.request = this.financeService.analyzeImport(this.projectId(), file).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.excluded.set(new Set());
        this.mode.set(this.hasExistingData() ? 'merge' : 'replace');
        this.stage.set('preview');
      },
      error: (err: HttpErrorResponse) => this.fail(this.messageFor(err)),
    });
  }

  // -------------------------------------------------------------------
  // Enregistrement
  // -------------------------------------------------------------------

  protected save(): void {
    const p = this.preview();
    if (!p || this.selectedCount() === 0) return;
    this.stage.set('saving');
    this.request = this.financeService
      .applyImport(this.projectId(), this.selectedDraft(p.draft), p.suggestions, this.mode())
      .subscribe({
        next: (finance) => {
          this.imported.emit(finance);
          this.close();
        },
        error: (err: HttpErrorResponse) => this.fail(this.messageFor(err)),
      });
  }

  private selectedDraft(d: FinanceImportDraft): FinanceImportDraft {
    const off = this.excluded();
    return {
      products: off.has('products') ? [] : d.products,
      salesObjectives: off.has('sales') || off.has('products') ? [] : d.salesObjectives,
      variableChargeLines: off.has('variable') ? [] : d.variableChargeLines,
      fixedChargeLines: off.has('fixed') ? [] : d.fixedChargeLines,
      salaries: off.has('salaries') ? [] : d.salaries,
      investments: off.has('investments') ? [] : d.investments,
      financing: off.has('financing') ? null : d.financing,
      params: off.has('params') ? {} : d.params,
    };
  }

  // -------------------------------------------------------------------
  // Fenêtre
  // -------------------------------------------------------------------

  protected close(): void {
    this.request?.unsubscribe();
    this.dialog().nativeElement.close();
  }

  /** Échap, bouton ou voile : la fenêtre se ferme, le parent le sait. */
  protected onDialogClose(): void {
    this.request?.unsubscribe();
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    // Pendant la lecture, un clic égaré sur le voile ne doit pas tout annuler.
    if (event.target === this.dialog().nativeElement && this.stage() !== 'reading' && this.stage() !== 'saving') {
      this.close();
    }
  }

  protected retry(): void {
    this.reset();
  }

  private reset(): void {
    this.request?.unsubscribe();
    this.stage.set('pick');
    this.fileName.set('');
    this.preview.set(null);
    this.errorMessage.set('');
    this.excluded.set(new Set());
    const inputEl = this.fileInput()?.nativeElement;
    if (inputEl) inputEl.value = '';
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.stage.set('error');
  }

  private messageFor(err: HttpErrorResponse): string {
    const server = typeof err?.error?.message === 'string' ? err.error.message : '';
    if ((err?.status === 415 || err?.status === 422 || err?.status === 402) && server) return server;
    if (err?.status === 413) return this.translate.instant('dashboard.finance.import.errors.size');
    return this.translate.instant('dashboard.finance.import.errors.generic');
  }
}
