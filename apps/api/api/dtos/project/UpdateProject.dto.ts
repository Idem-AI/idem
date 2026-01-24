/**
 * @openapi
 * components:
 *   schemas:
 *     UpdateProjectDto:
 *       type: object
 *       description: Data Transfer Object for updating an existing project.
 *       properties:
 *         name:
 *           type: string
 *           nullable: true
 *         description:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           enum: [web, mobile, iot, desktop]
 *           nullable: true
 *         constraints:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         teamSize:
 *           type: string
 *           nullable: true
 *         scope:
 *           type: string
 *           nullable: true
 *         budgetIntervals:
 *           type: string
 *           nullable: true
 *         targets:
 *           type: string
 *           nullable: true
 *         selectedPhases:
 *           type: array
 *           items:
 *             type: string
 *           nullable: true
 *         analysisResultModel:
 *           $ref: '#/components/schemas/AnalysisResultModel' # Assuming the whole analysis can be updated, or parts of it. This might need refinement based on actual update logic.
 *           nullable: true
 */
export class UpdateProjectDto {
  name?: string;
  description?: string;
  type?: 'web' | 'mobile' | 'iot' | 'desktop';
  constraints?: string[];
  teamSize?: string;
  scope?: string;
  budgetIntervals?: string;
  targets?: string;
  selectedPhases?: string[];
  // Consider if analysisResultModel should be updatable directly or via its own endpoints
  // For now, including it as potentially updatable.
  analysisResultModel?: any; // Using 'any' here as AnalysisResultModel is complex and its updatability needs clarification. For Swagger, it's linked to the schema.
}
