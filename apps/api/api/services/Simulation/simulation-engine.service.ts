/**
 * Moteur de simulation — la partie déterministe du module.
 *
 * Aucun appel LLM ici. L'IA choisit *quels* facteurs comptent et de *combien*
 * ils bougent; ce fichier calcule ce que cela produit. La séparation est
 * volontaire: les chiffres d'un rapport payant doivent être reproductibles et
 * vérifiables, pas régénérés à chaque lecture.
 */

import {
  BusinessBaseline,
  ConfidenceLevel,
  Evidence,
  Factor,
  FactorLever,
  FinancialPoint,
  FinancialSummary,
  Robustness,
  Scenario,
  ScenarioOutcome,
  ScenarioShift,
  SensitivityEntry,
  SIMULATION_HORIZON_MONTHS,
  SIMULATION_TIMELINE_YEARS,
  Timeline,
  TimelineYear,
  ViabilityCondition,
  Verdict,
} from '../../models/simulation.model';

// =====================================================================
// PROJECTION
// =====================================================================

/**
 * Projette l'activité mois par mois.
 *
 * Modèle de cohortes: la base installée fond au taux de rétention et se
 * reconstitue avec les nouveaux clients acquis. C'est le minimum pour que la
 * rétention et le coût d'acquisition aient un effet distinct l'un de l'autre,
 * ce qui est précisément la question que le produit pose.
 */
export function projectBusiness(
  baseline: BusinessBaseline,
  months: number = SIMULATION_HORIZON_MONTHS
): FinancialPoint[] {
  const points: FinancialPoint[] = [];
  let activeCustomers = 0;
  let cash = baseline.startingCapital;

  for (let month = 1; month <= months; month++) {
    const newCustomers =
      baseline.initialMonthlyCustomers * Math.pow(1 + baseline.monthlyGrowthRate, month - 1);

    // Les clients acquis ce mois-ci achètent dès ce mois-ci.
    activeCustomers = activeCustomers * baseline.monthlyRetentionRate + newCustomers;

    const transactions = activeCustomers * baseline.purchasesPerCustomerPerMonth;
    const revenue = transactions * baseline.unitPrice;
    const variableCosts = transactions * baseline.unitVariableCost;
    const acquisitionSpend = newCustomers * baseline.acquisitionCost;
    const costs = baseline.monthlyFixedCosts + variableCosts + acquisitionSpend;
    const cashflow = revenue - costs;

    cash += cashflow;

    points.push({
      month,
      activeCustomers: round(activeCustomers),
      revenue: round(revenue),
      costs: round(costs),
      cashflow: round(cashflow),
      cash: round(cash),
    });
  }

  return points;
}

// =====================================================================
// DÉCALAGES DE FACTEURS
// =====================================================================

/** Applique un ensemble de décalages aux leviers du modèle. */
export function applyShifts(
  baseline: BusinessBaseline,
  shifts: readonly ScenarioShift[]
): BusinessBaseline {
  const shifted: BusinessBaseline = { ...baseline };

  for (const shift of shifts) {
    switch (shift.lever) {
      case 'price':
        shifted.unitPrice = Math.max(0, shifted.unitPrice * (1 + shift.magnitude));
        break;
      case 'variableCost':
        shifted.unitVariableCost = Math.max(0, shifted.unitVariableCost * (1 + shift.magnitude));
        break;
      case 'fixedCost':
        shifted.monthlyFixedCosts = Math.max(0, shifted.monthlyFixedCosts * (1 + shift.magnitude));
        break;
      case 'acquisitionCost':
        shifted.acquisitionCost = Math.max(0, shifted.acquisitionCost * (1 + shift.magnitude));
        break;
      case 'growth':
        // La croissance peut devenir négative: une entreprise peut reculer.
        shifted.monthlyGrowthRate = shifted.monthlyGrowthRate * (1 + shift.magnitude);
        break;
      case 'retention':
        // La rétention est bornée: elle reste une probabilité.
        shifted.monthlyRetentionRate = clamp(
          shifted.monthlyRetentionRate * (1 + shift.magnitude),
          0,
          0.99
        );
        break;
      case 'frequency':
        shifted.purchasesPerCustomerPerMonth = Math.max(
          0,
          shifted.purchasesPerCustomerPerMonth * (1 + shift.magnitude)
        );
        break;
      case 'capital':
        shifted.startingCapital = Math.max(0, shifted.startingCapital * (1 + shift.magnitude));
        break;
      case 'none':
      default:
        break;
    }
  }

  return shifted;
}

// =====================================================================
// INDICE DE VIABILITÉ
// =====================================================================

/**
 * Indice de viabilité, 0-100.
 *
 * Il mesure la robustesse du modèle, jamais une probabilité de réussite. Les
 * quatre composantes sont volontairement séparées et pondérées explicitement,
 * pour que le rapport puisse dire lesquelles tirent le score vers le bas.
 */
export interface ViabilityBreakdown {
  index: number;
  unitEconomics: number;
  profitability: number;
  survival: number;
  scale: number;
}

export function computeViability(
  baseline: BusinessBaseline,
  points: FinancialPoint[]
): ViabilityBreakdown {
  // --- 1. Économie unitaire: la valeur d'un client couvre-t-elle son coût ?
  const grossMarginPerTransaction = baseline.unitPrice - baseline.unitVariableCost;
  const churn = Math.max(1 - baseline.monthlyRetentionRate, 0.01);
  const expectedLifetimeMonths = 1 / churn;
  const lifetimeValue =
    grossMarginPerTransaction *
    baseline.purchasesPerCustomerPerMonth *
    expectedLifetimeMonths;
  const ltvToCac =
    baseline.acquisitionCost > 0 ? lifetimeValue / baseline.acquisitionCost : lifetimeValue > 0 ? 5 : 0;
  // Le seuil usuel est 3; on sature à 5 pour ne pas récompenser l'aberrant.
  const unitEconomics = clamp(ltvToCac / 5, 0, 1) * 100;

  // --- 2. Rentabilité: le point mort tombe-t-il dans l'horizon, et quand ?
  const breakEvenMonth = findBreakEvenMonth(points);
  const profitability =
    breakEvenMonth === null
      ? 0
      : clamp(1 - (breakEvenMonth - 1) / points.length, 0, 1) * 100;

  // --- 3. Survie: la trésorerie tient-elle jusque-là ?
  const runwayMonths = findRunwayMonths(points);
  const survival =
    runwayMonths === null
      ? 100
      : breakEvenMonth !== null && runwayMonths > breakEvenMonth
        ? 100
        : clamp(runwayMonths / points.length, 0, 1) * 100;

  // --- 4. Échelle: le volume atteint justifie-t-il la structure de coûts ?
  const finalRevenue = points[points.length - 1]?.revenue ?? 0;
  const scale =
    baseline.monthlyFixedCosts > 0
      ? clamp(finalRevenue / (baseline.monthlyFixedCosts * 3), 0, 1) * 100
      : finalRevenue > 0
        ? 100
        : 0;

  const index =
    unitEconomics * 0.3 + profitability * 0.25 + survival * 0.3 + scale * 0.15;

  return {
    index: Math.round(clamp(index, 0, 100)),
    unitEconomics: Math.round(unitEconomics),
    profitability: Math.round(profitability),
    survival: Math.round(survival),
    scale: Math.round(scale),
  };
}

/** Premier mois où le flux devient positif et le reste. */
export function findBreakEvenMonth(points: FinancialPoint[]): number | null {
  for (let i = 0; i < points.length; i++) {
    if (points[i].cashflow >= 0 && points.slice(i).every((p) => p.cashflow >= 0)) {
      return points[i].month;
    }
  }
  return null;
}

/** Premier mois où la trésorerie passe sous zéro, ou null si elle tient. */
export function findRunwayMonths(points: FinancialPoint[]): number | null {
  const failure = points.find((point) => point.cash < 0);
  return failure ? failure.month : null;
}

// =====================================================================
// SCÉNARIOS
// =====================================================================

/** Exécute un scénario et renvoie son issue. */
export function runScenario(
  baseline: BusinessBaseline,
  scenario: Scenario,
  months: number = SIMULATION_HORIZON_MONTHS
): ScenarioOutcome {
  const shifted = applyShifts(baseline, scenario.shifts);
  const points = projectBusiness(shifted, months);
  const viability = computeViability(shifted, points);
  const breakEvenMonth = findBreakEvenMonth(points);
  const runwayMonths = findRunwayMonths(points);
  const lowestCash = Math.min(...points.map((point) => point.cash));

  // « Tenir » veut dire deux choses à la fois: atteindre l'équilibre, et avoir
  // encore de la trésorerie en y arrivant. L'un sans l'autre ne suffit pas.
  const survives =
    breakEvenMonth !== null && (runwayMonths === null || runwayMonths > breakEvenMonth);

  return {
    viability: viability.index,
    breakEvenMonth,
    runwayMonths,
    survives,
    lowestCash: round(lowestCash),
    revenueYear1: round(sumRevenue(points, 0, 12)),
    revenueYear3: round(sumRevenue(points, 24, 36)),
    narrative: describeOutcome(breakEvenMonth, runwayMonths, survives, lowestCash),
  };
}

function describeOutcome(
  breakEvenMonth: number | null,
  runwayMonths: number | null,
  survives: boolean,
  lowestCash: number
): string {
  if (survives) {
    const runwayNote =
      runwayMonths === null
        ? "la trésorerie reste positive sur tout l'horizon"
        : `la trésorerie touche son point bas au mois ${runwayMonths}`;
    return `Le modèle atteint son point mort au mois ${breakEvenMonth} et ${runwayNote}.`;
  }
  if (breakEvenMonth === null) {
    return "Le modèle n'atteint jamais l'équilibre sur l'horizon simulé : les coûts restent au-dessus des revenus.";
  }
  return `Le point mort n'arrive qu'au mois ${breakEvenMonth}, après épuisement de la trésorerie (au plus bas à ${Math.round(lowestCash)}).`;
}

// =====================================================================
// SENSIBILITÉ
// =====================================================================

/** Variation testée pour chaque levier lors de l'analyse de sensibilité. */
const SENSITIVITY_PROBES: { lever: FactorLever; magnitude: number; label: string }[] = [
  { lever: 'retention', magnitude: 0.1, label: '+10 % de rétention' },
  { lever: 'acquisitionCost', magnitude: -0.2, label: "-20 % de coût d'acquisition" },
  { lever: 'price', magnitude: 0.1, label: '+10 % de prix' },
  { lever: 'variableCost', magnitude: 0.15, label: '+15 % de coût variable' },
  { lever: 'fixedCost', magnitude: 0.2, label: '+20 % de charges fixes' },
  { lever: 'growth', magnitude: 0.25, label: '+25 % de croissance' },
  { lever: 'frequency', magnitude: 0.15, label: "+15 % de fréquence d'achat" },
];

/**
 * Mesure ce que chaque mouvement change réellement, tous les autres leviers
 * restant constants. C'est la section qui répond à « où mettre mon effort ».
 */
export function computeSensitivity(
  baseline: BusinessBaseline,
  factors: readonly Factor[],
  months: number = SIMULATION_HORIZON_MONTHS
): SensitivityEntry[] {
  const referenceIndex = computeViability(baseline, projectBusiness(baseline, months)).index;

  const entries: SensitivityEntry[] = [];

  for (const probe of SENSITIVITY_PROBES) {
    const shifted = applyShifts(baseline, [
      {
        factorId: `probe-${probe.lever}`,
        label: probe.label,
        lever: probe.lever,
        magnitude: probe.magnitude,
        delta: formatPercent(probe.magnitude),
      },
    ]);
    const index = computeViability(shifted, projectBusiness(shifted, months)).index;

    // Rattache la sonde au facteur découvert qui agit sur le même levier,
    // pour que la section parle des facteurs du projet, pas de leviers abstraits.
    const matching = factors.find((factor) => factor.lever === probe.lever);

    entries.push({
      factorId: matching?.id ?? `probe-${probe.lever}`,
      factorName: matching?.name ?? leverLabel(probe.lever),
      lever: probe.lever,
      change: probe.label,
      viabilityDelta: index - referenceIndex,
    });
  }

  return entries.sort((a, b) => Math.abs(b.viabilityDelta) - Math.abs(a.viabilityDelta));
}

// =====================================================================
// CONDITIONS DE VIABILITÉ
// =====================================================================

/**
 * Cherche, levier par levier, le seuil à partir duquel le modèle tient.
 *
 * Recherche par dichotomie plutôt que formule fermée: le modèle de cohortes
 * n'est pas inversible analytiquement, et 24 itérations suffisent largement.
 */
export function computeViabilityConditions(
  baseline: BusinessBaseline,
  months: number = SIMULATION_HORIZON_MONTHS
): ViabilityCondition[] {
  const conditions: ViabilityCondition[] = [];
  const currency = baseline.currency;

  const survivesWith = (candidate: BusinessBaseline): boolean => {
    const points = projectBusiness(candidate, months);
    const breakEven = findBreakEvenMonth(points);
    const runway = findRunwayMonths(points);
    return breakEven !== null && (runway === null || runway > breakEven);
  };

  // --- Coût d'acquisition maximal
  const maxCac = solveThreshold(
    (value) => survivesWith({ ...baseline, acquisitionCost: value }),
    0,
    Math.max(baseline.acquisitionCost * 4, 1),
    'descending'
  );
  conditions.push({
    id: 'cond-cac',
    label: "Coût d'acquisition client",
    threshold: maxCac === null ? 'aucun seuil trouvé' : `< ${formatMoney(maxCac, currency)}`,
    currentValue: formatMoney(baseline.acquisitionCost, currency),
    met: maxCac === null ? null : baseline.acquisitionCost < maxCac,
  });

  // --- Rétention minimale
  const minRetention = solveThreshold(
    (value) => survivesWith({ ...baseline, monthlyRetentionRate: value }),
    0,
    0.99,
    'ascending'
  );
  conditions.push({
    id: 'cond-retention',
    label: 'Rétention mensuelle',
    threshold: minRetention === null ? 'aucun seuil trouvé' : `> ${formatPercentValue(minRetention)}`,
    currentValue: formatPercentValue(baseline.monthlyRetentionRate),
    met: minRetention === null ? null : baseline.monthlyRetentionRate > minRetention,
  });

  // --- Prix minimal
  const minPrice = solveThreshold(
    (value) => survivesWith({ ...baseline, unitPrice: value }),
    0,
    Math.max(baseline.unitPrice * 4, 1),
    'ascending'
  );
  conditions.push({
    id: 'cond-price',
    label: 'Prix unitaire',
    threshold: minPrice === null ? 'aucun seuil trouvé' : `> ${formatMoney(minPrice, currency)}`,
    currentValue: formatMoney(baseline.unitPrice, currency),
    met: minPrice === null ? null : baseline.unitPrice > minPrice,
  });

  // --- Charges fixes maximales
  const maxFixed = solveThreshold(
    (value) => survivesWith({ ...baseline, monthlyFixedCosts: value }),
    0,
    Math.max(baseline.monthlyFixedCosts * 4, 1),
    'descending'
  );
  conditions.push({
    id: 'cond-fixed',
    label: 'Charges fixes mensuelles',
    threshold: maxFixed === null ? 'aucun seuil trouvé' : `< ${formatMoney(maxFixed, currency)}`,
    currentValue: formatMoney(baseline.monthlyFixedCosts, currency),
    met: maxFixed === null ? null : baseline.monthlyFixedCosts < maxFixed,
  });

  // --- Capital nécessaire: le creux de trésorerie du scénario de référence.
  const points = projectBusiness(baseline, months);
  const lowestCash = Math.min(...points.map((point) => point.cash));
  const capitalNeeded = lowestCash < 0 ? baseline.startingCapital - lowestCash : baseline.startingCapital;
  conditions.push({
    id: 'cond-capital',
    label: 'Capital disponible',
    threshold: `> ${formatMoney(capitalNeeded, currency)}`,
    currentValue: formatMoney(baseline.startingCapital, currency),
    met: baseline.startingCapital >= capitalNeeded,
  });

  return conditions;
}

/**
 * Dichotomie sur un prédicat monotone.
 * `direction` dit de quel côté se trouve la zone viable.
 */
function solveThreshold(
  survives: (value: number) => boolean,
  low: number,
  high: number,
  direction: 'ascending' | 'descending',
  iterations = 24
): number | null {
  const viableAtHigh = survives(high);
  const viableAtLow = survives(low);

  if (direction === 'ascending') {
    // Viable au-dessus d'un seuil: rien à trouver si même le maximum échoue.
    if (!viableAtHigh) return null;
    if (viableAtLow) return low;
  } else {
    if (!viableAtLow) return null;
    if (viableAtHigh) return high;
  }

  let lo = low;
  let hi = high;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const ok = survives(mid);
    if (direction === 'ascending') {
      if (ok) hi = mid;
      else lo = mid;
    } else {
      if (ok) lo = mid;
      else hi = mid;
    }
  }
  return direction === 'ascending' ? hi : lo;
}

// =====================================================================
// SYNTHÈSE
// =====================================================================

export function buildFinancialSummary(
  baseline: BusinessBaseline,
  points: FinancialPoint[]
): FinancialSummary {
  const breakEvenMonth = findBreakEvenMonth(points);
  const runwayMonths = findRunwayMonths(points);
  const lowestCash = Math.min(...points.map((point) => point.cash));
  const negativeMonths = points.filter((point) => point.cashflow < 0);
  const monthlyBurnRate =
    negativeMonths.length > 0
      ? Math.abs(negativeMonths.reduce((sum, p) => sum + p.cashflow, 0) / negativeMonths.length)
      : 0;
  const grossMargin =
    baseline.unitPrice > 0
      ? (baseline.unitPrice - baseline.unitVariableCost) / baseline.unitPrice
      : 0;

  return {
    currency: baseline.currency,
    monthlyBurnRate: round(monthlyBurnRate),
    breakEvenMonth,
    capitalRequired: round(lowestCash < 0 ? baseline.startingCapital - lowestCash : baseline.startingCapital),
    runwayMonths,
    grossMargin: Number(grossMargin.toFixed(3)),
    revenueYear1: round(sumRevenue(points, 0, 12)),
    revenueYear3: round(sumRevenue(points, 24, 36)),
    points,
  };
}

/**
 * Robustesse: la tenue du modèle à travers les scénarios, pas son score.
 * Un projet peut avoir un indice élevé et une robustesse faible s'il ne tient
 * que dans le scénario de référence.
 */
export function computeRobustness(scenarios: readonly Scenario[]): Robustness {
  const stressed = scenarios.filter((s) => s.kind !== 'baseline' && s.outcome);
  if (stressed.length === 0) return 'medium';

  const survivalRate = stressed.filter((s) => s.outcome!.survives).length / stressed.length;
  if (survivalRate >= 0.7) return 'high';
  if (survivalRate >= 0.4) return 'medium';
  return 'low';
}

/**
 * Niveau de confiance: dérivé de la provenance des données, pas du score.
 * Beaucoup d'hypothèses ⇒ confiance faible, même si le modèle tient bien.
 */
export function computeConfidence(evidence: readonly Evidence[]): ConfidenceLevel {
  if (evidence.length === 0) return 'low';

  const weights: Record<EvidenceWeightKey, number> = { data: 1, estimate: 0.55, assumption: 0.2 };
  const score =
    evidence.reduce((sum, item) => sum + weights[item.kind], 0) / evidence.length;

  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

type EvidenceWeightKey = 'data' | 'estimate' | 'assumption';

/**
 * Verdict. GO exige à la fois un bon score et une bonne tenue: un modèle qui
 * casse dans la moitié des scénarios ne reçoit jamais un GO sec, quel que soit
 * son indice.
 */
export function computeVerdict(index: number, robustness: Robustness): Verdict {
  if (index >= 70 && robustness === 'high') return 'go';
  if (index < 40 || robustness === 'low') return index < 30 ? 'no-go' : 'go-with-conditions';
  return 'go-with-conditions';
}

// =====================================================================
// TIME MACHINE
// =====================================================================

/** Agrège une projection mensuelle en années, pour la vue long terme. */
export function buildTimeline(
  baseline: BusinessBaseline,
  scenario: Scenario,
  years: number = SIMULATION_TIMELINE_YEARS
): Timeline {
  const shifted = applyShifts(baseline, scenario.shifts);
  const points = projectBusiness(shifted, years * 12);
  const timelineYears: TimelineYear[] = [];

  for (let year = 1; year <= years; year++) {
    const slice = points.slice((year - 1) * 12, year * 12);
    timelineYears.push({
      year,
      revenue: round(slice.reduce((sum, p) => sum + p.revenue, 0)),
      costs: round(slice.reduce((sum, p) => sum + p.costs, 0)),
      cash: round(slice[slice.length - 1]?.cash ?? 0),
      activeCustomers: round(slice[slice.length - 1]?.activeCustomers ?? 0),
    });
  }

  const cashOutYear = timelineYears.find((y) => y.cash < 0)?.year ?? null;
  const profitableYear = timelineYears.find((y) => y.revenue > y.costs)?.year ?? null;

  return {
    id: scenario.id,
    name: scenario.name,
    kind: scenario.kind,
    years: timelineYears,
    divergence: scenario.question,
    divergenceYear: cashOutYear ?? profitableYear,
    endState:
      cashOutYear !== null
        ? `La trésorerie devient négative en année ${cashOutYear}.`
        : profitableYear !== null
          ? `L'activité devient rentable en année ${profitableYear}.`
          : "L'activité reste déficitaire sur tout l'horizon.",
  };
}

// =====================================================================
// UTILITAIRES
// =====================================================================

function sumRevenue(points: FinancialPoint[], from: number, to: number): number {
  return points.slice(from, to).reduce((sum, point) => sum + point.revenue, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatPercent(magnitude: number): string {
  const sign = magnitude >= 0 ? '+' : '';
  return `${sign}${Math.round(magnitude * 100)} %`;
}

function formatPercentValue(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function formatMoney(value: number, currency: string): string {
  return `${Math.round(value).toLocaleString('fr-FR')} ${currency}`;
}

export function leverLabel(lever: FactorLever): string {
  const labels: Record<FactorLever, string> = {
    price: 'Prix',
    variableCost: 'Coût variable',
    fixedCost: 'Charges fixes',
    acquisitionCost: "Coût d'acquisition",
    growth: 'Croissance',
    retention: 'Rétention',
    frequency: "Fréquence d'achat",
    capital: 'Capital',
    none: 'Facteur qualitatif',
  };
  return labels[lever];
}
