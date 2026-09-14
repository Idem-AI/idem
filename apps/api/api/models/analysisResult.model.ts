import { ArchitectureModel } from './architecture.model';
import { BrandIdentityModel } from './brand-identity.model';
import { DiagramModel } from './diagram.model';
import { LandingModel } from './landing.model';
import { BusinessPlanDocument, BusinessPlanModel } from './businessPlan.model';
import { PitchDeckDocument, PitchDeckModel } from './pitchDeck.model';
import { LegalDocsModel } from './legalDocs.model';
import { AdvisorConversationModel } from './advisor.model';
import { WebContainerModel } from './webcontainer.model';
import { DevelopmentConfigsModel } from './development.model';
import { CommunicationModel } from './communication.model';
import { FinanceModel } from './finance.model';

/**
 * @openapi
 * components:
 *   schemas:
 *     AnalysisResultModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         architectures:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ArchitectureModel'
 *         businessPlan:
 *           $ref: '#/components/schemas/BusinessPlanModel'
 *           nullable: true
 *         design:
 *           $ref: '#/components/schemas/DiagramModel'
 *         development:
 *           type: string
 *           description: Description or plan for the development phase.
 *         branding:
 *           $ref: '#/components/schemas/BrandIdentityModel'
 *         landing:
 *           $ref: '#/components/schemas/LandingModel'
 *         testing:
 *           type: string
 *           description: Description or plan for the testing phase.
 *         createdAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - architectures
 *         - design
 *         - development
 *         - branding
 *         - landing
 *         - testing
 *         - createdAt
 */
export interface AnalysisResultModel {
  id?: string;
  architectures: ArchitectureModel[];
  /**
   * Ancien emplacement unique du business plan. Lu comme premier document de
   * `businessPlans`, retiré à la première écriture (`common/deliverable-documents.ts`).
   */
  businessPlan?: BusinessPlanModel;
  /** Business plans du projet (dossier bancaire, plan investisseur…). */
  businessPlans?: BusinessPlanDocument[];
  /** Ancien emplacement unique du pitch deck — même traitement que `businessPlan`. */
  pitchDeck?: PitchDeckModel;
  /** Pitch decks du projet (levée, banque, présentation commerciale…). */
  pitchDecks?: PitchDeckDocument[];
  legalDocs?: LegalDocsModel;
  advisorConversation?: AdvisorConversationModel;
  communication?: CommunicationModel;
  finance?: FinanceModel;
  design: DiagramModel;
  development: {
    configs: DevelopmentConfigsModel;
  };
  branding: BrandIdentityModel;
  landing: LandingModel;
  testing: string;
  generatedDeployment: [
    {
      name: string;
      content: string;
    },
  ];
  createdAt: Date;
  updatedAt: Date;
}
