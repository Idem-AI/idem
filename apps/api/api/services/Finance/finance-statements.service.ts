/**
 * Les états que le rapport financier devait produire et ne produisait pas.
 *
 * `finance-calculator.service` porte la cascade historique — chiffre
 * d'affaires, exploitation, bilan, trésorerie. Ce module porte ce qui manquait
 * et qui, pour un banquier, décide de la lecture du dossier :
 *
 *   · la structure de coûts DÉTAILLÉE, poste par poste, au lieu de deux totaux ;
 *   · la fiscalité tranche par tranche, la patente comprise ;
 *   · le tableau des INVESTISSEMENTS et le coût total du projet ;
 *   · le schéma de financement et, surtout, le BESOIN DE FINANCEMENT — la ligne
 *     qu'un prêteur cherche en premier et qui n'existait nulle part ;
 *   · le tableau de flux O.E.C. détaillé (A, B, C) ;
 *   · l'actualisation ligne à ligne, année 0 comprise.
 *
 * Fonctions pures. Aucune ne lit la base ni n'écrit ailleurs que dans sa valeur
 * de retour.
 */

import {
  AmortizationComputed,
  BfrComputed,
  BilanRow,
  CashFlowOecRow,
  CompteExploitationRow,
  CostStructureComputed,
  DiscountedFlowRow,
  FINANCE_PROJECTION_MONTHS,
  FinanceModel,
  FinancingComputed,
  FundingPlanComputed,
  FundingSource,
  InvestmentScheduleRow,
  MonthlyArray,
  PatenteBracketDetail,
  ProjectCostComputed,
  ShareValueRow,
  TaxesComputed,
  YearlyArray,
  fiscalYearLabels,
  zerosMonthly,
  zerosYearly,
} from '../../models/finance.model';

const MONTHS_PER_YEAR = 12;

/**
 * Durée retenue pour les « frais de premier fonctionnement ».
 *
 * Trois mois de charges d'exploitation : c'est la règle de place pour un fonds
 * de roulement de démarrage, et c'est surtout un choix EXPLICITE. L'ancien
 * calcul retenait le seul premier mois de charges fixes, ce qui donnait un BFR
 * dérisoire — donc un coût de projet sous-évalué, donc un besoin de financement
 * invisible. Le rapport affiche cette hypothèse en toutes lettres.
 */
export const INITIAL_OPERATING_MONTHS = 3;

const sum = (arr: number[]): number => arr.reduce((a, b) => a + (b || 0), 0);

const addMonthly = (a: MonthlyArray, b: MonthlyArray): MonthlyArray =>
  a.map((v, i) => (v || 0) + (b[i] || 0));

function monthlyToYearly(monthly: MonthlyArray, years: number): YearlyArray {
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
}

function aggregate(lines: { monthlyValues: MonthlyArray }[]): MonthlyArray {
  let total = zerosMonthly();
  for (const line of lines) total = addMonthly(total, line.monthlyValues || zerosMonthly());
  return total;
}

/** Postes de charges variables qui constituent un stock. */
const STOCK_CATEGORIES = ['matieresPremieres', 'achatsMarchandises', 'achatsStockes'];

/** Postes de charges fixes qui NE SONT PAS des charges externes (base de la VA). */
const NON_EXTERNAL_FIXED = [
  'remunerationsPersonnel',
  'chargesSociales',
  'impotsFonciers',
  'patentesLicences',
  'taxesSurSalaires',
  'taxesApprentissage',
  'formationProfessionnelle',
  'autresImpotsDirects',
  'droitsEnregistrement',
  'interetsEmprunt',
  'interetCreditBail',
  'escomptes',
  'autresInterets',
  'perteChange',
];

// =====================================================================
// 2. STRUCTURE DE COÛTS
// =====================================================================

export function computeCostStructure(finance: FinanceModel): CostStructureComputed {
  const years = finance.projectionYears;
  const socialRate = finance.fixedCharges.socialChargesRatePct / 100;
  const tusRate = finance.fixedCharges.tusRatePct / 100;
  const supplierRate = finance.variableCharges.supplierDebtRatePct / 100;

  const variableByLine = finance.variableCharges.lines.map((line) => ({
    id: line.id,
    label: line.label,
    category: String(line.category),
    yearly: monthlyToYearly(line.monthlyValues || zerosMonthly(), years),
  }));

  const fixedByLine = finance.fixedCharges.lines.map((line) => ({
    id: line.id,
    label: line.label,
    category: String(line.category),
    yearly: monthlyToYearly(line.monthlyValues || zerosMonthly(), years),
  }));

  const salariesByLine = finance.fixedCharges.salaries.map((line) => ({
    id: line.id,
    position: line.position,
    yearly: monthlyToYearly(line.monthlyValues || zerosMonthly(), years),
  }));

  const totalVariable = monthlyToYearly(aggregate(finance.variableCharges.lines), years);
  const totalSalaries = monthlyToYearly(aggregate(finance.fixedCharges.salaries), years);
  const baseFixed = monthlyToYearly(aggregate(finance.fixedCharges.lines), years);

  const chargesSociales = totalSalaries.map((s) => s * socialRate);
  const tus = totalSalaries.map((s) => s * tusRate);
  // Le total des charges fixes reprend la définition du compte d'exploitation :
  // postes fixes + masse salariale + charges assises sur elle.
  const totalFixed = baseFixed.map(
    (v, y) => v + (totalSalaries[y] || 0) + (chargesSociales[y] || 0) + (tus[y] || 0)
  );

  const externalLines = finance.fixedCharges.lines.filter(
    (line) => !NON_EXTERNAL_FIXED.includes(String(line.category))
  );
  const chargesExternes = monthlyToYearly(aggregate(externalLines), years);

  return {
    variableByLine,
    fixedByLine,
    salariesByLine,
    totalVariable,
    totalFixed,
    totalSalaries,
    chargesSociales,
    tus,
    detteFournisseur: totalVariable.map((v) => v * supplierRate),
    chargesExternes,
  };
}

// =====================================================================
// 3. FISCALITÉ
// =====================================================================

/**
 * Patente PAR TRANCHE : (plafond − seuil) × taux, sommé sur les tranches
 * franchies.
 *
 * L'ancien calcul appliquait le taux de la SEULE tranche atteinte à la totalité
 * du chiffre d'affaires — un barème progressif traité comme un barème
 * proportionnel, ce qui surestime la patente d'un facteur proche de deux sur un
 * CA d'un milliard. Le détail par tranche est renvoyé pour que le lecteur
 * puisse refaire le calcul.
 */
export function computePatenteBrackets(
  ca: number,
  finance: FinanceModel
): { brackets: PatenteBracketDetail[]; total: number } {
  const brackets = finance.taxesParams.patenteBrackets || [];
  const detail: PatenteBracketDetail[] = [];
  let seuil = 0;
  let total = 0;

  for (const bracket of brackets) {
    if (ca <= seuil) break;
    const plafond = Math.min(ca, bracket.caUpperBound);
    const assiette = Math.max(0, plafond - seuil);
    const montant = (assiette * bracket.ratePct) / 100;
    detail.push({ seuil, plafond, ratePct: bracket.ratePct, montant });
    total += montant;
    seuil = bracket.caUpperBound;
    if (!Number.isFinite(seuil)) break;
  }

  const floor = brackets[0]?.minAmount || 0;
  return { brackets: detail, total: ca > 0 ? Math.max(total, floor) : 0 };
}

export function computeTaxes(
  finance: FinanceModel,
  compteExpl: CompteExploitationRow[],
  yearlyCA: YearlyArray,
  costStructure: CostStructureComputed
): TaxesComputed {
  const labels = fiscalYearLabels(finance.fiscalCalendar, finance.projectionYears);
  const taxeOccupation = finance.taxesParams.taxeOccupation[finance.taxesParams.locationSize] || 0;

  const rows = compteExpl.map((row, y) => {
    const ca = yearlyCA[y] || 0;
    const { brackets, total: patente } = computePatenteBrackets(ca, finance);
    const tus = costStructure.tus[y] || 0;
    return {
      year: row.year,
      label: labels[y] ?? String(row.year),
      chiffreAffaires: ca,
      brackets,
      patente,
      taxeOccupation,
      tus,
      totalImpotsTaxes: patente + taxeOccupation + tus,
      impotSocietes: row.is,
    };
  });

  // Base des droits d'enregistrement : le capital social apporté.
  // Base foncière : terrains et bâtiments inscrits aux investissements.
  const capitalBase = finance.financing.apportCapital || 0;
  const fonciereBase = finance.investments
    .filter((inv) => ['terrains', 'batiments', 'ouvragesInfrastructure'].includes(String(inv.category)))
    .reduce((acc, inv) => acc + sum(inv.monthlyValues), 0);

  const t = finance.taxesParams;
  const droitsEnregistrement = (capitalBase * t.droitsEnregistrementPct) / 100;
  const centimesAdditionnels = (droitsEnregistrement * t.centimesAdditionnelsPct) / 100;
  const publiciteFonciere = (fonciereBase * t.publiciteFonciereePct) / 100;
  const travauxCadastraux = (fonciereBase * t.travauxCadastrauxPct) / 100;

  return {
    rows,
    droitsEnregistrement: {
      base: capitalBase + fonciereBase,
      droitsEnregistrement,
      centimesAdditionnels,
      publiciteFonciere,
      travauxCadastraux,
      total:
        droitsEnregistrement + centimesAdditionnels + publiciteFonciere + travauxCadastraux,
    },
  };
}

// =====================================================================
// 4 & 5. INVESTISSEMENTS, BFR, COÛT DU PROJET
// =====================================================================

const INCORPORELLES = 'incorporelles';
const FINANCIERES = 'financieres';

/**
 * Premier mois d'EXPLOITATION, et non premier mois du plan.
 *
 * Une activité qui démarre en septembre porte huit mois vides en tête de son
 * premier exercice — c'est ce qu'impose le calage SYSCOHADA sur l'année civile.
 * Compter le fonds de roulement sur les mois 1 à 3 revenait alors à le calculer
 * sur une période où l'entreprise n'achète ni ne vend : un stock initial nul et
 * des frais de démarrage amputés de tout leur variable.
 *
 * On retient donc le premier mois où quelque chose se passe — une charge
 * variable engagée ou une vente prévue — et, à défaut de signal, le mois de
 * démarrage déclaré au calendrier.
 */
function initialWindowStart(finance: FinanceModel): number {
  const variable = aggregate(finance.variableCharges.lines);
  const firstCharge = variable.findIndex((v) => (v || 0) > 0);
  const firstSale = finance.salesObjectives.reduce((earliest, objective) => {
    const index = (objective.monthlyQuantities || []).findIndex((q) => (q || 0) > 0);
    return index >= 0 && (earliest < 0 || index < earliest) ? index : earliest;
  }, -1);

  const signals = [firstCharge, firstSale].filter((index) => index >= 0);
  if (signals.length > 0) return Math.min(...signals);

  const declared = (finance.fiscalCalendar?.activityStartMonth ?? 1) - 1;
  return Math.min(Math.max(declared, 0), FINANCE_PROJECTION_MONTHS - 1);
}

/** Stock à constituer pour ouvrir : les achats stockés des premiers mois d'exploitation. */
export function computeStockInitial(finance: FinanceModel): number {
  const stockLines = finance.variableCharges.lines.filter((line) =>
    STOCK_CATEGORIES.includes(String(line.category))
  );
  const monthly = aggregate(stockLines);
  const start = initialWindowStart(finance);
  let total = 0;
  for (let i = 0; i < INITIAL_OPERATING_MONTHS; i++) {
    const m = start + i;
    if (m >= monthly.length) break;
    total += monthly[m] || 0;
  }
  return total;
}

/**
 * Charges d'exploitation de la période initiale.
 *
 * Les achats STOCKÉS en sont exclus : ils sont déjà portés par le stock
 * initial, et les compter deux fois gonflerait le coût du projet — donc le
 * besoin de financement — d'un montant qui n'existe pas.
 */
export function computeFraisPremierFonctionnement(finance: FinanceModel): number {
  const socialRate = finance.fixedCharges.socialChargesRatePct / 100;
  const tusRate = finance.fixedCharges.tusRatePct / 100;
  const nonStockVariable = aggregate(
    finance.variableCharges.lines.filter(
      (line) => !STOCK_CATEGORIES.includes(String(line.category))
    )
  );
  const fixedBase = aggregate(finance.fixedCharges.lines);
  const salaries = aggregate(finance.fixedCharges.salaries);
  const start = initialWindowStart(finance);

  let total = 0;
  for (let i = 0; i < INITIAL_OPERATING_MONTHS; i++) {
    const m = start + i;
    if (m >= FINANCE_PROJECTION_MONTHS) break;
    const wage = salaries[m] || 0;
    total += (nonStockVariable[m] || 0) + (fixedBase[m] || 0) + wage * (1 + socialRate + tusRate);
  }
  // Les charges fixes courent dès la constitution, avant même l'exploitation :
  // les mois qui précèdent le démarrage sont ajoutés, sans quoi le plan suppose
  // une structure gratuite jusqu'à la première vente.
  for (let m = 0; m < start && m < FINANCE_PROJECTION_MONTHS; m++) {
    const wage = salaries[m] || 0;
    total += (fixedBase[m] || 0) + wage * (1 + socialRate + tusRate);
  }
  return total;
}

export function computeProjectCost(finance: FinanceModel): ProjectCostComputed {
  const rows: InvestmentScheduleRow[] = finance.investments.map((inv) => {
    const montant = sum(inv.monthlyValues);
    const engaged = (inv.monthlyValues || []).findIndex((v) => (v || 0) > 0);
    const engagedCount = (inv.monthlyValues || []).filter((v) => (v || 0) > 0).length;
    const defaults = finance.amortizationDefaults as unknown as Record<string, number>;
    const rate =
      inv.amortGroup === FINANCIERES
        ? 0
        : (inv.amortRateOverridePct ?? defaults[inv.amortGroup] ?? 0);
    return {
      id: inv.id,
      label: inv.label,
      category: String(inv.category),
      amortGroup: inv.amortGroup,
      montant,
      moisEngagement: engagedCount === 1 && engaged >= 0 ? engaged + 1 : null,
      dureeAmortissement: rate > 0 ? Math.round(100 / rate) : 0,
      tauxAmortissementPct: rate,
    };
  });

  const totalOf = (predicate: (row: InvestmentScheduleRow) => boolean) =>
    rows.filter(predicate).reduce((acc, row) => acc + row.montant, 0);

  const immobilisationsIncorporelles = totalOf((r) => r.amortGroup === INCORPORELLES);
  const immobilisationsFinancieres = totalOf((r) => r.amortGroup === FINANCIERES);
  const immobilisationsCorporelles = totalOf(
    (r) => r.amortGroup !== INCORPORELLES && r.amortGroup !== FINANCIERES
  );
  const totalInvestissements =
    immobilisationsIncorporelles + immobilisationsCorporelles + immobilisationsFinancieres;

  const stockInitial = computeStockInitial(finance);
  const fraisPremierFonctionnement = computeFraisPremierFonctionnement(finance);
  const besoinFondsRoulement = stockInitial + fraisPremierFonctionnement;

  return {
    rows,
    immobilisationsIncorporelles,
    immobilisationsCorporelles,
    immobilisationsFinancieres,
    totalInvestissements,
    stockInitial,
    fraisPremierFonctionnement,
    besoinFondsRoulement,
    coutTotalProjet: totalInvestissements + besoinFondsRoulement,
  };
}

// =====================================================================
// 6. SCHÉMA DE FINANCEMENT ET DEMANDE
// =====================================================================

function durationLabel(duration: number, unit?: 'years' | 'months'): string {
  if (!duration) return '—';
  return unit === 'months' ? `${duration} mois` : `${duration} ans`;
}

export function computeFundingPlan(
  finance: FinanceModel,
  projectCost: ProjectCostComputed
): FundingPlanComputed {
  const f = finance.financing;

  const raw: Omit<FundingSource, 'sharePct'>[] = [
    { key: 'apportCapital', label: 'Apport en capital', nature: 'equity', amount: f.apportCapital || 0 },
    {
      key: 'compteCourantAssocies',
      label: 'Compte courant d’associés',
      nature: 'equity',
      amount: f.compteCourantAssocies?.amount || 0,
      ratePct: f.compteCourantAssocies?.ratePct,
      durationLabel: durationLabel(
        f.compteCourantAssocies?.duration,
        f.compteCourantAssocies?.durationUnit
      ),
    },
    { key: 'autofinancement', label: 'Autofinancement', nature: 'equity', amount: f.autofinancement || 0 },
    { key: 'subvention', label: 'Subvention d’investissement', nature: 'equity', amount: f.subvention || 0 },
    {
      key: 'cmt',
      label: 'Emprunt bancaire (CMT)',
      nature: 'debt',
      amount: f.cmt?.amount || 0,
      ratePct: f.cmt?.ratePct,
      durationLabel: durationLabel(f.cmt?.duration, f.cmt?.durationUnit),
    },
    {
      key: 'creditBail',
      label: 'Crédit-bail',
      nature: 'debt',
      amount: f.creditBail?.amount || 0,
      ratePct: f.creditBail?.ratePct,
      durationLabel: durationLabel(f.creditBail?.duration, f.creditBail?.durationUnit),
    },
    {
      key: 'creditFournisseurs',
      label: 'Crédit fournisseurs',
      nature: 'debt',
      amount: f.creditFournisseurs || 0,
    },
  ];

  const totalFinancement = raw.reduce((acc, s) => acc + s.amount, 0);
  const sources: FundingSource[] = raw.map((s) => ({
    ...s,
    sharePct: totalFinancement > 0 ? (s.amount / totalFinancement) * 100 : 0,
  }));

  const totalEquity = sources
    .filter((s) => s.nature === 'equity')
    .reduce((acc, s) => acc + s.amount, 0);
  const totalDebt = sources.filter((s) => s.nature === 'debt').reduce((acc, s) => acc + s.amount, 0);

  const coutTotalProjet = projectCost.coutTotalProjet;
  const besoinDeFinancement = coutTotalProjet - totalFinancement;

  const affectationRaw = [
    { label: 'Immobilisations incorporelles', montant: projectCost.immobilisationsIncorporelles },
    { label: 'Immobilisations corporelles', montant: projectCost.immobilisationsCorporelles },
    { label: 'Immobilisations financières', montant: projectCost.immobilisationsFinancieres },
    { label: 'Stock initial', montant: projectCost.stockInitial },
    { label: 'Frais de premier fonctionnement', montant: projectCost.fraisPremierFonctionnement },
  ].filter((entry) => entry.montant > 0);

  return {
    sources,
    totalEquity,
    totalDebt,
    totalFinancement,
    coutTotalProjet,
    besoinDeFinancement,
    tauxEndettementPct:
      totalEquity + totalDebt > 0 ? (totalDebt / (totalEquity + totalDebt)) * 100 : 0,
    couverturePct: coutTotalProjet > 0 ? (totalFinancement / coutTotalProjet) * 100 : 0,
    affectation: affectationRaw.map((entry) => ({
      ...entry,
      sharePct: coutTotalProjet > 0 ? (entry.montant / coutTotalProjet) * 100 : 0,
    })),
  };
}

// =====================================================================
// 9. FLUX DE TRÉSORERIE — MÉTHODE O.E.C. DÉTAILLÉE
// =====================================================================

export function computeCashFlowOec(
  finance: FinanceModel,
  compteExpl: CompteExploitationRow[],
  amort: AmortizationComputed,
  bilan: BilanRow[],
  financing: FinancingComputed,
  dividendes: YearlyArray
): CashFlowOecRow[] {
  const years = finance.projectionYears;
  const labels = fiscalYearLabels(finance.fiscalCalendar, years);

  const investsYearly = monthlyToYearly(
    finance.investments.reduce<MonthlyArray>(
      (acc, inv) => addMonthly(acc, inv.monthlyValues || zerosMonthly()),
      zerosMonthly()
    ),
    years
  );

  // Les échéanciers sont mensuels par construction (cf. finance-calculator) :
  // il n'y a plus d'unité à deviner ici.
  const annualAmort = (schedule: { amortissements: number[] }): YearlyArray => {
    const out = zerosYearly(years);
    for (let i = 0; i < schedule.amortissements.length; i++) {
      const y = Math.floor(i / MONTHS_PER_YEAR);
      if (y < years) out[y] += schedule.amortissements[i];
    }
    return out;
  };

  const remboursements = zerosYearly(years);
  for (const schedule of [
    financing.cmtSchedule,
    financing.creditBailSchedule,
    financing.compteCourantSchedule,
  ]) {
    const annual = annualAmort(schedule);
    for (let y = 0; y < years; y++) remboursements[y] += annual[y];
  }

  const rows: CashFlowOecRow[] = [];
  let tresorerie = 0;

  for (let y = 0; y < years; y++) {
    const cex = compteExpl[y];
    const dotations = amort.totalAnnualDotations[y] || 0;
    const rbe = cex.resultatExploitation + dotations;

    const prev = bilan[y - 1];
    const current = bilan[y];
    const variationStocks = (current?.stocks || 0) - (prev?.stocks || 0);
    const variationCreances = (current?.creancesClients || 0) - (prev?.creancesClients || 0);
    const variationDettes =
      (current?.dettesFournisseurs || 0) +
      (current?.dettesFiscalesSociales || 0) -
      ((prev?.dettesFournisseurs || 0) + (prev?.dettesFiscalesSociales || 0));

    const fluxNetExploitation = rbe - variationStocks - variationCreances + variationDettes;
    const fraisFinanciers = cex.chargesFinancieres;
    const fluxActivite = fluxNetExploitation - fraisFinanciers + 0 - cex.is;

    const acquisitions = investsYearly[y] || 0;
    const fluxInvestissement = -acquisitions;

    const augmentationCapital = y === 0 ? finance.financing.apportCapital || 0 : 0;
    const emissions =
      y === 0
        ? (finance.financing.cmt?.amount || 0) +
          (finance.financing.creditBail?.amount || 0) +
          (finance.financing.compteCourantAssocies?.amount || 0)
        : 0;
    const subventions = y === 0 ? finance.financing.subvention || 0 : 0;
    // Les dividendes d'un exercice se décaissent sur le suivant.
    const dividendesVerses = y > 0 ? dividendes[y - 1] || 0 : 0;
    const fluxFinancement =
      augmentationCapital + emissions - remboursements[y] - dividendesVerses + subventions;

    const variation = fluxActivite + fluxInvestissement + fluxFinancement;
    const ouverture = tresorerie;
    tresorerie = ouverture + variation;

    rows.push({
      year: y + 1,
      label: labels[y] ?? String(y + 1),
      resultatExploitation: cex.resultatExploitation,
      dotationsAmortissements: dotations,
      resultatBrutExploitation: rbe,
      variationStocks,
      variationCreances,
      variationDettesExploitation: variationDettes,
      fluxNetExploitation,
      fraisFinanciers,
      produitsFinanciers: 0,
      impotSocietes: cex.is,
      fluxActivite,
      acquisitionsImmobilisations: acquisitions,
      cessionsImmobilisations: 0,
      fluxInvestissement,
      augmentationCapital,
      emissionsEmprunts: emissions,
      remboursementsEmprunts: remboursements[y],
      dividendesVerses,
      subventions,
      fluxFinancement,
      variationTresorerie: variation,
      tresorerieOuverture: ouverture,
      tresorerieCloture: tresorerie,
    });
  }

  return rows;
}

// =====================================================================
// 11. ACTUALISATION, CMPC, VALEUR DE L'ACTION
// =====================================================================

/**
 * Tableau d'actualisation, année 0 comprise.
 *
 * L'année 0 porte l'investissement initial en NÉGATIF. C'est précisément la
 * ligne dont l'absence gonflait la VAN et le TRI : sans elle, on actualise une
 * suite de bénéfices sans jamais payer ce qui les produit.
 */
export function computeDiscountedFlows(
  fluxCash: number[],
  i0: number,
  ratePct: number,
  labels: string[]
): DiscountedFlowRow[] {
  const r = ratePct / 100;
  const rows: DiscountedFlowRow[] = [];
  let cumul = -i0;
  let cumulActualise = -i0;

  rows.push({
    year: 0,
    label: 'Année 0 · investissement',
    flux: -i0,
    facteurActualisation: 1,
    fluxActualise: -i0,
    cumulFlux: cumul,
    cumulFluxActualise: cumulActualise,
  });

  for (let t = 0; t < fluxCash.length; t++) {
    const facteur = Math.pow(1 + r, -(t + 1));
    const actualise = fluxCash[t] * facteur;
    cumul += fluxCash[t];
    cumulActualise += actualise;
    rows.push({
      year: t + 1,
      label: labels[t] ?? `Année ${t + 1}`,
      flux: fluxCash[t],
      facteurActualisation: facteur,
      fluxActualise: actualise,
      cumulFlux: cumul,
      cumulFluxActualise: cumulActualise,
    });
  }

  return rows;
}

/**
 * CMPC déduit de la structure de financement réelle.
 *
 * CMPC = Ke × FP/(FP+D) + Kd × (1 − IS) × D/(FP+D).
 * Le coût de la dette, quand il n'est pas saisi, est le taux MOYEN PONDÉRÉ des
 * emprunts réellement inscrits au plan — pas une valeur de convenance.
 */
export function computeCmpc(
  finance: FinanceModel,
  fundingPlan: FundingPlanComputed
): {
  valuePct: number;
  source: 'saisi' | 'déduit';
  costOfEquityPct: number;
  costOfDebtPct: number;
  equityWeightPct: number;
  debtWeightPct: number;
  taxRatePct: number;
} {
  const params = finance.ratiosParams;
  const taxRatePct = finance.taxesParams.isRatePct || 0;
  const equity = fundingPlan.totalEquity;
  const debt = fundingPlan.totalDebt;
  const total = equity + debt;

  const costOfEquityPct = params.costOfEquityPct ?? 15;

  let costOfDebtPct = params.costOfDebtPct ?? 0;
  if (params.costOfDebtPct === undefined) {
    const weighted = fundingPlan.sources
      .filter((s) => s.nature === 'debt' && s.amount > 0 && s.ratePct !== undefined)
      .reduce((acc, s) => acc + s.amount * (s.ratePct || 0), 0);
    const base = fundingPlan.sources
      .filter((s) => s.nature === 'debt' && s.amount > 0 && s.ratePct !== undefined)
      .reduce((acc, s) => acc + s.amount, 0);
    costOfDebtPct = base > 0 ? weighted / base : 0;
  }

  const equityWeightPct = total > 0 ? (equity / total) * 100 : 100;
  const debtWeightPct = total > 0 ? (debt / total) * 100 : 0;

  if (!params.cmpcAuto || total <= 0) {
    return {
      valuePct: params.cmpcPct,
      source: 'saisi',
      costOfEquityPct,
      costOfDebtPct,
      equityWeightPct,
      debtWeightPct,
      taxRatePct,
    };
  }

  const valuePct =
    costOfEquityPct * (equityWeightPct / 100) +
    costOfDebtPct * (1 - taxRatePct / 100) * (debtWeightPct / 100);

  return {
    valuePct,
    source: 'déduit',
    costOfEquityPct,
    costOfDebtPct,
    equityWeightPct,
    debtWeightPct,
    taxRatePct,
  };
}

export function computeShareValues(
  finance: FinanceModel,
  bilan: BilanRow[],
  dividendes: YearlyArray
): ShareValueRow[] {
  const shares = Math.max(1, finance.ratiosParams.numberOfShares ?? 100);
  const labels = fiscalYearLabels(finance.fiscalCalendar, finance.projectionYears);
  let previous: number | null = null;

  return bilan.map((row, y) => {
    const valeurAction = row.fondsPropres / shares;
    // Une variation rapportée à une base NÉGATIVE n'a pas de sens : des fonds
    // propres qui passent de −414 000 à +105 000 afficheraient « −125 % » là où
    // la situation s'est redressée. On ne publie pas ce chiffre.
    const croissance =
      previous !== null && previous > 0 ? ((valeurAction - previous) / previous) * 100 : null;
    previous = valeurAction;
    const dividende = dividendes[y] || 0;
    return {
      year: row.year,
      label: labels[y] ?? String(row.year),
      fondsPropres: row.fondsPropres,
      valeurAction,
      croissanceActionPct: croissance,
      dividendesADistribuer: dividende,
      dividendeParAction: dividende / shares,
    };
  });
}
