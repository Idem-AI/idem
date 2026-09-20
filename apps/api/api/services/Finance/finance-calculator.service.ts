/**
 * Service de calculs financiers — reproduit toutes les formules du fichier Excel
 * "Prévisions financières V1 bis".
 *
 * Fonctions pures, sans effet de bord. Le service n'accède pas à la base de
 * données ; il prend en entrée un FinanceModel et renvoie un FinanceComputed.
 */

import {
  AmortizationComputed,
  AmortizationGroup,
  AmortizationRow,
  BfrComputed,
  CashFlowOecRow,
  CostStructureComputed,
  FundingPlanComputed,
  ProjectCostComputed,
  ShareValueRow,
  TaxesComputed,
  fiscalYearLabels,
  BilanRow,
  CompteExploitationRow,
  FINANCE_PROJECTION_MONTHS,
  FinanceComputed,
  FinanceModel,
  FinancingComputed,
  FluxTresorerieRow,
  InvestmentLine,
  LoanParams,
  LoanSchedule,
  MonthlyArray,
  RatiosComputed,
  RevenueComputed,
  SeuilRentabiliteRow,
  YearlyArray,
  zerosMonthly,
  zerosYearly,
} from '../../models/finance.model';
import {
  computeCashFlowOec,
  computeCmpc,
  computeCostStructure,
  computeDiscountedFlows,
  computeFraisPremierFonctionnement,
  computeFundingPlan,
  computePatenteBrackets,
  computeProjectCost,
  computeShareValues,
  computeTaxes,
} from './finance-statements.service';

// =====================================================================
// HELPERS
// =====================================================================

const MONTHS_PER_YEAR = 12;

const sum = (arr: number[]): number => arr.reduce((a, b) => a + (b || 0), 0);

const addMonthly = (a: MonthlyArray, b: MonthlyArray): MonthlyArray =>
  a.map((v, i) => (v || 0) + (b[i] || 0));

/** Agrège un tableau mensuel (36) en tableau annuel (years) */
const monthlyToYearly = (monthly: MonthlyArray, years: number): YearlyArray => {
  const out = zerosYearly(years);
  for (let y = 0; y < years; y++) {
    let s = 0;
    for (let m = 0; m < MONTHS_PER_YEAR; m++) {
      const idx = y * MONTHS_PER_YEAR + m;
      if (idx < monthly.length) s += monthly[idx] || 0;
    }
    out[y] = s;
  }
  return out;
};

/** Convertit un index mois (0..35) en année (0..2) */
const yearOfMonth = (m: number): number => Math.floor(m / MONTHS_PER_YEAR);

// =====================================================================
// 1. CHIFFRE D'AFFAIRES & COGS
// =====================================================================

export function computeRevenue(finance: FinanceModel): RevenueComputed {
  const monthlyTotal = zerosMonthly();
  const cogsMonthly = zerosMonthly();
  const monthlyByProduct: Record<string, MonthlyArray> = {};

  const productMap = new Map(finance.products.map((p) => [p.id, p]));

  for (const obj of finance.salesObjectives) {
    const product = productMap.get(obj.productId);
    if (!product) continue;
    const byProduct = zerosMonthly();

    for (let m = 0; m < FINANCE_PROJECTION_MONTHS; m++) {
      let qty = obj.monthlyQuantities[m] || 0;
      // Croissance auto à partir du mois 25 si renseignée
      if (m >= 24 && obj.growthRateFromMonth25 && m > 0) {
        const baseQty = obj.monthlyQuantities[m] || obj.monthlyQuantities[m - 1] || 0;
        const monthsAfter = m - 24;
        qty = baseQty * Math.pow(1 + obj.growthRateFromMonth25 / 100, monthsAfter);
      }
      const year = yearOfMonth(m);
      const price = product.prices[year] ?? product.prices[product.prices.length - 1] ?? 0;
      const cost = product.unitCosts[year] ?? product.unitCosts[product.unitCosts.length - 1] ?? 0;
      const revenue = qty * price;
      const cogs = qty * cost;

      byProduct[m] = revenue;
      monthlyTotal[m] += revenue;
      cogsMonthly[m] += cogs;
    }
    monthlyByProduct[product.id] = byProduct;
  }

  const grossMarginMonthly = monthlyTotal.map((v, i) => v - (cogsMonthly[i] || 0));

  return {
    monthlyTotal,
    monthlyByProduct,
    yearlyTotal: monthlyToYearly(monthlyTotal, finance.projectionYears),
    cogsMonthly,
    grossMarginMonthly,
  };
}

// =====================================================================
// 2. CHARGES VARIABLES & FIXES
// =====================================================================

function aggregateChargeLines(lines: { monthlyValues: MonthlyArray }[]): MonthlyArray {
  let total = zerosMonthly();
  for (const l of lines) total = addMonthly(total, l.monthlyValues || zerosMonthly());
  return total;
}

export function computeVariableChargesMonthly(finance: FinanceModel): MonthlyArray {
  return aggregateChargeLines(finance.variableCharges.lines);
}

export function computeFixedChargesMonthly(finance: FinanceModel): MonthlyArray {
  // Charges fixes (hors salaires/charges sociales/TUS qui sont calculés à part)
  const baseLines = aggregateChargeLines(finance.fixedCharges.lines);
  const salariesMonthly = aggregateChargeLines(finance.fixedCharges.salaries);
  const socialChargesRate = finance.fixedCharges.socialChargesRatePct / 100;
  const tusRate = finance.fixedCharges.tusRatePct / 100;

  return baseLines.map((v, i) => {
    const salaries = salariesMonthly[i] || 0;
    return v + salaries + salaries * socialChargesRate + salaries * tusRate;
  });
}

export function computeSalariesMonthly(finance: FinanceModel): MonthlyArray {
  return aggregateChargeLines(finance.fixedCharges.salaries);
}

// =====================================================================
// 3. IMPÔTS ET TAXES — PATENTE
// =====================================================================

/**
 * Patente annuelle, barème PROGRESSIF PAR TRANCHE.
 *
 * Le calcul délègue à `computePatenteBrackets`, qui somme (plafond − seuil) ×
 * taux sur chaque tranche franchie. La version précédente appliquait le taux de
 * la seule tranche atteinte à la TOTALITÉ du chiffre d'affaires : sur un CA
 * d'un milliard, cela doublait la patente. Un compte d'exploitation et un
 * tableau fiscal qui ne calculent pas la même patente est le genre de
 * contradiction qu'un lecteur repère immédiatement — d'où le point d'entrée
 * unique.
 */
export function computePatente(ca: number, finance: FinanceModel): number {
  return computePatenteBrackets(ca, finance).total;
}

/** Taxe d'occupation annuelle selon taille des locaux */
export function computeTaxeOccupation(finance: FinanceModel): number {
  return finance.taxesParams.taxeOccupation[finance.taxesParams.locationSize];
}

/** Impôts et taxes annuels totaux (hors IS) */
export function computeImpotsTaxesAnnuels(
  yearlyCA: YearlyArray,
  yearlySalaries: YearlyArray,
  finance: FinanceModel
): YearlyArray {
  const tusRate = finance.fixedCharges.tusRatePct / 100;
  const taxeOcc = computeTaxeOccupation(finance);
  return yearlyCA.map((ca, y) => {
    const patente = computePatente(ca, finance);
    const tus = (yearlySalaries[y] || 0) * tusRate;
    return patente + taxeOcc + tus;
  });
}

// =====================================================================
// 4. AMORTISSEMENTS
// =====================================================================

type AmortizableGroup = 'incorporelles' | 'batiments' | 'mobilier' | 'materielOutillage';

export function computeAmortization(finance: FinanceModel): AmortizationComputed {
  const groups: AmortizableGroup[] = [
    'incorporelles',
    'batiments',
    'mobilier',
    'materielOutillage',
  ];
  const years = finance.projectionYears;
  const rows: AmortizationRow[] = [];

  for (const group of groups) {
    const investsInGroup = finance.investments.filter((i) => i.amortGroup === group);
    if (investsInGroup.length === 0) {
      rows.push({
        category: group,
        base: 0,
        ratePct: finance.amortizationDefaults[group] || 0,
        annualDotations: zerosYearly(years),
        cumulative: zerosYearly(years),
        vna: zerosYearly(years),
      });
      continue;
    }

    const defaultRate = finance.amortizationDefaults[group] || 0;
    // Pour chaque investissement, calculer la dotation annuelle linéaire
    const annualDotations = zerosYearly(years);
    let totalBase = 0;

    for (const inv of investsInGroup) {
      const rate = (inv.amortRateOverridePct ?? defaultRate) / 100;
      if (rate <= 0) continue;
      // Annualiser les investissements mensuels par année d'achat
      const invYearly = monthlyToYearly(inv.monthlyValues, years);
      // Chaque tranche d'investissement de l'année y génère dotation = invYearly[y] * rate
      // jusqu'à totalement amortie (1/rate années)
      const lifeYears = Math.max(1, Math.round(1 / rate));
      for (let yPurchase = 0; yPurchase < years; yPurchase++) {
        const amount = invYearly[yPurchase];
        totalBase += amount;
        for (let k = 0; k < lifeYears && yPurchase + k < years; k++) {
          annualDotations[yPurchase + k] += amount * rate;
        }
      }
    }

    // Cumul + VNA
    const cumulative = zerosYearly(years);
    const vna = zerosYearly(years);
    let cum = 0;
    let baseYear = 0;
    for (let y = 0; y < years; y++) {
      // Base = cumul des invests jusqu'à l'année y
      // On reconstitue le cumul base depuis les invests
      const investsTillY = investsInGroup.reduce((acc, inv) => {
        const invYearly = monthlyToYearly(inv.monthlyValues, years);
        let s = 0;
        for (let k = 0; k <= y; k++) s += invYearly[k];
        return acc + s;
      }, 0);
      baseYear = investsTillY;
      cum += annualDotations[y];
      cumulative[y] = cum;
      vna[y] = Math.max(0, baseYear - cum);
    }

    rows.push({
      category: group,
      base: totalBase,
      ratePct: defaultRate,
      annualDotations,
      cumulative,
      vna,
    });
  }

  const totalAnnualDotations = zerosYearly(years);
  for (const row of rows) {
    for (let y = 0; y < years; y++) totalAnnualDotations[y] += row.annualDotations[y];
  }

  return { rows, totalAnnualDotations };
}

// =====================================================================
// 5. EMPRUNTS — ÉCHÉANCIERS
// =====================================================================

function emptySchedule(periods: number): LoanSchedule {
  return {
    capitalDu: Array(periods).fill(0),
    interets: Array(periods).fill(0),
    amortissements: Array(periods).fill(0),
    annuites: Array(periods).fill(0),
    totalInterets: 0,
  };
}

/**
 * ── LES ÉCHÉANCIERS SONT TOUJOURS MENSUELS ─────────────────────────────────
 *
 * Deux défauts se cachaient dans la version précédente, et le second n'était
 * visible que dans le rapport imprimé :
 *
 *  1. une durée exprimée en ANNÉES produisait `duration × 12` périodes — donc
 *     des périodes mensuelles — mais conservait le taux ANNUEL sur chacune.
 *     Un emprunt de 300 M à 9,5 % sur 5 ans facturait ainsi 28,5 M d'intérêts
 *     SOIXANTE fois : 1,42 Md d'intérêts sur un capital de 300 M ;
 *  2. les consommateurs en aval (charges financières, remboursements, capital
 *     restant dû) indexaient ce même tableau à l'ANNÉE quand l'unité de durée
 *     valait `years` — ils lisaient donc la deuxième mensualité comme la
 *     deuxième annuité.
 *
 * La cause commune est l'ambiguïté de l'unité. Elle est supprimée : un
 * échéancier est mensuel, toujours, et le taux périodique est le taux annuel
 * divisé par douze. Plus aucun appelant n'a d'unité à deviner.
 */

/** Nombre de mensualités d'un emprunt, quelle que soit l'unité saisie. */
function scheduleMonths(p: LoanParams): number {
  const duration = p.duration || 0;
  return p.durationUnit === 'months' ? duration : duration * MONTHS_PER_YEAR;
}

/** Échéancier d'amortissement constant, mensualisé. */
function constantAmortizationSchedule(p: LoanParams): LoanSchedule {
  const periods = scheduleMonths(p);
  if (periods <= 0 || p.amount <= 0) return emptySchedule(Math.max(periods, 1));

  const rate = p.ratePct / 100 / MONTHS_PER_YEAR;
  const periodicAmort = p.amount / periods;

  const schedule = emptySchedule(periods);
  let remaining = p.amount;
  for (let i = 0; i < periods; i++) {
    const interest = remaining * rate;
    schedule.capitalDu[i] = remaining;
    schedule.interets[i] = interest;
    schedule.amortissements[i] = periodicAmort;
    schedule.annuites[i] = periodicAmort + interest;
    schedule.totalInterets += interest;
    remaining -= periodicAmort;
  }
  return schedule;
}

/** Échéancier d'annuité constante, mensualisé. */
function constantAnnuitySchedule(p: LoanParams): LoanSchedule {
  const periods = scheduleMonths(p);
  if (periods <= 0 || p.amount <= 0) return emptySchedule(Math.max(periods, 1));

  const r = p.ratePct / 100 / MONTHS_PER_YEAR;
  const annuite = r === 0 ? p.amount / periods : (p.amount * r) / (1 - Math.pow(1 + r, -periods));

  const schedule = emptySchedule(periods);
  let remaining = p.amount;
  for (let i = 0; i < periods; i++) {
    const interest = remaining * r;
    const amort = annuite - interest;
    schedule.capitalDu[i] = remaining;
    schedule.interets[i] = interest;
    schedule.amortissements[i] = amort;
    schedule.annuites[i] = annuite;
    schedule.totalInterets += interest;
    remaining -= amort;
  }
  return schedule;
}

export function computeLoanSchedule(p: LoanParams): LoanSchedule {
  if (!p || !p.amount || p.amount <= 0) return emptySchedule(1);
  const method = p.method || 'constant_annuity';
  return method === 'constant_amortization'
    ? constantAmortizationSchedule(p)
    : constantAnnuitySchedule(p);
}

/**
 * Agrège une série mensuelle d'échéancier en totaux par exercice.
 * Employée pour les intérêts comme pour les amortissements de capital.
 */
export function scheduleToYearly(monthlySeries: number[], years: number): YearlyArray {
  const out = zerosYearly(years);
  for (let i = 0; i < monthlySeries.length; i++) {
    const y = Math.floor(i / MONTHS_PER_YEAR);
    if (y < years) out[y] += monthlySeries[i] || 0;
  }
  return out;
}

/** Charges financières annuelles portées par un échéancier. */
function scheduleAnnualInterests(schedule: LoanSchedule, years: number): YearlyArray {
  return scheduleToYearly(schedule.interets, years);
}

// =====================================================================
// 6. BFR & FINANCEMENT
// =====================================================================

export function computeBfr(finance: FinanceModel, revenue: RevenueComputed): BfrComputed {
  const recRate = finance.revenueParams.clientReceivablesRatePct / 100;
  const supplierRate = finance.variableCharges.supplierDebtRatePct / 100;
  const safetyStockRate = finance.variableCharges.safetyStockRatePct / 100;

  const variableMonthly = computeVariableChargesMonthly(finance);
  const matieresMonthly = aggregateChargeLines(
    finance.variableCharges.lines.filter((l) =>
      ['matieresPremieres', 'achatsMarchandises'].includes(l.category)
    )
  );

  const monthlyBfr = zerosMonthly();
  for (let m = 0; m < 12; m++) {
    const creancesClients = (revenue.monthlyTotal[m] || 0) * recRate;
    const stocks = (matieresMonthly[m] || 0) * safetyStockRate;
    const dettesFourn = (variableMonthly[m] || 0) * supplierRate;
    monthlyBfr[m] = creancesClients + stocks - dettesFourn;
  }

  // Frais de premier fonctionnement : les charges d'exploitation de la période
  // initiale, variables comprises (cf. INITIAL_OPERATING_MONTHS). Retenir le
  // seul premier mois de charges fixes donnait un fonds de roulement dérisoire,
  // donc un coût de projet sous-évalué, donc un besoin de financement invisible.
  const fraisPremierFonctionnement = computeFraisPremierFonctionnement(finance);

  // Variation annuelle: BFR fin d'année N - BFR fin d'année N-1
  const variationAnnuelle = zerosYearly(finance.projectionYears);
  let prevBfr = 0;
  for (let y = 0; y < finance.projectionYears; y++) {
    const lastMonth = Math.min((y + 1) * MONTHS_PER_YEAR - 1, FINANCE_PROJECTION_MONTHS - 1);
    const recRateApplied = (revenue.monthlyTotal[lastMonth] || 0) * recRate;
    const stocks = (matieresMonthly[lastMonth] || 0) * safetyStockRate;
    const dettes = (variableMonthly[lastMonth] || 0) * supplierRate;
    const yearEndBfr = recRateApplied + stocks - dettes;
    variationAnnuelle[y] = yearEndBfr - prevBfr;
    prevBfr = yearEndBfr;
  }

  return { monthlyBfr, fraisPremierFonctionnement, variationAnnuelle };
}

export function computeFinancing(
  finance: FinanceModel,
  bfr: BfrComputed,
  projectCost: ProjectCostComputed
): FinancingComputed {
  // Le coût du projet vient du TABLEAU DES INVESTISSEMENTS, pas d'un agrégat
  // parallèle : c'est ce tableau que le rapport publie, et deux chemins de
  // calcul finissent toujours par diverger.
  const totalInvestissements = projectCost.totalInvestissements;
  const totalBfr = projectCost.besoinFondsRoulement;
  const coutTotalProjet = projectCost.coutTotalProjet;

  const f = finance.financing;
  const totalFinancement =
    f.apportCapital +
    f.compteCourantAssocies.amount +
    f.cmt.amount +
    f.creditBail.amount +
    f.creditFournisseurs +
    f.autofinancement +
    f.subvention;

  const compteCourantSchedule = computeLoanSchedule(f.compteCourantAssocies);
  const cmtSchedule = computeLoanSchedule(f.cmt);
  const creditBailSchedule = computeLoanSchedule(f.creditBail);

  const years = finance.projectionYears;
  const chargesFinancieresAnnuelles = zerosYearly(years);
  for (const sched of [compteCourantSchedule, cmtSchedule, creditBailSchedule]) {
    const annual = scheduleAnnualInterests(sched, years);
    for (let y = 0; y < years; y++) chargesFinancieresAnnuelles[y] += annual[y];
  }

  return {
    totalInvestissements,
    totalBfr,
    coutTotalProjet,
    totalFinancement,
    compteCourantSchedule,
    cmtSchedule,
    creditBailSchedule,
    chargesFinancieresAnnuelles,
  };
}

// =====================================================================
// 7. COMPTE D'EXPLOITATION
// =====================================================================

export function computeCompteExploitation(
  finance: FinanceModel,
  revenue: RevenueComputed,
  amort: AmortizationComputed,
  financing: FinancingComputed
): CompteExploitationRow[] {
  const years = finance.projectionYears;
  const variableMonthly = computeVariableChargesMonthly(finance);
  const fixedMonthly = computeFixedChargesMonthly(finance);
  const salariesMonthly = computeSalariesMonthly(finance);

  const yearlyCA = revenue.yearlyTotal;
  const yearlyVar = monthlyToYearly(variableMonthly, years);
  const yearlyFix = monthlyToYearly(fixedMonthly, years);
  const yearlySalaries = monthlyToYearly(salariesMonthly, years);

  const impotsTaxesAnnuels = computeImpotsTaxesAnnuels(yearlyCA, yearlySalaries, finance);
  const isRate = finance.taxesParams.isRatePct / 100;

  const rows: CompteExploitationRow[] = [];
  for (let y = 0; y < years; y++) {
    const ca = yearlyCA[y] || 0;
    const cv = yearlyVar[y] || 0;
    const margeBrute = ca - cv;
    const tauxMarge = ca > 0 ? (margeBrute / ca) * 100 : 0;
    const cf = yearlyFix[y] || 0;
    const remunerations = yearlySalaries[y] || 0;
    const va = margeBrute - (cf - remunerations); // VA = CA - conso - charges externes; ici approximé
    const ebe = margeBrute - cf - impotsTaxesAnnuels[y];
    const dotations = amort.totalAnnualDotations[y] || 0;
    const re = ebe - dotations;
    const chargesFi = financing.chargesFinancieresAnnuelles[y] || 0;
    const rai = re - chargesFi;
    const is = Math.max(0, rai * isRate);
    const rn = rai - is;

    rows.push({
      year: y + 1,
      chiffreAffaires: ca,
      chargesVariables: cv,
      margeBrute,
      tauxMargePct: tauxMarge,
      chargesFixes: cf,
      valeurAjoutee: va,
      remunerations,
      impotsTaxes: impotsTaxesAnnuels[y],
      ebe,
      dotationsAmortissements: dotations,
      resultatExploitation: re,
      chargesFinancieres: chargesFi,
      resultatAvantImpot: rai,
      is,
      resultatNet: rn,
    });
  }
  return rows;
}

// =====================================================================
// 8. SEUIL DE RENTABILITÉ
// =====================================================================

export function computeSeuilRentabilite(
  compteExpl: CompteExploitationRow[]
): SeuilRentabiliteRow[] {
  return compteExpl.map((row) => {
    const taux = row.tauxMargePct / 100;
    const seuil = taux > 0 ? row.chargesFixes / taux : 0;
    const caJournalier = row.chiffreAffaires / 360;
    const pointMort = caJournalier > 0 ? seuil / caJournalier : 0;
    const part = row.chiffreAffaires > 0 ? (seuil / row.chiffreAffaires) * 100 : 0;
    return {
      year: row.year,
      chargesFixes: row.chargesFixes,
      tauxMargeCoutsVariablesPct: row.tauxMargePct,
      seuilRentabilite: seuil,
      caJournalier,
      pointMortJours: pointMort,
      partSeuilDansCAPct: part,
    };
  });
}
// =====================================================================
// 9. BILAN PRÉVISIONNEL
// =====================================================================

/**
 * Bilan prévisionnel, la trésorerie servant de VARIABLE D'ÉQUILIBRAGE.
 *
 * L'ancienne version reprenait la trésorerie du tableau de flux et additionnait
 * le passif de son côté : les deux totaux ne tombaient jamais juste, et un
 * bilan qui ne s'équilibre pas est, pour un analyste, le signal qu'il faut
 * cesser de lire. La trésorerie est donc déduite :
 *
 *   Trésorerie = Total passif − VNC − Créances clients − Stock
 *
 * Elle peut ressortir négative : c'est alors un découvert, et c'est une
 * information — pas un défaut à masquer par un `Math.max(0, …)`.
 */
export function computeBilan(
  finance: FinanceModel,
  revenue: RevenueComputed,
  compteExpl: CompteExploitationRow[],
  amort: AmortizationComputed,
  bfr: BfrComputed,
  financing: FinancingComputed,
  dividendes: YearlyArray
): BilanRow[] {
  const years = finance.projectionYears;
  const recRate = finance.revenueParams.clientReceivablesRatePct / 100;
  const supplierRate = finance.variableCharges.supplierDebtRatePct / 100;
  const safetyStockRate = finance.variableCharges.safetyStockRatePct / 100;

  const matieresMonthly = aggregateChargeLines(
    finance.variableCharges.lines.filter((l) =>
      ['matieresPremieres', 'achatsMarchandises', 'achatsStockes'].includes(l.category)
    )
  );
  const variableMonthly = computeVariableChargesMonthly(finance);

  const investsYearly = monthlyToYearly(
    finance.investments.reduce<MonthlyArray>(
      (acc, inv) => addMonthly(acc, inv.monthlyValues),
      zerosMonthly()
    ),
    years
  );

  let immoBrutesCum = 0;
  let reportANouveau = 0;
  const rows: BilanRow[] = [];

  for (let y = 0; y < years; y++) {
    const lastMonth = Math.min((y + 1) * MONTHS_PER_YEAR - 1, FINANCE_PROJECTION_MONTHS - 1);
    immoBrutesCum += investsYearly[y];

    const creances = (revenue.monthlyTotal[lastMonth] || 0) * recRate;
    const stocks = (matieresMonthly[lastMonth] || 0) * safetyStockRate;

    const amortCum = amort.rows.reduce((acc, r) => acc + (r.cumulative[y] || 0), 0);
    const vnc = Math.max(0, immoBrutesCum - amortCum);

    const dettesFourn = (variableMonthly[lastMonth] || 0) * supplierRate;

    // Capital restant dû à la clôture : la dernière mensualité de l'exercice,
    // diminuée de l'amortissement qu'elle porte.
    const remainingLoan = (sched: LoanSchedule): number => {
      const idx = (y + 1) * MONTHS_PER_YEAR - 1;
      if (idx >= sched.capitalDu.length) return 0;
      return Math.max(0, sched.capitalDu[idx] - sched.amortissements[idx]);
    };
    const empruntsRestants =
      remainingLoan(financing.cmtSchedule) + remainingLoan(financing.creditBailSchedule);
    const ccaRestant = remainingLoan(financing.compteCourantSchedule);

    const cex = compteExpl[y];
    // Impôt sur les sociétés et impôts assis sur l'exercice, restant à décaisser
    // à la clôture. L'IS d'un exercice se règle sur le suivant.
    const dettesFiscalesSociales = cex.is + cex.impotsTaxes * 0.1;
    const totalDettes = dettesFourn + dettesFiscalesSociales + empruntsRestants;

    const resultatExo = cex.resultatNet;
    const fondsPropres =
      finance.financing.apportCapital + reportANouveau + resultatExo + ccaRestant;
    const totalPassif = totalDettes + fondsPropres;

    // ── L'ÉQUILIBRE ────────────────────────────────────────────────────────
    const tresorerie = totalPassif - vnc - creances - stocks;
    const totalActifsCirc = creances + stocks + tresorerie;
    const totalActif = totalActifsCirc + vnc;

    rows.push({
      year: y + 1,
      tresorerie,
      creancesClients: creances,
      stocks,
      totalActifsCirculants: totalActifsCirc,
      immobilisationsBrutes: immoBrutesCum,
      amortissementsCumules: amortCum,
      vnc,
      totalActif,
      dettesFournisseurs: dettesFourn,
      dettesFiscalesSociales,
      emprunts: empruntsRestants,
      totalDettes,
      capitalSocial: finance.financing.apportCapital,
      reportANouveau,
      resultatExercice: resultatExo,
      compteCourantAssocies: ccaRestant,
      fondsPropres,
      totalPassif,
      bfr: creances + stocks - dettesFourn,
      variationBfr: bfr.variationAnnuelle[y] || 0,
    });

    // Report à nouveau : cumul des résultats NETS DES DIVIDENDES distribués.
    // Un cumul brut ferait apparaître en fonds propres des sommes déjà sorties.
    reportANouveau += resultatExo - (dividendes[y] || 0);
  }
  return rows;
}

// =====================================================================
// 10. FLUX DE TRÉSORERIE — vue condensée du tableau O.E.C.
// =====================================================================

/**
 * Projection du tableau O.E.C. dans la forme condensée historique.
 *
 * Les deux tableaux ne peuvent plus diverger : il n'y a qu'un seul calcul de
 * flux, et celui-ci n'en est qu'une lecture.
 */
export function computeFluxTresorerie(oec: CashFlowOecRow[]): FluxTresorerieRow[] {
  return oec.map((row) => ({
    year: row.year,
    fluxExploitation: row.fluxActivite,
    fluxInvestissement: row.fluxInvestissement,
    fluxFinancement: row.fluxFinancement,
    variationTresorerie: row.variationTresorerie,
    tresorerieOuverture: row.tresorerieOuverture,
    tresorerieCloture: row.tresorerieCloture,
  }));
}

// =====================================================================
// 11. RATIOS — VAN, TRI, DRCI, INDICE PROFITABILITÉ, DCF
// =====================================================================

/** Valeur Actuelle Nette */
export function computeVAN(fluxCash: number[], i0: number, ratePct: number): number {
  const r = ratePct / 100;
  let van = -i0;
  for (let t = 0; t < fluxCash.length; t++) {
    van += fluxCash[t] / Math.pow(1 + r, t + 1);
  }
  return van;
}

/** TRI par méthode de Newton-Raphson (renvoie un % annuel) */
export function computeTRI(fluxCash: number[], i0: number): number {
  // Inclut l'investissement initial à t=0 sous forme négative
  const cf = [-i0, ...fluxCash];
  const npv = (rate: number): number => {
    let v = 0;
    for (let t = 0; t < cf.length; t++) v += cf[t] / Math.pow(1 + rate, t);
    return v;
  };
  const dnpv = (rate: number): number => {
    let v = 0;
    for (let t = 1; t < cf.length; t++) v += (-t * cf[t]) / Math.pow(1 + rate, t + 1);
    return v;
  };

  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    const f = npv(rate);
    const fp = dnpv(rate);
    if (Math.abs(fp) < 1e-10) break;
    const next = rate - f / fp;
    if (Math.abs(next - rate) < 1e-7) {
      rate = next;
      break;
    }
    rate = next;
    if (rate < -0.99) rate = -0.99;
  }
  return rate * 100;
}

/** DRCI: délai (en années, possiblement fractionnaire) pour récupérer I0 */
export function computeDRCI(fluxCash: number[], i0: number): number {
  let cum = 0;
  for (let t = 0; t < fluxCash.length; t++) {
    const prevCum = cum;
    cum += fluxCash[t];
    if (cum >= i0) {
      const need = i0 - prevCum;
      const fraction = fluxCash[t] > 0 ? need / fluxCash[t] : 0;
      return t + fraction;
    }
  }
  return fluxCash.length; // pas récupéré dans l'horizon
}

export function computeRatios(
  finance: FinanceModel,
  compteExpl: CompteExploitationRow[],
  amort: AmortizationComputed,
  financing: FinancingComputed,
  bfr: BfrComputed,
  bilan: BilanRow[],
  fundingPlan: FundingPlanComputed,
  dividendes: YearlyArray
): RatiosComputed {
  const labels = fiscalYearLabels(finance.fiscalCalendar, finance.projectionYears);

  // Flux de trésorerie disponibles annuels = RN + Dotations - Variation BFR
  const fluxCash = compteExpl.map(
    (c, y) => c.resultatNet + (amort.totalAnnualDotations[y] || 0) - (bfr.variationAnnuelle[y] || 0)
  );

  const i0 = financing.coutTotalProjet;
  const discountRate = finance.ratiosParams.vanDiscountRatePct;
  const van = computeVAN(fluxCash, i0, discountRate);
  const tri = computeTRI(fluxCash, i0);
  const drci = computeDRCI(fluxCash, i0);

  // ── SINCÉRITÉ DU CALCUL ──────────────────────────────────────────────────
  //
  // VAN, TRI et indice de profitabilité n'ont de sens que si l'année 0 porte un
  // décaissement. Quand le tableau des investissements est vide, I0 vaut zéro :
  // la VAN devient la somme actualisée des bénéfices et le TRI diverge vers
  // l'infini. Ces deux nombres restent CALCULÉS — mais ils partent marqués, et
  // le rapport refuse de les présenter comme des indicateurs de rentabilité.
  const significant = i0 > 0;
  const significanceNote = significant
    ? undefined
    : "Aucun investissement initial n'est saisi : la VAN, le TRI et l'indice de " +
      'profitabilité sont sans objet tant que le tableau des investissements et le ' +
      'besoin en fonds de roulement ne sont pas renseignés.';

  // Indice de profitabilité classique = valeur actuelle des flux / I0.
  const indiceProfitabilite = i0 > 0 ? (van + i0) / i0 : 0;
  // Variante du cahier des charges : VAN / I0.
  const indiceProfitabiliteVanSurI0 = i0 > 0 ? van / i0 : 0;

  const fluxActualisesDetail = computeDiscountedFlows(fluxCash, i0, discountRate, labels);
  const drciAtteintAnnee =
    fluxActualisesDetail.find((row) => row.year > 0 && row.cumulFlux >= 0)?.year ?? null;

  // ── DCF ──────────────────────────────────────────────────────────────────
  const cmpc = computeCmpc(finance, fundingPlan);
  const cmpcRate = cmpc.valuePct / 100;
  const gInf = finance.ratiosParams.perpetualGrowthRatePct / 100;
  const fluxActualises = fluxCash.map((f, t) => f / Math.pow(1 + cmpcRate, t + 1));
  const fluxNormatif = fluxCash[fluxCash.length - 1] || 0;
  const valeurTerminale = cmpcRate > gInf ? (fluxNormatif * (1 + gInf)) / (cmpcRate - gInf) : 0;
  const valeurTerminaleActualisee = valeurTerminale / Math.pow(1 + cmpcRate, fluxCash.length);
  const valeurTotaleEntreprise =
    fluxActualises.reduce((a, b) => a + b, 0) + valeurTerminaleActualisee;

  return {
    van,
    tri,
    drci,
    indiceProfitabilite,
    indiceProfitabiliteVanSurI0,
    investissementInitial: i0,
    significant,
    significanceNote,
    fluxActualisesDetail,
    drciAtteintAnnee,
    cmpc,
    valeurAction: computeShareValues(finance, bilan, dividendes),
    dcf: {
      fluxActualises,
      fluxNormatif,
      valeurTerminale: valeurTerminaleActualisee,
      valeurTotaleEntreprise,
    },
    dividendesAnnuels: dividendes,
  };
}

// =====================================================================
// ENTRÉE PRINCIPALE
// =====================================================================

/**
 * Calcule l'ensemble des sorties financières d'un FinanceModel.
 *
 * L'ORDRE compte, et il est celui d'une clôture réelle : exploitation, puis
 * dividendes, puis bilan (dont la trésorerie équilibre), puis flux de
 * trésorerie déduits du bilan, puis seulement les indicateurs. Chaque étape ne
 * lit que ce que la précédente a produit — c'est ce qui garantit qu'aucun
 * tableau du rapport n'en contredit un autre.
 */
export function computeFinance(finance: FinanceModel): FinanceComputed {
  const years = finance.projectionYears;
  const labels = fiscalYearLabels(finance.fiscalCalendar, years);

  const revenue = computeRevenue(finance);
  const amortization = computeAmortization(finance);
  const bfr = computeBfr(finance, revenue);
  const projectCost = computeProjectCost(finance);
  const financing = computeFinancing(finance, bfr, projectCost);
  const fundingPlan = computeFundingPlan(finance, projectCost);

  const compteExploitation = computeCompteExploitation(finance, revenue, amortization, financing);
  const costStructure = computeCostStructure(finance);
  const taxes = computeTaxes(finance, compteExploitation, revenue.yearlyTotal, costStructure);
  const seuilRentabilite = computeSeuilRentabilite(compteExploitation);

  const dividendRate = finance.ratiosParams.dividendDistributionRatePct / 100;
  const dividendes = compteExploitation.map((row) => Math.max(0, row.resultatNet) * dividendRate);

  const bilan = computeBilan(
    finance,
    revenue,
    compteExploitation,
    amortization,
    bfr,
    financing,
    dividendes
  );

  const cashFlowOec = computeCashFlowOec(
    finance,
    compteExploitation,
    amortization,
    bilan,
    financing,
    dividendes
  );
  const fluxTresorerie = computeFluxTresorerie(cashFlowOec);

  const ratios = computeRatios(
    finance,
    compteExploitation,
    amortization,
    financing,
    bfr,
    bilan,
    fundingPlan,
    dividendes
  );

  const recRate = finance.revenueParams.clientReceivablesRatePct / 100;
  const creancesClients = revenue.yearlyTotal.map((ca) => ca * recRate);

  return {
    revenue,
    amortization,
    bfr,
    financing,
    compteExploitation,
    bilan,
    seuilRentabilite,
    fluxTresorerie,
    ratios,
    fiscalYearLabels: labels,
    costStructure,
    taxes,
    projectCost,
    fundingPlan,
    cashFlowOec,
    creancesClients,
  };
}
