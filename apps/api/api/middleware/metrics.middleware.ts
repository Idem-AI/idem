import { Request, Response, NextFunction } from 'express';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  activeConnections,
} from '../config/metrics';

/**
 * Normalize route paths for consistent metric labels.
 * Replaces dynamic segments (UUIDs, ObjectIDs, numeric IDs) with placeholders.
 */
function normalizeRoute(path: string): string {
  return path
    // Replace UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace MongoDB ObjectIDs (24 hex chars)
    .replace(/[0-9a-f]{24}/gi, ':id')
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Collapse multiple slashes
    .replace(/\/+/g, '/');
}

/**
 * Express middleware that records Prometheus metrics for every HTTP request.
 * Tracks: request count, duration, request/response sizes, active connections.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const service = 'idem-api';

  // Track active connections
  activeConnections.inc({ service });

  // Capture response metrics when the response finishes
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const route = normalizeRoute(req.route?.path || req.path || 'unknown');
    const method = req.method;
    const statusCode = res.statusCode.toString();

    // Record metrics
    httpRequestsTotal.inc({ method, route, status_code: statusCode, service });
    httpRequestDuration.observe({ method, route, status_code: statusCode, service }, duration);

    // Request size
    const reqSize = parseInt(req.headers['content-length'] || '0', 10);
    if (reqSize > 0) {
      httpRequestSize.observe({ method, route, service }, reqSize);
    }

    // Response size
    const resSize = parseInt(res.getHeader('content-length')?.toString() || '0', 10);
    if (resSize > 0) {
      httpResponseSize.observe({ method, route, status_code: statusCode, service }, resSize);
    }

    // Decrement active connections
    activeConnections.dec({ service });
  });

  next();
}
