import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/settings.controller';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /api/v1/settings/instance:
 *   get: { summary: Get instance settings, tags: [Settings], responses: { 200: { description: OK } } }
 *   patch: { summary: Update instance settings, tags: [Settings], responses: { 200: { description: OK } } }
 */
router.get('/instance', ctrl.getInstance);
router.patch('/instance', ctrl.updateInstance);
router.get('/version', ctrl.version);
router.get('/changelog/reads', ctrl.changelogReads);
router.post('/changelog/read', ctrl.markChangelogRead);
router.get('/search', requireTeam, ctrl.search);

export default router;
