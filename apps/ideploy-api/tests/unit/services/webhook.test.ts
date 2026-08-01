/**
 * Push-to-deploy verification and triggering.
 *
 * This endpoint cannot be session-authenticated — a git host has no cookie — so
 * the signature check *is* the authorisation. A weakness here is remote code
 * deployment by an unauthenticated caller, which is why the cases below dwell on
 * rejection rather than on the happy path.
 */
import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import {
  decideWebhookAction,
  parsePushEvent,
  safeEqual,
  verifyHmacSignature,
  verifySharedToken,
  WebhookTarget,
} from '../../../api/services/webhook.service';

const SECRET = 'a-very-secret-value';

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function target(overrides: Partial<WebhookTarget> = {}): WebhookTarget {
  return {
    applicationId: 1,
    applicationUuid: 'app-uuid',
    name: 'my-app',
    teamId: 1,
    gitBranch: 'main',
    autoDeployEnabled: true,
    secret: SECRET,
    ...overrides,
  };
}

describe('safeEqual', () => {
  it('accepts identical values', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });

  it('rejects different values of the same length', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  it('rejects different lengths without throwing', () => {
    // `timingSafeEqual` throws on a length mismatch; that must never surface as
    // a 500, which would itself disclose the secret's length.
    expect(() => safeEqual('short', 'much-longer-value')).not.toThrow();
    expect(safeEqual('short', 'much-longer-value')).toBe(false);
  });

  it('rejects the empty string against a real secret', () => {
    expect(safeEqual('', SECRET)).toBe(false);
  });
});

describe('verifyHmacSignature', () => {
  const body = '{"ref":"refs/heads/main"}';

  it('accepts a correct signature', () => {
    expect(verifyHmacSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('accepts a signature sent without the sha256= prefix', () => {
    const bare = sign(body).replace('sha256=', '');
    expect(verifyHmacSignature(body, bare, SECRET)).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyHmacSignature(body, sign(body, 'wrong-secret'), SECRET)).toBe(false);
  });

  it('rejects a signature for a different body', () => {
    // The exact case a replay with a tampered payload would produce.
    expect(verifyHmacSignature('{"ref":"refs/heads/evil"}', sign(body), SECRET)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyHmacSignature(body, undefined, SECRET)).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(verifyHmacSignature(body, sign(body), '')).toBe(false);
  });

  it('verifies over the raw bytes, not a re-serialised object', () => {
    // Re-serialising changes whitespace and key order, so an implementation that
    // hashed `JSON.stringify(req.body)` would reject every genuine delivery.
    const raw = Buffer.from('{"ref":"refs/heads/main",  "extra": 1}');
    expect(verifyHmacSignature(raw, sign(raw.toString()), SECRET)).toBe(true);
  });
});

describe('verifySharedToken', () => {
  it('accepts the exact token GitLab sends', () => {
    expect(verifySharedToken(SECRET, SECRET)).toBe(true);
  });

  it('rejects a wrong or missing token', () => {
    expect(verifySharedToken('nope', SECRET)).toBe(false);
    expect(verifySharedToken(undefined, SECRET)).toBe(false);
  });
});

describe('parsePushEvent', () => {
  it('reads the branch from a GitHub push', () => {
    expect(parsePushEvent('github', { ref: 'refs/heads/main' }).branch).toBe('main');
  });

  it('handles a branch name containing slashes', () => {
    expect(parsePushEvent('github', { ref: 'refs/heads/feature/login' }).branch).toBe(
      'feature/login'
    );
  });

  it('ignores tag pushes, which are not branch events', () => {
    expect(parsePushEvent('github', { ref: 'refs/tags/v1.0.0' }).branch).toBeNull();
  });

  it('collects the files a push touched, de-duplicated', () => {
    const event = parsePushEvent('github', {
      ref: 'refs/heads/main',
      commits: [
        { added: ['a.ts'], modified: ['b.ts'], removed: [] },
        { added: [], modified: ['b.ts'], removed: ['c.ts'] },
      ],
    });

    expect(event.changedFiles.sort()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('reads Bitbucket’s nested branch shape', () => {
    const event = parsePushEvent('bitbucket', {
      push: { changes: [{ new: { type: 'branch', name: 'main' } }] },
    });

    expect(event.branch).toBe('main');
  });

  it('ignores a Bitbucket tag push', () => {
    const event = parsePushEvent('bitbucket', {
      push: { changes: [{ new: { type: 'tag', name: 'v1.0.0' } }] },
    });

    expect(event.branch).toBeNull();
  });

  it('survives an unexpected payload shape', () => {
    // A provider changing its format must not crash the endpoint.
    expect(parsePushEvent('github', {}).branch).toBeNull();
    expect(parsePushEvent('bitbucket', {}).branch).toBeNull();
  });
});

describe('decideWebhookAction', () => {
  const push = { branch: 'main', changedFiles: [] };

  it('deploys a push to the tracked branch', () => {
    expect(decideWebhookAction(target(), push).deploy).toBe(true);
  });

  it('ignores a push to another branch, saying which', () => {
    const decision = decideWebhookAction(target(), { branch: 'develop', changedFiles: [] });

    expect(decision.deploy).toBe(false);
    expect(decision.reason).toContain('develop');
    expect(decision.reason).toContain('main');
  });

  it('respects the automatic deployment switch', () => {
    const decision = decideWebhookAction(target({ autoDeployEnabled: false }), push);

    expect(decision.deploy).toBe(false);
    expect(decision.reason).toMatch(/turned off/i);
  });

  it('ignores an event with no branch', () => {
    expect(decideWebhookAction(target(), { branch: null, changedFiles: [] }).deploy).toBe(false);
  });

  it('tracks a non-default branch when the application says so', () => {
    const decision = decideWebhookAction(target({ gitBranch: 'production' }), {
      branch: 'production',
      changedFiles: [],
    });

    expect(decision.deploy).toBe(true);
  });
});

describe('trigger wiring', () => {
  it('does not call the deployment trigger for an ignored event', async () => {
    // Cheap to get wrong, expensive in production: every branch push would
    // deploy the tracked branch.
    const trigger = vi.fn();
    const decision = decideWebhookAction(target(), { branch: 'other', changedFiles: [] });

    if (decision.deploy) await trigger();

    expect(trigger).not.toHaveBeenCalled();
  });
});
