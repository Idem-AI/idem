import { AnalysisResultModel } from "./analysisResult.model";
import { ChatMessage, DeploymentModel } from "./deployment.model";

/**
 * Modèle d'acceptation des politiques intégré au projet
 * (version simplifiée sans userId et projectId)
 */
export interface ProjectPolicyAcceptance {
  privacyPolicyAccepted: boolean;
  termsOfServiceAccepted: boolean;
  betaPolicyAccepted: boolean;
  marketingAccepted: boolean;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * @openapi
 * components:
 *   schemas:
 *     ProjectModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           type: string
 *           enum: [web, mobile, iot, desktop]
 *         constraints:
 *           type: array
 *           items:
 *             type: string
 *         teamSize:
 *           type: string
 *         scope:
 *           type: string
 *         budgetIntervals:
 *           type: string
 *           nullable: true
 *         targets:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         userId:
 *           type: string
 *           format: uuid
 *         selectedPhases:
 *           type: array
 *           items:
 *             type: string
 *         analysisResultModel:
 *           $ref: '#/components/schemas/AnalysisResultModel'
 *         activeChatMessages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatMessage'
 *         policyAcceptance:
 *           type: object
 *           nullable: true
 *           properties:
 *             privacyPolicyAccepted:
 *               type: boolean
 *             termsOfServiceAccepted:
 *               type: boolean
 *             betaPolicyAccepted:
 *               type: boolean
 *             marketingAccepted:
 *               type: boolean
 *             acceptedAt:
 *               type: string
 *               format: date-time
 *             ipAddress:
 *               type: string
 *             userAgent:
 *               type: string
 *         additionalInfos:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *             address:
 *               type: string
 *             city:
 *               type: string
 *             country:
 *               type: string
 *             zipCode:
 *               type: string
 *             teamMembers:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TeamMember'
 *       required:
 *         - name
 *         - description
 *         - type
 *         - constraints
 *         - teamSize
 *         - scope
 *         - targets
 *         - createdAt
 *         - updatedAt
 *         - userId
 *         - selectedPhases
 *         - analysisResultModel
 */
export interface ProjectModel {
  project: any;
  id?: string;
  name: string;
  description: string;
  type: "web" | "mobile" | "iot" | "desktop";
  constraints: string[];
  teamSize: string;
  scope: string;
  budgetIntervals?: string;
  targets: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  selectedPhases: string[];
  analysisResultModel: AnalysisResultModel;
  deployments: DeploymentModel[];
  activeChatMessages: ChatMessage[];
  policyAcceptance?: ProjectPolicyAcceptance;
  additionalInfos: {
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    zipCode: string;
    teamMembers: TeamMember[];
  };
}

export interface TeamMember {
  name: string;
  role: string;
  email: string;
  bio: string;
  pictureUrl?: string;
  socialLinks?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
}
