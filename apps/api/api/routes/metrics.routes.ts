import { Router, Request, Response } from 'express';
import { register } from '../config/metrics';
import { safeEqual } from '../utils/safe-equal.util';

const metricsRouter = Router();

/**
 * GET /metrics
 * Prometheus scrape endpoint.
 * Returns all collected metrics in Prometheus text exposition format.
 */
metricsRouter.get('/', async (req: Request, res: Response) => {
  // Si `METRICS_TOKEN` est défini, Prometheus doit présenter
  // `Authorization: Bearer <token>`. Sans lui, l'endpoint reste ouvert (réseau
  // interne) — à ne pas exposer publiquement via le proxy.
  const expected = process.env.METRICS_TOKEN;
  if (expected) {
    const header = req.headers.authorization ?? '';
    const given = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!given || !safeEqual(given, expected)) {
      res.status(401).end('Unauthorized');
      return;
    }
  }

  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end('Error collecting metrics');
  }
});

export default metricsRouter;
