import { Router, Request, Response } from 'express';
import { register } from '../config/metrics';

const metricsRouter = Router();

/**
 * GET /metrics
 * Prometheus scrape endpoint.
 * Returns all collected metrics in Prometheus text exposition format.
 */
metricsRouter.get('/', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end('Error collecting metrics');
  }
});

export default metricsRouter;
