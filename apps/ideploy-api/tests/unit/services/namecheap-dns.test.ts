/**
 * Namecheap's API replaces the whole zone on every write: what is read must be
 * written back intact, mail setting included, or idem.africa loses records.
 */
import { describe, expect, it } from 'vitest';
import { NamecheapDnsProvider, parseGetHosts, setHostsParams } from '../../../api/services/dns/namecheap.client';

const ZONE_XML = `<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.dns.getHosts">
    <DomainDNSGetHostsResult Domain="idem.africa" EmailType="MX" IsUsingOurDNS="true">
      <host HostId="1" Name="@" Type="A" Address="46.62.236.34" MXPref="10" TTL="1800" />
      <host HostId="2" Name="*" Type="A" Address="46.62.236.34" MXPref="10" TTL="1800" />
      <host HostId="3" Name="@" Type="MX" Address="mx1.example.com." MXPref="5" TTL="1800" />
      <host HostId="4" Name="@" Type="TXT" Address="v=spf1 include:_spf.example.com &amp; ~all" MXPref="10" TTL="1800" />
    </DomainDNSGetHostsResult>
  </CommandResponse>
</ApiResponse>`;

describe('reading the zone', () => {
  it('keeps every record, its type, priority, TTL and the mail setting', () => {
    const zone = parseGetHosts(ZONE_XML);

    expect(zone.emailType).toBe('MX');
    expect(zone.hosts).toHaveLength(4);
    expect(zone.hosts[2]).toEqual({ name: '@', type: 'MX', address: 'mx1.example.com.', mxPref: '5', ttl: '1800' });
    expect(zone.hosts[3].address).toBe('v=spf1 include:_spf.example.com & ~all');
  });

  it("stops with Namecheap's own sentence on an error answer, not a tag", () => {
    const xml = `<ApiResponse Status="ERROR"><Errors><Error Number="1011150">Invalid request IP: 129.0.60.35</Error></Errors></ApiResponse>`;
    expect(() => parseGetHosts(xml)).toThrow('Namecheap refused the request: Invalid request IP: 129.0.60.35');
  });
});

describe('writing the zone', () => {
  it('numbers every host and sends the mail setting back', () => {
    const params = setHostsParams(parseGetHosts(ZONE_XML));

    expect(params.EmailType).toBe('MX');
    expect(params.HostName3).toBe('@');
    expect(params.RecordType3).toBe('MX');
    expect(params.MXPref3).toBe('5');
    expect(params.HostName4).toBe('@');
    expect(params.HostName5).toBeUndefined();
  });

  it('calls getHosts then setHosts for idem / africa, the full zone in the body', async () => {
    const calls: Array<{ url: string; body?: string }> = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body as string | undefined });
      const xml = init?.method === 'POST'
        ? '<ApiResponse Status="OK"><DomainDNSSetHostsResult Domain="idem.africa" IsSuccess="true" /></ApiResponse>'
        : ZONE_XML;
      return new Response(xml);
    }) as typeof fetch;

    const provider = new NamecheapDnsProvider(
      { apiUser: 'u', apiKey: 'k', userName: 'u', clientIp: '1.2.3.4', domain: 'idem.africa', sandbox: true },
      fakeFetch
    );
    const zone = await provider.getZone();
    await provider.setZone({ ...zone, hosts: [...zone.hosts, { name: 'monapp', type: 'A', address: '5.6.7.8', mxPref: '10', ttl: '300' }] });

    expect(calls[0].url).toContain('Command=namecheap.domains.dns.getHosts');
    expect(calls[0].url).toContain('SLD=idem');
    expect(calls[0].url).toContain('TLD=africa');
    expect(calls[0].url).toContain('api.sandbox.namecheap.com');
    const body = new URLSearchParams(calls[1].body);
    expect(body.get('Command')).toBe('namecheap.domains.dns.setHosts');
    expect(body.get('HostName5')).toBe('monapp');
    expect(body.get('Address5')).toBe('5.6.7.8');
    expect(body.get('Address4')).toBe('v=spf1 include:_spf.example.com & ~all');
    expect(body.get('EmailType')).toBe('MX');
  });

  it('reports a refused write instead of believing it went through', async () => {
    const fakeFetch = (async () =>
      new Response('<ApiResponse Status="ERROR"><Errors><Error Number="2">API key invalid</Error></Errors></ApiResponse>')) as typeof fetch;
    const provider = new NamecheapDnsProvider(
      { apiUser: 'u', apiKey: 'k', userName: 'u', clientIp: '1.2.3.4', domain: 'idem.africa', sandbox: false },
      fakeFetch
    );
    await expect(provider.setZone({ emailType: 'MX', hosts: [] })).rejects.toThrow(/API key invalid/);
  });
});
