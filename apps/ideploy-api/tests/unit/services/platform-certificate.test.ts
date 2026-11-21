import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { routesFileContent, RoutesInput } from '../../../api/services/routes-file.service';
import { coveredByWildcard, mayHoldPlatformKey, platformCertificateYaml } from '../../../api/services/platform-certificate.service';
import type { ServerRow } from '../../../api/models/ideploy.types';

const context: RoutesInput['context'] = {
  forceHttps: true, gzip: true, stripPrefix: true, redirect: 'both', hsts: false, redirectToPrimary: false, basicAuth: null, customLabels: [],
};

describe('platform wildcard certificate', () => {
  it('covers exactly one label under the platform domain', () => {
    expect(coveredByWildcard('monapp.idem.africa', 'idem.africa')).toBe(true);
    expect(coveredByWildcard('MonApp.IDEM.africa', 'idem.africa')).toBe(true);
    expect(coveredByWildcard('a.b.idem.africa', 'idem.africa')).toBe(false);
    expect(coveredByWildcard('idem.africa', 'idem.africa')).toBe(false);
    expect(coveredByWildcard('monapp.idem.africa.evil.com', 'idem.africa')).toBe(false);
    expect(coveredByWildcard('monappidem.africa', 'idem.africa')).toBe(false);
    expect(coveredByWildcard('monapp.idem.africa', null)).toBe(false);
  });

  it('never lets a customer server hold the platform key', () => {
    expect(mayHoldPlatformKey({ id: 1, idem_managed: true } as unknown as ServerRow)).toBe(true);
    expect(mayHoldPlatformKey({ id: 2, idem_managed: false } as unknown as ServerRow)).toBe(false);
    expect(mayHoldPlatformKey({ id: 3 } as unknown as ServerRow)).toBe(false);
  });

  it('asks Let’s Encrypt for nothing on a host the wildcard covers, and keeps the resolver for the others', () => {
    const http = YAML.parse(
      routesFileContent({
        uuid: 'u1',
        target: 'site-u1:80',
        domains: ['https://monapp.idem.africa', 'https://boutique.com'],
        routable: new Set(['monapp.idem.africa', 'boutique.com']),
        context,
        preCertified: (host) => coveredByWildcard(host, 'idem.africa'),
      })
    ).http;
    expect(http.routers['r0-u1-https'].tls).toEqual({});
    expect(http.routers['r1-u1-https'].tls).toEqual({ certResolver: 'letsencrypt' });
  });

  it('writes the certificate inline, for Traefik’s file provider', () => {
    const parsed = YAML.parse(
      platformCertificateYaml({ domain: 'idem.africa', certificate: '-----BEGIN CERTIFICATE-----\nA\n-----END CERTIFICATE-----\n', privateKey: '-----BEGIN PRIVATE KEY-----\nB\n-----END PRIVATE KEY-----\n', expiresAt: new Date(), fingerprint: 'f' })
    );
    expect(parsed.tls.certificates[0].certFile).toContain('BEGIN CERTIFICATE');
    expect(parsed.tls.certificates[0].keyFile).toContain('BEGIN PRIVATE KEY');
  });
});
