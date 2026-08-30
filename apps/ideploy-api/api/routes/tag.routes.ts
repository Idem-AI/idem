import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/tag.controller';

const router = Router();
router.use(authenticate, requireTeam);

/**
 * @swagger
 * /api/v1/tags:
 *   get: { summary: List team tags, tags: [Tags], responses: { 200: { description: OK } } }
 *   post: { summary: Create a tag, tags: [Tags], responses: { 201: { description: Created } } }
 */
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.delete('/:uuid', ctrl.remove);
// Ahead of `/:uuid` so the literal segment `for` is not read as a tag uuid.
router.get('/for/:taggableType/:taggableId', ctrl.listForTaggable);

router.post('/:uuid/attach', ctrl.attach);
router.post('/:uuid/detach', ctrl.detach);

export default router;
