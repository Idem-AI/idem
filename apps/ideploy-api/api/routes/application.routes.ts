import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/application.controller';

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
router.post('/:uuid/exec', ctrl.exec);

export default router;
