/** Fin de chaîne : route inconnue, erreurs non rattrapées (jamais de pile renvoyée au client). */
import { NextFunction, Request, Response } from 'express';
import logger from '../config/logger';
import { IdemGatewayError } from '../services/idem.client';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message || code);
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'not_found' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: any, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.code, message: error.message, ...(error.details || {}) });
    return;
  }
  if (error instanceof IdemGatewayError) {
    res.status(error.status === 402 ? 402 : 502).json(error.status === 402 ? error.body : { error: 'idem_unavailable', message: 'IDEM ne répond pas pour le moment.' });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'payload_too_large' });
    return;
  }
  logger.error('http.unhandled_error', { event: 'http.unhandled_error', path: req.path, error });
  res.status(500).json({ error: 'internal_error', message: 'Une erreur est survenue.' });
}

/** Un contrôleur asynchrone dont l'erreur rejoint le gestionnaire. */
export const asyncRoute =
  <T extends Request>(fn: (req: T, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req as T, res).catch(next);
  };
