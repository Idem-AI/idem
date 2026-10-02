/**
 * Le prévisionnel vu comme un tableur, et retour.
 *
 * Le mode tableur montre TOUT le prévisionnel en lignes (une par produit,
 * vente, dépense, salaire, achat, financement) et l'enregistre en bloc : le
 * tableau fait alors foi (`sync`). Pour ne rien perdre de ce qui a été saisi
 * en mode pas à pas, chaque ligne exportée garde l'objet d'origine : une ligne
 * qu'on n'a pas touchée repart telle quelle — détail mois par mois, prix par
 * année et catégorie compris. Seules les lignes modifiées ou nouvelles sont
 * reconstruites depuis leurs six cases.
 */

import {
  FinanceImportDraft,
  FinanceModel,
  FinancingPlan,
  FixedChargeLine,
  INVESTMENT_OPTIONS,
  InvestmentLine,
  ProductPricing,
  SalaryLine,
  SalesObjective,
  VariableChargeLine,
} from '../../../models/finance.model';
import { MonthlyAmountEditorComponent } from '../monthly-amount-editor/monthly-amount-editor';
import { FundingKey, normalizeText, PlanSection } from './finance-paste.parser';

/** Une ligne lue et vérifiée. */
export interface PlanRow {
  section: PlanSection;
  name: string;
  amount: number;
  unitCost: number;
  /** Mois du plan, de 1 à 36. */
  start: number;
  growth: number;
  category?: string;
  funding?: FundingKey;
}

export type RowOrigin =
  | { kind: 'product'; product: ProductPricing }
  | { kind: 'sale'; sale: SalesObjective }
  | { kind: 'variable'; line: VariableChargeLine }
  | { kind: 'fixed'; line: FixedChargeLine }
  | { kind: 'salary'; line: SalaryLine }
  | { kind: 'purchase'; line: InvestmentLine }
  | { kind: 'funding'; key: FundingKey };

/** Une ligne du tableur : ses six cases, et ce dont elle vient. */
export interface SheetRow {
  cells: string[];
  origin?: RowOrigin;
  /** Les cases telles qu'exportées : identiques = ligne intacte. */
  originCells?: string[];
  /** Ligne exportée dont la série n'a pas de forme simple (détail mois par mois). */
  detailed?: boolean;
}

export const FUNDING_KEYS: readonly FundingKey[] = ['apportCapital', 'cmt', 'compteCourantAssocies', 'creditBail', 'subvention'];

export interface ExportLabels {
  section: (s: PlanSection) => string;
  funding: (k: FundingKey) => string;
  month: (index: number) => string;
}

const formatNumber = (n: number) =>
  Number.isFinite(n) ? (Math.round(n * 100) / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';

export const isUnchanged = (row: SheetRow) =>
  !!row.originCells && row.cells.every((c, i) => c.trim() === (row.originCells![i] ?? '').trim());

// ---------------------------------------------------------------------------
// Prévisionnel → lignes
// ---------------------------------------------------------------------------

export function exportRows(finance: FinanceModel | null, labels: ExportLabels): SheetRow[] {
  if (!finance) return [];
  const rows: SheetRow[] = [];
  const push = (cells: string[], origin: RowOrigin, detailed = false) =>
    rows.push({ cells, origin, originCells: [...cells], detailed });

  /** Montant + mois de début d'une série, et si elle a une forme simple. */
  const shape = (values: number[], once = false) => {
    const simple = MonthlyAmountEditorComponent.detect(values, once ? 'once' : 'recurring');
    const first = Math.max(0, values.findIndex((v) => v > 0));
    if (simple) return { amount: simple.amount, start: simple.start, growth: simple.growth, detailed: false };
    return {
      amount: once ? values.reduce((a, b) => a + (b || 0), 0) : values[first] || 0,
      start: first,
      growth: 0,
      detailed: true,
    };
  };

  for (const p of finance.products) {
    push([labels.section('product'), p.name, formatNumber(p.prices[0] || 0), p.unitCosts[0] ? formatNumber(p.unitCosts[0]) : '', '', ''], { kind: 'product', product: p });
  }
  for (const s of finance.salesObjectives) {
    const product = finance.products.find((p) => p.id === s.productId);
    if (!product) continue;
    const sh = shape(s.monthlyQuantities);
    push(
      [labels.section('sale'), product.name, formatNumber(sh.amount), '', labels.month(sh.start), sh.growth ? String(sh.growth) : ''],
      { kind: 'sale', sale: s },
      sh.detailed,
    );
  }
  const lines = <T extends { label: string; monthlyValues: number[] }>(
    list: T[],
    section: PlanSection,
    origin: (line: T) => RowOrigin,
    name: (line: T) => string = (l) => l.label,
    once = false,
  ) => {
    for (const line of list) {
      const sh = shape(line.monthlyValues, once);
      if (!sh.amount) continue;
      push([labels.section(section), name(line), formatNumber(sh.amount), '', labels.month(sh.start), ''], origin(line), sh.detailed);
    }
  };
  lines(finance.variableCharges.lines, 'variable', (line) => ({ kind: 'variable', line }));
  lines(finance.fixedCharges.lines, 'fixed', (line) => ({ kind: 'fixed', line }));
  for (const s of finance.fixedCharges.salaries) {
    const sh = shape(s.monthlyValues);
    if (!sh.amount) continue;
    push([labels.section('salary'), s.position, formatNumber(sh.amount), '', labels.month(sh.start), ''], { kind: 'salary', line: s }, sh.detailed);
  }
  lines(finance.investments, 'purchase', (line) => ({ kind: 'purchase', line }), undefined, true);

  const f = finance.financing;
  const amounts: Record<FundingKey, number> = {
    apportCapital: f.apportCapital,
    cmt: f.cmt.amount,
    compteCourantAssocies: f.compteCourantAssocies.amount,
    creditBail: f.creditBail.amount,
    subvention: f.subvention,
  };
  for (const key of FUNDING_KEYS) {
    if (amounts[key] > 0) {
      push([labels.section('funding'), labels.funding(key), formatNumber(amounts[key]), '', '', ''], { kind: 'funding', key });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Lignes → brouillon (le tableur fait foi)
// ---------------------------------------------------------------------------

export interface CheckedSheetRow {
  row: PlanRow;
  sheet: SheetRow;
}

const newId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const series = (amount: number, start: number, growth = 0, once = false, round = false) =>
  MonthlyAmountEditorComponent.build(amount, start - 1, growth, once ? 'once' : 'recurring', round);

export function buildSheetDraft(rows: CheckedSheetRow[], finance: FinanceModel | null): FinanceImportDraft {
  const years = finance?.projectionYears || 3;
  const products: ProductPricing[] = [];
  const nameToId = new Map<string, string>();

  // Les produits d'abord : les ventes s'y rattachent par le nom.
  for (const { row, sheet } of rows.filter((r) => r.row.section === 'product')) {
    const origin = sheet.origin?.kind === 'product' ? sheet.origin.product : undefined;
    const product: ProductPricing =
      origin && isUnchanged(sheet)
        ? origin
        : {
            id: origin?.id ?? newId('p'),
            name: row.name,
            prices: Array(years).fill(row.amount),
            unitCosts: Array(years).fill(row.unitCost || 0),
          };
    products.push(product);
    nameToId.set(normalizeText(product.name), product.id);
  }
  const productIds = new Set(products.map((p) => p.id));

  const salesObjectives: SalesObjective[] = [];
  const variableChargeLines: VariableChargeLine[] = [];
  const fixedChargeLines: FixedChargeLine[] = [];
  const salaries: SalaryLine[] = [];
  const investments: InvestmentLine[] = [];
  const financing: FinancingPlan = structuredClone(finance?.financing ?? EMPTY_FINANCING);
  financing.apportCapital = 0;
  financing.subvention = 0;
  financing.cmt.amount = 0;
  financing.compteCourantAssocies.amount = 0;
  financing.creditBail.amount = 0;

  for (const { row, sheet } of rows) {
    const o = sheet.origin;
    const keep = isUnchanged(sheet);
    switch (row.section) {
      case 'sale': {
        if (keep && o?.kind === 'sale' && productIds.has(o.sale.productId)) {
          salesObjectives.push(o.sale);
          break;
        }
        const productId = nameToId.get(normalizeText(row.name));
        if (productId) {
          salesObjectives.push({ productId, monthlyQuantities: series(row.amount, row.start, row.growth, false, true) });
        }
        break;
      }
      case 'variable': {
        if (keep && o?.kind === 'variable') variableChargeLines.push(o.line);
        else
          variableChargeLines.push({
            id: newId('v'),
            category: (o?.kind === 'variable' ? o.line.category : row.category) as VariableChargeLine['category'],
            label: row.name,
            monthlyValues: series(row.amount, row.start),
          });
        break;
      }
      case 'fixed': {
        if (keep && o?.kind === 'fixed') fixedChargeLines.push(o.line);
        else
          fixedChargeLines.push({
            id: newId('f'),
            category: (o?.kind === 'fixed' ? o.line.category : row.category) as FixedChargeLine['category'],
            label: row.name,
            monthlyValues: series(row.amount, row.start),
          });
        break;
      }
      case 'salary': {
        if (keep && o?.kind === 'salary') salaries.push(o.line);
        else salaries.push({ id: newId('s'), position: row.name, monthlyValues: series(row.amount, row.start) });
        break;
      }
      case 'purchase': {
        if (keep && o?.kind === 'purchase') {
          investments.push(o.line);
          break;
        }
        const category = o?.kind === 'purchase' ? o.line.category : (row.category ?? 'autresMateriels');
        investments.push({
          id: newId('i'),
          category,
          amortGroup: INVESTMENT_OPTIONS[category] ?? (o?.kind === 'purchase' ? o.line.amortGroup : 'materielOutillage'),
          label: row.name,
          monthlyValues: series(row.amount, row.start, 0, true),
        });
        break;
      }
      case 'funding': {
        if (!row.funding) break;
        if (row.funding === 'apportCapital' || row.funding === 'subvention') financing[row.funding] += row.amount;
        else financing[row.funding].amount += row.amount;
        break;
      }
    }
  }

  return { products, salesObjectives, variableChargeLines, fixedChargeLines, salaries, investments, financing, params: {} };
}

/** Plan vide, pour un prévisionnel qui n'a encore jamais été enregistré. */
const EMPTY_FINANCING: FinancingPlan = {
  apportCapital: 0,
  compteCourantAssocies: { amount: 0, ratePct: 7, duration: 5, durationUnit: 'years', method: 'constant_amortization' },
  cmt: { amount: 0, ratePct: 7, duration: 12, durationUnit: 'months', method: 'constant_annuity' },
  creditBail: { amount: 0, ratePct: 10, duration: 5, durationUnit: 'years', method: 'constant_annuity' },
  creditFournisseurs: 0,
  autofinancement: 0,
  subvention: 0,
};
