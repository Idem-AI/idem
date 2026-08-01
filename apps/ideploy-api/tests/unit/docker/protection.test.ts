/**
 * Proxy-native protections: geo-blocking, rate limiting, concurrency.
 *
 * The bug this module exists to prevent is silent: a Traefik plugin option
 * spelled in the wrong case does not error, it loads a middleware with its
 * default settings — which for `geoblock` means no country list, and for the
 * bouncer (a different plugin, PascalCase) meant no LAPI. Every assertion here
 * is against the literal label string, not a parsed re-interpretation of it,
 * because a re-interpretation would forgive the exact mistake being guarded
 * against.
 */
import { describe, expect, it } from 'vitest';
import {
  concurrencyLabels,
  concurrencyMiddlewareName,
  geoBlockLabels,
  geoBlockMiddlewareName,
  geoBlockStaticFlags,
  GEOBLOCK_MODULE,
  rateLimitLabels,
  rateLimitMiddlewareName,
} from '../../../api/docker/protection';

const UUID = 'app-1234';

describe('geoBlockLabels', () => {
  it('inverts the list to a block-list, or it would allow only the named countries', () => {
    const labels = geoBlockLabels(UUID, { blockedCountries: ['RU'] });

    expect(labels).toContain(
      `traefik.http.middlewares.${geoBlockMiddlewareName(UUID)}.plugin.geoblock.blackListMode=true`
    );
  });

  it('lists each country under its own indexed key, upper-cased', () => {
    const labels = geoBlockLabels(UUID, { blockedCountries: ['ru', 'cn'] });

    expect(labels).toContain(
      `traefik.http.middlewares.${geoBlockMiddlewareName(UUID)}.plugin.geoblock.countries[0]=RU`
    );
    expect(labels).toContain(
      `traefik.http.middlewares.${geoBlockMiddlewareName(UUID)}.plugin.geoblock.countries[1]=CN`
    );
  });

  it('fails open on a lookup timeout or API error', () => {
    // A lookup provider we do not run is not allowed to take every geo-protected
    // site on the platform down with it.
    const labels = geoBlockLabels(UUID, { blockedCountries: ['RU'] });

    expect(labels).toContain(
      `traefik.http.middlewares.${geoBlockMiddlewareName(UUID)}.plugin.geoblock.ignoreAPITimeout=true`
    );
    expect(labels).toContain(
      `traefik.http.middlewares.${geoBlockMiddlewareName(UUID)}.plugin.geoblock.ignoreAPIFailures=true`
    );
  });

  it('allows local requests and unknown countries, so the platform’s own probes are not geo-filtered', () => {
    const labels = geoBlockLabels(UUID, { blockedCountries: ['RU'] });

    expect(labels).toContain(
      `traefik.http.middlewares.${geoBlockMiddlewareName(UUID)}.plugin.geoblock.allowLocalRequests=true`
    );
    expect(labels).toContain(
      `traefik.http.middlewares.${geoBlockMiddlewareName(UUID)}.plugin.geoblock.allowUnknownCountries=true`
    );
  });

  it('excludes the given path patterns under their own indexed key', () => {
    const labels = geoBlockLabels(UUID, {
      blockedCountries: ['RU'],
      excludedPaths: ['/healthz'],
    });

    expect(labels).toContain(
      `traefik.http.middlewares.${geoBlockMiddlewareName(UUID)}.plugin.geoblock.excludedPathPatterns[0]=/healthz`
    );
  });

  it('names the middleware after the application, so two applications never collide', () => {
    expect(geoBlockMiddlewareName('a')).not.toBe(geoBlockMiddlewareName('b'));
  });
});

describe('geoBlockStaticFlags', () => {
  it('declares the plugin module Traefik must load at start-up', () => {
    const flags = geoBlockStaticFlags();

    expect(flags.some((f) => f.includes(GEOBLOCK_MODULE))).toBe(true);
    expect(flags.some((f) => f.startsWith('--experimental.plugins.geoblock.modulename='))).toBe(true);
  });
});

describe('rateLimitLabels', () => {
  it('sets the average and a burst above it, so one page load is not refused', () => {
    // Traefik's own default burst is 1, which blocks the second of two
    // simultaneous requests — including the parallel asset loads of one visit.
    const labels = rateLimitLabels(UUID, { averagePerSecond: 5 });

    expect(labels).toContain(`traefik.http.middlewares.${rateLimitMiddlewareName(UUID)}.ratelimit.average=5`);
    const burst = labels.find((l) => l.endsWith('.ratelimit.burst=10'));
    expect(burst).toBeDefined();
  });

  it('honours an explicit burst over the derived default', () => {
    const labels = rateLimitLabels(UUID, { averagePerSecond: 5, burst: 50 });

    expect(labels).toContain(`traefik.http.middlewares.${rateLimitMiddlewareName(UUID)}.ratelimit.burst=50`);
  });

  it('keys the bucket by client address at the given forwarded-header depth', () => {
    // Keying on the proxy's own address instead would put every visitor in one
    // bucket, so the first busy moment locks out the whole world.
    const labels = rateLimitLabels(UUID, { averagePerSecond: 5 }, 2);

    expect(labels).toContain(
      `traefik.http.middlewares.${rateLimitMiddlewareName(UUID)}.ratelimit.sourceCriterion.ipStrategy.depth=2`
    );
  });
});

describe('concurrencyLabels', () => {
  it('sets the in-flight cap', () => {
    const labels = concurrencyLabels(UUID, { maxInFlight: 20 });

    expect(labels).toContain(
      `traefik.http.middlewares.${concurrencyMiddlewareName(UUID)}.inflightreq.amount=20`
    );
  });

  it('names a middleware distinct from the rate limiter', () => {
    expect(concurrencyMiddlewareName(UUID)).not.toBe(rateLimitMiddlewareName(UUID));
  });
});
