import { describe, expect, it } from 'vitest';
import { classify, inCidr, isAutomatic, isCloudflare, recordFor, zoneOf } from '../../../api/services/domain-dns.service';

describe('domain DNS guide', () => {
  it('finds the zone and the record name a DNS provider asks for', () => {
    expect(zoneOf('boutique.com')).toBe('boutique.com');
    expect(zoneOf('shop.boutique.com')).toBe('boutique.com');
    expect(zoneOf('app.boutique.co.uk')).toBe('boutique.co.uk');
    expect(zoneOf('api.monapp.com.cm')).toBe('monapp.com.cm');
    expect(recordFor('boutique.com', '1.2.3.4')).toEqual({ type: 'A', name: '@', value: '1.2.3.4', zone: 'boutique.com' });
    expect(recordFor('api.v2.boutique.com', '1.2.3.4')).toMatchObject({ name: 'api.v2', zone: 'boutique.com' });
  });

  it('recognises Cloudflare addresses', () => {
    expect(inCidr('104.21.5.9', '104.16.0.0/13')).toBe(true);
    expect(isCloudflare('172.67.1.1')).toBe(true);
    expect(isCloudflare('46.62.236.34')).toBe(false);
  });

  it('needs no DNS for the hostnames iDeploy manages itself', () => {
    expect(isAutomatic('x-1.159.69.185.176.sslip.io')).toBe(true);
    expect(isAutomatic('monapp.idem.africa', 'idem.africa')).toBe(true);
    expect(isAutomatic('boutique.com', 'idem.africa')).toBe(false);
  });

  it('says what is wrong with what public DNS answers', () => {
    const ip = '159.69.185.176';
    expect(classify({ a: [], aaaa: [], cname: null }, ip)).toBe('missing');
    expect(classify({ a: [ip], aaaa: [], cname: null }, ip)).toBe('ok');
    expect(classify({ a: ['5.6.7.8'], aaaa: [], cname: null }, ip)).toBe('wrong_ip');
    expect(classify({ a: [ip, '5.6.7.8'], aaaa: [], cname: null }, ip)).toBe('wrong_ip');
    expect(classify({ a: ['104.21.5.9'], aaaa: [], cname: null }, ip)).toBe('proxied');
    expect(classify({ a: [ip], aaaa: ['2606:4700::1'], cname: null }, ip)).toBe('ipv6_conflict');
  });
});
