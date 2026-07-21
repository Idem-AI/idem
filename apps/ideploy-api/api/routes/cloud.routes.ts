import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/cloud.controller';

const router = Router();
router.use(authenticate, requireTeam);

// Cloud provider tokens
/**
 * @swagger
 * /api/v1/cloud/tokens:
 *   get: { summary: List cloud provider tokens, tags: [Cloud], responses: { 200: { description: OK } } }
 *   post: { summary: Create a cloud provider token (encrypted), tags: [Cloud], responses: { 201: { description: Created } } }
 */
router.get('/tokens', ctrl.listTokens);
router.post('/tokens', ctrl.createToken);
router.delete('/tokens/:id', ctrl.deleteToken);

// Cloud-init scripts
router.get('/init-scripts', ctrl.listInitScripts);
router.post('/init-scripts', ctrl.createInitScript);
router.delete('/init-scripts/:id', ctrl.deleteInitScript);

// Hetzner provisioning (pass ?token_id=<cloud provider token id>)
/**
 * @swagger
 * /api/v1/cloud/hetzner/server-types:
 *   get: { summary: List Hetzner server types, tags: [Cloud], responses: { 200: { description: OK } } }
 */
router.get('/hetzner/locations', ctrl.hetznerLocations);
router.get('/hetzner/server-types', ctrl.hetznerServerTypes);
router.post('/hetzner/servers', ctrl.hetznerCreateServer);

export default router;
