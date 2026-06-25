import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/notification.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/notifications/{channel}:
 *   get: { summary: Get notification settings (channel = slack|discord|telegram|pushover), tags: [Notifications], responses: { 200: { description: OK } } }
 *   put: { summary: Update notification settings, tags: [Notifications], responses: { 200: { description: OK } } }
 */
router.get('/:channel', ctrl.get);
router.put('/:channel', ctrl.update);
router.post('/:channel/test', ctrl.test);

export default router;
