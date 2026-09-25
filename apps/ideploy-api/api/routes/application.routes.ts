import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import { requireTeamAdmin } from '../middleware/authorize.middleware';
import * as ctrl from '../controllers/application.controller';
import * as deployCtrl from '../controllers/deploy.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/applications:
 *   get: { summary: List applications (optionally by ?environment_id), tags: [Applications], responses: { 200: { description: OK } } }
 *   post: { summary: Create an application, tags: [Applications], responses: { 201: { description: Created } } }
 */
router.get('/', ctrl.listApplications);
router.post('/', ctrl.createApplication);

router.get('/:uuid', ctrl.getApplication);
router.patch('/:uuid', ctrl.updateApplication);

/**
 * @swagger
 * /api/v1/applications/{uuid}:
 *   delete:
 *     summary: Delete an application, its containers and volumes
 *     tags: [Applications]
 *     responses:
 *       200: { description: Deleted; serverCleanup tells whether the server was cleaned }
 *       403: { description: Not an owner or admin of the team }
 *       404: { description: Application not found }
 *       409: { description: A deployment is queued or running }
 */
router.delete('/:uuid', requireTeamAdmin, ctrl.deleteApplication);

// Lifecycle
router.post('/:uuid/start', ctrl.startApplication);
router.post('/:uuid/stop', ctrl.stopApplication);
router.post('/:uuid/restart', ctrl.restartApplication);

// Environment variables
router.get('/:uuid/envs', ctrl.listEnvVars);
router.post('/:uuid/envs', ctrl.upsertEnvVar);
router.delete('/:uuid/envs/:key', ctrl.deleteEnvVar);

// Deployments / previews
router.get('/:uuid/deployments', ctrl.listDeployments);

/**
 * @swagger
 * /api/v1/applications/{uuid}/rollback-targets:
 *   get: { summary: Successful past deployments this application can return to, tags: [Deployments], responses: { 200: { description: OK } } }
 * /api/v1/applications/{uuid}/rollback:
 *   post: { summary: Redeploy the commit a previous deployment used, tags: [Deployments], responses: { 202: { description: Queued }, 422: { description: That deployment cannot be reproduced } } }
 */
router.get('/:uuid/rollback-targets', deployCtrl.rollbackTargets);
router.post('/:uuid/rollback', deployCtrl.rollback);
router.get('/:uuid/previews', ctrl.listPreviews);

// Scheduled tasks
router.get('/:uuid/tasks', ctrl.listTasks);
router.post('/:uuid/tasks', ctrl.createTask);
router.post('/:uuid/tasks/:taskUuid/run', ctrl.runTask);
router.get('/:uuid/tasks/:taskUuid/executions', ctrl.taskExecutions);
router.delete('/:uuid/tasks/:taskUuid', ctrl.deleteTask);

// Volumes
router.get('/:uuid/volumes', ctrl.listVolumes);
router.post('/:uuid/volumes/persistent', ctrl.createPersistentVolume);
router.post('/:uuid/volumes/files', ctrl.createFileVolume);
router.delete('/:uuid/volumes/persistent/:id', ctrl.deletePersistentVolume);

// Ops
router.get('/:uuid/status', ctrl.containerStatus);
router.get('/:uuid/metrics', ctrl.metrics);

/**
 * @swagger
 * /api/v1/applications/{uuid}/usage:
 *   get:
 *     summary: Per-container CPU, memory and network use, as numbers
 *     description: A single snapshot — nothing records history, so this is not a time series.
 *     tags: [Applications]
 *     responses: { 200: { description: OK } }
 */
router.get('/:uuid/usage', ctrl.resourceUsage);
router.post('/:uuid/exec', ctrl.exec);

export default router;
