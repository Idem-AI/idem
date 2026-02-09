/**
 * @openapi
 * components:
 *   schemas:
 *     CreateProjectDto:
 *       type: object
 *       required:
 *         - name
 *         - description
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the project.
 *           example: My Awesome Project
 *         description:
 *           type: string
 *           description: A brief description of the project.
 *           example: This project aims to solve world hunger.
 *         userId:
 *           type: string
 *           description: The ID of the user creating the project. (Usually injected by auth middleware)
 *           example: 'user123'
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Optional tags for the project.
 *           example: ['AI', 'SaaS', 'Startup']
 */
export class CreateProjectDto {
  name!: string;
  description!: string;
  userId?: string; // Optional here as it's often injected by middleware
  tags?: string[];
}
