/**
 * Clone credentials: a token the provider rejects is skipped (and dropped),
 * and git's own failure is explained in terms the user can act on.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tokens, disconnect, renewToken, get, query } = vi.hoisted(() => ({
  tokens: new Map<number, string>(),
  disconnect: vi.fn(),
  renewToken: vi.fn(),
  get: vi.fn(),
  query: vi.fn(),
}));
vi.mock('../../../api/config/db.config', () => ({ default: { query } }));
vi.mock('../../../api/services/github.service', () => ({
  getToken: async (userId: number) => tokens.get(userId) ?? null,
  renewToken,
  disconnect,
}));
vi.mock('axios', () => ({ default: { get } }));

import { explainGitFailure, resolveGitCredential } from '../../../api/services/git-credentials.service';

beforeEach(() => {
  tokens.clear();
  disconnect.mockReset();
  renewToken.mockReset();
  renewToken.mockResolvedValue(null);
  get.mockReset();
  query.mockResolvedValue({ rows: [{ user_id: 1 }, { user_id: 2 }] });
});

describe('resolveGitCredential', () => {
  it('skips a token GitHub rejects, drops it, and uses the next member\'s', async () => {
    tokens.set(1, 'revoked');
    tokens.set(2, 'good');
    get.mockImplementation(async (_url: string, opts: { headers: { Authorization: string } }) => ({
      status: opts.headers.Authorization === 'Bearer good' ? 200 : 401,
    }));

    const credential = await resolveGitCredential(7, 'https://github.com/Ebolo1/wegift-backend.git');

    expect(credential?.token).toBe('good');
    expect(credential?.authenticatedUrl).toContain('x-access-token:good@github.com');
    expect(disconnect).toHaveBeenCalledWith(1);
  });

  it('returns nothing when every token is rejected', async () => {
    tokens.set(1, 'revoked');
    get.mockResolvedValue({ status: 401 });

    expect(await resolveGitCredential(7, 'https://github.com/a/b.git')).toBeNull();
  });
});

describe('resolveGitCredential — expired tokens', () => {
  it('renews an expired token instead of dropping it', async () => {
    tokens.set(1, 'expired');
    renewToken.mockResolvedValue('renewed');
    get.mockImplementation(async (_url: string, opts: { headers: { Authorization: string } }) => ({
      status: opts.headers.Authorization === 'Bearer renewed' ? 200 : 401,
    }));

    const credential = await resolveGitCredential(7, 'https://github.com/a/b.git');

    expect(credential?.token).toBe('renewed');
    expect(disconnect).not.toHaveBeenCalled();
  });
});

describe('explainGitFailure', () => {
  const raw =
    "remote: Invalid username or token. Password authentication is not supported for Git operations.\nfatal: Authentication failed for 'https://github.com/Ebolo1/wegift-backend.git/'";

  it('tells a team with no connected account to connect one', () => {
    expect(explainGitFailure(raw, false)).toMatch(/no GitHub\/GitLab account is connected/);
    expect(explainGitFailure('fatal: could not read Username for https://github.com', false)).toMatch(/no GitHub\/GitLab account/);
  });

  it('tells a team whose account was refused that this account cannot read the repository', () => {
    expect(explainGitFailure(raw, true)).toMatch(/connected GitHub\/GitLab account cannot read/);
  });
});
