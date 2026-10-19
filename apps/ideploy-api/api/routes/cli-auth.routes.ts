/**
 * The CLI's browser sign-in (see cli-auth.service.ts). `start` and `poll` are
 * public — the CLI has no token yet; seeing and answering a request needs the
 * developer's session.
 */
import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { CustomRequest } from '../interfaces/express.interface';
import { ok, fail, respondWithError } from '../utils/response';
import * as cliAuth from '../services/cli-auth.service';

const router = Router();
const webUrl = () => process.env.IDEPLOY_WEB_URL || 'http://localhost:4202';

/**
 * @swagger
 * /api/v1/cli/auth/start:
 *   post:
 *     summary: Start a CLI sign-in — returns the code to show and the page to open
 *     tags: [CLI]
 *     responses: { 200: { description: OK } }
 */
router.post('/start', async (req: CustomRequest, res: Response) => {
  try {
    ok(res, await cliAuth.startRequest(req.body?.host, webUrl()));
  } catch (err) {
    respondWithError(res, err, 'Starting the CLI sign-in');
  }
});

/**
 * @swagger
 * /api/v1/cli/auth/poll:
 *   post:
 *     summary: The CLI asks whether its sign-in was approved; the token is returned once
 *     tags: [CLI]
 *     responses: { 200: { description: OK } }
 */
router.post('/poll', async (req: CustomRequest, res: Response) => {
  try {
    ok(res, await cliAuth.pollRequest(req.body?.device_code));
  } catch (err) {
    respondWithError(res, err, 'Checking the CLI sign-in');
  }
});

/**
 * @swagger
 * /api/v1/cli/auth/requests/{code}:
 *   get:
 *     summary: A pending CLI sign-in, for the approval page
 *     tags: [CLI]
 *     responses: { 200: { description: OK }, 404: { description: Expired or unknown } }
 */
router.get('/requests/:code', authenticate, async (req: CustomRequest, res: Response) => {
  try {
    ok(res, await cliAuth.describeRequest(String(req.params.code)));
  } catch (err) {
    respondWithError(res, err, 'Reading the CLI sign-in');
  }
});

/**
 * @swagger
 * /api/v1/cli/auth/requests/{code}:
 *   post:
 *     summary: Approve (or deny) a CLI sign-in — approving issues a token for the caller
 *     tags: [CLI]
 *     responses: { 200: { description: OK } }
 */
router.post('/requests/:code', authenticate, async (req: CustomRequest, res: Response) => {
  if (!req.user?.currentTeamId) return fail(res, 'Choose a team first.', 422, 'NO_TEAM');
  try {
    await cliAuth.answerRequest(
      { id: req.user.id, currentTeamId: req.user.currentTeamId },
      String(req.params.code),
      req.body?.approve !== false
    );
    ok(res, { answered: true });
  } catch (err) {
    respondWithError(res, err, 'Answering the CLI sign-in');
  }
});

export default router;
