import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../../api/middleware/validate.middleware';
import { createPrivateKeySchema } from '../../../api/routes/private-key.routes';

interface Captured {
  status?: number;
  payload?: {
    success: boolean;
    error: { code: string; message: string; details: Array<{ path: string; message: string }> };
  };
}

/** Minimal Express doubles: enough for a middleware, nothing more. */
function harness(req: Partial<Request>) {
  const captured: Captured = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: unknown) {
      captured.payload = payload as Captured['payload'];
      return this;
    },
  } as unknown as Response;

  const next = vi.fn() as unknown as NextFunction;
  const request = { body: {}, query: {}, params: {}, ...req } as Request;

  return { request, res, next: next as NextFunction & { mock: { calls: unknown[] } }, captured };
}

describe('validate', () => {
  it('calls next when the payload is valid', () => {
    const { request, res, next } = harness({ body: { name: 'ok' } });

    validate({ body: z.object({ name: z.string() }) })(request, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects with 422 and does not call next', () => {
    const { request, res, next, captured } = harness({ body: {} });

    validate({ body: z.object({ name: z.string() }) })(request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.status).toBe(422);
    expect(captured.payload?.error.code).toBe('VALIDATION');
  });

  it('reports every invalid field at once, prefixed by its source', () => {
    const { request, res, captured, next } = harness({
      body: { name: '' },
      params: {},
    });

    validate({
      body: z.object({ name: z.string().min(1) }),
      params: z.object({ uuid: z.string().min(1) }),
    })(request, res, next);

    const paths = captured.payload?.error.details.map((d) => d.path) ?? [];
    expect(paths).toContain('body.name');
    expect(paths).toContain('params.uuid');
  });

  it('passes coerced and trimmed values through to the handler', () => {
    const { request, res, next } = harness({ body: { name: '  padded  ', count: '42' } });

    validate({
      body: z.object({ name: z.string().trim(), count: z.coerce.number() }),
    })(request, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.body).toEqual({ name: 'padded', count: 42 });
  });

  it('leaves query and params object identity intact while merging values', () => {
    // Express 5 exposes `query`/`params` through getters; replacing them
    // outright breaks downstream middleware, so we merge in place.
    const { request, res, next } = harness({ params: { uuid: 'abc' } });
    const before = request.params;

    validate({ params: z.object({ uuid: z.string() }) })(request, res, next);

    expect(request.params).toBe(before);
    expect(request.params.uuid).toBe('abc');
  });

  it('only validates the sources it was given', () => {
    const { request, res, next } = harness({ body: { name: 'ok' }, query: { anything: 'goes' } });

    validate({ body: z.object({ name: z.string() }) })(request, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.query).toEqual({ anything: 'goes' });
  });
});

describe('createPrivateKeySchema', () => {
  const valid = {
    name: 'deploy key',
    private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----',
  };

  it('accepts a well-formed PEM key', () => {
    expect(createPrivateKeySchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a key that is not a PEM block, with an actionable message', () => {
    const result = createPrivateKeySchema.safeParse({ ...valid, private_key: 'ssh-rsa AAAAB3Nz...' });

    expect(result.success).toBe(false);
    // A user pasting a *public* key is the common mistake; the message has to
    // tell them what to paste instead.
    expect(result.error?.issues[0].message).toMatch(/full PEM block/i);
  });

  it('rejects a blank name', () => {
    expect(createPrivateKeySchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('rejects a name longer than the column allows', () => {
    expect(createPrivateKeySchema.safeParse({ ...valid, name: 'x'.repeat(256) }).success).toBe(false);
  });
});
