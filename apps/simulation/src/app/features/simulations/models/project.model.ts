/**
 * Whether the engine knows something, can look it up, has to guess, or is
 * missing it outright. Drives the "what we know" step before any simulating
 * happens.
 */
export type KnowledgeState = 'known' | 'researchable' | 'uncertain' | 'missing';

export interface KnowledgeItem {
  id: string;
  label: string;
  state: KnowledgeState;
  /** What the engine holds today, when it holds anything. */
  value?: string;
  /** Why it is uncertain, or what would resolve it. */
  detail?: string;
  /** Missing items the user can fill in before launching. */
  answerable?: boolean;
}

/** The structured read of the project the whole simulation is built on. */
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

export interface ProjectUnderstanding {
  profile: ProjectProfile;
  items: KnowledgeItem[];
}

/** An IDEM project available as a simulation input. */
export interface LinkedProject {
  id: string;
  name: string;
  description: string;
  sector: string;
  /** Deliverables IDEM already produced, used to preload the simulation. */
  availableAssets: string[];
  updatedAt: string;
}
