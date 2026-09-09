import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default Node.js metrics (event loop lag, heap size, GC, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
  labels: { service: 'idem-api' },
});

// ==================== CUSTOM METRICS ====================

// HTTP request counter
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  registers: [register],
});

// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// HTTP request size
export const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route', 'service'] as const,
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

// HTTP response size
export const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

// Active connections gauge
export const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  labelNames: ['service'] as const,
  registers: [register],
});

// Error counter by type
export const errorsTotal = new client.Counter({
  name: 'app_errors_total',
  help: 'Total number of application errors',
  labelNames: ['type', 'service'] as const,
  registers: [register],
});

// Database operation duration
export const dbOperationDuration = new client.Histogram({
  name: 'db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'collection', 'service'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// ==================== MÉTRIQUES IA ====================
//
// Les données existaient déjà (`AiUsageEvent` en base, `ai-trace.log`), mais pas
// à un endroit où une alerte peut les lire. Quatre séries suffisent à piloter
// les trois axes du produit — qualité, vitesse, coût — et elles sont toutes
// alimentées depuis un point unique : `aiUsageService.record`.

/** Latence d'un appel modèle. `tier` distingue XS/M/S, `status` succès/échec. */
export const aiCallDuration = new client.Histogram({
  name: 'ai_call_duration_seconds',
  help: 'Duration of a model call in seconds',
  labelNames: ['provider', 'model', 'prompt_type', 'status', 'service'] as const,
  // Bornes larges : une classification tient en 1 s, une page HTML complète en
  // dépasse 60. Un histogramme trop serré écraserait justement ce qu'on veut voir.
  buckets: [0.5, 1, 2, 5, 10, 20, 40, 80, 160],
  registers: [register],
});

/**
 * Tokens consommés. `kind` vaut `input`, `output` ou `cached` — c'est ce
 * dernier qui mesure l'efficacité du cache de préfixe, indépendamment de sa
 * tarification.
 */
export const aiTokensTotal = new client.Counter({
  name: 'ai_tokens_total',
  help: 'Tokens consumed by model calls',
  labelNames: ['provider', 'model', 'kind', 'service'] as const,
  registers: [register],
});

/** Coût estimé, ventilé par fonctionnalité — le fil à tirer quand la facture monte. */
export const aiCostUsdTotal = new client.Counter({
  name: 'ai_cost_usd_total',
  help: 'Estimated cost of model calls, in USD',
  labelNames: ['provider', 'model', 'feature', 'service'] as const,
  registers: [register],
});

/**
 * Issue qualité d'un appel : `ok`, `error`, `escalated`, `repaired`, `flagged`,
 * `fallback`. C'est la série qui dit si la baisse d'étage tient — une hausse
 * de `escalated` après un dépinglage désigne exactement les sections où le
 * rendu déterministe ne suffit pas encore.
 */
export const aiOutcomeTotal = new client.Counter({
  name: 'ai_outcome_total',
  help: 'Quality outcome of model calls',
  labelNames: ['outcome', 'prompt_type', 'service'] as const,
  registers: [register],
});

export { register };
export default register;
