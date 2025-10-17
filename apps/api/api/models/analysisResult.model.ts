import { ArchitectureModel } from "./architecture.model";
import { BrandIdentityModel } from "./brand-identity.model";
import { DiagramModel } from "./diagram.model";
import { LandingModel } from "./landing.model";
import { BusinessPlanModel } from "./businessPlan.model";
import { WebContainerModel } from "./webcontainer.model";
import { DevelopmentConfigsModel } from "./development.model";

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
  businessPlan?: BusinessPlanModel;
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
    }
  ];
  createdAt: Date;
  updatedAt: Date;
}

