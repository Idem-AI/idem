/**
 * CATALOGUE DES SECTIONS DE BUSINESS PLAN.
 *
 * Le plan n'a plus une seule forme. Une banque impose sa table des matières, un
 * fonds d'amorçage en attend une autre, un bailleur de subvention une
 * troisième. Mais laisser l'utilisateur inventer ses sections librement
 * reviendrait à perdre tout contrôle sur la qualité : une section sans brief de
 * contenu retombe sur un prompt de composition, et produit du HTML là où le
 * gabarit attend du contenu structuré.
 *
 * D'où ce catalogue FERMÉ : l'utilisateur choisit un modèle prédéfini, ou
 * compose le sien — mais uniquement à partir des sections listées ici, chacune
 * avec son brief, son volume, ses recherches et ses dépendances déjà écrits et
 * vérifiés (`npm run check:prompts`).
 *
 * Ajouter une section = ajouter une entrée ici ET son brief dans
 * `prompts/section-briefs.prompt.ts`. Le contrôle de conformité échoue sinon.
 */

import { BP_SECTION_BRIEFS } from '../prompts/section-briefs.prompt';

/** Famille d'une section — sert au regroupement dans le composeur custom. */
export type BusinessPlanSectionCategory =
  | 'opening'
  | 'company'
  | 'market'
  | 'offer'
  | 'strategy'
  | 'operations'
  | 'finance'
  | 'impact'
  | 'closing';

/** Contexte fourni aux briefs de recherche d'une section. */
export interface SectionResearchContext {
  /** Description du projet, tronquée par l'appelant. */
  projectSummary: string;
  /** Suffixe géographique déjà formaté, ex: " (priority market: Cameroun)". */
  geo: string;
}

export interface BusinessPlanSectionDefinition {
  /** Identifiant stable, seul champ persisté dans la structure d'un projet. */
  key: string;
  /**
   * Nom canonique de la section — c'est lui qui est stocké dans
   * `businessPlan.sections[].name`, trié par le PDF et ciblé par une
   * régénération. Il ne doit JAMAIS changer une fois publié : un renommage
   * orpheline les sections déjà générées de tous les projets existants.
   */
  name: string;
  category: BusinessPlanSectionCategory;
  /** Volume rédactionnel visé (nombre de blocs), passé au gabarit. */
  volume: string;
  /** Déclenche la phase de recherche web sourcée. */
  needsResearch: boolean;
  /** Briefs de recherche explicites, construits à partir du projet. */
  researchBriefs?: (ctx: SectionResearchContext) => string[];
  /**
   * Composition libre, hors gabarit (couverture uniquement) : sa mise en page
   * EST le livrable, et le paginateur ne la redécoupe pas.
   */
  freeform?: boolean;
  /** Page à hauteur fixe dans le PDF (jamais redécoupée ni étirée). */
  fixedPage?: boolean;
  /** Reçoit les tableaux posés par le module Finance, avant le texte. */
  financeBlocks?: boolean;
  /** Reçoit le contexte financier narratif en suffixe de brief. */
  financeContext?: boolean;
  /**
   * Sections dont le digest est injecté SI elles font partie de la structure
   * choisie. Les dépendances absentes sont ignorées — une structure « banque »
   * ne contient pas « Opportunity », et cela ne doit pas casser le graphe.
   */
  requires?: string[];
  /**
   * Consultation d'autres modules du projet via le Context Engine.
   * Aligné sur `ProjectSectionKey`.
   */
  consults?: ('branding' | 'finance')[];
}

/** Raccourci : brief de recherche marché, réutilisé par plusieurs sections. */
const marketBriefs = (ctx: SectionResearchContext): string[] => [
  `Market size (TAM/SAM/SOM), annual growth rate (CAGR) and recent projections for the project's sector${ctx.geo}. Context: ${ctx.projectSummary}`,
  `How the market is evolving: overall volume, turnover, growth or decline${ctx.geo}`,
  `Players already present on this market, their positioning and comparative strengths${ctx.geo}`,
];

/**
 * Le catalogue. L'ORDRE de déclaration est celui du composeur custom : les
 * sections y apparaissent groupées par famille, dans l'ordre où elles se
 * lisent dans un plan.
 */
export const BUSINESS_PLAN_SECTION_CATALOG: BusinessPlanSectionDefinition[] = [
  // ── Ouverture ────────────────────────────────────────────────────────────
  {
    key: 'cover-page',
    name: 'Cover Page',
    category: 'opening',
    volume: '1',
    needsResearch: false,
    freeform: true,
    fixedPage: true,
    consults: ['branding'],
  },
  {
    key: 'executive-summary',
    name: 'Executive Summary',
    category: 'opening',
    volume: '8 to 11',
    needsResearch: false,
    requires: ['Opportunity', 'Market Analysis', 'Products & Services', 'Financial Plan'],
  },
  {
    key: 'one-page-summary',
    name: 'One-Page Summary',
    category: 'opening',
    volume: '4 to 6',
    needsResearch: false,
    requires: ['Company Summary', 'Market Analysis'],
  },

  // ── L'entreprise ─────────────────────────────────────────────────────────
  {
    key: 'company-summary',
    name: 'Company Summary',
    category: 'company',
    volume: '9 to 12',
    needsResearch: false,
    requires: ['Opportunity', 'Products & Services', 'Target Audience'],
  },
  {
    key: 'mission-vision',
    name: 'Mission & Vision',
    category: 'company',
    volume: '6 to 8',
    needsResearch: false,
  },
  {
    key: 'promoter-profile',
    name: 'Promoter Profile',
    category: 'company',
    volume: '6 to 9',
    needsResearch: false,
  },
  {
    key: 'management-team',
    name: 'Management & Team',
    category: 'company',
    volume: '7 to 10',
    needsResearch: false,
  },
  {
    key: 'legal-regulatory',
    name: 'Legal & Regulatory Framework',
    category: 'company',
    volume: '7 to 9',
    needsResearch: true,
    researchBriefs: (ctx) => [
      `Licences, permits and authorisations legally required to operate this activity${ctx.geo}, with their issuing authority, cost and lead time. Context: ${ctx.projectSummary}`,
      `Sector regulations and recent legal changes constraining this activity${ctx.geo}`,
    ],
  },

  // ── Le marché ────────────────────────────────────────────────────────────
  {
    key: 'problem',
    name: 'Problem Statement',
    category: 'market',
    volume: '7 to 9',
    needsResearch: true,
    researchBriefs: (ctx) => [
      `Recent statistics and studies quantifying the scale of the problem addressed${ctx.geo}. Context: ${ctx.projectSummary}`,
      `How this problem is handled today and the cost of the existing workarounds${ctx.geo}`,
    ],
  },
  {
    key: 'opportunity',
    name: 'Opportunity',
    category: 'market',
    volume: '10 to 13',
    needsResearch: true,
    researchBriefs: (ctx) => [
      `Market size (TAM/SAM/SOM), annual growth rate (CAGR) and recent projections for the project's sector${ctx.geo}. Context: ${ctx.projectSummary}`,
      `The problem addressed: recent statistics and studies quantifying its scale${ctx.geo}`,
      `Recent trends and regulatory factors affecting this market${ctx.geo}`,
    ],
  },
  {
    key: 'market-analysis',
    name: 'Market Analysis',
    category: 'market',
    volume: '10 to 13',
    needsResearch: true,
    researchBriefs: marketBriefs,
  },
  {
    key: 'target-audience',
    name: 'Target Audience',
    category: 'market',
    volume: '7 to 9',
    needsResearch: true,
    researchBriefs: (ctx) => [
      `Size and demographics of the target customer segments${ctx.geo}. Context: ${ctx.projectSummary}`,
      `Purchasing behaviour, spending power and adoption rates for those segments${ctx.geo}`,
    ],
  },
  {
    key: 'competition',
    name: 'Competitive Analysis',
    category: 'market',
    volume: '8 to 10',
    needsResearch: true,
    researchBriefs: (ctx) => [
      `Direct competitors operating in this sector${ctx.geo}: size, offering, pricing and positioning. Context: ${ctx.projectSummary}`,
      `Substitutes and indirect alternatives customers use instead${ctx.geo}`,
    ],
  },

  // ── L'offre ──────────────────────────────────────────────────────────────
  {
    key: 'solution',
    name: 'Solution',
    category: 'offer',
    volume: '7 to 10',
    needsResearch: false,
    requires: ['Problem Statement'],
  },
  {
    key: 'products-services',
    name: 'Products & Services',
    category: 'offer',
    volume: '7 to 9',
    needsResearch: false,
  },
  {
    key: 'value-proposition',
    name: 'Unique Value Proposition',
    category: 'offer',
    volume: '5 to 7',
    needsResearch: false,
    requires: ['Target Audience'],
  },
  {
    key: 'unfair-advantage',
    name: 'Unfair Advantage',
    category: 'offer',
    volume: '5 to 7',
    needsResearch: false,
    requires: ['Competitive Analysis'],
  },
  {
    key: 'business-model',
    name: 'Business Model',
    category: 'offer',
    volume: '8 to 10',
    needsResearch: true,
    financeContext: true,
    consults: ['finance'],
    researchBriefs: (ctx) => [
      `Price ranges charged by competitors for this kind of offering${ctx.geo}. Context: ${ctx.projectSummary}`,
      `Benchmark gross margins and unit economics for this sector${ctx.geo}`,
    ],
    requires: ['Products & Services'],
  },

  // ── La stratégie ─────────────────────────────────────────────────────────
  {
    key: 'strategy-milestones',
    name: 'Strategy & Key Milestones',
    category: 'strategy',
    volume: '8 to 11',
    needsResearch: false,
    requires: ['Market Analysis', 'Opportunity', 'Products & Services'],
  },
  {
    key: 'marketing-sales',
    name: 'Marketing & Sales',
    category: 'strategy',
    volume: '9 to 12',
    needsResearch: false,
    requires: ['Target Audience', 'Products & Services'],
  },
  {
    key: 'go-to-market',
    name: 'Go-to-Market Strategy',
    category: 'strategy',
    volume: '8 to 10',
    needsResearch: false,
    requires: ['Target Audience', 'Business Model'],
  },
  {
    key: 'traction',
    name: 'Traction & Proof Points',
    category: 'strategy',
    volume: '6 to 8',
    needsResearch: false,
    requires: ['Products & Services'],
  },
  {
    key: 'partnerships',
    name: 'Partnerships & Ecosystem',
    category: 'strategy',
    volume: '6 to 8',
    needsResearch: false,
  },

  // ── L'exploitation ───────────────────────────────────────────────────────
  {
    key: 'operations-plan',
    name: 'Operational Plan',
    category: 'operations',
    volume: '8 to 11',
    needsResearch: false,
    financeContext: true,
    requires: ['Products & Services'],
  },
  {
    key: 'resources-assets',
    name: 'Resources & Assets',
    category: 'operations',
    volume: '6 to 8',
    needsResearch: false,
  },
  {
    key: 'goal-planning',
    name: 'Goal Planning',
    category: 'operations',
    volume: '8 to 11',
    needsResearch: false,
    requires: ['Marketing & Sales', 'Financial Plan'],
  },
  {
    key: 'kpi-metrics',
    name: 'Key Metrics & KPIs',
    category: 'operations',
    volume: '5 to 7',
    needsResearch: false,
    requires: ['Business Model', 'Marketing & Sales'],
  },
  {
    key: 'risk-analysis',
    name: 'Risk Analysis & Mitigation',
    category: 'operations',
    volume: '7 to 9',
    needsResearch: false,
    requires: ['Financial Plan', 'Operational Plan'],
  },

  // ── Les finances ─────────────────────────────────────────────────────────
  {
    key: 'financial-plan',
    name: 'Financial Plan',
    category: 'finance',
    volume: '8 to 10',
    needsResearch: true,
    financeBlocks: true,
    financeContext: true,
    consults: ['finance'],
    researchBriefs: (ctx) => [
      `Benchmark gross margins and cost structures for the sector${ctx.geo}. Context: ${ctx.projectSummary}`,
      `Price ranges charged by competitors for this kind of offering${ctx.geo}`,
    ],
    requires: ['Products & Services', 'Opportunity', 'Market Analysis'],
  },
  {
    key: 'funding-request',
    name: 'Funding Request & Use of Funds',
    category: 'finance',
    volume: '6 to 8',
    needsResearch: false,
    financeContext: true,
    consults: ['finance'],
    requires: ['Financial Plan'],
  },
  {
    key: 'guarantees',
    name: 'Guarantees & Collateral',
    category: 'finance',
    volume: '5 to 7',
    needsResearch: true,
    financeContext: true,
    researchBriefs: (ctx) => [
      `Public guarantee schemes, guarantee funds and mutual guarantee institutions available to small businesses${ctx.geo}, with their coverage rates. Context: ${ctx.projectSummary}`,
    ],
    requires: ['Financial Plan'],
  },
  {
    key: 'exit-strategy',
    name: 'Exit Strategy & Investor Returns',
    category: 'finance',
    volume: '5 to 7',
    needsResearch: true,
    financeContext: true,
    researchBriefs: (ctx) => [
      `Recent acquisitions, exits and valuation multiples for companies in this sector${ctx.geo}. Context: ${ctx.projectSummary}`,
    ],
    requires: ['Financial Plan'],
  },

  // ── L'impact ─────────────────────────────────────────────────────────────
  {
    key: 'theory-of-change',
    name: 'Theory of Change',
    category: 'impact',
    volume: '7 to 9',
    needsResearch: false,
    requires: ['Problem Statement', 'Target Audience'],
  },
  {
    key: 'impact',
    name: 'Social & Economic Impact',
    category: 'impact',
    volume: '6 to 8',
    needsResearch: true,
    researchBriefs: (ctx) => [
      `Local development priorities, employment statistics and economic indicators relevant to this activity${ctx.geo}. Context: ${ctx.projectSummary}`,
    ],
    requires: ['Operational Plan'],
  },
  {
    key: 'monitoring-evaluation',
    name: 'Monitoring & Evaluation',
    category: 'impact',
    volume: '6 to 8',
    needsResearch: false,
    requires: ['Theory of Change', 'Social & Economic Impact'],
  },
  {
    key: 'sustainability',
    name: 'Sustainability Plan',
    category: 'impact',
    volume: '6 to 8',
    needsResearch: false,
    financeContext: true,
    requires: ['Financial Plan'],
  },

  // ── La fermeture ─────────────────────────────────────────────────────────
  {
    key: 'appendix',
    name: 'Appendix',
    category: 'closing',
    volume: '7 to 10',
    needsResearch: false,
    requires: ['Opportunity', 'Market Analysis', 'Financial Plan'],
  },
];

/**
 * Page de bibliographie ajoutée AUTOMATIQUEMENT en fin de livrable par
 * l'équipe de recherche. Elle n'est pas dans le catalogue — on ne la choisit
 * pas, elle est la conséquence des sections qui citent des sources — mais le
 * PDF doit la connaître pour ne pas la rejeter en fin de document.
 */
export const BP_RESOURCES_SECTION_NAME = 'Ressources';

const BY_KEY = new Map(BUSINESS_PLAN_SECTION_CATALOG.map((s) => [s.key, s]));
const BY_NAME = new Map(BUSINESS_PLAN_SECTION_CATALOG.map((s) => [s.name, s]));

export const getSectionByKey = (key: string): BusinessPlanSectionDefinition | undefined =>
  BY_KEY.get(key);

export const getSectionByName = (name: string): BusinessPlanSectionDefinition | undefined =>
  BY_NAME.get(name);

/** Clés valides — sert à filtrer une structure reçue du client. */
export const isKnownSectionKey = (key: string): boolean => BY_KEY.has(key);

/**
 * Brief de contenu d'une section. Absent = la section retomberait sur un
 * prompt de composition : `npm run check:prompts` vérifie qu'aucune entrée du
 * catalogue (hors couverture) n'est dans ce cas.
 */
export const getSectionBrief = (name: string): string | undefined => BP_SECTION_BRIEFS[name];
