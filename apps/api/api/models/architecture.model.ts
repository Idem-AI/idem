/**
 * @openapi
 * components:
 *   schemas:
 *     ArchitectureModel:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The unique identifier for the architecture diagram.
 *           nullable: true
 *         content:
 *           type: string
 *           description: The main content or data of the architecture (e.g., JSON, XML, or other structured data representing the diagram).
 *         summary:
 *           type: string
 *           description: A summary or description of the architecture.
 *         name:
 *           type: string
 *           description: The name of the architecture diagram.
 *       required:
 *         - content
 *         - summary
 *         - name
 */
export interface ArchitectureModel {
  id?: string;
  content: string;
  summary: string;
  name: string;
}
