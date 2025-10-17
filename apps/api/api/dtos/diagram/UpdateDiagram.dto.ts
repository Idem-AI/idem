import { SectionModel } from "../../models/section.model";

/**
 * @openapi
 * components:
 *   schemas:
 *     UpdateDiagramDto:
 *       type: object
 *       description: Data Transfer Object for updating an existing diagram.
 *       properties:
 *         name:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [architecture, sequence, class, use_case, entity_relationship, network, flowchart, mind_map, custom]
 *           nullable: true
 *         format:
 *           type: string
 *           enum: [json, xml, plantuml, mermaid, drawio, custom]
 *           nullable: true
 *         content:
 *           type: object
 *           description: The actual diagram content, structure depends on the 'format'. Could be a JSON object, XML string, PlantUML/Mermaid code, etc.
 *           additionalProperties: true
 *           nullable: true
 *         version:
 *           type: number
 *           nullable: true
 *         status:
 *           type: string
 *           enum: [draft, review, approved, deprecated]
 *           nullable: true
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         sections:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SectionModel'
 *           nullable: true
 */
export class UpdateDiagramDto {
  name?: string;
  description?: string;
  type?: 'architecture' | 'sequence' | 'class' | 'use_case' | 'entity_relationship' | 'network' | 'flowchart' | 'mind_map' | 'custom';
  format?: 'json' | 'xml' | 'plantuml' | 'mermaid' | 'drawio' | 'custom';
  content?: any; // Using 'any' as the structure is highly variable
  version?: number;
  status?: 'draft' | 'review' | 'approved' | 'deprecated';
  tags?: string[];
  sections?: SectionModel[];
}
