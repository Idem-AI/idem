/**
 * Declarative request validation.
 *
 * Replaces the hand-rolled `if (!req.body?.name) return fail(...)` checks that
 * were scattered across controllers: easy to forget, impossible to type, and
 * inconsistent in what they returned. A schema per route gives us one source of
 * truth for both the runtime check and the TypeScript type of the payload.
 *
 * Usage:
 *   const createServer = z.object({ name: z.string().min(1), ip: z.string().ip() });
 *   router.post('/', validate({ body: createServer }), ctrl.createServer);
 *
 *   // in the controller, the body is already validated and coerced:
 *   type Body = z.infer<typeof createServer>;
 *
 * Validated values *replace* `req.body` / `req.query` / `req.params`, so
 * coercions (string → number for query params, trimming, defaults) reach the
 * controller rather than being re-done there.
 */
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, ZodType } from 'zod';
import { FieldError, failValidation } from '../utils/response';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Flatten Zod issues into the API's field-error shape. */
function toFieldErrors(error: ZodError, source: keyof ValidationSchemas): FieldError[] {
  return error.issues.map((issue) => ({
    path: [source, ...issue.path.map(String)].join('.'),
    message: issue.message,
  }));
}

/**
 * Validate any combination of body, query and params. Reports every problem
 * across all three at once — a form should not have to be submitted three times
 * to discover three mistakes.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  const sources = Object.keys(schemas) as Array<keyof ValidationSchemas>;

  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: FieldError[] = [];
    const parsed: Partial<Record<keyof ValidationSchemas, unknown>> = {};

    for (const source of sources) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source]);
      if (result.success) {
        parsed[source] = result.data;
      } else {
        errors.push(...toFieldErrors(result.error, source));
      }
    }

    if (errors.length > 0) {
      failValidation(res, errors);
      return;
    }

    // Assigning through `Object.assign` keeps Express's own getters intact on
    // `query`/`params`, which are not plain writable properties in Express 5.
    for (const source of sources) {
      if (!(source in parsed)) continue;
      const value = parsed[source];
      if (source === 'body') {
        req.body = value;
      } else if (value && typeof value === 'object') {
        Object.assign(req[source], value);
      }
    }

    next();
  };
}
