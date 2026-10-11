import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { routesFileContent, RoutesInput } from '../../../api/services/routes-file.service';

const base: RoutesInput = {
  uuid: 'u1',
  target: 'shop-u1:3000',
  domains: ['https://boutique.com', 'https://www.boutique.com', 'https://pending.com'],
  routable: new Set(['boutique.com', 'www.boutique.com']),
  context: { forceHttps: true, gzip: true, stripPrefix: true, redirect: 'both', hsts: false, redirectToPrimary: false, basicAuth: null, customLabels: [] },
};
const parse = (input: RoutesInput) => YAML.parse(routesFileContent(input)).http;

describe('routes file', () => {
  it('routes only verified domains, over HTTPS with a certificate, HTTP redirecting', () => {
    const http = parse(base);
    expect(Object.keys(http.routers).sort()).toEqual(['r0-u1-http', 'r0-u1-https', 'r1-u1-http', 'r1-u1-https']);
    expect(http.routers['r0-u1-https']).toMatchObject({
      entryPoints: ['https'],
      rule: 'Host(`boutique.com`)',
      service: 'app-u1',
      tls: { certResolver: 'letsencrypt' },
    });
    expect(http.routers['r0-u1-http'].middlewares).toEqual(['to-https-u1']);
    expect(http.services['app-u1'].loadBalancer.servers).toEqual([{ url: 'http://shop-u1:3000' }]);
    // The firewall chain comes last.
    expect(http.routers['r0-u1-https'].middlewares.at(-1)).toBe('firewall-u1');
  });

  it('redirects the other domains to the primary one, and adds HSTS when asked', () => {
    const http = parse({ ...base, context: { ...base.context, redirectToPrimary: true, hsts: true } });
    expect(http.routers['r1-u1-https'].middlewares).toEqual(['hsts-u1', 'to-primary-1-u1']);
    expect(http.middlewares['to-primary-1-u1'].redirectRegex.replacement).toBe('https://boutique.com${1}');
    expect(http.middlewares['hsts-u1'].headers.stsSeconds).toBe(31536000);
    expect(http.routers['r0-u1-https'].middlewares[0]).toBe('hsts-u1');
  });

  it('strips a sub-path, protects with basic auth, and names the user middlewares with their provider', () => {
    const http = parse({
      ...base,
      domains: ['https://boutique.com/app'],
      routable: new Set(['boutique.com']),
      context: { ...base.context, basicAuth: { username: 'admin', password: 'pw' }, customLabels: ['traefik.http.middlewares.extra.headers.customrequestheaders.X-A=1'] },
    });
    expect(http.routers['r0-u1-https'].rule).toBe('Host(`boutique.com`) && PathPrefix(`/app`)');
    expect(http.middlewares['strip-0-u1'].stripPrefix.prefixes).toEqual(['/app']);
    expect(http.middlewares['auth-u1'].basicAuth.users[0]).toMatch(/^admin:/);
    expect(http.routers['r0-u1-https'].middlewares).toContain('extra@docker');
  });

  it('is an empty, valid file while no domain is verified', () => {
    expect(parse({ ...base, routable: new Set() })).toEqual({});
  });
});
