/**
 * @openapi
 * components:
 *   schemas:
 *     SectionModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The unique identifier for the section.
 *           nullable: true
 *         name:
 *           type: string
 *           description: The name of the section.
 *         type:
 *           type: string
 *           description: The type of the section (e.g., 'market-analysis', 'financial-projections').
 *         data:
 *           type: object
 *           description: The content or data of the section. Structure can vary.
 *           additionalProperties: true
 *         summary:
 *           type: string
 *           description: A summary of the section's content.
 *       required:
 *         - name
 *         - type
 *         - data
 *         - summary
 */
export interface SectionModel {
    id?: string;
    name: string;
    type: string;
    data: any;
    summary: string;
}