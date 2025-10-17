import { Router } from "express";
import {
  generateDiagramController,
  generateDiagramStreamingController,
  getDiagramsByProjectController,
  getDiagramByIdController,
  updateDiagramController,
  deleteDiagramController,
} from "../controllers/diagram.controller";
import { authenticate } from "../services/auth.service"; // Updated import path
import { checkQuota } from "../middleware/quota.middleware";
import { checkPolicyAcceptance } from "../middleware/policyCheck.middleware";

export const diagramRoutes = Router();

const resourceName = "diagrams";

// All routes are protected and project-specific where applicable

// Generate a new diagram for a project
/**
 * @openapi
 * /diagrams/generate/{projectId}:
 *   post:
 *     tags:
 *       - Diagrams
 *     summary: Generate a new diagram for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project for which to generate the diagram.
 *     requestBody:
 *       description: Optional initial data for diagram generation.
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Optional initial name for the diagram.
 *               type:
 *                 type: string
 *                 enum: [architecture, sequence, class, use_case, entity_relationship, network, flowchart, mind_map, custom]
 *                 description: Optional type of the diagram to generate.
 *               description:
 *                 type: string
 *                 description: Optional description or prompt for diagram generation.
 *     responses:
 *       '201':
 *         description: Diagram generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiagramModel'
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project not found.
 *       '500':
 *         description: Internal server error.
 */
diagramRoutes.get(
  `/${resourceName}/generate/:projectId`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  generateDiagramController
);

// Generate a new diagram for a project with streaming updates
/**
 * @openapi
 * /diagrams/generate-stream/{projectId}:
 *   post:
 *     tags:
 *       - Diagrams
 *     summary: Generate a new diagram for a project with streaming updates
 *     description: Returns each step's result as soon as it's generated using Server-Sent Events
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project for which to generate the diagram.
 *     responses:
 *       '200':
 *         description: Stream of diagram generation steps and final result.
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: object
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project not found.
 *       '500':
 *         description: Internal server error.
 */
diagramRoutes.get(
  `/${resourceName}/generate-stream/:projectId`,
  authenticate,
  checkPolicyAcceptance,
  checkQuota,
  generateDiagramStreamingController
);

// Get all diagrams for a specific project
/**
 * @openapi
 * /diagrams/getAll/{projectId}:
 *   get:
 *     tags:
 *       - Diagrams
 *     summary: Retrieve all diagrams for a specific project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project whose diagrams are to be retrieved.
 *     responses:
 *       '200':
 *         description: A list of diagrams.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DiagramModel'
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project not found.
 *       '500':
 *         description: Internal server error.
 */
diagramRoutes.get(
  `/${resourceName}/getAll/:projectId`,
  authenticate,
  getDiagramsByProjectController
);

// Get a specific diagram by its ID
/**
 * @openapi
 * /diagrams/get/{diagramId}:
 *   get:
 *     tags:
 *       - Diagrams
 *     summary: Retrieve a specific diagram by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: diagramId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the diagram to retrieve.
 *     responses:
 *       '200':
 *         description: Details of the diagram.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiagramModel'
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Diagram not found.
 *       '500':
 *         description: Internal server error.
 */
diagramRoutes.get(
  `/${resourceName}/get/:diagramId`,
  authenticate,
  getDiagramByIdController
);

// Update a specific diagram by its ID
/**
 * @openapi
 * /diagrams/update/{diagramId}:
 *   put:
 *     tags:
 *       - Diagrams
 *     summary: Update an existing diagram
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: diagramId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the diagram to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDiagramDto'
 *     responses:
 *       '200':
 *         description: Diagram updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiagramModel'
 *       '400':
 *         description: Bad request (e.g., validation error).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Diagram not found.
 *       '500':
 *         description: Internal server error.
 */
diagramRoutes.put(
  `/${resourceName}/update/:diagramId`,
  authenticate,
  updateDiagramController
);

// Delete a specific diagram by its ID
/**
 * @openapi
 * /diagrams/delete/{diagramId}:
 *   delete:
 *     tags:
 *       - Diagrams
 *     summary: Delete a diagram by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: diagramId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the diagram to delete.
 *     responses:
 *       '200':
 *         description: Diagram deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Diagram deleted successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Diagram not found.
 *       '500':
 *         description: Internal server error.
 */
diagramRoutes.delete(
  `/${resourceName}/delete/:diagramId`,
  authenticate,
  deleteDiagramController
);
