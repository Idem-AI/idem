import { Router } from "express";
import { projectController } from "../controllers/project.controller";
import { authenticate } from "../services/auth.service";
import { checkQuota } from "../middleware/quota.middleware";

export const projectRoutes = Router();

// Create a new project
/**
 * @openapi
 * /projects/create:
 *   post:
 *     tags:
 *       - Projects
 *     summary: Create a new project
 *     description: Creates a new project for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProjectDto'
 *     responses:
 *       '201':
 *         description: Project created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               # You might want to define a ProjectResponseDto or reference ProjectModel here
 *               type: object 
 *               properties:
 *                 id:
 *                   type: string
 *                   example: 'project-uuid-123'
 *                 name:
 *                   type: string
 *                   example: 'My Awesome Project'
 *                 message:
 *                   type: string
 *                   example: 'Project created successfully'
 *       '400':
 *         description: Bad request (e.g., validation error).
 *       '401':
 *         description: Unauthorized (e.g., missing or invalid token).
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.post("/create", authenticate, projectController.createProject);




// Get all projects for the authenticated user
/**
 * @openapi
 * /projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Retrieve all projects for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: A list of projects.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProjectModel'
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.get('/', authenticate,  projectController.getAllProjects);

// Get a specific project by ID
/**
 * @openapi
 * /projects/get/{projectId}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Retrieve a project by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to retrieve.
 *     responses:
 *       '200':
 *         description: Project retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectModel'
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project not found.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.get(
  "/:projectId",
  authenticate,
  projectController.getProjectById
);

// Update a specific project by ID
/**
 * @openapi
 * /projects/{projectId}:
 *   put:
 *     tags:
 *       - Projects
 *     summary: Update an existing project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProjectDto'
 *     responses:
 *       '200':
 *         description: Project updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectModel'
 *       '400':
 *         description: Bad request (e.g., validation error).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project not found.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.put('/:projectId', authenticate, projectController.updateProject);

// Delete a specific project by ID
/**
 * @openapi
 * /projects/delete/{projectId}:
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Delete a project by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to delete.
 *     responses:
 *       '200':
 *         description: Project deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project deleted successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Project not found.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.delete(
  "/delete/:projectId",
  authenticate,
  projectController.deleteProject
);
