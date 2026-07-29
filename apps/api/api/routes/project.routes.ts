import { Router } from 'express';
import { projectController } from '../controllers/project.controller';
import { authenticate } from '../services/auth.service';
import { checkQuota } from '../middleware/quota.middleware';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

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
projectRoutes.post('/create', authenticate, projectController.createProject);

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
projectRoutes.get('/', authenticate, projectController.getAllProjects);

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
projectRoutes.get('/:projectId', authenticate, projectController.getProjectById);

// Check project branding completion status
/**
 * @openapi
 * /projects/{projectId}/branding/completion:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Check if project branding is complete
 *     description: Returns completion status and list of missing branding elements
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     responses:
 *       '200':
 *         description: Branding completion status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isComplete:
 *                   type: boolean
 *                 missingElements:
 *                   type: array
 *                   items:
 *                     type: string
 *       '404':
 *         description: Project not found
 *       '500':
 *         description: Internal server error
 */
projectRoutes.get(
  '/:projectId/branding/completion',
  authenticate,
  projectController.checkBrandingCompletion
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
projectRoutes.delete('/delete/:projectId', authenticate, projectController.deleteProject);
projectRoutes.delete('/:projectId', authenticate, projectController.deleteProject);

// Project Generation Routes

// Get project generation
/**
 * @openapi
 * /projects/{projectId}/generation:
 *   get:
 *     tags:
 *       - Project Generation
 *     summary: Get project generation data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     responses:
 *       '200':
 *         description: Generation data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Generation not found.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.get('/:projectId/generation', authenticate, projectController.getProjectGeneration);

// Save project generation
/**
 * @openapi
 * /projects/{projectId}/generation:
 *   post:
 *     tags:
 *       - Project Generation
 *     summary: Save project generation data
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *               files:
 *                 type: object
 *               timestamp:
 *                 type: number
 *               projectName:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Generation saved successfully.
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.post('/:projectId/generation', authenticate, projectController.saveProjectGeneration);

// Incremental code storage + chat session (iCode/AppGen workspace persistence)

/**
 * @openapi
 * /projects/{projectId}/code/manifest:
 *   get:
 *     tags:
 *       - Project Generation
 *     summary: Get the content hashes of the code stored for a project
 *     description: Used by the client to compute which files actually changed before uploading.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Manifest (empty when nothing is stored yet).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: object
 *                   additionalProperties:
 *                     type: string
 *       '401':
 *         description: Unauthorized.
 */
projectRoutes.get(
  '/:projectId/code/manifest',
  authenticate,
  projectController.getProjectCodeManifest
);

/**
 * @openapi
 * /projects/{projectId}/code:
 *   put:
 *     tags:
 *       - Project Generation
 *     summary: Incrementally sync the generated code to object storage
 *     description: Writes only added/modified files, removes deleted ones and updates the manifest.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [manifest]
 *             properties:
 *               upserts:
 *                 type: object
 *                 description: Map of file path to content, limited to changed files.
 *               deletions:
 *                 type: array
 *                 items:
 *                   type: string
 *               manifest:
 *                 type: object
 *                 description: Content hashes of the complete resulting file set.
 *     responses:
 *       '200':
 *         description: Sync applied.
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 */
projectRoutes.put('/:projectId/code', authenticate, projectController.syncProjectCode);

/**
 * @openapi
 * /projects/{projectId}/chat-session:
 *   get:
 *     tags:
 *       - Project Generation
 *     summary: Get the iCode chat session attached to a project
 *     description: Lets the user reopen the same conversation from any machine.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Chat session found.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: No chat session yet.
 */
projectRoutes.get(
  '/:projectId/chat-session',
  authenticate,
  projectController.getProjectChatSession
);

/**
 * @openapi
 * /projects/{projectId}/chat-session:
 *   put:
 *     tags:
 *       - Project Generation
 *     summary: Save the iCode chat session of a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, messages]
 *             properties:
 *               sessionId:
 *                 type: string
 *               title:
 *                 type: string
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       '200':
 *         description: Chat session saved.
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 */
projectRoutes.put(
  '/:projectId/chat-session',
  authenticate,
  projectController.saveProjectChatSession
);

// App Deployment Routes (quick deploys from iCode/AppGen)

/**
 * @openapi
 * /projects/{projectId}/app-deployment:
 *   get:
 *     tags:
 *       - Project Generation
 *     summary: Get the last quick deployment (Netlify) of a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deployment found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 provider:
 *                   type: string
 *                 siteId:
 *                   type: string
 *                 siteName:
 *                   type: string
 *                 url:
 *                   type: string
 *                 adminUrl:
 *                   type: string
 *                 lastDeployedAt:
 *                   type: string
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: No deployment found.
 */
projectRoutes.get('/:projectId/app-deployment', authenticate, projectController.getAppDeployment);

/**
 * @openapi
 * /projects/{projectId}/app-deployment:
 *   post:
 *     tags:
 *       - Project Generation
 *     summary: Record the quick deployment (Netlify) of a project
 *     description: Stores the Netlify site id so the next deploy updates the same site.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [siteId, url]
 *             properties:
 *               siteId:
 *                 type: string
 *               siteName:
 *                 type: string
 *               url:
 *                 type: string
 *               adminUrl:
 *                 type: string
 *               deployId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Deployment recorded.
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 */
projectRoutes.post('/:projectId/app-deployment', authenticate, projectController.saveAppDeployment);

// Save project ZIP file
/**
 * @openapi
 * /projects/{projectId}/zip:
 *   post:
 *     tags:
 *       - Project Generation
 *     summary: Save project ZIP file
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               zip:
 *                 type: string
 *                 format: binary
 *                 description: The ZIP file containing the project files.
 *     responses:
 *       '200':
 *         description: ZIP file saved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 url:
 *                   type: string
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.post(
  '/:projectId/zip',
  authenticate,
  upload.single('zip'),
  projectController.saveProjectZip
);

// Send project to GitHub
/**
 * @openapi
 * /projects/{projectId}/github:
 *   post:
 *     tags:
 *       - Project Generation
 *     summary: Send project to GitHub
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectName:
 *                 type: string
 *                 description: Name of the project for GitHub repository.
 *               description:
 *                 type: string
 *                 description: Description of the project.
 *               files:
 *                 type: object
 *                 description: Project files to upload.
 *               isPublic:
 *                 type: boolean
 *                 description: Whether the repository should be public.
 *             required:
 *               - projectName
 *               - files
 *     responses:
 *       '200':
 *         description: Project sent to GitHub successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 repoUrl:
 *                   type: string
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.post('/:projectId/github', authenticate, projectController.sendProjectToGitHub);

// Get project code from Firebase Storage
/**
 * @openapi
 * /projects/{projectId}/code:
 *   get:
 *     tags:
 *       - Project Generation
 *     summary: Get project code from Firebase Storage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     responses:
 *       '200':
 *         description: Project code retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 files:
 *                   type: object
 *                   description: Project files as key-value pairs (filename -> content).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: No code found for this project.
 *       '500':
 *         description: Internal server error.
 */
projectRoutes.get('/:projectId/code', authenticate, projectController.getProjectCode);
