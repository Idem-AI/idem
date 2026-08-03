/**
 * Contract tests for the authentication boundary.
 *
 * These exercise the real Express stack — middleware order, error envelope,
 * status codes — with no credentials, no database rows and no network. If this
 * suite ever goes green on a route that should be protected, we have shipped an
 * open endpoint.
 */
import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../api/app';
import { closeInfrastructure } from '../helpers/teardown';

const app = createApp();

afterAll(async () => {
  await closeInfrastructure();
});

/** One representative route per mounted router that requires a session. */
const PROTECTED_ROUTES: Array<[method: 'get' | 'post', path: string]> = [
  ['get', '/api/v1/servers'],
  ['get', '/api/v1/workspaces'],
  ['get', '/api/v1/applications'],
  ['get', '/api/v1/databases'],
  ['get', '/api/v1/services'],
  ['get', '/api/v1/tags'],
  ['get', '/api/v1/team'],
  ['get', '/api/v1/security/keys'],
  ['get', '/api/v1/subscription'],
  ['get', '/api/v1/me'],
  ['get', '/api/v1/resources'],
  ['post', '/api/v1/deploy'],
];

describe('unauthenticated access', () => {
  it.each(PROTECTED_ROUTES)('rejects %s %s with 401', async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'UNAUTHENTICATED' },
    });
  });

  it('rejects a malformed bearer token rather than treating it as anonymous', async () => {
    const res = await request(app)
      .get('/api/v1/servers')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
  });

  it('never leaks a stack trace in the error envelope', async () => {
    const res = await request(app).get('/api/v1/servers');

    expect(JSON.stringify(res.body)).not.toMatch(/\bat .+:\d+:\d+/);
    expect(res.body.error).not.toHaveProperty('stack');
  });
});

describe('unknown routes', () => {
  it('answers 404 in the standard envelope outside the authenticated API', async () => {
    const res = await request(app).get('/no-such-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('answers 401 — not 404 — for unknown paths under /api/v1', async () => {
    // Deliberate: the routers mounted on /api/v1 apply `authenticate` to their
    // whole mount point, so an anonymous caller cannot probe which endpoints
    // exist. Enumerating the API surface is a reconnaissance step; keep it shut.
    const res = await request(app).get('/api/v1/no-such-endpoint');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('push-to-deploy webhooks', () => {
  // A git host cannot present a session, so this endpoint must be reachable
  // anonymously — its signature check is the authorisation. Several routers are
  // mounted on the bare `/api/v1` prefix and guard everything beneath it, so the
  // webhook router has to be registered before them. This test is what stops a
  // later reordering from silently turning every delivery into a 401.
  it('is reachable without a session', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/github/some-app-uuid')
      .send({ ref: 'refs/heads/main' });

    expect(res.status).not.toBe(401);
    expect(res.body?.error?.code).not.toBe('UNAUTHENTICATED');
  });

  it('refuses an unsigned delivery', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/github/some-app-uuid')
      .send({ ref: 'refs/heads/main' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('answers identically for an unknown application and a bad signature', async () => {
    // Distinguishing the two would let anyone enumerate which uuids exist.
    const unknown = await request(app)
      .post('/api/v1/webhooks/github/definitely-not-an-app')
      .send({ ref: 'refs/heads/main' });
    const badSignature = await request(app)
      .post('/api/v1/webhooks/github/some-app-uuid')
      .set('X-Hub-Signature-256', 'sha256=deadbeef')
      .send({ ref: 'refs/heads/main' });

    expect(unknown.status).toBe(badSignature.status);
    expect(unknown.body.error.code).toBe(badSignature.body.error.code);
  });

  it('rejects a provider it does not support', async () => {
    const res = await request(app).post('/api/v1/webhooks/notaprovider/x').send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('still guards the authenticated webhook management routes', async () => {
    const res = await request(app).get('/api/v1/applications/x/webhooks/github');

    expect(res.status).toBe(401);
  });
});

describe('security headers', () => {
  it('does not advertise the framework', async () => {
    const res = await request(app).get('/api/v1/servers');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  it('sets the hardening headers helmet is there for', async () => {
    const res = await request(app).get('/api/v1/servers');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers).toHaveProperty('x-frame-options');
  });
});
