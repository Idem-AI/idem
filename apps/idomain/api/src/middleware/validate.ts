/** Validation déclarative des entrées (zod) : un 422 avec le détail par champ. */
import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';

export function validate(schemas: { body?: ZodType; query?: ZodType; params?: ZodType }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const parsed = schema.safeParse(req[part]);
      if (!parsed.success) {
        res.status(422).json({ error: 'invalid_input', part, issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
        return;
      }
      if (part === 'body') req.body = parsed.data;
      else Object.assign(req[part], parsed.data);
    }
    next();
  };
}
