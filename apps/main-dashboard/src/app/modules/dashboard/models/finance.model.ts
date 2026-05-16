/**
 * Types Finance (miroir du backend apps/api/api/models/finance.model.ts).
 * Permet d'utiliser le module sans dépendre de @idem/shared-models.
 */

export const FINANCE_PROJECTION_MONTHS = 36;
export const FINANCE_MAX_PRODUCTS = 20;

export type MonthlyArray = number[];
export type YearlyArray = number[];

export type SectionCompletionStatus = 'empty' | 'in_progress' | 'completed';

export interface AISuggestion {
  fieldPath: string;
  value: number | string;
  justification: string;
  generatedAt: Date | string;
  model?: string;
}

export interface ProductPricing {
  id: string;
  name: string;
  prices: YearlyArray;
  unitCosts: YearlyArray;
  notes?: string;
}

export interface SalesObjective {
  productId: string;
  monthlyQuantities: MonthlyArray;
  growthRateFromMonth25?: number;
}

export interface RevenueParams {
  clientReceivablesRatePct: number;
}

export type VariableChargeCategory =
  | 'achatsMarchandises'
  | 'matieresPremieres'
  | 'variationStockMarchandises'
  | 'variationStockMatieres'
  | 'achatsStockes'
  | 'autresAchats'
  | 'achatsEmballages'
  | 'transportSurAchats'
  | 'transportSurVentes'
  | 'transportPourTiers'
  | 'transportDePlis'
  | 'autresFraisTransport'
  | 'sousTraitance'
  | 'publiciteRelationsPubliques'
  | 'fraisTelecommunications'
  | 'fraisBancaires'
  | 'remunerationsIntermediaires'
  | 'fraisFormation'
  | 'redevancesBrevetsLicencesLogiciels'
  | 'remunerationsPersonnelExterieur'
  | 'autresChargesExternes';

export interface VariableChargeLine {
  id: string;
  category: VariableChargeCategory;
  label: string;
  monthlyValues: MonthlyArray;
}

export interface VariableCharges {
  lines: VariableChargeLine[];
  supplierDebtRatePct: number;
  safetyStockRatePct: number;
}

export type FixedChargeCategory =
  | 'locations'
  | 'creditBail'
  | 'entretienReparation'
  | 'primesAssurances'
  | 'etudesRecherche'
  | 'cotisations'
  | 'impotsFonciers'
  | 'patentesLicences'
  | 'taxesSurSalaires'
  | 'taxesApprentissage'
  | 'formationProfessionnelle'
  | 'autresImpotsDirects'
  | 'droitsEnregistrement'
  | 'remunerationsPersonnel'
  | 'chargesSociales'
  | 'interetsEmprunt'
  | 'interetCreditBail'
  | 'escomptes'
  | 'autresInterets'
  | 'perteChange';

export interface FixedChargeLine {
  id: string;
  category: FixedChargeCategory;
  label: string;
  monthlyValues: MonthlyArray;
}

export interface SalaryLine {
  id: string;
  position: string;
  monthlyValues: MonthlyArray;
}

export interface FixedCharges {
  lines: FixedChargeLine[];
  salaries: SalaryLine[];
  socialChargesRatePct: number;
  tusRatePct: number;
}

export type LocationSize = 'petites' | 'moyennes' | 'grandes';

export interface PatenteBracket {
  caUpperBound: number;
  ratePct: number;
  minAmount?: number;
}

export interface TaxesParams {
  locationSize: LocationSize;
  regimeType: 'reel' | 'forfait' | 'auto';
  patenteBrackets: PatenteBracket[];
  forfaitaireCARatePct: number;
  forfaitaireMargeRatePct: number;
  isRatePct: number;
  droitsEnregistrementPct: number;
  centimesAdditionnelsPct: number;
  publiciteFonciereePct: number;
  travauxCadastrauxPct: number;
  taxeOccupation: { petites: number; moyennes: number; grandes: number };
}

export type AmortizationGroup =
  | 'incorporelles'
  | 'batiments'
  | 'mobilier'
  | 'materielOutillage'
  | 'financieres';

export interface InvestmentLine {
  id: string;
  category: string;
  amortGroup: AmortizationGroup;
  label: string;
  monthlyValues: MonthlyArray;
  amortRateOverridePct?: number;
}

export interface AmortizationDefaults {
  incorporelles: number;
  batiments: number;
  mobilier: number;
  materielOutillage: number;
}

export interface LoanParams {
  amount: number;
  ratePct: number;
  duration: number;
  durationUnit?: 'years' | 'months';
  method?: 'constant_amortization' | 'constant_annuity';
}

export interface FinancingPlan {
  apportCapital: number;
  compteCourantAssocies: LoanParams;
  cmt: LoanParams;
  creditBail: LoanParams;
  creditFournisseurs: number;
  autofinancement: number;
  subvention: number;
}

export interface RatiosParams {
  vanDiscountRatePct: number;
  dividendDistributionRatePct: number;
  perpetualGrowthRatePct: number;
  cmpcPct: number;
}

export interface FinanceMetadata {
  lastAutoFilledAt?: Date | string;
  lastCalculatedAt?: Date | string;
  completionStatus: {
    products: SectionCompletionStatus;
    salesObjectives: SectionCompletionStatus;
    revenue: SectionCompletionStatus;
    variableCharges: SectionCompletionStatus;
    fixedCharges: SectionCompletionStatus;
    taxes: SectionCompletionStatus;
    investments: SectionCompletionStatus;
    financing: SectionCompletionStatus;
  };
  aiSuggestions: AISuggestion[];
  currency: string;
}

// ----- Computed snapshot -----

export interface RevenueComputed {
  monthlyTotal: MonthlyArray;
  monthlyByProduct: Record<string, MonthlyArray>;
  yearlyTotal: YearlyArray;
  cogsMonthly: MonthlyArray;
  grossMarginMonthly: MonthlyArray;
}

export interface AmortizationRow {
  category: AmortizationGroup;
  base: number;
  ratePct: number;
  annualDotations: YearlyArray;
  cumulative: YearlyArray;
  vna: YearlyArray;
}

export interface AmortizationComputed {
  rows: AmortizationRow[];
  totalAnnualDotations: YearlyArray;
}

export interface BfrComputed {
  monthlyBfr: MonthlyArray;
  fraisPremierFonctionnement: number;
  variationAnnuelle: YearlyArray;
}

export interface LoanSchedule {
  capitalDu: number[];
  interets: number[];
  amortissements: number[];
  annuites: number[];
  totalInterets: number;
}

export interface FinancingComputed {
  totalInvestissements: number;
  totalBfr: number;
  coutTotalProjet: number;
  totalFinancement: number;
  compteCourantSchedule: LoanSchedule;
  cmtSchedule: LoanSchedule;
  creditBailSchedule: LoanSchedule;
  chargesFinancieresAnnuelles: YearlyArray;
}

export interface CompteExploitationRow {
  year: number;
  chiffreAffaires: number;
  chargesVariables: number;
  margeBrute: number;
  tauxMargePct: number;
  chargesFixes: number;
  valeurAjoutee: number;
  remunerations: number;
  impotsTaxes: number;
  ebe: number;
  dotationsAmortissements: number;
  resultatExploitation: number;
  chargesFinancieres: number;
  resultatAvantImpot: number;
  is: number;
  resultatNet: number;
}

export interface BilanRow {
  year: number;
  tresorerie: number;
  creancesClients: number;
  stocks: number;
  totalActifsCirculants: number;
  immobilisationsBrutes: number;
  amortissementsCumules: number;
  vnc: number;
  totalActif: number;
  dettesFournisseurs: number;
  dettesFiscalesSociales: number;
  emprunts: number;
  totalDettes: number;
  capitalSocial: number;
  reportANouveau: number;
  resultatExercice: number;
  compteCourantAssocies: number;
  fondsPropres: number;
  totalPassif: number;
  bfr: number;
  variationBfr: number;
}

export interface SeuilRentabiliteRow {
  year: number;
  chargesFixes: number;
  tauxMargeCoutsVariablesPct: number;
  seuilRentabilite: number;
  caJournalier: number;
  pointMortJours: number;
  partSeuilDansCAPct: number;
}

export interface FluxTresorerieRow {
  year: number;
  fluxExploitation: number;
  fluxInvestissement: number;
  fluxFinancement: number;
  variationTresorerie: number;
  tresorerieOuverture: number;
  tresorerieCloture: number;
}

export interface RatiosComputed {
  van: number;
  tri: number;
  drci: number;
  indiceProfitabilite: number;
  dcf: {
    fluxActualises: YearlyArray;
    fluxNormatif: number;
    valeurTerminale: number;
    valeurTotaleEntreprise: number;
  };
  dividendesAnnuels: YearlyArray;
}

export interface FinanceComputed {
  revenue: RevenueComputed;
  amortization: AmortizationComputed;
  bfr: BfrComputed;
  financing: FinancingComputed;
  compteExploitation: CompteExploitationRow[];
  bilan: BilanRow[];
  seuilRentabilite: SeuilRentabiliteRow[];
  fluxTresorerie: FluxTresorerieRow[];
  ratios: RatiosComputed;
}

export interface FinanceModel {
  id?: string;
  projectId: string;
  projectionYears: number;
  products: ProductPricing[];
  salesObjectives: SalesObjective[];
  revenueParams: RevenueParams;
  variableCharges: VariableCharges;
  fixedCharges: FixedCharges;
  taxesParams: TaxesParams;
  investments: InvestmentLine[];
  amortizationDefaults: AmortizationDefaults;
  financing: FinancingPlan;
  ratiosParams: RatiosParams;
  computed?: FinanceComputed;
  meta: FinanceMetadata;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface FinanceSummary {
  caY1: number;
  caY2: number;
  caY3: number;
  resultatNetY1: number;
  resultatNetY2: number;
  resultatNetY3: number;
  margeBrutePct: number;
  tresorerieClotureY1: number;
  pointMortJours: number;
  bfr: number;
  coutTotalProjet: number;
  tri: number;
  van: number;
  alerts: string[];
}

export interface FinanceSummaryResponse {
  finance: FinanceModel;
  summary: FinanceSummary;
}

/** Sections exposées par l'API pour les mises à jour partielles */
export type FinanceSectionKey =
  | 'products'
  | 'salesObjectives'
  | 'revenueParams'
  | 'variableCharges'
  | 'fixedCharges'
  | 'taxesParams'
  | 'investments'
  | 'financing'
  | 'ratiosParams';

/** Métadonnées de navigation pour les sections du module Finance */
export interface FinanceSectionDescriptor {
  /** Clé technique (utilisée pour completionStatus et update) */
  key: keyof FinanceMetadata['completionStatus'] | 'overview' | 'amortization' | 'compteExploitation' | 'bilan' | 'fluxTresorerie' | 'ratios' | 'revenueParams' | 'taxesParams' | 'ratiosParams' | 'fixedCharges';
  /** Route Angular (relative au préfixe /project/finance) */
  route: string;
  /** Clé i18n du libellé */
  labelKey: string;
  /** Icône PrimeNG */
  icon: string;
  /** Section appartient au CRUD (input éditable) ou en lecture seule (calculée) */
  editable: boolean;
}

export const FINANCE_SECTIONS: FinanceSectionDescriptor[] = [
  { key: 'overview', route: '', labelKey: 'dashboard.finance.sections.overview', icon: 'pi pi-chart-pie', editable: false },
  { key: 'products', route: 'products', labelKey: 'dashboard.finance.sections.products', icon: 'pi pi-tag', editable: true },
  { key: 'salesObjectives', route: 'sales', labelKey: 'dashboard.finance.sections.sales', icon: 'pi pi-shopping-cart', editable: true },
  { key: 'revenueParams', route: 'revenue', labelKey: 'dashboard.finance.sections.revenue', icon: 'pi pi-calculator', editable: true },
  { key: 'variableCharges', route: 'charges', labelKey: 'dashboard.finance.sections.charges', icon: 'pi pi-wallet', editable: true },
  { key: 'fixedCharges', route: 'fixed-charges', labelKey: 'dashboard.finance.sections.fixedCharges', icon: 'pi pi-building', editable: true },
  { key: 'taxesParams', route: 'taxes', labelKey: 'dashboard.finance.sections.taxes', icon: 'pi pi-receipt', editable: true },
  { key: 'investments', route: 'investments', labelKey: 'dashboard.finance.sections.investments', icon: 'pi pi-briefcase', editable: true },
  { key: 'amortization', route: 'amortization', labelKey: 'dashboard.finance.sections.amortization', icon: 'pi pi-history', editable: false },
  { key: 'financing', route: 'financing', labelKey: 'dashboard.finance.sections.financing', icon: 'pi pi-money-bill', editable: true },
  { key: 'ratiosParams', route: 'ratios-params', labelKey: 'dashboard.finance.sections.ratiosParams', icon: 'pi pi-sliders-h', editable: true },
  { key: 'compteExploitation', route: 'exploitation', labelKey: 'dashboard.finance.sections.exploitation', icon: 'pi pi-chart-line', editable: false },
  { key: 'bilan', route: 'bilan', labelKey: 'dashboard.finance.sections.bilan', icon: 'pi pi-book', editable: false },
  { key: 'fluxTresorerie', route: 'cashflow', labelKey: 'dashboard.finance.sections.cashflow', icon: 'pi pi-arrow-right-arrow-left', editable: false },
  { key: 'ratios', route: 'ratios', labelKey: 'dashboard.finance.sections.ratios', icon: 'pi pi-percentage', editable: false },
];
