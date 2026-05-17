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

export { register };
export default register;
