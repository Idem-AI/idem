import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { description, pemPrivateKey, resourceName, uuidParam } from '../validation/common';
import { SSH_KEY_TYPES } from '../ssh/keygen';
import * as ctrl from '../controllers/private-key.controller';

const router = Router();
router.use(authenticate, requireTeam);

export const createPrivateKeySchema = z.object({
  name: resourceName,
  description,
  private_key: pemPrivateKey,
  is_git_related: z.boolean().optional(),
});

export const generatePrivateKeySchema = z.object({
  name: resourceName,
  description,
  // ed25519 by default: shorter, faster and the current OpenSSH recommendation.
  type: z.enum(SSH_KEY_TYPES).default('ed25519'),
  is_git_related: z.boolean().optional(),
});

/**
 * @swagger
 * /api/v1/security/keys:
 *   get: { summary: List private keys, tags: [Security], responses: { 200: { description: OK } } }
 *   post: { summary: Register an existing private key (PEM, encrypted at rest), tags: [Security], responses: { 201: { description: Created }, 409: { description: Already registered }, 422: { description: Not a usable private key } } }
 */
router.get('/', ctrl.list);
router.post('/', validate({ body: createPrivateKeySchema }), ctrl.create);

/**
 * @swagger
 * /api/v1/security/keys/generate:
 *   post:
 *     summary: Generate a new SSH key pair; the response includes the public key to install on the server
 *     tags: [Security]
 *     responses: { 201: { description: Created } }
 */
router.post('/generate', validate({ body: generatePrivateKeySchema }), ctrl.generate);

/**
 * @swagger
 * /api/v1/security/keys/{uuid}/public:
 *   get: { summary: Derive the authorized_keys line for a stored key, tags: [Security], responses: { 200: { description: OK }, 404: { description: Not found } } }
 */
router.get('/:uuid/public', validate({ params: uuidParam }), ctrl.publicKey);

router.get('/:uuid', validate({ params: uuidParam }), ctrl.get);
router.delete('/:uuid', validate({ params: uuidParam }), ctrl.remove);

export default router;
