import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FINANCE_PROJECTION_MONTHS } from '../../../models/finance.model';
import { FinanceService } from '../../../services/finance.service';

/**
 * Saisie d'une série de 36 mois, telle qu'un non-comptable la pense.
 *
 * Le modèle stocke un montant par mois sur trois ans. Personne ne pense en 36
 * cases : on pense « 150 000 par mois à partir de mars » ou « une moto à
 * 800 000 en février ». L'éditeur montre donc d'abord cette forme simple, et
 * n'ouvre le détail mois par mois que sur demande.
 *
 * - `recurring` : un montant chaque mois, à partir d'un mois donné ; pour des
 *   quantités, une progression mensuelle optionnelle (les ventes montent).
 * - `once`      : un achat, un mois.
 *
 * Composant contrôlé : il reçoit la série et émet la nouvelle série entière.
 */
@Component({
  selector: 'app-monthly-amount-editor',
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (view() === 'simple') {
      <div class="grid gap-3" [class.sm:grid-cols-2]="!growthEnabled()" [class.sm:grid-cols-3]="growthEnabled()">
        <label class="!block">
          <span class="block text-xs text-text-secondary mb-1">{{ amountLabelKey() | translate }}</span>
          <input
            type="number"
            min="0"
            inputmode="decimal"
            class="!w-full"
            [value]="simpleAmount() || ''"
            [attr.aria-describedby]="hintId"
            placeholder="0"
            (input)="setSimpleAmount($any($event.target).valueAsNumber)"
          />
        </label>
        <label class="!block">
          <span class="block text-xs text-text-secondary mb-1">
            {{ (mode() === 'once' ? 'dashboard.finance.editor.month' : 'dashboard.finance.editor.from') | translate }}
          </span>
          <select class="!w-full" [value]="simpleStart()" (change)="setSimpleStart(+$any($event.target).value)">
            @for (label of monthLabels(); track $index) {
              <option [value]="$index" [selected]="$index === simpleStart()">{{ label }}</option>
            }
          </select>
        </label>
        @if (growthEnabled()) {
          <label class="!block">
            <span class="block text-xs text-text-secondary mb-1">{{ 'dashboard.finance.editor.growth' | translate }}</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              class="!w-full"
              [value]="growth() || ''"
              placeholder="0"
              (input)="setGrowth($any($event.target).valueAsNumber)"
            />
          </label>
        }
      </div>
      <p [id]="hintId" class="mt-2 text-xs text-text-tertiary">
        @if (yearTotals()[0] > 0 || yearTotals()[1] > 0) {
          {{ 'dashboard.finance.editor.yearTotals' | translate: { y1: yearLabels()[0], v1: format(yearTotals()[0]), y3: yearLabels()[2], v3: format(yearTotals()[2]) } }}
        }
        <button type="button" class="ml-1 text-primary hover:underline" (click)="openDetail()">
          {{ (mode() === 'once' ? 'dashboard.finance.editor.spread' : 'dashboard.finance.editor.vary') | translate }}
        </button>
      </p>
    } @else {
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="inline-flex rounded-lg border border-[var(--glass-border)] p-0.5" role="group" [attr.aria-label]="'dashboard.finance.editor.year' | translate">
          @for (label of yearLabels(); track $index) {
            <button
              type="button"
              class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
              [class.bg-primary]="year() === $index"
              [class.text-on-primary]="year() === $index"
              [class.text-text-secondary]="year() !== $index"
              [attr.aria-pressed]="year() === $index"
              (click)="year.set($index)"
            >
              {{ label }}
            </button>
          }
        </div>
        <button type="button" class="text-xs text-primary hover:underline" (click)="backToSimple()">
          {{ 'dashboard.finance.editor.simplify' | translate }}
        </button>
      </div>
      <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        @for (m of yearMonths(); track m) {
          <label class="!block">
            <span class="block text-[11px] text-text-tertiary mb-0.5">{{ monthLabels()[m] }}</span>
            <input
              type="number"
              min="0"
              class="!w-full !px-2 !py-1.5 text-sm"
              [value]="values()[m] || ''"
              placeholder="0"
              (input)="setMonth(m, $any($event.target).valueAsNumber)"
            />
          </label>
        }
      </div>
      <p class="mt-2 text-xs text-text-tertiary">
        {{ 'dashboard.finance.editor.yearTotal' | translate: { year: yearLabels()[year()], value: format(yearTotals()[year()]) } }}
      </p>
    }
  `,
})
export class MonthlyAmountEditorComponent implements OnInit {
  readonly values = input.required<number[]>();
  readonly monthLabels = input.required<string[]>();
  readonly yearLabels = input.required<string[]>();
  readonly mode = input<'recurring' | 'once'>('recurring');
  /** `quantity` : des unités vendues, sans devise et avec progression. */
  readonly unit = input<'money' | 'quantity'>('money');
  readonly currency = input<string>('XAF');
  readonly amountLabelKey = input<string>('dashboard.finance.editor.perMonth');

  readonly valuesChange = output<number[]>();

  private static nextId = 0;
  protected readonly hintId = `mae-hint-${MonthlyAmountEditorComponent.nextId++}`;

  protected readonly view = signal<'simple' | 'detail'>('simple');
  protected readonly year = signal(0);
  protected readonly simpleAmount = signal(0);
  protected readonly simpleStart = signal(0);
  protected readonly growth = signal(0);

  protected readonly growthEnabled = computed(
    () => this.unit() === 'quantity' && this.mode() === 'recurring',
  );

  protected readonly yearMonths = computed(() =>
    Array.from({ length: 12 }, (_, i) => this.year() * 12 + i),
  );

  protected readonly yearTotals = computed(() => {
    const v = this.values();
    return [0, 1, 2].map((y) => v.slice(y * 12, y * 12 + 12).reduce((a, b) => a + (b || 0), 0));
  });

  ngOnInit(): void {
    const shape = MonthlyAmountEditorComponent.detect(this.values(), this.mode());
    this.view.set(shape ? 'simple' : 'detail');
    const first = this.values().findIndex((v) => v > 0);
    this.simpleAmount.set(shape?.amount ?? (first >= 0 ? this.values()[first] : 0));
    this.simpleStart.set(shape?.start ?? Math.max(0, first));
    this.growth.set(shape?.growth ?? 0);
  }

  /**
   * Reconnaît la forme simple d'une série : un montant constant à partir d'un
   * mois (ou, pour un achat, un seul mois non nul). Une série en progression
   * géométrique régulière est aussi reconnue, pour les ventes.
   */
  static detect(
    values: number[],
    mode: 'recurring' | 'once',
  ): { amount: number; start: number; growth: number } | null {
    const first = values.findIndex((v) => v > 0);
    if (first < 0) return { amount: 0, start: 0, growth: 0 };
    const rest = values.slice(first);
    if (mode === 'once') {
      return rest.filter((v) => v > 0).length === 1 ? { amount: values[first], start: first, growth: 0 } : null;
    }
    if (rest.every((v) => v === values[first])) return { amount: values[first], start: first, growth: 0 };
    // Progression : estimée sur toute la série (les quantités sont arrondies,
    // deux mois voisins ne suffisent pas), puis vérifiée à l'unité près.
    const last = rest[rest.length - 1];
    if (rest.length > 2 && rest[0] > 0 && last > rest[0] && rest.every((v) => v > 0)) {
      const growth = Math.round((Math.pow(last / rest[0], 1 / (rest.length - 1)) - 1) * 1000) / 10;
      const rebuilt = MonthlyAmountEditorComponent.build(values[first], first, growth, 'recurring', true);
      if (rebuilt.every((v, i) => Math.abs(v - values[i]) <= 1)) return { amount: values[first], start: first, growth };
    }
    return null;
  }

  static build(
    amount: number,
    start: number,
    growth: number,
    mode: 'recurring' | 'once',
    round: boolean,
  ): number[] {
    const out = Array<number>(FINANCE_PROJECTION_MONTHS).fill(0);
    if (!amount) return out;
    if (mode === 'once') {
      out[start] = amount;
      return out;
    }
    for (let m = start; m < FINANCE_PROJECTION_MONTHS; m++) {
      const v = amount * Math.pow(1 + growth / 100, m - start);
      out[m] = round ? Math.round(v) : v;
    }
    return out;
  }

  protected setSimpleAmount(value: number): void {
    this.simpleAmount.set(Number.isFinite(value) ? Math.max(0, value) : 0);
    this.emitSimple();
  }

  protected setSimpleStart(index: number): void {
    this.simpleStart.set(index);
    this.emitSimple();
  }

  protected setGrowth(value: number): void {
    this.growth.set(Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0);
    this.emitSimple();
  }

  protected setMonth(index: number, value: number): void {
    const next = [...this.values()];
    next[index] = Number.isFinite(value) ? Math.max(0, value) : 0;
    this.valuesChange.emit(next);
  }

  protected openDetail(): void {
    this.year.set(Math.floor(this.simpleStart() / 12));
    this.view.set('detail');
  }

  /** Revenir à la forme simple réécrit la série depuis le premier mois rempli. */
  protected backToSimple(): void {
    const first = this.values().findIndex((v) => v > 0);
    this.simpleAmount.set(first >= 0 ? this.values()[first] : 0);
    this.simpleStart.set(Math.max(0, first));
    this.growth.set(0);
    this.view.set('simple');
    this.emitSimple();
  }

  protected format(value: number): string {
    if (this.unit() === 'quantity') {
      return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
    return FinanceService.formatCurrency(value, this.currency());
  }

  private emitSimple(): void {
    this.valuesChange.emit(
      MonthlyAmountEditorComponent.build(
        this.simpleAmount(),
        this.simpleStart(),
        this.growthEnabled() ? this.growth() : 0,
        this.mode(),
        this.unit() === 'quantity',
      ),
    );
  }
}
