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
  businessPlan?: BusinessPlanModel;
  pitchDeck?: PitchDeckModel;
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
