/**
 * MODÈLES DE STRUCTURE DE BUSINESS PLAN.
 *
 * Un plan destiné à un comité de crédit et un plan destiné à un fonds
 * d'amorçage ne portent pas les mêmes sections, ni dans le même ordre. Certaines
 * institutions imposent littéralement leur table des matières — le plan qui ne
 * la suit pas est renvoyé avant d'être lu.
 *
 * Chaque modèle ci-dessous vient d'une structure réellement pratiquée :
 * l'ossature en neuf points de l'administration américaine (SBA), le dossier de
 * financement en neuf blocs distribué par les banques françaises, le plan
 * attendu par un fonds d'amorçage, le Lean Canvas d'Ash Maurya, le plan de
 * subvention d'un bailleur, le dossier de crédit d'une institution de
 * microfinance en zone OHADA.
 *
 * L'utilisateur en choisit un — ou compose le sien, mais uniquement à partir du
 * catalogue (cf. `section-catalog.ts`). C'est l'arbitrage central de ce module :
 * assez de souplesse pour qu'un dossier soit recevable là où il est déposé,
 * pas assez pour qu'une section arrive sans brief ni volume.
 */

import { isKnownSectionKey } from './section-catalog';
import type { BusinessPlanAudience } from './audience.types';

// Réexporté : les appelants existants importent le type depuis ce module, et le
// déplacer a été motivé par un cycle de dépendances, pas par un renommage.
export type { BusinessPlanAudience };

export interface BusinessPlanTemplate {
  id: string;
  /** Public visé, pour grouper les modèles dans l'UI. */
  audience: BusinessPlanAudience;
  /** Clés de sections, DANS L'ORDRE de lecture du document. */
  sectionKeys: string[];
  /** Modèle proposé par défaut quand le projet n'a rien choisi. */
  isDefault?: boolean;
  /**
   * Origine de la structure, affichée dans l'UI. Un utilisateur qui doit
   * déposer un dossier veut savoir d'où vient la table des matières proposée.
   */
  source?: string;
  /** Nombre de pages A4 typiquement produit — sert à cadrer l'attente. */
  estimatedPages: string;
}

/** Identifiant réservé à une structure composée par l'utilisateur. */
export const CUSTOM_TEMPLATE_ID = 'custom';

export const BUSINESS_PLAN_TEMPLATES: BusinessPlanTemplate[] = [
  {
    id: 'idem-standard',
    audience: 'general',
    isDefault: true,
    estimatedPages: '25-35',
    sectionKeys: [
      'cover-page',
      'company-summary',
      'opportunity',
      'target-audience',
      'products-services',
      'marketing-sales',
      'financial-plan',
      'goal-planning',
      'appendix',
    ],
  },
  {
    id: 'sba-traditional',
    audience: 'bank',
    source: 'U.S. Small Business Administration — traditional business plan',
    estimatedPages: '25-40',
    sectionKeys: [
      'cover-page',
      'executive-summary',
      'company-summary',
      'market-analysis',
      'management-team',
      'products-services',
      'marketing-sales',
      'funding-request',
      'financial-plan',
      'appendix',
    ],
  },
  {
    id: 'bank-financing-9',
    audience: 'bank',
    source: 'Guide business plan bancaire — dossier de financement en 9 points',
    estimatedPages: '20-30',
    sectionKeys: [
      'cover-page',
      'one-page-summary',
      'management-team',
      'market-analysis',
      'strategy-milestones',
      'marketing-sales',
      'operations-plan',
      'financial-plan',
      'resources-assets',
    ],
  },
  {
    id: 'bank-credit-file',
    audience: 'bank',
    source: 'Dossier de crédit — comité d’engagement bancaire',
    estimatedPages: '35-50',
    sectionKeys: [
      'cover-page',
      'executive-summary',
      'promoter-profile',
      'company-summary',
      'market-analysis',
      'competition',
      'products-services',
      'operations-plan',
      'management-team',
      'financial-plan',
      'funding-request',
      'guarantees',
      'risk-analysis',
      'appendix',
    ],
  },
  {
    id: 'vc-seed',
    audience: 'investor',
    source: 'Structure attendue par les fonds d’amorçage et de série A',
    estimatedPages: '20-30',
    sectionKeys: [
      'cover-page',
      'executive-summary',
      'problem',
      'solution',
      'value-proposition',
      'market-analysis',
      'target-audience',
      'business-model',
      'traction',
      'competition',
      'unfair-advantage',
      'go-to-market',
      'management-team',
      'financial-plan',
      'funding-request',
      'exit-strategy',
      'appendix',
    ],
  },
  {
    id: 'lean-canvas',
    audience: 'internal',
    source: 'Lean Canvas (Ash Maurya) — validation d’hypothèses',
    estimatedPages: '10-15',
    sectionKeys: [
      'cover-page',
      'problem',
      'solution',
      'value-proposition',
      'unfair-advantage',
      'target-audience',
      'business-model',
      'kpi-metrics',
      'financial-plan',
    ],
  },
  {
    id: 'grant-nonprofit',
    audience: 'grant',
    source: 'Dossier de demande de subvention — bailleurs et fondations',
    estimatedPages: '25-40',
    sectionKeys: [
      'cover-page',
      'executive-summary',
      'mission-vision',
      'problem',
      'target-audience',
      'products-services',
      'theory-of-change',
      'management-team',
      'partnerships',
      'monitoring-evaluation',
      'impact',
      'financial-plan',
      'funding-request',
      'sustainability',
      'appendix',
    ],
  },
  {
    id: 'microfinance-ohada',
    audience: 'bank',
    source: 'Dossier de financement — institutions de microfinance, zone OHADA',
    estimatedPages: '20-30',
    sectionKeys: [
      'cover-page',
      'promoter-profile',
      'company-summary',
      'market-analysis',
      'products-services',
      'operations-plan',
      'management-team',
      'financial-plan',
      'funding-request',
      'guarantees',
      'impact',
      'appendix',
    ],
  },
  {
    id: 'incubator-application',
    audience: 'investor',
    source: 'Dossier de candidature — incubateurs et accélérateurs',
    estimatedPages: '15-25',
    sectionKeys: [
      'cover-page',
      'executive-summary',
      'problem',
      'solution',
      'target-audience',
      'business-model',
      'traction',
      'competition',
      'management-team',
      'go-to-market',
      'goal-planning',
      'financial-plan',
    ],
  },
  {
    id: 'internal-strategic',
    audience: 'internal',
    source: 'Plan stratégique interne — pilotage et comité de direction',
    estimatedPages: '20-30',
    sectionKeys: [
      'executive-summary',
      'company-summary',
      'market-analysis',
      'competition',
      'strategy-milestones',
      'operations-plan',
      'management-team',
      'goal-planning',
      'kpi-metrics',
      'risk-analysis',
      'financial-plan',
    ],
  },
];

export const DEFAULT_TEMPLATE_ID =
  BUSINESS_PLAN_TEMPLATES.find((t) => t.isDefault)?.id ?? BUSINESS_PLAN_TEMPLATES[0].id;

export const getTemplate = (id: string): BusinessPlanTemplate | undefined =>
  BUSINESS_PLAN_TEMPLATES.find((t) => t.id === id);

/**
 * Garde-fou de démarrage : un modèle qui référence une clé absente du catalogue
 * produirait un plan avec une section en moins, silencieusement. Mieux vaut
 * échouer au chargement du module.
 */
for (const template of BUSINESS_PLAN_TEMPLATES) {
  const unknown = template.sectionKeys.filter((key) => !isKnownSectionKey(key));
  if (unknown.length > 0) {
    throw new Error(
      `Modèle de business plan « ${template.id} » invalide : section(s) inconnue(s) ${unknown.join(', ')}.`
    );
  }
}
