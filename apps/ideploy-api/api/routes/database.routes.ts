import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/database.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/databases:
 *   get: { summary: List databases of all types for the team, tags: [Databases], responses: { 200: { description: OK } } }
 */
router.get('/', ctrl.list);

// Backup schedule deletion / executions (flat paths, by schedule uuid)
router.delete('/backups/:scheduleUuid', ctrl.deleteSchedule);
router.get('/backups/:scheduleUuid/executions', ctrl.listExecutions);

/**
 * @swagger
 * /api/v1/databases/{type}:
 *   post: { summary: Create a database (type = postgresql|mysql|mariadb|mongodb|redis|keydb|dragonfly|clickhouse), tags: [Databases], responses: { 201: { description: Created } } }
 */
router.post('/:type', ctrl.create);
router.get('/:type/:uuid', ctrl.get);
router.delete('/:type/:uuid', ctrl.remove);

// Lifecycle
router.post('/:type/:uuid/start', ctrl.start);
router.post('/:type/:uuid/stop', ctrl.stop);
router.post('/:type/:uuid/restart', ctrl.restart);

// Backups for a database
router.get('/:type/:uuid/backups', ctrl.listSchedules);
router.post('/:type/:uuid/backups', ctrl.createSchedule);
router.post('/:type/:uuid/backup-now', ctrl.backupNow);

export default router;
