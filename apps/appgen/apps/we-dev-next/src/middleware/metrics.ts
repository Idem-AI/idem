import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create a Registry
const register = new client.Registry();

// Add default Node.js metrics
client.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
  labels: { service: 'idem-appgen' },
});

// HTTP request counter
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  registers: [register],
});

// HTTP request duration histogram
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Active connections gauge
const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  labelNames: ['service'] as const,
  registers: [register],
});

// ==================== MÉTRIQUES IA ====================
//
// Le module le plus consommateur de la plateforme n'avait AUCUNE mesure de son
// coût : `deductUserTokens` était une fonction vide, et l'estimation maison
// comptait chaque groupe d'espaces comme un token entier — surestimation lourde
// sur du code indenté. On relève désormais les compteurs RÉELS du fournisseur,
// exposés par le SDK dans `onFinish`.

export const aiTokensTotal = new client.Counter({
  name: 'ai_tokens_total',
  help: 'Tokens consumed by model calls',
  labelNames: ['model', 'kind', 'mode', 'service'] as const,
  registers: [register],
});

export const aiGenerationsTotal = new client.Counter({
  name: 'ai_generations_total',
  help: 'Model generations, by finish reason',
  labelNames: ['model', 'mode', 'finish_reason', 'service'] as const,
  registers: [register],
});

/** Étiquette `service` commune à ce processus. */
export const METRICS_SERVICE = 'idem-appgen';

/**
 * Normalize route paths to prevent cardinality explosion.
 */
function normalizeRoute(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/[0-9a-f]{24}/gi, ':id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/+/g, '/');
}

/**
 * Express middleware that records Prometheus metrics.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const service = 'idem-appgen';

  activeConnections.inc({ service });

  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const route = normalizeRoute(req.route?.path || req.path || 'unknown');
    const method = req.method;
    const statusCode = res.statusCode.toString();

    httpRequestsTotal.inc({ method, route, status_code: statusCode, service });
    httpRequestDuration.observe({ method, route, status_code: statusCode, service }, duration);
    activeConnections.dec({ service });
  });

  next();
}

export { register };
