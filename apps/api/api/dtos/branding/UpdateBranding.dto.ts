import { LogoModel } from "../../models/logo.model";
import { ColorModel } from "../../models/brand-identity.model"; // ColorModel is in brand-identity.model.ts
import { TypographyModel } from "../../models/brand-identity.model"; // TypographyModel is in brand-identity.model.ts
import { SectionModel } from "../../models/section.model";

/**
 * @openapi
 * components:
 *   schemas:
 *     UpdateBrandingDto:
 *       type: object
 *       description: Data Transfer Object for updating an existing brand identity.
 *       properties:
 *         name:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         logos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LogoModel'
 *           nullable: true
 *         colors:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ColorModel'
 *           nullable: true
 *         typography:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TypographyModel'
 *           nullable: true
 *         visualElements:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         toneOfVoice:
 *           type: string
 *           nullable: true
 *         messaging:
 *           type: string
 *           nullable: true
 *         targetAudience:
 *           type: string
 *           nullable: true
 *         competitorAnalysis:
 *           type: string
 *           nullable: true
 *         uniqueSellingProposition:
 *           type: string
 *           nullable: true
 *         brandStory:
 *           type: string
 *           nullable: true
 *         guidelines:
 *           type: string
 *           nullable: true
 *         feedback:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [draft, review, approved, archived]
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
export class UpdateBrandingDto {
  name?: string;
  description?: string;
  logos?: LogoModel[];
  colors?: ColorModel[];
  typography?: TypographyModel[];
  visualElements?: string[];
  toneOfVoice?: string;
  messaging?: string;
  targetAudience?: string;
  competitorAnalysis?: string;
  uniqueSellingProposition?: string;
  brandStory?: string;
  guidelines?: string;
  feedback?: string;
  status?: 'draft' | 'review' | 'approved' | 'archived';
  version?: number;
  sections?: SectionModel[];
}
