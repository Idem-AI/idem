import { BrandIdentityModel } from './brand-identity.model';
import { DiagramModel } from './diagram.model';
import { LandingModel } from './landing.model';
import { BusinessPlanModel } from './businessPlan.model';
import { PitchDeckModel } from './pitchDeck.model';
import { LegalDocsModel } from './legalDocs.model';
import { AdvisorConversationModel } from './advisor.model';
import { DevelopmentConfigsModel } from './development.model';

export interface AnalysisResultModel {
  id?: string;
  /**
   * Ancien emplacement unique du business plan : lu par
   * `listDeliverableDocuments`, jamais directement.
   */
  businessPlan?: BusinessPlanModel;
  /** Business plans du projet. */
  businessPlans?: BusinessPlanModel[];
  /** Ancien emplacement unique du pitch deck — même traitement. */
  pitchDeck?: PitchDeckModel;
  /** Pitch decks du projet. */
  pitchDecks?: PitchDeckModel[];
  legalDocs?: LegalDocsModel;
  advisorConversation?: AdvisorConversationModel;
  design: DiagramModel;
  development: {
    configs: DevelopmentConfigsModel;
  };
  branding: BrandIdentityModel;
  landing: LandingModel;
  testing: string;
  createdAt: Date;
}
