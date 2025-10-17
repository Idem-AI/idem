import { SectionModel } from "../../models/section.model";

/**
 * @openapi
 * components:
 *   schemas:
 *     UpdateBusinessPlanDto:
 *       type: object
 *       description: Data Transfer Object for updating an existing business plan.
 *       properties:
 *         title:
 *           type: string
 *           nullable: true
 *         executiveSummary:
 *           type: string
 *           nullable: true
 *         companyDescription:
 *           type: string
 *           nullable: true
 *         marketAnalysis:
 *           type: string
 *           nullable: true
 *         organizationAndManagement:
 *           type: string
 *           nullable: true
 *         serviceOrProductLine:
 *           type: string
 *           nullable: true
 *         marketingAndSalesStrategy:
 *           type: string
 *           nullable: true
 *         fundingRequest:
 *           type: string
 *           nullable: true
 *         financialProjections:
 *           type: string
 *           nullable: true
 *         appendix:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [draft, review, finalized, archived]
 *           nullable: true
 *         version:
 *           type: number
 *           nullable: true
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SectionModel'
 *           nullable: true
 */
export class UpdateBusinessPlanDto {
  title?: string;
  executiveSummary?: string;
  companyDescription?: string;
  marketAnalysis?: string;
  organizationAndManagement?: string;
  serviceOrProductLine?: string;
  marketingAndSalesStrategy?: string;
  fundingRequest?: string;
  financialProjections?: string;
  appendix?: string;
  status?: 'draft' | 'review' | 'finalized' | 'archived';
  version?: number;
  sections?: SectionModel[];
}
