import { Router, Request, Response } from 'express';
import { checkDbConnection } from '../config/db.config';
import redis from '../config/redis.config';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Liveness/readiness probe (DB + Redis)
 *     tags: [System]
 *     responses:
 *       200: { description: OK }
 *       503: { description: A dependency is down }
 */
router.get('/health', async (_req: Request, res: Response) => {
  const db = await checkDbConnection();
  let redisOk = false;
  try {
    redisOk = (await redis.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }
  const healthy = db && redisOk;
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: { db, redis: redisOk, service: 'ideploy-api' },
  });
});

export default router;
