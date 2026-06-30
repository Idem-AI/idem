import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/team.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/team:
 *   get: { summary: Get current team, tags: [Teams], responses: { 200: { description: OK } } }
 *   patch: { summary: Update current team (admin), tags: [Teams], responses: { 200: { description: OK } } }
 */
router.get('/', ctrl.get);
router.patch('/', ctrl.update);

router.get('/members', ctrl.members);
router.patch('/members/:userId/role', ctrl.setRole);
router.delete('/members/:userId', ctrl.removeMember);

router.get('/invitations', ctrl.listInvitations);
router.post('/invitations', ctrl.createInvitation);
router.delete('/invitations/:uuid', ctrl.deleteInvitation);

export default router;
