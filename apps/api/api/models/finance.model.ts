/**
 * Modèle Finance complet pour le module Prévisions Financières
 *
 * Reproduit la structure du fichier Excel "Prévisions financières V1 bis":
 *  1. Produits & Prix
 *  2. Objectifs de ventes (quantité)
 *  3. Chiffre d'affaires prévisionnel (calculé)
 *  4. Charges variables
 *  5. Charges fixes
 *  6. Impôts et taxes (paramètres + calcul)
 *  7. Liste des investissements
 *  8. Tableau des amortissements (calculé)
 *  9. Fonds de roulement / BFR (calculé)
 * 10. Coût et schéma de financement
 * 11. Calculs financiers (emprunts)
 * 12. Compte d'exploitation prévisionnel (calculé)
 * 13. Bilan prévisionnel (calculé)
 * 14. Seuil de rentabilité / Point mort (calculé)
 * 15. Flux de trésorerie (calculé)
 * 16. Ratios & Indicateurs (calculé)
 *
 * Horizon: 36 mois (3 ans) en mensuel, projection consolidée jusqu'à 7 ans.
 */

// =====================================================================
// CONSTANTES
// =====================================================================

export const FINANCE_PROJECTION_MONTHS = 36;
export const FINANCE_PROJECTION_YEARS = 7; // certains tableaux vont jusqu'à 7 ans
export const FINANCE_MAX_PRODUCTS = 20;

// =====================================================================
// TYPES UTILITAIRES
// =====================================================================

/** Tableau mensuel sur 36 mois */
export type MonthlyArray = number[]; // length = 36 (zero-padded)

/** Tableau annuel sur jusqu'à 7 ans */
export type YearlyArray = number[]; // length variable (1..7)

/** Justification IA pour un champ ou une section */
export interface AISuggestion {
  fieldPath: string;          // ex: "products[0].prices[0]"
  value: number | string;
  justification: string;      // explication courte donnée par l'IA
  generatedAt: Date;
  model?: string;             // nom du modèle IA utilisé
}

/** Statut de complétion d'une section */
export type SectionCompletionStatus = 'empty' | 'in_progress' | 'completed';

// =====================================================================
// 1. PRODUITS & PRIX
// =====================================================================

export interface ProductPricing {
  id: string;
  name: string;
  /** Prix de vente unitaire par année (index 0 = An 1, jusqu'à An 7) */
  prices: YearlyArray;
  /** Coût d'achat unitaire par année */
  unitCosts: YearlyArray;
  notes?: string;
}

// =====================================================================
// 2. OBJECTIFS DE VENTES
// =====================================================================

export interface SalesObjective {
  productId: string;
  /** Quantités vendues mois par mois (36 mois) */
  monthlyQuantities: MonthlyArray;
  /** Taux de croissance mensuel appliqué automatiquement à partir du mois 25 (%) */
  growthRateFromMonth25?: number;
}

// =====================================================================
// 3. CHIFFRE D'AFFAIRES (paramètres - le CA est calculé)
// =====================================================================

export interface RevenueParams {
  /** Objectif de créances clients en % du CA (ex: 20 = 20%) */
  clientReceivablesRatePct: number;
}

// =====================================================================
// 4. CHARGES VARIABLES
// =====================================================================

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
  /** Dette fournisseur en % des charges variables (défaut 30) */
  supplierDebtRatePct: number;
  /** Stock de sécurité en % des matières (défaut 30) */
  safetyStockRatePct: number;
}

// =====================================================================
// 5. CHARGES FIXES
// =====================================================================

export type FixedChargeCategory =
  | 'locations'
  | 'creditBail'
  | 'entretienReparation'
  | 'primesAssurances'
  | 'etudesRecherche'
  | 'cotisations'
  | 'impotsFonciers'
  | 'patentesLicences'
  | 'taxesSurSalaires'          // TUS 7,5%
  | 'taxesApprentissage'
  | 'formationProfessionnelle'
  | 'autresImpotsDirects'
  | 'droitsEnregistrement'
  | 'remunerationsPersonnel'
  | 'chargesSociales'           // 33,6%
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
  position: string;           // ex: "Directeur Général"
  /** Salaire brut mensuel par mois (36 mois) */
  monthlyValues: MonthlyArray;
}

export interface FixedCharges {
  lines: FixedChargeLine[];
  salaries: SalaryLine[];
  /** Taux charges sociales appliqué aux salaires (défaut 33.6) */
  socialChargesRatePct: number;
  /** Taux TUS appliqué aux salaires (défaut 7.5) */
  tusRatePct: number;
}

// =====================================================================
// 6. IMPÔTS ET TAXES — PARAMÈTRES
// =====================================================================

export type LocationSize = 'petites' | 'moyennes' | 'grandes';

export interface PatenteBracket {
  /** Borne supérieure de CA pour ce taux (FCFA). Le dernier élément peut être Infinity. */
  caUpperBound: number;
  ratePct: number;            // ex: 0.045 = 0.045%
  minAmount?: number;         // ex: 10000 FCFA minimum
}

export interface TaxesParams {
  /** Taille des locaux pour taxe d'occupation */
  locationSize: LocationSize;
  /** Régime fiscal applicable */
  regimeType: 'reel' | 'forfait' | 'auto';
  /** Tranches de patente progressives (10 taux par défaut) */
  patenteBrackets: PatenteBracket[];
  /** Impôt forfaitaire global - taux sur CA (défaut 7.5%) */
  forfaitaireCARatePct: number;
  /** Impôt forfaitaire global - taux sur marge (défaut 10%) */
  forfaitaireMargeRatePct: number;
  /** Impôt sur sociétés (défaut 30%) */
  isRatePct: number;
  /** Droits d'enregistrement (défaut 0.5%) */
  droitsEnregistrementPct: number;
  /** Centimes additionnels (défaut 2.5%) */
  centimesAdditionnelsPct: number;
  /** Frais publicité foncière (défaut 0.25%) */
  publiciteFonciereePct: number;
  /** Travaux cadastraux (défaut 0.225%) */
  travauxCadastrauxPct: number;
  /** Taxe d'occupation des locaux par taille (FCFA / an) */
  taxeOccupation: {
    petites: number;          // 60 000
    moyennes: number;         // 120 000
    grandes: number;          // 500 000
  };
}

// =====================================================================
// 7. INVESTISSEMENTS
// =====================================================================

export type InvestmentCategory =
  // Incorporelles (20% / 5 ans)
  | 'fraisConstitution'
  | 'fraisProspection'
  | 'publiciteLancement'
  | 'fonctionnementAnterieur'
  | 'modificationCapital'
  | 'entreeBourse'
  | 'restructuration'
  | 'fraisDivers'
  | 'chargesARepartir'
  | 'primesRemboursement'
  | 'rechercheDeveloppement'
  | 'brevetsLicences'
  | 'logiciels'
  | 'marques'
  | 'fondsCommercial'
  | 'droitAuBail'
  | 'investissementsCreation'
  | 'autresDroitsIncorporels'
  | 'immobilisationsEnCours'
  // Bâtiments (5% / 20 ans)
  | 'terrains'
  | 'batiments'
  | 'ouvragesInfrastructure'
  // Matériel et outillage (20% / 5 ans)
  | 'installationsTechniques'
  | 'amenagementBureaux'
  | 'materielOutillageIndustriel'
  | 'emballagesRecuperables'
  | 'cheptel'
  | 'plantationsAgricoles'
  | 'autresMateriels'
  | 'materielTransport'
  // Mobilier (5% / 10 ans)
  | 'mobilier'
  // Financières (non amortissables)
  | 'avancesSurImmobilisations'
  | 'titresParticipation'
  | 'pretsCreancesNonCommerciales'
  | 'pretsPersonnel'
  | 'creancesSurEtat'
  | 'titresImmobilises'
  | 'depotsCautionnements'
  | 'immobilisationsFinancieresDiverses';

export type AmortizationGroup =
  | 'incorporelles'
  | 'batiments'
  | 'mobilier'
  | 'materielOutillage'
  | 'financieres'; // non amortissables

export interface InvestmentLine {
  id: string;
  category: InvestmentCategory;
  amortGroup: AmortizationGroup;
  label: string;
  /** Montants investis mois par mois (36 mois) */
  monthlyValues: MonthlyArray;
  /** Surcharge du taux d'amortissement par défaut (en %, ex: 20) */
  amortRateOverridePct?: number;
}

// =====================================================================
// 8. TAUX D'AMORTISSEMENT PAR DÉFAUT
// =====================================================================

export interface AmortizationDefaults {
  /** % par défaut (ex: 20 = 20% / an, soit 5 ans) */
  incorporelles: number;      // 20
  batiments: number;          // 5
  mobilier: number;           // 10 (= 10 ans dans Excel mais Excel indique 5%; on garde 5% / 20 ans par défaut)
  materielOutillage: number;  // 20
}

// =====================================================================
// 10. SCHÉMA DE FINANCEMENT
// =====================================================================

export interface LoanParams {
  amount: number;
  /** Taux annuel en % */
  ratePct: number;
  /** Durée en années (ou mois pour CMT court) */
  duration: number;
  /** Unité de la durée */
  durationUnit?: 'years' | 'months';
  /** Méthode d'amortissement */
  method?: 'constant_amortization' | 'constant_annuity';
}

export interface FinancingPlan {
  /** Apport en capital (fonds propres) */
  apportCapital: number;
  /** Compte courant associés */
  compteCourantAssocies: LoanParams;
  /** Crédit moyen terme (CMT bancaire) */
  cmt: LoanParams;
  /** Crédit-bail (leasing) */
  creditBail: LoanParams;
  /** Crédit fournisseurs (dette commerciale) */
  creditFournisseurs: number;
  /** Autofinancement */
  autofinancement: number;
  /** Subvention */
  subvention: number;
}

// =====================================================================
// 16. RATIOS — PARAMÈTRES
// =====================================================================

export interface RatiosParams {
  /** Taux d'actualisation pour VAN (défaut 10%) */
  vanDiscountRatePct: number;
  /** Politique de distribution des dividendes (défaut 30%) */
  dividendDistributionRatePct: number;
  /** Taux de croissance à l'infini pour DCF (défaut 2%) */
  perpetualGrowthRatePct: number;
  /** Coût moyen pondéré du capital (CMPC/WACC) en % */
  cmpcPct: number;
}

// =====================================================================
// COMPLÉTION & MÉTADONNÉES
// =====================================================================

export interface FinanceMetadata {
  lastAutoFilledAt?: Date;
  lastCalculatedAt?: Date;
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
  /** Justifications IA indexées par chemin de champ */
  aiSuggestions: AISuggestion[];
  /** Devise utilisée (défaut XAF / FCFA) */
  currency: string;
}

// =====================================================================
// SORTIES CALCULÉES (snapshot, recalculé à chaque mutation)
// =====================================================================

export interface RevenueComputed {
  /** CA mensuel total tous produits confondus (36 mois) */
  monthlyTotal: MonthlyArray;
  /** CA par produit, mensuel (productId -> 36 mois) */
  monthlyByProduct: Record<string, MonthlyArray>;
  /** CA annuel total (1 valeur par année) */
  yearlyTotal: YearlyArray;
  /** Coût des marchandises vendues mensuel */
  cogsMonthly: MonthlyArray;
  /** Marge brute mensuelle */
  grossMarginMonthly: MonthlyArray;
}

export interface AmortizationRow {
  category: AmortizationGroup;
  base: number;               // base d'amortissement (cumul des invests)
  ratePct: number;
  /** Dotations annuelles (jusqu'à 7 ans) */
  annualDotations: YearlyArray;
  /** Cumul amortissement par fin d'année */
  cumulative: YearlyArray;
  /** Valeur Nette Actuelle (VNA) en fin d'année */
  vna: YearlyArray;
}

export interface AmortizationComputed {
  rows: AmortizationRow[];
  /** Dotations totales agrégées par année */
  totalAnnualDotations: YearlyArray;
}

export interface BfrComputed {
  /** BFR mensuel sur 12 premiers mois */
  monthlyBfr: MonthlyArray;
  /** Frais de premier fonctionnement (montant total) */
  fraisPremierFonctionnement: number;
  /** Variation BFR N-1 à N (annuel) */
  variationAnnuelle: YearlyArray;
}

export interface LoanSchedule {
  /** Capital restant dû par période */
  capitalDu: number[];
  /** Intérêts par période */
  interets: number[];
  /** Amortissement du capital par période */
  amortissements: number[];
  /** Annuités/mensualités totales par période */
  annuites: number[];
  /** Total intérêts payés sur la durée */
  totalInterets: number;
}

export interface FinancingComputed {
  /** Coût total du projet = investissements + BFR */
  totalInvestissements: number;
  totalBfr: number;
  coutTotalProjet: number;
  /** Total des financements mobilisés */
  totalFinancement: number;
  /** Échéanciers calculés */
  compteCourantSchedule: LoanSchedule;
  cmtSchedule: LoanSchedule;
  creditBailSchedule: LoanSchedule;
  /** Charges financières annuelles consolidées (somme des intérêts) */
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
  ebe: number;                // Excédent Brut d'Exploitation
  dotationsAmortissements: number;
  resultatExploitation: number;
  chargesFinancieres: number;
  resultatAvantImpot: number;
  is: number;                 // Impôt sur les Sociétés
  resultatNet: number;
}

export interface BilanRow {
  year: number;
  // Actif
  tresorerie: number;
  creancesClients: number;
  stocks: number;
  totalActifsCirculants: number;
  immobilisationsBrutes: number;
  amortissementsCumules: number;
  vnc: number;                // Valeur Nette Comptable
  totalActif: number;
  // Passif
  dettesFournisseurs: number;
  dettesFiscalesSociales: number;
  emprunts: number;           // CMT + Crédit-bail
  totalDettes: number;
  capitalSocial: number;
  reportANouveau: number;
  resultatExercice: number;
  compteCourantAssocies: number;
  fondsPropres: number;
  totalPassif: number;
  // BFR
  bfr: number;
  variationBfr: number;
}

export interface SeuilRentabiliteRow {
  year: number;
  chargesFixes: number;
  tauxMargeCoutsVariablesPct: number;
  seuilRentabilite: number;
  caJournalier: number;       // CA/360
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
  van: number;                // Valeur Actuelle Nette
  tri: number;                // Taux de Rendement Interne (en %)
  drci: number;               // Délai de Récupération du Capital Investi (en années)
  indiceProfitabilite: number;
  /** Évaluation DCF */
  dcf: {
    fluxActualises: YearlyArray;
    fluxNormatif: number;
    valeurTerminale: number;
    valeurTotaleEntreprise: number;
  };
  /** Politique de distribution */
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

// =====================================================================
// MODÈLE PRINCIPAL
// =====================================================================

export interface FinanceModel {
  id?: string;
  projectId: string;
  /** Horizon de projection en années (défaut 3, max 7) */
  projectionYears: number;
  // Inputs
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
  // Sortie
  computed?: FinanceComputed;
  // Méta
  meta: FinanceMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================================
// VALEURS PAR DÉFAUT
// =====================================================================

export const DEFAULT_PATENTE_BRACKETS: PatenteBracket[] = [
  { caUpperBound: 5_000_000, ratePct: 0.045, minAmount: 10_000 },
  { caUpperBound: 10_000_000, ratePct: 0.080, minAmount: 10_000 },
  { caUpperBound: 25_000_000, ratePct: 0.130, minAmount: 10_000 },
  { caUpperBound: 50_000_000, ratePct: 0.180, minAmount: 10_000 },
  { caUpperBound: 100_000_000, ratePct: 0.230, minAmount: 10_000 },
  { caUpperBound: 250_000_000, ratePct: 0.280, minAmount: 10_000 },
  { caUpperBound: 500_000_000, ratePct: 0.330, minAmount: 10_000 },
  { caUpperBound: 1_000_000_000, ratePct: 0.380, minAmount: 10_000 },
  { caUpperBound: 2_000_000_000, ratePct: 0.430, minAmount: 10_000 },
  { caUpperBound: Number.POSITIVE_INFINITY, ratePct: 0.480, minAmount: 10_000 },
];

export const DEFAULT_AMORTIZATION_DEFAULTS: AmortizationDefaults = {
  incorporelles: 20,
  batiments: 5,
  mobilier: 10,
  materielOutillage: 20,
};

export const DEFAULT_RATIOS_PARAMS: RatiosParams = {
  vanDiscountRatePct: 10,
  dividendDistributionRatePct: 30,
  perpetualGrowthRatePct: 2,
  cmpcPct: 10,
};

export const DEFAULT_TAXES_PARAMS: TaxesParams = {
  locationSize: 'petites',
  regimeType: 'reel',
  patenteBrackets: DEFAULT_PATENTE_BRACKETS,
  forfaitaireCARatePct: 7.5,
  forfaitaireMargeRatePct: 10,
  isRatePct: 30,
  droitsEnregistrementPct: 0.5,
  centimesAdditionnelsPct: 2.5,
  publiciteFonciereePct: 0.25,
  travauxCadastrauxPct: 0.225,
  taxeOccupation: {
    petites: 60_000,
    moyennes: 120_000,
    grandes: 500_000,
  },
};

export const DEFAULT_REVENUE_PARAMS: RevenueParams = {
  clientReceivablesRatePct: 20,
};

/** Crée un tableau mensuel de zéros (36 mois) */
export const zerosMonthly = (): MonthlyArray =>
  Array(FINANCE_PROJECTION_MONTHS).fill(0);

/** Crée un tableau annuel de zéros pour la durée donnée */
export const zerosYearly = (years: number): YearlyArray =>
  Array(years).fill(0);

/** Modèle Finance vide pour un projet */
export function createEmptyFinanceModel(projectId: string, projectionYears = 3): FinanceModel {
  return {
    projectId,
    projectionYears,
    products: [],
    salesObjectives: [],
    revenueParams: { ...DEFAULT_REVENUE_PARAMS },
    variableCharges: {
      lines: [],
      supplierDebtRatePct: 30,
      safetyStockRatePct: 30,
    },
    fixedCharges: {
      lines: [],
      salaries: [],
      socialChargesRatePct: 33.6,
      tusRatePct: 7.5,
    },
    taxesParams: { ...DEFAULT_TAXES_PARAMS, patenteBrackets: [...DEFAULT_PATENTE_BRACKETS] },
    investments: [],
    amortizationDefaults: { ...DEFAULT_AMORTIZATION_DEFAULTS },
    financing: {
      apportCapital: 0,
      compteCourantAssocies: { amount: 0, ratePct: 7, duration: 5, durationUnit: 'years', method: 'constant_amortization' },
      cmt: { amount: 0, ratePct: 7, duration: 12, durationUnit: 'months', method: 'constant_annuity' },
      creditBail: { amount: 0, ratePct: 10, duration: 5, durationUnit: 'years', method: 'constant_annuity' },
      creditFournisseurs: 0,
      autofinancement: 0,
      subvention: 0,
    },
    ratiosParams: { ...DEFAULT_RATIOS_PARAMS },
    meta: {
      completionStatus: {
        products: 'empty',
        salesObjectives: 'empty',
        revenue: 'empty',
        variableCharges: 'empty',
        fixedCharges: 'empty',
        taxes: 'empty',
        investments: 'empty',
        financing: 'empty',
      },
      aiSuggestions: [],
      currency: 'XAF',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
