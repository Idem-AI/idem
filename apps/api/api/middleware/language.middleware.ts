import { Request, Response, NextFunction } from 'express';
import { normalizeLanguage, runWithLanguage } from '../utils/request-language';

/**
 * Resolve the user's UI language for the request and expose it two ways:
 *  - `req.language` (typed on CustomRequest) for direct access in controllers;
 *  - an AsyncLocalStorage context so PromptService (and any downstream service)
 *    can read it without threading the value through every call.
 *
 * Resolution priority: `?lang=` query > `language` body field > Accept-Language
 * header > default 'en'.
 */
export function languageMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const fromQuery = typeof req.query.lang === 'string' ? req.query.lang : undefined;
  const fromBody =
    req.body && typeof req.body.language === 'string' ? (req.body.language as string) : undefined;
  const headerValue = req.headers['accept-language'];
  const fromHeader = typeof headerValue === 'string' ? headerValue.split(',')[0] : undefined;

  const language = normalizeLanguage(fromQuery || fromBody || fromHeader);
  (req as Request & { language?: string }).language = language;

  runWithLanguage(language, () => next());
}
