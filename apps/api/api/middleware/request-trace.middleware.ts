import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger';
import { runWithTrace } from '../utils/trace.util';

/**
 * Ouvre le contexte de traçage de la requête (un requestId par requête HTTP)
 * et journalise son début/fin. C'est le point d'entrée de toute la
 * corrélation: tout ce qui est loggé plus loin dans la chaîne (auth, routes,
 * services IA, Chronicle, Coherence Guard) porte automatiquement ce
 * requestId — voir traceEnrichment dans config/logger.ts.
 *
 * L'ID est aussi renvoyé en en-tête `X-Request-Id`, pour que le frontend
 * puisse le logger côté client et faciliter le rapprochement support.
 */
export function requestTraceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  const startedAt = Date.now();
  const path = (req.originalUrl || req.url || '').split('?')[0];

  res.setHeader('X-Request-Id', requestId);

  runWithTrace({ requestId, method: req.method, path, startedAt }, () => {
    logger.info('http.request_start', {
      event: 'http.request_start',
      method: req.method,
      path,
    });

    res.on('finish', () => {
      logger.info('http.request_end', {
        event: 'http.request_end',
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  });
}
