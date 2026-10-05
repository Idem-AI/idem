/**
 * OAuth tokens stored with what renews them.
 */
import { describe, expect, it } from 'vitest';
import { fromOAuthResponse, needsRenewal, parseStored } from '../../../api/services/oauth-token-store.service';

describe('fromOAuthResponse', () => {
  it('keeps the refresh token and turns expires_in into a date', () => {
    const t = fromOAuthResponse({ access_token: 'a', refresh_token: 'r', expires_in: 7200 }, 1_000_000);
    expect(t).toEqual({ access: 'a', refresh: 'r', expiresAt: 1_000_000 + 7_200_000 });
  });

  it('refuses a response without an access token', () => {
    expect(fromOAuthResponse({ error: 'bad_verification_code' })).toBeNull();
  });
});

describe('parseStored', () => {
  it('reads what is written now, and the bare token written before', () => {
    expect(parseStored('{"access":"a","refresh":"r","expiresAt":5}')).toEqual({ access: 'a', refresh: 'r', expiresAt: 5 });
    expect(parseStored('gho_legacyToken')).toEqual({ access: 'gho_legacyToken' });
  });
});

describe('needsRenewal', () => {
  const now = 10_000_000;
  it('renews a token about to expire, never one without a refresh token or an expiry', () => {
    expect(needsRenewal({ access: 'a', refresh: 'r', expiresAt: now + 60_000 }, now)).toBe(true);
    expect(needsRenewal({ access: 'a', refresh: 'r', expiresAt: now + 3_600_000 }, now)).toBe(false);
    expect(needsRenewal({ access: 'a', expiresAt: now }, now)).toBe(false);
    expect(needsRenewal({ access: 'a', refresh: 'r' }, now)).toBe(false);
  });
});
