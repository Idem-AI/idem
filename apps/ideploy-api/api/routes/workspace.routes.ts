import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { description, resourceName, uuidParam } from '../validation/common';
import { DEPLOYMENT_TYPES } from '../services/workspace.service';
import * as ctrl from '../controllers/workspace.controller';

const router = Router();
router.use(authenticate, requireTeam);

/** ISO 3166-1 alpha-2, matching the Laravel form's `size:2` rule. */
const regionCode = z
  .string()
  .trim()
  .length(2, 'A region is a two-letter country code.')
  .transform((v) => v.toUpperCase());

export const createWorkspaceSchema = z
  .object({
    name: resourceName,
    description,
    // `saas` = IDEM's managed fleet, `own` = one of the team's own servers.
    deployment_type: z.enum(DEPLOYMENT_TYPES).default('saas'),
    region: regionCode.optional(),
    server_uuid: z.string().trim().min(1).optional(),
  })
  .refine((v) => v.deployment_type !== 'own' || Boolean(v.server_uuid), {
    message: 'Choose which of your servers this workspace should deploy to.',
    path: ['server_uuid'],
  })
  .refine((v) => v.deployment_type !== 'own' || !v.region, {
    // A region describes where IDEM hosts you; on your own server it is wherever
    // that machine is, so accepting one here would record a fiction.
    message: 'A region cannot be set when deploying to your own server.',
    path: ['region'],
  });

export const updateWorkspaceSchema = z
  .object({ name: resourceName.optional(), description })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: 'Provide a name or a description to change.',
  });

export const createEnvironmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'An environment needs a name.')
    .max(255)
    // Becomes part of container names and DNS labels.
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, digits and hyphens.'),
});

/**
 * @swagger
 * /api/v1/workspaces:
 *   get:
 *     summary: List workspaces
 *     description: >
 *       A workspace groups the projects of one application (frontend, API,
 *       database) onto a shared server and network, so they can reach each other.
 *     tags: [Workspaces]
 *     responses: { 200: { description: OK } }
 *   post:
 *     summary: Create a workspace, deciding its deployment target and region
 *     tags: [Workspaces]
 *     responses:
 *       201: { description: Created }
 *       403: { description: Region selection not available on this plan }
 *       409: { description: Name already used }
 *       422: { description: No managed capacity, or no server chosen }
 */
router.get('/', ctrl.list);
router.post('/', validate({ body: createWorkspaceSchema }), ctrl.create);

/**
 * @swagger
 * /api/v1/workspaces/options:
 *   get: { summary: Deployment targets and regions available to this team, tags: [Workspaces], responses: { 200: { description: OK } } }
 */
router.get('/options', ctrl.creationOptions);

/**
 * @swagger
 * /api/v1/workspaces/{uuid}:
 *   get: { summary: Get a workspace with its environments and project count, tags: [Workspaces], responses: { 200: { description: OK } } }
 *   patch: { summary: Rename or re-describe a workspace, tags: [Workspaces], responses: { 200: { description: OK } } }
 *   delete: { summary: Delete an empty workspace, tags: [Workspaces], responses: { 200: { description: OK }, 409: { description: Still holds projects } } }
 */
router.get('/:uuid', validate({ params: uuidParam }), ctrl.get);
router.patch('/:uuid', validate({ params: uuidParam, body: updateWorkspaceSchema }), ctrl.update);
router.delete('/:uuid', validate({ params: uuidParam }), ctrl.remove);

/**
 * @swagger
 * /api/v1/workspaces/{uuid}/environments:
 *   post: { summary: Add an environment (staging, …), tags: [Workspaces], responses: { 201: { description: Created }, 409: { description: Name already used } } }
 */
router.post(
  '/:uuid/environments',
  validate({ params: uuidParam, body: createEnvironmentSchema }),
  ctrl.addEnvironment
);

/**
 * @swagger
 * /api/v1/workspaces/{uuid}/environments/{environmentUuid}:
 *   delete: { summary: Delete an empty environment, tags: [Workspaces], responses: { 200: { description: OK }, 409: { description: Not empty, or the last one } } }
 */
router.delete('/:uuid/environments/:environmentUuid', ctrl.removeEnvironment);

export const createProjectSchema = z.object({
  name: resourceName,
  description,
  environment_name: z.string().trim().min(1).optional(),
});

/**
 * @swagger
 * /api/v1/workspaces/{uuid}/projects:
 *   get: { summary: List the named projects (frontend, backend, …) in a workspace, tags: [Workspaces], responses: { 200: { description: OK } } }
 *   post: { summary: Create a project inside a workspace, tags: [Workspaces], responses: { 201: { description: Created }, 409: { description: Name already used in that environment } } }
 * /api/v1/workspaces/{uuid}/projects/{projectUuid}:
 *   delete: { summary: Delete an empty project, tags: [Workspaces], responses: { 200: { description: OK }, 409: { description: Still holds resources } } }
 */
router.get('/:uuid/projects', validate({ params: uuidParam }), ctrl.listProjects);
router.post(
  '/:uuid/projects',
  validate({ params: uuidParam, body: createProjectSchema }),
  ctrl.createProject
);
router.delete('/:uuid/projects/:projectUuid', validate({ params: uuidParam }), ctrl.removeProject);

export default router;
