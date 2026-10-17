import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../config/logger';
import { runWithTrace, TraceContext } from '../utils/trace.util';

/** Un identifiant reçu d'un autre service IDEM est repris s'il a une forme saine. */
const INCOMING_REQUEST_ID = /^[A-Za-z0-9._-]{8,80}$/;

/** Sondes appelées en boucle : journalisées en `debug` sauf si elles échouent. */
const QUIET_PATHS = new Set(['/health', '/metrics', '/favicon.ico']);

/** Corps d'une requête en échec, joint à la ligne de fin si `LOG_HTTP_ERROR_BODY=true`. */
const LOG_ERROR_BODY = process.env.LOG_HTTP_ERROR_BODY === 'true';

/**
 * Ouvre le contexte de traçage de la requête (un requestId par requête HTTP)
 * et journalise son début/fin. C'est le point d'entrée de toute la
 * corrélation: tout ce qui est loggé plus loin dans la chaîne (auth, routes,
 * services IA, Chronicle, Coherence Guard) porte automatiquement ce
 * requestId — voir traceEnrichment dans config/logger.ts.
 *
 * L'ID est aussi renvoyé en en-tête `X-Request-Id`, pour que le frontend
 * puisse le logger côté client et faciliter le rapprochement support. Un
 * `X-Request-Id` entrant (appel d'un autre service IDEM) est repris tel quel :
 * un seul identifiant suit alors la requête à travers les services.
 *
 * Niveau de la ligne de fin : `error` pour un 5xx, `warn` pour un 4xx — c'est
 * sur ces niveaux que portent les alertes Grafana.
 */
export function requestTraceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  const requestId = incoming && INCOMING_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  const startedAt = Date.now();
  const path = (req.originalUrl || req.url || '').split('?')[0];
  const quiet = QUIET_PATHS.has(path);

  res.setHeader('X-Request-Id', requestId);

  const context: TraceContext = { requestId, method: req.method, path, startedAt };

  runWithTrace(context, () => {
    logger.log(quiet ? 'debug' : 'info', 'http.request_start', {
      event: 'http.request_start',
      method: req.method,
      path,
      query: Object.keys(req.query ?? {}).length ? req.query : undefined,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      origin: req.get('origin'),
      referer: req.get('referer'),
      requestBytes: numberOrUndefined(req.get('content-length')),
      upstream: incoming ? 'propagated' : undefined,
    });

    let finished = false;
    const end = (event: 'http.request_end' | 'http.request_aborted') => {
      // L'événement 'finish' peut être émis hors du contexte asynchrone de la
      // requête : on le rouvre pour que requestId/userId/projectId suivent.
      runWithTrace(context, () => {
        const status = res.statusCode;
        const aborted = event === 'http.request_aborted';
        const lvl = status >= 500 ? 'error' : status >= 400 || aborted ? 'warn' : quiet ? 'debug' : 'info';
        logger.log(lvl, event, {
          event,
          method: req.method,
          path,
          route: routePattern(req),
          statusCode: status,
          statusClass: `${Math.floor(status / 100)}xx`,
          durationMs: Date.now() - startedAt,
          responseBytes: numberOrUndefined(res.getHeader('content-length')),
          ip: req.ip,
          userAgent: req.get('user-agent'),
          body: LOG_ERROR_BODY && status >= 400 ? req.body : undefined,
        });
      });
    };

    res.on('finish', () => {
      finished = true;
      end('http.request_end');
    });
    // Client parti avant la réponse (onglet fermé, flux SSE coupé, timeout du proxy).
    res.on('close', () => {
      if (!finished) end('http.request_aborted');
    });

    next();
  });
}

/** `/project/:projectId/branding` plutôt que l'URL réelle : regroupable dans Grafana. */
function routePattern(req: Request): string | undefined {
  const route = (req as Request & { route?: { path?: string } }).route?.path;
  return route ? `${req.baseUrl || ''}${route}` : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined && value !== null && value !== '' ? n : undefined;
}
