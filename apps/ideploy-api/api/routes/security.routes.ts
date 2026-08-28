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

// ── Geo-blocking ──────────────────────────────────────────
/**
 * @swagger
 * /api/v1/firewall/countries:
 *   get: { summary: Countries and continents available for geo-blocking, tags: [Security], responses: { 200: { description: OK } } }
 * /api/v1/applications/{uuid}/firewall/geo:
 *   get: { summary: Current geo-blocking selection, tags: [Security], responses: { 200: { description: OK } } }
 *   put: { summary: Set the geo-blocking selection, tags: [Security], responses: { 200: { description: OK } } }
 *   delete: { summary: Remove geo-blocking, tags: [Security], responses: { 200: { description: OK } } }
 */
// Not application-scoped: the catalogue is the same for everyone, and making the
// picker wait on an application would be an invented dependency.
router.get('/firewall/countries', ctrl.listCountries);
router.get('/applications/:uuid/firewall/geo', ctrl.getGeoBlocking);
router.put('/applications/:uuid/firewall/geo', ctrl.setGeoBlocking);
router.delete('/applications/:uuid/firewall/geo', ctrl.removeGeoBlocking);

// ── Rate limiting ──────────────────────────────────────────
/**
 * @swagger
 * /api/v1/firewall/rate-limit-templates:
 *   get: { summary: Named rate-limit presets, tags: [Security], responses: { 200: { description: OK } } }
 * /api/v1/applications/{uuid}/firewall/rate-limit:
 *   get: { summary: Current rate limit, tags: [Security], responses: { 200: { description: OK } } }
 *   delete: { summary: Remove the rate limit, tags: [Security], responses: { 200: { description: OK } } }
 * /api/v1/applications/{uuid}/firewall/rate-limit/template:
 *   put: { summary: Apply a named rate-limit template, tags: [Security], responses: { 200: { description: OK } } }
 * /api/v1/applications/{uuid}/firewall/rate-limit/custom:
 *   put: { summary: Set specific rate-limit numbers, tags: [Security], responses: { 200: { description: OK } } }
 */
router.get('/firewall/rate-limit-templates', ctrl.listRateLimitTemplates);
router.get('/applications/:uuid/firewall/rate-limit', ctrl.getRateLimit);
router.put('/applications/:uuid/firewall/rate-limit/template', ctrl.applyRateLimitTemplate);
router.put('/applications/:uuid/firewall/rate-limit/custom', ctrl.setCustomRateLimit);
router.delete('/applications/:uuid/firewall/rate-limit', ctrl.removeRateLimit);

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
