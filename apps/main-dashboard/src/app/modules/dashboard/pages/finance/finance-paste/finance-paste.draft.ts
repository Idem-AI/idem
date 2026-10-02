/**
 * Lignes collées → brouillon d'import IDEM.
 *
 * Le brouillon a la même forme que celui produit par la lecture IA d'un
 * fichier : il part sur la même route d'enregistrement (`import/apply`), qui
 * le re-normalise côté serveur. Ici, aucun appel à l'IA — le format imposé
 * suffit à savoir où va chaque ligne.
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

/** Une ligne collée, lue et vérifiée. */
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

const id = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const series = (amount: number, start: number, growth = 0, once = false, round = false) =>
  MonthlyAmountEditorComponent.build(amount, start - 1, growth, once ? 'once' : 'recurring', round);

export function rowsToDraft(rows: PlanRow[], finance: FinanceModel | null): FinanceImportDraft {
  const years = finance?.projectionYears || 3;
  const products: ProductPricing[] = [];
  const salesObjectives: SalesObjective[] = [];
  const variableChargeLines: VariableChargeLine[] = [];
  const fixedChargeLines: FixedChargeLine[] = [];
  const salaries: SalaryLine[] = [];
  const investments: InvestmentLine[] = [];
  let financing: FinancingPlan | null = null;

  const productByName = (name: string): ProductPricing | undefined => {
    const key = normalizeText(name);
    const pasted = products.find((p) => normalizeText(p.name) === key);
    if (pasted) return pasted;
    // Ventes d'un produit déjà enregistré : il repart avec ses prix pour que
    // ses ventes s'y rattachent, sans rien changer à ses prix.
    const existing = finance?.products.find((p) => normalizeText(p.name) === key);
    if (!existing) return undefined;
    const copy = { ...existing, id: id('p') };
    products.push(copy);
    return copy;
  };

  for (const row of rows) {
    switch (row.section) {
      case 'product': {
        const existing = products.find((p) => normalizeText(p.name) === normalizeText(row.name));
        const product: ProductPricing = {
          id: existing?.id ?? id('p'),
          name: row.name,
          prices: Array(years).fill(row.amount),
          unitCosts: Array(years).fill(row.unitCost || 0),
        };
        if (existing) Object.assign(existing, product);
        else products.push(product);
        break;
      }
      case 'sale': {
        const product = productByName(row.name);
        if (product) {
          salesObjectives.push({ productId: product.id, monthlyQuantities: series(row.amount, row.start, row.growth, false, true) });
        }
        break;
      }
      case 'variable':
        variableChargeLines.push({ id: id('v'), category: row.category as VariableChargeLine['category'], label: row.name, monthlyValues: series(row.amount, row.start) });
        break;
      case 'fixed':
        fixedChargeLines.push({ id: id('f'), category: row.category as FixedChargeLine['category'], label: row.name, monthlyValues: series(row.amount, row.start) });
        break;
      case 'salary':
        salaries.push({ id: id('s'), position: row.name, monthlyValues: series(row.amount, row.start) });
        break;
      case 'purchase': {
        const category = row.category ?? 'autresMateriels';
        investments.push({ id: id('i'), category, amortGroup: INVESTMENT_OPTIONS[category] ?? 'materielOutillage', label: row.name, monthlyValues: series(row.amount, row.start, 0, true) });
        break;
      }
      case 'funding': {
        if (!row.funding) break;
        const base: FinancingPlan = financing ?? structuredClone(finance?.financing ?? EMPTY_FINANCING);
        if (!financing) {
          // Seuls les montants collés comptent : le reste reste à zéro, et la
          // fusion côté serveur garde alors les montants déjà saisis.
          base.apportCapital = 0;
          base.subvention = 0;
          base.creditFournisseurs = 0;
          base.autofinancement = 0;
          base.cmt = { ...base.cmt, amount: 0 };
          base.compteCourantAssocies = { ...base.compteCourantAssocies, amount: 0 };
          base.creditBail = { ...base.creditBail, amount: 0 };
        }
        if (row.funding === 'apportCapital' || row.funding === 'subvention') {
          base[row.funding] += row.amount;
        } else {
          base[row.funding] = { ...base[row.funding], amount: base[row.funding].amount + row.amount };
        }
        financing = base;
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
