export type KnowledgeState = 'known' | 'researchable' | 'uncertain' | 'missing';

export interface KnowledgeItem {
  id: string;
  label: string;
  state: KnowledgeState;
  value?: string;
  detail?: string;
  /** Vrai si l'utilisateur peut combler le trou avant de lancer. */
  answerable?: boolean;
  answer?: string;
}

export interface ProjectProfile {
  name: string;
  sector: string;
  businessModel: string;
  product: string;
  targetCustomer: string;
  market: string;
  location: string;
  country: string;
  currency: string;
  pricePoint?: string;
  plannedFunding?: string;
  teamSize?: string;
}

/** Les seuls chiffres dont le moteur déterministe se sert. */
export interface BusinessBaseline {
  unitPrice: number;
  unitVariableCost: number;
  monthlyFixedCosts: number;
  acquisitionCost: number;
  initialMonthlyCustomers: number;
  /** Fraction : 0.08 = +8 % par mois. */
  monthlyGrowthRate: number;
  /** Fraction entre 0 et 0.99. */
  monthlyRetentionRate: number;
  purchasesPerCustomerPerMonth: number;
  startingCapital: number;
  currency: string;
}

export interface ProjectUnderstanding {
  profile: ProjectProfile;
  baseline: BusinessBaseline;
  items: KnowledgeItem[];
  narrative?: string;
}

/** Un projet IDEM utilisable comme entrée de simulation. */
export interface LinkedProject {
  id: string;
  name: string;
  description: string;
  sector: string;
  availableAssets: string[];
  updatedAt: string;
}
