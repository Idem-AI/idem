export type KnowledgeState = 'known' | 'researchable' | 'uncertain' | 'missing';

/**
 * D'où vient une information.
 *
 * `document` et `project` désignent ce qui est écrit dans la source ; ce sont
 * les deux seules provenances que l'API laisse porter l'état `known`. Le reste
 * est déduit (`inferred`), à rechercher (`external`), ou fourni par
 * l'utilisateur (`answer`).
 */
export type KnowledgeSource = 'document' | 'project' | 'answer' | 'inferred' | 'external';

export interface KnowledgeItem {
  id: string;
  label: string;
  state: KnowledgeState;
  value?: string;
  detail?: string;
  source?: KnowledgeSource;
  /** Vrai si l'utilisateur peut combler le trou avant de lancer. */
  answerable?: boolean;
  answer?: string;
}

/**
 * Une information que la source donne et qu'aucun champ du profil n'accueille.
 * Elle est affichée telle quelle et repart dans le contexte des simulations.
 */
export interface DocumentFact {
  label: string;
  value: string;
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

/** Types de projet reconnus par IDEM. */
export type IdemProjectType =
  | 'web'
  | 'mobile'
  | 'iot'
  | 'desktop'
  | 'enterprise'
  | 'ecommerce'
  | 'api'
  | 'ai'
  | 'blockchain'
  | 'landing'
  | 'other';

/**
 * De quoi créer le projet IDEM que décrit un business plan importé.
 *
 * L'application ne fait que la transporter : elle est produite par la lecture
 * du document et renvoyée telle quelle au lancement, où l'API crée le projet.
 */
export interface ImportedProjectSeed {
  type: IdemProjectType;
  description: string;
  /** Reprise développée de ce que le document dit, pour la fiche projet. */
  longDescription?: string;
  scope?: string;
  targets?: string;
  constraints: string[];
  budgetIntervals?: string;
  teamSize?: string;
  city?: string;
  country?: string;
  currency?: string;
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
    zipCode?: string;
  };
  teamMembers?: { name: string; role: string; bio?: string }[];
}

export interface ProjectUnderstanding {
  profile: ProjectProfile;
  baseline: BusinessBaseline;
  items: KnowledgeItem[];
  narrative?: string;
  /** Ce que la source dit et qu'aucun champ standard ne porte. */
  extras?: DocumentFact[];
  /** Renseignée pour un business plan importé, absente sinon. */
  projectSeed?: ImportedProjectSeed;
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

/** Les quatre états, dans l'ordre où ils se lisent. */
const KNOWLEDGE_ORDER: readonly KnowledgeState[] = [
  'known',
  'researchable',
  'uncertain',
  'missing',
];

/** Provenances qui attestent d'une information écrite dans la source. */
const SOURCED: readonly KnowledgeSource[] = ['document', 'project', 'answer'];

export interface KnowledgeGroup {
  state: KnowledgeState;
  items: KnowledgeItem[];
}

/**
 * Regroupe les éléments par état, en n'admettant sous « ce que nous savons »
 * que ce qui vient réellement de la source.
 *
 * L'API applique déjà la règle en amont ; elle est reposée ici parce que les
 * simulations déjà enregistrées, elles, ont été écrites avant. Sans provenance,
 * on retombe sur la présence d'une valeur : une ligne sans valeur ni origine
 * n'a rien d'une information sue.
 */
export function groupKnowledge(items: readonly KnowledgeItem[]): KnowledgeGroup[] {
  return KNOWLEDGE_ORDER.map((state) => ({
    state,
    items: items.filter(
      (item) => item.state === state && (state !== 'known' || isSourced(item)),
    ),
  })).filter((group) => group.items.length > 0);
}

function isSourced(item: KnowledgeItem): boolean {
  return item.source ? SOURCED.includes(item.source) : Boolean(item.value);
}
