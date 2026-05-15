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

/** Calcule la patente annuelle à partir du CA selon les tranches progressives */
export function computePatente(ca: number, finance: FinanceModel): number {
  const brackets = finance.taxesParams.patenteBrackets;
  // On applique le taux de la tranche correspondante (taux progressif simple)
  for (const bracket of brackets) {
    if (ca <= bracket.caUpperBound) {
      const computed = (ca * bracket.ratePct) / 100;
      return Math.max(computed, bracket.minAmount || 0);
    }
  }
  return 0;
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

/** Échéancier d'amortissement constant */
function constantAmortizationSchedule(p: LoanParams): LoanSchedule {
  const periods = p.durationUnit === 'months' ? p.duration : p.duration * MONTHS_PER_YEAR;
  if (periods <= 0 || p.amount <= 0) return emptySchedule(Math.max(periods, 1));

  const rPerPeriod = p.durationUnit === 'months' ? p.ratePct / 100 / 12 : p.ratePct / 100;
  const isMonthlyRate = p.durationUnit === 'months';
  const periodicAmort = p.amount / periods;

  const schedule = emptySchedule(periods);
  let remaining = p.amount;
  for (let i = 0; i < periods; i++) {
    const interest = remaining * (isMonthlyRate ? rPerPeriod : rPerPeriod);
    schedule.capitalDu[i] = remaining;
    schedule.interets[i] = interest;
    schedule.amortissements[i] = periodicAmort;
    schedule.annuites[i] = periodicAmort + interest;
    schedule.totalInterets += interest;
    remaining -= periodicAmort;
  }
  return schedule;
}

/** Échéancier d'annuité constante (formule de remboursement classique) */
function constantAnnuitySchedule(p: LoanParams): LoanSchedule {
  const isMonthly = p.durationUnit === 'months';
  const periods = isMonthly ? p.duration : p.duration * MONTHS_PER_YEAR;
  if (periods <= 0 || p.amount <= 0) return emptySchedule(Math.max(periods, 1));

  const r = isMonthly ? p.ratePct / 100 / 12 : p.ratePct / 100;
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

/** Convertit un échéancier (mensuel ou annuel) en charges financières annuelles */
function scheduleAnnualInterests(
  schedule: LoanSchedule,
  isMonthly: boolean,
  years: number
): YearlyArray {
  const out = zerosYearly(years);
  for (let i = 0; i < schedule.interets.length; i++) {
    const yIdx = isMonthly ? Math.floor(i / MONTHS_PER_YEAR) : i;
    if (yIdx < years) out[yIdx] += schedule.interets[i];
  }
  return out;
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

  // Frais de premier fonctionnement: somme des charges fixes du mois 1
  const fixedMonthly = computeFixedChargesMonthly(finance);
  const fraisPremierFonctionnement = fixedMonthly[0] || 0;

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

export function computeFinancing(finance: FinanceModel, bfr: BfrComputed): FinancingComputed {
  const totalInvestissements = finance.investments.reduce(
    (acc, inv) => acc + sum(inv.monthlyValues),
    0
  );
  const totalBfr = Math.max(0, ...bfr.monthlyBfr) + bfr.fraisPremierFonctionnement;
  const coutTotalProjet = totalInvestissements + totalBfr;

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
  const accumulators: Array<[LoanSchedule, boolean]> = [
    [compteCourantSchedule, (f.compteCourantAssocies.durationUnit || 'years') === 'months'],
    [cmtSchedule, (f.cmt.durationUnit || 'months') === 'months'],
    [creditBailSchedule, (f.creditBail.durationUnit || 'years') === 'months'],
  ];
  for (const [sched, isMonthly] of accumulators) {
    const annual = scheduleAnnualInterests(sched, isMonthly, years);
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
// 9. FLUX DE TRÉSORERIE (méthode OEC)
// =====================================================================

export function computeFluxTresorerie(
  finance: FinanceModel,
  compteExpl: CompteExploitationRow[],
  amort: AmortizationComputed,
  bfr: BfrComputed,
  financing: FinancingComputed
): FluxTresorerieRow[] {
  const years = finance.projectionYears;
  const investsYearly = monthlyToYearly(
    finance.investments.reduce<MonthlyArray>(
      (acc, inv) => addMonthly(acc, inv.monthlyValues),
      zerosMonthly()
    ),
    years
  );

  const rows: FluxTresorerieRow[] = [];
  // Trésorerie initiale = apports en année 0
  let tresOuverture =
    finance.financing.apportCapital +
    finance.financing.subvention +
    finance.financing.autofinancement;

  for (let y = 0; y < years; y++) {
    const cex = compteExpl[y];
    const dotations = amort.totalAnnualDotations[y] || 0;
    const varBfr = bfr.variationAnnuelle[y] || 0;
    const fluxExpl = cex.resultatNet + dotations - varBfr;

    const fluxInvest = -(investsYearly[y] || 0);

    // Flux financement = nouveaux emprunts - remboursements - intérêts (déjà dans RE)
    // Année 0: encaissements emprunts; années suivantes: remboursements
    let fluxFinancement = 0;
    if (y === 0) {
      fluxFinancement =
        finance.financing.cmt.amount +
        finance.financing.creditBail.amount +
        finance.financing.compteCourantAssocies.amount +
        finance.financing.creditFournisseurs;
    }
    // Remboursement de capital annuel
    const isMonth = (u?: 'months' | 'years') => u === 'months';
    const annualAmort = (sched: LoanSchedule, monthly: boolean) => {
      const out = zerosYearly(years);
      for (let i = 0; i < sched.amortissements.length; i++) {
        const yIdx = monthly ? Math.floor(i / MONTHS_PER_YEAR) : i;
        if (yIdx < years) out[yIdx] += sched.amortissements[i];
      }
      return out;
    };
    const remb =
      annualAmort(financing.cmtSchedule, isMonth(finance.financing.cmt.durationUnit))[y] +
      annualAmort(financing.creditBailSchedule, isMonth(finance.financing.creditBail.durationUnit))[
        y
      ] +
      annualAmort(
        financing.compteCourantSchedule,
        isMonth(finance.financing.compteCourantAssocies.durationUnit)
      )[y];
    fluxFinancement -= remb;

    const variation = fluxExpl + fluxInvest + fluxFinancement;
    const tresCloture = tresOuverture + variation;

    rows.push({
      year: y + 1,
      fluxExploitation: fluxExpl,
      fluxInvestissement: fluxInvest,
      fluxFinancement,
      variationTresorerie: variation,
      tresorerieOuverture: tresOuverture,
      tresorerieCloture: tresCloture,
    });
    tresOuverture = tresCloture;
  }
  return rows;
}

// =====================================================================
// 10. BILAN PRÉVISIONNEL
// =====================================================================

export function computeBilan(
  finance: FinanceModel,
  revenue: RevenueComputed,
  compteExpl: CompteExploitationRow[],
  amort: AmortizationComputed,
  bfr: BfrComputed,
  financing: FinancingComputed,
  flux: FluxTresorerieRow[]
): BilanRow[] {
  const years = finance.projectionYears;
  const recRate = finance.revenueParams.clientReceivablesRatePct / 100;
  const supplierRate = finance.variableCharges.supplierDebtRatePct / 100;
  const safetyStockRate = finance.variableCharges.safetyStockRatePct / 100;

  const matieresMonthly = aggregateChargeLines(
    finance.variableCharges.lines.filter((l) =>
      ['matieresPremieres', 'achatsMarchandises'].includes(l.category)
    )
  );
  const variableMonthly = computeVariableChargesMonthly(finance);

  // Cumul immobilisations brutes
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
    const tresorerie = flux[y]?.tresorerieCloture || 0;
    const totalActifsCirc = creances + stocks + Math.max(tresorerie, 0);

    const amortCum = amort.rows.reduce((acc, r) => acc + (r.cumulative[y] || 0), 0);
    const vnc = Math.max(0, immoBrutesCum - amortCum);
    const totalActif = totalActifsCirc + vnc;

    const dettesFourn = (variableMonthly[lastMonth] || 0) * supplierRate;
    // Capital restant dû sur les emprunts en fin d'année
    const remainingLoan = (sched: LoanSchedule, isMonthly: boolean): number => {
      const idx = isMonthly ? (y + 1) * MONTHS_PER_YEAR - 1 : y;
      if (idx >= sched.capitalDu.length) return 0;
      return Math.max(0, sched.capitalDu[idx] - sched.amortissements[idx]);
    };
    const isMonthly = (u?: 'months' | 'years') => u === 'months';
    const empruntsRestants =
      remainingLoan(financing.cmtSchedule, isMonthly(finance.financing.cmt.durationUnit)) +
      remainingLoan(
        financing.creditBailSchedule,
        isMonthly(finance.financing.creditBail.durationUnit)
      );
    const ccaRestant = remainingLoan(
      financing.compteCourantSchedule,
      isMonthly(finance.financing.compteCourantAssocies.durationUnit)
    );

    const cex = compteExpl[y];
    const dettesFiscalesSociales = cex.is + cex.impotsTaxes * 0.1; // approximation des dettes restantes
    const totalDettes = dettesFourn + dettesFiscalesSociales + empruntsRestants;

    const resultatExo = cex.resultatNet;
    const fondsPropres =
      finance.financing.apportCapital + reportANouveau + resultatExo + ccaRestant;
    const totalPassif = totalDettes + fondsPropres;

    rows.push({
      year: y + 1,
      tresorerie: Math.max(tresorerie, 0),
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

    // Report à nouveau = cumul des résultats nets (avant dividendes), simplifié
    reportANouveau += resultatExo;
  }
  return rows;
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
  bfr: BfrComputed
): RatiosComputed {
  // Flux de trésorerie disponibles annuels = RN + Dotations - Variation BFR
  const fluxCash = compteExpl.map(
    (c, y) => c.resultatNet + (amort.totalAnnualDotations[y] || 0) - (bfr.variationAnnuelle[y] || 0)
  );

  const i0 = financing.coutTotalProjet;
  const discountRate = finance.ratiosParams.vanDiscountRatePct;
  const van = computeVAN(fluxCash, i0, discountRate);
  const tri = computeTRI(fluxCash, i0);
  const drci = computeDRCI(fluxCash, i0);

  // Indice profitabilité = (VAN + I0) / I0
  const indiceProfitabilite = i0 > 0 ? (van + i0) / i0 : 0;

  // DCF
  const cmpc = finance.ratiosParams.cmpcPct / 100;
  const gInf = finance.ratiosParams.perpetualGrowthRatePct / 100;
  const fluxActualises = fluxCash.map((f, t) => f / Math.pow(1 + cmpc, t + 1));
  const fluxNormatif = fluxCash[fluxCash.length - 1] || 0;
  const valeurTerminale = cmpc > gInf ? (fluxNormatif * (1 + gInf)) / (cmpc - gInf) : 0;
  const valeurTerminaleActualisee = valeurTerminale / Math.pow(1 + cmpc, fluxCash.length);
  const valeurTotaleEntreprise =
    fluxActualises.reduce((a, b) => a + b, 0) + valeurTerminaleActualisee;

  const dividendRate = finance.ratiosParams.dividendDistributionRatePct / 100;
  const dividendesAnnuels = compteExpl.map((c) => Math.max(0, c.resultatNet) * dividendRate);

  return {
    van,
    tri,
    drci,
    indiceProfitabilite,
    dcf: {
      fluxActualises,
      fluxNormatif,
      valeurTerminale: valeurTerminaleActualisee,
      valeurTotaleEntreprise,
    },
    dividendesAnnuels,
  };
}

// =====================================================================
// ENTRÉE PRINCIPALE
// =====================================================================

/** Calcule l'ensemble des sorties financières d'un FinanceModel */
export function computeFinance(finance: FinanceModel): FinanceComputed {
  const revenue = computeRevenue(finance);
  const amortization = computeAmortization(finance);
  const bfr = computeBfr(finance, revenue);
  const financing = computeFinancing(finance, bfr);
  const compteExploitation = computeCompteExploitation(finance, revenue, amortization, financing);
  const seuilRentabilite = computeSeuilRentabilite(compteExploitation);
  const fluxTresorerie = computeFluxTresorerie(
    finance,
    compteExploitation,
    amortization,
    bfr,
    financing
  );
  const bilan = computeBilan(
    finance,
    revenue,
    compteExploitation,
    amortization,
    bfr,
    financing,
    fluxTresorerie
  );
  const ratios = computeRatios(finance, compteExploitation, amortization, financing, bfr);

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
  };
}
