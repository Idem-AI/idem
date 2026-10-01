/**
 * Mise en forme des données financières venues d'un modèle de langage.
 *
 * Deux chemins écrivent dans le prévisionnel à partir d'un JSON produit par
 * l'IA : le remplissage automatique (l'IA estime) et l'import d'un fichier
 * (l'IA recopie ce que dit le document). Dans les deux cas, le JSON reçu n'est
 * qu'une proposition : une catégorie inventée, un tableau de 14 mois ou un
 * montant écrit « 150 000 » casseraient le calcul. Ce module ramène tout cela
 * au schéma IDEM, sans rien deviner de plus que nécessaire.
 *
 * Les séries mensuelles acceptent trois écritures, parce qu'un document
 * financier parle rarement en 36 colonnes :
 *   - `monthlyValues`  : le détail mois par mois, repris tel quel ;
 *   - `annualAmounts`  : un total par exercice, réparti également sur ses mois ;
 *   - `monthlyAmount`  : un montant constant, de `startMonth` à `endMonth`.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AmortizationGroup,
  FINANCE_PROJECTION_MONTHS,
  FinancingPlan,
  FixedChargeCategory,
  FixedCharges,
  InvestmentCategory,
  InvestmentLine,
  LoanParams,
  ProductPricing,
  SalesObjective,
  VariableChargeCategory,
  VariableCharges,
  zerosMonthly,
} from '../../models/finance.model';

// ---------------------------------------------------------------------------
// Catégories admises — toute autre valeur retombe sur la catégorie « autres »
// ---------------------------------------------------------------------------

export const VARIABLE_CHARGE_CATEGORIES: readonly VariableChargeCategory[] = [
  'achatsMarchandises',
  'matieresPremieres',
  'variationStockMarchandises',
  'variationStockMatieres',
  'achatsStockes',
  'autresAchats',
  'achatsEmballages',
  'transportSurAchats',
  'transportSurVentes',
  'transportPourTiers',
  'transportDePlis',
  'autresFraisTransport',
  'sousTraitance',
  'publiciteRelationsPubliques',
  'fraisTelecommunications',
  'fraisBancaires',
  'remunerationsIntermediaires',
  'fraisFormation',
  'redevancesBrevetsLicencesLogiciels',
  'remunerationsPersonnelExterieur',
  'autresChargesExternes',
];

export const FIXED_CHARGE_CATEGORIES: readonly FixedChargeCategory[] = [
  'locations',
  'creditBail',
  'entretienReparation',
  'primesAssurances',
  'etudesRecherche',
  'cotisations',
  'impotsFonciers',
  'patentesLicences',
  'taxesSurSalaires',
  'taxesApprentissage',
  'formationProfessionnelle',
  'autresImpotsDirects',
  'droitsEnregistrement',
  'remunerationsPersonnel',
  'chargesSociales',
  'interetsEmprunt',
  'interetCreditBail',
  'escomptes',
  'autresInterets',
  'perteChange',
];

/** Chaque catégorie d'investissement porte son groupe d'amortissement. */
export const INVESTMENT_CATEGORY_GROUPS: Readonly<Record<InvestmentCategory, AmortizationGroup>> = {
  fraisConstitution: 'incorporelles',
  fraisProspection: 'incorporelles',
  publiciteLancement: 'incorporelles',
  fonctionnementAnterieur: 'incorporelles',
  modificationCapital: 'incorporelles',
  entreeBourse: 'incorporelles',
  restructuration: 'incorporelles',
  fraisDivers: 'incorporelles',
  chargesARepartir: 'incorporelles',
  primesRemboursement: 'incorporelles',
  rechercheDeveloppement: 'incorporelles',
  brevetsLicences: 'incorporelles',
  logiciels: 'incorporelles',
  marques: 'incorporelles',
  fondsCommercial: 'incorporelles',
  droitAuBail: 'incorporelles',
  investissementsCreation: 'incorporelles',
  autresDroitsIncorporels: 'incorporelles',
  immobilisationsEnCours: 'incorporelles',
  terrains: 'batiments',
  batiments: 'batiments',
  ouvragesInfrastructure: 'batiments',
  installationsTechniques: 'materielOutillage',
  amenagementBureaux: 'materielOutillage',
  materielOutillageIndustriel: 'materielOutillage',
  emballagesRecuperables: 'materielOutillage',
  cheptel: 'materielOutillage',
  plantationsAgricoles: 'materielOutillage',
  autresMateriels: 'materielOutillage',
  materielTransport: 'materielOutillage',
  mobilier: 'mobilier',
  avancesSurImmobilisations: 'financieres',
  titresParticipation: 'financieres',
  pretsCreancesNonCommerciales: 'financieres',
  pretsPersonnel: 'financieres',
  creancesSurEtat: 'financieres',
  titresImmobilises: 'financieres',
  depotsCautionnements: 'financieres',
  immobilisationsFinancieresDiverses: 'financieres',
};

// ---------------------------------------------------------------------------
// Nombres et séries
// ---------------------------------------------------------------------------

/**
 * Lit un nombre écrit par un humain ou un modèle : « 150 000 », « 1,5 »,
 * « 12 % », « 2.500.000 FCFA ». Rend 0 pour ce qui n'en est pas un.
 */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  let s = value.replace(/[\s  ]/g, '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Le dernier séparateur est le décimal, l'autre groupe les milliers.
    const decimal = lastComma > lastDot ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    s = s.split(group).join('').replace(decimal, '.');
  } else if (lastComma > -1) {
    // « 1,5 » est décimal ; « 1,500,000 » groupe les milliers.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

const clampMonth = (value: unknown, fallback: number): number => {
  const n = Math.round(toNumber(value));
  if (!n) return fallback;
  return Math.min(FINANCE_PROJECTION_MONTHS, Math.max(1, n));
};

/** Série mensuelle tirée de l'une des trois écritures admises. */
export function toMonthlySeries(
  input: any,
  keys: { monthly: string; annual: string; constant: string } = SERIES_KEYS.amounts
): number[] {
  const out = zerosMonthly();
  if (!input || typeof input !== 'object') return out;

  const detail = input[keys.monthly];
  if (Array.isArray(detail) && detail.some((v) => toNumber(v) !== 0)) {
    for (let i = 0; i < Math.min(detail.length, FINANCE_PROJECTION_MONTHS); i++) {
      out[i] = toNumber(detail[i]);
    }
    return out;
  }

  const annual = input[keys.annual];
  if (Array.isArray(annual) && annual.some((v) => toNumber(v) !== 0)) {
    const years = FINANCE_PROJECTION_MONTHS / 12;
    for (let y = 0; y < years; y++) {
      // Une année absente reprend la précédente : un document qui ne donne
      // que l'an 1 décrit un rythme, pas un arrêt d'activité.
      const yearly = toNumber(annual[Math.min(y, annual.length - 1)]);
      for (let m = 0; m < 12; m++) out[y * 12 + m] = yearly / 12;
    }
    return out;
  }

  const constant = toNumber(input[keys.constant]);
  if (constant !== 0) {
    const start = clampMonth(input.startMonth, 1);
    const end = Math.max(start, clampMonth(input.endMonth, FINANCE_PROJECTION_MONTHS));
    for (let m = start; m <= end; m++) out[m - 1] = constant;
  }
  return out;
}

export const SERIES_KEYS = {
  amounts: { monthly: 'monthlyValues', annual: 'annualAmounts', constant: 'monthlyAmount' },
  quantities: {
    monthly: 'monthlyQuantities',
    annual: 'annualQuantities',
    constant: 'monthlyQuantity',
  },
} as const;

/** Tableau annuel de la bonne longueur ; une année absente reprend la précédente. */
export function toYearly(values: unknown, years: number): number[] {
  const source = Array.isArray(values) ? values.map(toNumber) : [toNumber(values)];
  return Array.from({ length: years }, (_, i) => source[Math.min(i, source.length - 1)] ?? 0);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown, fallback: string): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  return s ? s.slice(0, 160) : fallback;
};

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * Produits. Rend aussi la correspondance entre la référence employée par le
 * modèle (`id` ou `ref`) et l'identifiant définitif, pour relier les ventes.
 */
export function normalizeProducts(
  raw: unknown,
  years: number
): { products: ProductPricing[]; refs: Map<string, string> } {
  const refs = new Map<string, string>();
  const list = Array.isArray(raw) ? raw : [];
  const products = list
    .filter((p) => p && typeof p === 'object')
    .map((p: any, index) => {
      // Un identifiant déjà au format UUID est conservé : les ventes existantes
      // y sont rattachées. Les références courtes du modèle (« p1 ») sont remplacées.
      const id = typeof p.id === 'string' && UUID.test(p.id) ? p.id : uuidv4();
      for (const ref of [p.ref, p.id, p.name, String(index)]) {
        if (ref !== undefined && ref !== null && ref !== '') refs.set(String(ref), id);
      }
      const prices = p.prices ?? p.price;
      const costs = p.unitCosts ?? p.unitCost ?? 0;
      return {
        id,
        name: text(p.name, `Produit ${index + 1}`),
        prices: toYearly(prices, years),
        unitCosts: toYearly(costs, years),
      };
    });
  return { products, refs };
}

/** Ventes : chaque objectif doit viser un produit existant, sinon il tombe. */
export function normalizeSalesObjectives(
  raw: unknown,
  refs: Map<string, string>,
  knownProductIds: readonly string[] = []
): SalesObjective[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: SalesObjective[] = [];
  for (const o of list) {
    if (!o || typeof o !== 'object') continue;
    const ref = String((o as any).productRef ?? (o as any).productId ?? (o as any).product ?? '');
    const productId =
      refs.get(ref) ?? (knownProductIds.includes(ref) ? ref : undefined);
    if (!productId || seen.has(productId)) continue;
    seen.add(productId);
    const objective: SalesObjective = {
      productId,
      monthlyQuantities: toMonthlySeries(o, SERIES_KEYS.quantities).map((q) =>
        Math.max(0, Math.round(q))
      ),
    };
    const growth = (o as any).growthRateFromMonth25;
    if (typeof growth === 'number' && Number.isFinite(growth)) {
      objective.growthRateFromMonth25 = growth;
    }
    out.push(objective);
  }
  return out;
}

export function normalizeVariableCharges(input: any, fallback: VariableCharges): VariableCharges {
  if (!input || typeof input !== 'object') return fallback;
  const lines = Array.isArray(input.lines)
    ? input.lines
        .filter((l: any) => l && typeof l === 'object')
        .map((l: any) => ({
          id: uuidv4(),
          category: pick(l.category, VARIABLE_CHARGE_CATEGORIES, 'autresChargesExternes'),
          label: text(l.label, 'Charge'),
          monthlyValues: toMonthlySeries(l),
        }))
    : fallback.lines;
  return {
    lines,
    supplierDebtRatePct: rate(input.supplierDebtRatePct, fallback.supplierDebtRatePct),
    safetyStockRatePct: rate(input.safetyStockRatePct, fallback.safetyStockRatePct),
  };
}

export function normalizeFixedCharges(input: any, fallback: FixedCharges): FixedCharges {
  if (!input || typeof input !== 'object') return fallback;
  const lines = Array.isArray(input.lines)
    ? input.lines
        .filter((l: any) => l && typeof l === 'object')
        .map((l: any) => ({
          id: uuidv4(),
          category: pick(l.category, FIXED_CHARGE_CATEGORIES, 'locations'),
          label: text(l.label, 'Charge'),
          monthlyValues: toMonthlySeries(l),
        }))
    : fallback.lines;
  const salaries = Array.isArray(input.salaries)
    ? input.salaries
        .filter((s: any) => s && typeof s === 'object')
        .flatMap((s: any) => {
          // « 3 vendeurs à 120 000 » : une ligne par personne, comme à la saisie.
          const headcount = Math.min(20, Math.max(1, Math.round(toNumber(s.headcount) || 1)));
          const series = toMonthlySeries(s);
          const position = text(s.position ?? s.label, 'Poste');
          return Array.from({ length: headcount }, (_, i) => ({
            id: uuidv4(),
            position: headcount > 1 ? `${position} ${i + 1}` : position,
            monthlyValues: [...series],
          }));
        })
    : fallback.salaries;
  return {
    lines,
    salaries,
    socialChargesRatePct: rate(input.socialChargesRatePct, fallback.socialChargesRatePct),
    tusRatePct: rate(input.tusRatePct, fallback.tusRatePct),
  };
}

export function normalizeInvestments(raw: unknown): InvestmentLine[] {
  const list = Array.isArray(raw) ? raw : [];
  const categories = Object.keys(INVESTMENT_CATEGORY_GROUPS) as InvestmentCategory[];
  return list
    .filter((i) => i && typeof i === 'object')
    .map((i: any) => {
      const category = pick(i.category, categories, 'autresMateriels');
      let monthlyValues = toMonthlySeries(i);
      // Un investissement s'achète une fois : `amount` + `month`.
      if (monthlyValues.every((v) => v === 0) && toNumber(i.amount) !== 0) {
        monthlyValues = zerosMonthly();
        monthlyValues[clampMonth(i.month, 1) - 1] = toNumber(i.amount);
      }
      const line: InvestmentLine = {
        id: uuidv4(),
        category,
        amortGroup: INVESTMENT_CATEGORY_GROUPS[category],
        label: text(i.label, 'Investissement'),
        monthlyValues,
      };
      const override = toNumber(i.amortRateOverridePct);
      if (override > 0 && override <= 100) line.amortRateOverridePct = override;
      return line;
    })
    .filter((line) => line.monthlyValues.some((v) => v !== 0));
}

/** Plan de financement : seuls les champs fournis remplacent l'existant. */
export function normalizeFinancing(input: any, fallback: FinancingPlan): FinancingPlan {
  if (!input || typeof input !== 'object') return fallback;
  const amount = (key: keyof FinancingPlan) =>
    input[key] === undefined || input[key] === null ? (fallback[key] as number) : Math.max(0, toNumber(input[key]));
  return {
    apportCapital: amount('apportCapital'),
    compteCourantAssocies: loan(input.compteCourantAssocies, fallback.compteCourantAssocies),
    cmt: loan(input.cmt, fallback.cmt),
    creditBail: loan(input.creditBail, fallback.creditBail),
    creditFournisseurs: amount('creditFournisseurs'),
    autofinancement: amount('autofinancement'),
    subvention: amount('subvention'),
  };
}

function loan(input: any, fallback: LoanParams): LoanParams {
  if (!input || typeof input !== 'object') return fallback;
  const unit = input.durationUnit === 'months' || input.durationUnit === 'years'
    ? input.durationUnit
    : fallback.durationUnit;
  const method =
    input.method === 'constant_amortization' || input.method === 'constant_annuity'
      ? input.method
      : fallback.method;
  return {
    amount: input.amount === undefined ? fallback.amount : Math.max(0, toNumber(input.amount)),
    ratePct: rate(input.ratePct, fallback.ratePct),
    duration: toNumber(input.duration) > 0 ? toNumber(input.duration) : fallback.duration,
    durationUnit: unit,
    method,
  };
}

function rate(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = toNumber(value);
  return n >= 0 && n <= 100 ? n : fallback;
}

export const normalizeRate = rate;
