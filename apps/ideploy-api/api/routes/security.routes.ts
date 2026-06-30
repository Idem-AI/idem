import { Router } from 'express';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/security.controller';

const router = Router();
router.use(authenticate, requireTeam);

// ── Application firewall (WAF) ────────────────────────────
/**
 * @swagger
 * /api/v1/applications/{uuid}/firewall:
 *   get: { summary: Get firewall config, tags: [Security], responses: { 200: { description: OK } } }
 *   patch: { summary: Update firewall config, tags: [Security], responses: { 200: { description: OK } } }
 */
router.get('/applications/:uuid/firewall', ctrl.getConfig);
router.patch('/applications/:uuid/firewall', ctrl.updateConfig);
router.get('/applications/:uuid/firewall/rules', ctrl.listRules);
router.post('/applications/:uuid/firewall/rules', ctrl.createRule);
router.delete('/applications/:uuid/firewall/rules/:ruleId', ctrl.deleteRule);
router.get('/applications/:uuid/firewall/alerts', ctrl.listAlerts);
router.get('/applications/:uuid/firewall/traffic', ctrl.listTraffic);
router.post('/applications/:uuid/firewall/deploy', ctrl.deployFirewall);

// ── CrowdSec (server) ─────────────────────────────────────
/**
 * @swagger
 * /api/v1/servers/{serverUuid}/crowdsec/install:
 *   post: { summary: Install the CrowdSec agent on a server, tags: [Security], responses: { 200: { description: OK } } }
 */
router.post('/servers/:serverUuid/crowdsec/install', ctrl.installCrowdSec);
router.get('/servers/:serverUuid/crowdsec/status', ctrl.crowdSecStatus);
router.post('/servers/:serverUuid/crowdsec/bouncers', ctrl.addBouncer);

// ── SSL certificates (server) ─────────────────────────────
router.get('/servers/:serverUuid/certificates', ctrl.listCerts);
router.post('/servers/:serverUuid/certificates', ctrl.generateCert);
router.delete('/servers/:serverUuid/certificates/:id', ctrl.deleteCert);

export default router;
