/**
 * Proxy label generation.
 *
 * These labels are the difference between "the container is running" and "the
 * site works". Every assertion here corresponds to a way an application can end
 * up unreachable, or reachable when it should not be — a missing HTTP router, a
 * certificate resolver that never fires, a basic-auth password emitted in clear.
 */
import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  caddyLabels,
  decodeCustomLabels,
  defaultLabels,
  extractMiddlewareNames,
  parseDomain,
  slug,
  traefikLabels,
} from '../../../api/docker/labels';

/** Value of a `key=value` label, or undefined when absent. */
function valueOf(labels: string[], key: string): string | undefined {
  const found = labels.find((l) => l.startsWith(`${key}=`));
  return found?.slice(key.length + 1);
}

const base = { uuid: 'app123', domains: ['https://shop.example.com'] };

describe('parseDomain', () => {
  it('splits scheme, host, path and port', () => {
    expect(parseDomain('https://shop.example.com:8443/api')).toEqual({
      scheme: 'https',
      host: 'shop.example.com',
      path: '/api',
      port: 8443,
    });
  });

  it('defaults the path to the root', () => {
    expect(parseDomain('https://shop.example.com')?.path).toBe('/');
  });

  it('accepts a bare hostname, which is how people usually type it', () => {
    expect(parseDomain('shop.example.com')).toMatchObject({
      scheme: 'http',
      host: 'shop.example.com',
    });
  });

  it('upgrades an http domain to https when force-HTTPS is on', () => {
    // Otherwise the HTTPS router is never generated and the redirect points nowhere.
    expect(parseDomain('http://shop.example.com', true)?.scheme).toBe('https');
  });

  it('returns null for unusable input rather than throwing', () => {
    // One bad entry must not cost the application its other domains.
    expect(parseDomain('')).toBeNull();
    expect(parseDomain('   ')).toBeNull();
    expect(parseDomain('http://')).toBeNull();
  });
});

describe('traefikLabels — routing', () => {
  it('enables Traefik and routes the host', () => {
    const labels = traefikLabels(base);

    expect(labels).toContain('traefik.enable=true');
    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.rule')).toBe(
      'Host(`shop.example.com`) && PathPrefix(`/`)'
    );
    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.entryPoints')).toBe('https');
  });

  it('requests a certificate, without which HTTPS never works', () => {
    const labels = traefikLabels(base);

    expect(labels).toContain('traefik.http.routers.https-0-app123.tls=true');
    expect(labels).toContain('traefik.http.routers.https-0-app123.tls.certresolver=letsencrypt');
  });

  it('always emits a companion HTTP router, so port 80 is never simply absent', () => {
    const labels = traefikLabels(base);

    expect(valueOf(labels, 'traefik.http.routers.http-0-app123.entryPoints')).toBe('http');
  });

  it('redirects HTTP to HTTPS only when asked', () => {
    const forced = traefikLabels({ ...base, forceHttps: true });
    expect(valueOf(forced, 'traefik.http.routers.http-0-app123.middlewares')).toBe(
      'redirect-to-https'
    );

    const notForced = traefikLabels(base);
    expect(valueOf(notForced, 'traefik.http.routers.http-0-app123.middlewares')).toBeUndefined();
  });

  it('emits only an HTTP router for a plain http domain', () => {
    const labels = traefikLabels({ ...base, domains: ['http://shop.example.com'] });

    expect(labels.some((l) => l.includes('routers.https-'))).toBe(false);
    expect(labels.some((l) => l.includes('routers.http-0-app123'))).toBe(true);
  });

  it('wires the backend port so traffic reaches the container', () => {
    const labels = traefikLabels({ ...base, onlyPort: 3000 });

    expect(valueOf(labels, 'traefik.http.services.https-0-app123.loadbalancer.server.port')).toBe(
      '3000'
    );
    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.service')).toBe('https-0-app123');
  });

  it('prefers a port named in the domain over the fallback', () => {
    const labels = traefikLabels({
      ...base,
      domains: ['https://shop.example.com:9000'],
      onlyPort: 3000,
    });

    expect(valueOf(labels, 'traefik.http.services.https-0-app123.loadbalancer.server.port')).toBe(
      '9000'
    );
  });

  it('gives each domain its own router', () => {
    const labels = traefikLabels({
      ...base,
      domains: ['https://a.example.com', 'https://b.example.com'],
    });

    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.rule')).toContain('a.example.com');
    expect(valueOf(labels, 'traefik.http.routers.https-1-app123.rule')).toContain('b.example.com');
  });

  it('skips an unusable domain but keeps the others', () => {
    const labels = traefikLabels({ ...base, domains: ['not a url at all', 'https://ok.example.com'] });

    expect(labels.some((l) => l.includes('ok.example.com'))).toBe(true);
  });

  it('namespaces routers per service in a compose stack', () => {
    const labels = traefikLabels({ ...base, serviceName: 'api' });

    expect(labels.some((l) => l.includes('routers.https-0-app123-api.'))).toBe(true);
  });
});

describe('traefikLabels — middlewares', () => {
  it('compresses by default, and can be turned off', () => {
    expect(traefikLabels(base)).toContain('traefik.http.middlewares.gzip.compress=true');
    expect(valueOf(traefikLabels(base), 'traefik.http.routers.https-0-app123.middlewares')).toBe(
      'gzip'
    );

    const off = traefikLabels({ ...base, gzip: false });
    expect(off.some((l) => l.includes('gzip'))).toBe(false);
  });

  it('strips the prefix on a sub-path', () => {
    const labels = traefikLabels({ ...base, domains: ['https://shop.example.com/api'] });

    expect(
      valueOf(labels, 'traefik.http.middlewares.https-0-app123-stripprefix.stripprefix.prefixes')
    ).toBe('/api');
    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares')).toContain(
      'https-0-app123-stripprefix'
    );
  });

  it('does not strip anything at the root, where there is nothing to strip', () => {
    expect(traefikLabels(base).some((l) => l.includes('stripprefix'))).toBe(false);
  });

  it('honours stripPrefix: false on a sub-path', () => {
    const labels = traefikLabels({
      ...base,
      domains: ['https://shop.example.com/api'],
      stripPrefix: false,
    });

    expect(labels.some((l) => l.includes('stripprefix'))).toBe(false);
  });

  it('redirects to www only when the host lacks it', () => {
    const needsRedirect = traefikLabels({ ...base, redirect: 'www' });
    expect(needsRedirect.some((l) => l.includes('-to-www.redirectregex'))).toBe(true);

    const alreadyWww = traefikLabels({
      ...base,
      domains: ['https://www.shop.example.com'],
      redirect: 'www',
    });
    expect(alreadyWww.some((l) => l.includes('-to-www.redirectregex'))).toBe(false);
  });

  it('redirects to the apex only when the host has www', () => {
    const needsRedirect = traefikLabels({
      ...base,
      domains: ['https://www.shop.example.com'],
      redirect: 'non-www',
    });
    expect(needsRedirect.some((l) => l.includes('-to-non-www.redirectregex'))).toBe(true);

    const alreadyApex = traefikLabels({ ...base, redirect: 'non-www' });
    expect(alreadyApex.some((l) => l.includes('-to-non-www.redirectregex'))).toBe(false);
  });

  it('leaves both host forms alone by default', () => {
    expect(traefikLabels(base).some((l) => l.includes('to-www') || l.includes('to-non-www'))).toBe(
      false
    );
  });

  it('appends middlewares the user declared in their own labels', () => {
    const labels = traefikLabels({ ...base, extraMiddlewares: ['rate-limit', 'my-headers'] });
    const applied = valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares') ?? '';

    expect(applied).toContain('rate-limit');
    expect(applied).toContain('my-headers');
  });
});

describe('traefikLabels — basic auth', () => {
  const withAuth = { ...base, basicAuth: { username: 'admin', password: 's3cret' } };

  it('never emits the password in clear', () => {
    const labels = traefikLabels(withAuth);

    expect(labels.join('\n')).not.toContain('s3cret');
  });

  it('emits a bcrypt digest the proxy can verify', () => {
    const labels = traefikLabels(withAuth);
    const users = valueOf(labels, 'traefik.http.middlewares.http-basic-auth-app123.basicauth.users');

    expect(users?.startsWith('admin:')).toBe(true);
    expect(bcrypt.compareSync('s3cret', users!.slice('admin:'.length))).toBe(true);
  });

  it('applies the middleware to the router, not merely declares it', () => {
    // Declared but unapplied is the dangerous case: the operator believes the
    // route is protected and it is open.
    const labels = traefikLabels(withAuth);

    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares')).toContain(
      'http-basic-auth-app123'
    );
  });

  it('is absent when not configured', () => {
    expect(traefikLabels(base).some((l) => l.includes('basicauth'))).toBe(false);
  });
});

describe('traefikLabels — output shape', () => {
  it('returns sorted, de-duplicated labels', () => {
    const labels = traefikLabels({ ...base, domains: ['https://a.example.com', 'https://a.example.com'] });

    expect([...labels]).toEqual([...labels].sort());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('produces nothing routable when no domain is configured', () => {
    const labels = traefikLabels({ ...base, domains: [] });

    expect(labels.some((l) => l.includes('routers.'))).toBe(false);
    expect(labels).toContain('traefik.enable=true');
  });
});

describe('caddyLabels', () => {
  it('binds the ingress network and the host', () => {
    const labels = caddyLabels('ideploy', base);

    expect(labels).toContain('caddy_ingress_network=ideploy');
    expect(labels).toContain('caddy_0=https://shop.example.com');
  });

  it('reverse-proxies to the container port', () => {
    const labels = caddyLabels('ideploy', { ...base, onlyPort: 3000 });

    expect(labels).toContain('caddy_0.handle_path.0_reverse_proxy={{upstreams 3000}}');
  });

  it('falls back to an unqualified upstream without a port', () => {
    expect(caddyLabels('ideploy', base)).toContain(
      'caddy_0.handle_path.0_reverse_proxy={{upstreams}}'
    );
  });

  it('keeps the prefix when stripping is disabled', () => {
    const stripped = caddyLabels('ideploy', { ...base, domains: ['https://s.example.com/api'] });
    expect(stripped.some((l) => l.startsWith('caddy_0.handle_path='))).toBe(true);

    const kept = caddyLabels('ideploy', {
      ...base,
      domains: ['https://s.example.com/api'],
      stripPrefix: false,
    });
    expect(kept.some((l) => l.startsWith('caddy_0.handle='))).toBe(true);
  });

  it('redirects between host forms', () => {
    expect(
      caddyLabels('ideploy', { ...base, redirect: 'www' }).some((l) =>
        l.includes('redir=https://www.shop.example.com{uri}')
      )
    ).toBe(true);

    expect(
      caddyLabels('ideploy', {
        ...base,
        domains: ['https://www.shop.example.com'],
        redirect: 'non-www',
      }).some((l) => l.includes('redir=https://shop.example.com{uri}'))
    ).toBe(true);
  });

  it('hashes the basic-auth password here too', () => {
    const labels = caddyLabels('ideploy', {
      ...base,
      basicAuth: { username: 'admin', password: 's3cret' },
    });

    expect(labels.join('\n')).not.toContain('s3cret');
    expect(labels.some((l) => l.startsWith('caddy_0.basicauth.admin='))).toBe(true);
  });
});

describe('defaultLabels', () => {
  it('marks the container as ours, so the platform can find it again', () => {
    const labels = defaultLabels({
      id: 7,
      name: 'my-app-abc',
      workspaceName: 'My Shop',
      resourceName: 'Frontend',
      environment: 'production',
    });

    expect(labels).toContain('ideploy.managed=true');
    expect(labels).toContain('ideploy.applicationId=7');
    expect(labels).toContain('ideploy.type=application');
  });

  it('slugifies names, since labels feed DNS-ish identifiers', () => {
    const labels = defaultLabels({
      id: 1,
      name: 'x',
      workspaceName: 'Ma Boutique (Prod)',
      resourceName: 'Frontend Été',
      environment: 'production',
    });

    expect(labels).toContain('ideploy.projectName=ma-boutique-prod');
    expect(labels).toContain('ideploy.resourceName=frontend-ete');
  });

  it('defaults the pull-request id to zero for a normal deployment', () => {
    const labels = defaultLabels({
      id: 1,
      name: 'x',
      workspaceName: 'w',
      resourceName: 'r',
      environment: 'production',
    });

    expect(labels).toContain('ideploy.pullRequestId=0');
  });
});

describe('slug', () => {
  it.each([
    ['My Shop', 'my-shop'],
    ['Frontend Été', 'frontend-ete'],
    ['  spaced  out  ', 'spaced-out'],
    ['UPPER_case', 'upper-case'],
  ])('%s → %s', (input, expected) => {
    expect(slug(input)).toBe(expected);
  });
});

describe('extractMiddlewareNames', () => {
  it('finds middlewares the user declared', () => {
    expect(
      extractMiddlewareNames(['traefik.http.middlewares.rate-limit.ratelimit.average=100'])
    ).toEqual(['rate-limit']);
  });

  it('finds middlewares referenced by name', () => {
    expect(extractMiddlewareNames(['ideploy.traefik.middlewares=auth,geo-block'])).toEqual([
      'auth',
      'geo-block',
    ]);
  });

  it('de-duplicates across several declarations of one middleware', () => {
    expect(
      extractMiddlewareNames([
        'traefik.http.middlewares.rate-limit.ratelimit.average=100',
        'traefik.http.middlewares.rate-limit.ratelimit.burst=50',
      ])
    ).toEqual(['rate-limit']);
  });

  it('ignores labels that name no middleware', () => {
    expect(extractMiddlewareNames(['traefik.enable=true', 'com.example.foo=bar'])).toEqual([]);
  });
});

describe('decodeCustomLabels', () => {
  it('decodes the base64 blob the column stores', () => {
    const encoded = Buffer.from('traefik.enable=true\nfoo=bar\n').toString('base64');

    expect(decodeCustomLabels(encoded)).toEqual(['traefik.enable=true', 'foo=bar']);
  });

  it('returns nothing for absent or unreadable input', () => {
    expect(decodeCustomLabels(null)).toEqual([]);
    expect(decodeCustomLabels('')).toEqual([]);
  });
});

describe('traefikLabels — firewall bouncer', () => {
  const bouncer = {
    apiKey: 'bouncer-key-abc',
    lapiHost: 'crowdsec:8080',
    banDurationSeconds: 3600,
  };
  const withFirewall = { ...base, crowdsec: bouncer };

  it('declares the bouncer middleware', () => {
    const labels = traefikLabels(withFirewall);

    expect(labels).toContain(
      'traefik.http.middlewares.crowdsec-app123.plugin.bouncer.enabled=true'
    );
  });

  it('applies it to the router, which is what actually filters traffic', () => {
    // Declaring without referencing is the dangerous half-configuration: the
    // middleware exists, no router consults it, and nothing is inspected.
    const labels = traefikLabels(withFirewall);

    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares')).toContain(
      'crowdsec-app123'
    );
  });

  it('applies it on a sub-path router too', () => {
    const labels = traefikLabels({
      ...withFirewall,
      domains: ['https://shop.example.com/api'],
    });

    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares')).toContain(
      'crowdsec-app123'
    );
  });

  it('applies it on a plain-http router too', () => {
    const labels = traefikLabels({ ...withFirewall, domains: ['http://shop.example.com'] });

    expect(valueOf(labels, 'traefik.http.routers.http-0-app123.middlewares')).toContain(
      'crowdsec-app123'
    );
  });

  it('uses PascalCase keys, which is what the plugin actually reads', () => {
    // Lower-case spellings are silently ignored, yielding a middleware with
    // default settings — no LAPI configured, so nothing is ever blocked.
    const labels = traefikLabels(withFirewall);

    expect(labels.some((l) => l.includes('.CrowdsecLapiKey='))).toBe(true);
    expect(labels.some((l) => l.includes('.CrowdsecLapiHost='))).toBe(true);
    expect(labels.some((l) => l.includes('.crowdseclapikey='))).toBe(false);
  });

  it('passes the Local API address and the ban duration', () => {
    const labels = traefikLabels(withFirewall);
    const prefix = 'traefik.http.middlewares.crowdsec-app123.plugin.bouncer';

    expect(valueOf(labels, `${prefix}.CrowdsecLapiHost`)).toBe('crowdsec:8080');
    expect(valueOf(labels, `${prefix}.DefaultDecisionSeconds`)).toBe('3600');
  });

  it('queries the API per request so a ban takes effect at once', () => {
    const prefix = 'traefik.http.middlewares.crowdsec-app123.plugin.bouncer';

    expect(valueOf(traefikLabels(withFirewall), `${prefix}.CrowdsecMode`)).toBe('live');
  });

  it('trusts forwarded headers from private ranges, so bans match real visitors', () => {
    // Without this every request appears to come from the Docker network and no
    // decision could ever match a client address.
    const prefix = 'traefik.http.middlewares.crowdsec-app123.plugin.bouncer';
    const trusted = valueOf(traefikLabels(withFirewall), `${prefix}.ForwardedHeadersTrustedIPs`);

    expect(trusted).toContain('172.16.0.0/12');
  });

  it('does not log a line per request by default', () => {
    // DEBUG prints client addresses on every request and fills the disk of a
    // busy server; the Laravel side pins it there.
    const prefix = 'traefik.http.middlewares.crowdsec-app123.plugin.bouncer';

    expect(valueOf(traefikLabels(withFirewall), `${prefix}.LogLevel`)).toBe('INFO');
  });

  it('emits nothing at all when no bouncer is configured', () => {
    const labels = traefikLabels(base);

    expect(labels.some((l) => l.includes('crowdsec'))).toBe(false);
    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares')).not.toContain(
      'crowdsec'
    );
  });

  it('keeps the firewall last in the chain, after any rewriting', () => {
    const labels = traefikLabels({
      ...withFirewall,
      domains: ['https://shop.example.com/api'],
      extraMiddlewares: ['custom-one'],
    });
    const chain = (valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares') ?? '').split(
      ','
    );

    expect(chain.at(-1)).toBe('crowdsec-app123');
  });
});

describe('traefikLabels — proxy-native protections', () => {
  it('declares and references the geo-block middleware', () => {
    // Declaring without referencing is the same half-configuration the bouncer
    // tests above guard against: a middleware nothing consults inspects nothing.
    const labels = traefikLabels({ ...base, geoBlock: { blockedCountries: ['RU'] } });

    expect(labels).toContain(
      'traefik.http.middlewares.geoblock-app123.plugin.geoblock.blackListMode=true'
    );
    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares')).toContain(
      'geoblock-app123'
    );
  });

  it('emits no geo-block label when the country list is empty', () => {
    // An empty list is not "block nothing" in the plugin's own terms once
    // `blackListMode` is set — it is safest never to declare the middleware at
    // all rather than rely on that edge case.
    const labels = traefikLabels({ ...base, geoBlock: { blockedCountries: [] } });

    expect(labels.some((l) => l.includes('geoblock'))).toBe(false);
  });

  it('declares and references the rate limiter', () => {
    const labels = traefikLabels({ ...base, rateLimit: { averagePerSecond: 10 } });

    expect(labels).toContain('traefik.http.middlewares.ratelimit-app123.ratelimit.average=10');
    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares')).toContain(
      'ratelimit-app123'
    );
  });

  it('declares and references the concurrency cap', () => {
    const labels = traefikLabels({ ...base, concurrency: { maxInFlight: 25 } });

    expect(labels).toContain('traefik.http.middlewares.inflight-app123.inflightreq.amount=25');
    expect(valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares')).toContain(
      'inflight-app123'
    );
  });

  it('orders the connection-level checks before the ones needing a CrowdSec round trip', () => {
    // Refusing a banned country or an over-limit client costs nothing extra;
    // doing that before asking CrowdSec saves the round trip on refused traffic.
    const labels = traefikLabels({
      ...base,
      geoBlock: { blockedCountries: ['RU'] },
      rateLimit: { averagePerSecond: 10 },
      concurrency: { maxInFlight: 25 },
      crowdsec: { apiKey: 'k', lapiHost: 'crowdsec:8080', banDurationSeconds: 3600 },
    });
    const chain = (valueOf(labels, 'traefik.http.routers.https-0-app123.middlewares') ?? '').split(',');

    expect(chain.indexOf('geoblock-app123')).toBeLessThan(chain.indexOf('crowdsec-app123'));
    expect(chain.indexOf('inflight-app123')).toBeLessThan(chain.indexOf('crowdsec-app123'));
    expect(chain.indexOf('ratelimit-app123')).toBeLessThan(chain.indexOf('crowdsec-app123'));
  });
});
