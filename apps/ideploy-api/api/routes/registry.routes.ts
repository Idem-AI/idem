import { Response, Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTeam } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, respondWithError } from '../utils/response';
import * as registry from '../services/registry-credentials.service';

const router = Router();
router.use(authenticate, requireTeam);

const credential = z.object({
  registry: z.string().trim().min(1).max(255),
  username: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(2000),
});

/**
 * @swagger
 * /api/v1/registry-credentials:
 *   get: { summary: Logins to private image registries (tokens are never returned), tags: [Registry], responses: { 200: { description: OK } } }
 *   post: { summary: Save the login for a registry, replacing an existing one, tags: [Registry], responses: { 201: { description: Saved } } }
 */
router.get('/', async (req: CustomRequest, res: Response) => {
  try {
    ok(res, await registry.listRegistryCredentials(req.user!.currentTeamId!));
  } catch (err) {
    respondWithError(res, err, 'Listing the registry logins');
  }
});

router.post('/', validate({ body: credential }), async (req: CustomRequest, res: Response) => {
  try {
    ok(res, await registry.saveRegistryCredential(req.user!.currentTeamId!, req.body), 201);
  } catch (err) {
    respondWithError(res, err, 'Saving the registry login');
  }
});

router.delete('/:id', async (req: CustomRequest, res: Response) => {
  try {
    await registry.deleteRegistryCredential(req.user!.currentTeamId!, Number(req.params.id));
    ok(res, { deleted: true });
  } catch (err) {
    respondWithError(res, err, 'Deleting the registry login');
  }
});

export default router;
