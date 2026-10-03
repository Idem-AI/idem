/**
 * `monapp.idem.africa` for what iCode publishes: the name of the application,
 * an id added only when it is taken, and a zone that never loses a record.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { claimPlatformHost } from '../../api/services/platform-domain.service';
import { DnsProvider, DnsZone, resetDnsProvider, setDnsProvider } from '../../api/services/dns/namecheap.client';
import { quickDeploy, quickDeployFullstack } from '../../api/services/quick-deploy.service';
import * as appService from '../../api/services/application.service';
import * as envVarService from '../../api/services/env-var.service';
import { isTestDatabaseAvailable, truncateAll } from '../helpers/db';
import { makeManagedServer, makeTeam } from '../helpers/factories';
import { useFakeExecutor } from '../helpers/fake-executor';
import { closeInfrastructure } from '../helpers/teardown';

/** idem.africa as an in-memory zone. */
class MemoryZone implements DnsProvider {
  readonly domain = 'idem.africa';
  writes = 0;
  failWrites = false;
  zone: DnsZone = {
    emailType: 'MX',
    hosts: [
      { name: '@', type: 'A', address: '46.62.236.34', mxPref: '10', ttl: '1800' },
      { name: '*', type: 'A', address: '46.62.236.34', mxPref: '10', ttl: '1800' },
      { name: 'shop', type: 'CNAME', address: 'shops.example.com.', mxPref: '10', ttl: '1800' },
      { name: '@', type: 'MX', address: 'mx1.example.com.', mxPref: '5', ttl: '1800' },
    ],
  };

  async getZone(): Promise<DnsZone> {
    return JSON.parse(JSON.stringify(this.zone));
  }

  async setZone(zone: DnsZone): Promise<void> {
    if (this.failWrites) throw new Error('Namecheap is down');
    this.writes++;
    this.zone = JSON.parse(JSON.stringify(zone));
  }

  record(name: string) {
    return this.zone.hosts.find((h) => h.name === name && h.type === 'A');
  }
}

let dns: MemoryZone;
useFakeExecutor();

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error('Integration tests need the test database. Run scripts/prepare-test-db.sh from the repo root.');
  }
});

beforeEach(async () => {
  await truncateAll();
  dns = new MemoryZone();
  setDnsProvider(dns);
});

afterEach(() => resetDnsProvider());
afterAll(async () => closeInfrastructure());

describe('claimPlatformHost', () => {
  it('gives the application its own name and points it at its server, keeping every other record', async () => {
    const host = await claimPlatformHost('Boutique Amara', '198.51.100.7');

    expect(host).toBe('boutique-amara.idem.africa');
    expect(dns.record('boutique-amara')?.address).toBe('198.51.100.7');
    expect(dns.zone.hosts).toHaveLength(5);
    expect(dns.zone.hosts.filter((h) => h.type === 'MX')).toHaveLength(1);
    expect(dns.zone.emailType).toBe('MX');
  });

  it("adds an id when the name is one of IDEM's own services", async () => {
    const host = await claimPlatformHost('api', '198.51.100.7');
    expect(host).toMatch(/^api-[a-z0-9]{5}\.idem\.africa$/);
  });

  it('adds an id when the zone already has that name', async () => {
    const host = await claimPlatformHost('shop', '198.51.100.7');
    expect(host).toMatch(/^shop-[a-z0-9]{5}\.idem\.africa$/);
    expect(dns.zone.hosts.find((h) => h.name === 'shop')?.type).toBe('CNAME');
  });

  it('writes nothing when the zone comes back empty, and keeps the automatic address', async () => {
    dns.zone.hosts = [];
    expect(await claimPlatformHost('vide', '198.51.100.7')).toBeNull();
    expect(dns.writes).toBe(0);
  });

  it('never fails the deployment when Namecheap fails', async () => {
    dns.failWrites = true;
    expect(await claimPlatformHost('boutique', '198.51.100.7')).toBeNull();
  });

  it('is off when no provider is configured', async () => {
    setDnsProvider(null);
    expect(await claimPlatformHost('boutique', '198.51.100.7')).toBeNull();
  });
});

describe('publishing from iCode', () => {
  const site = { 'dist/index.html': '<h1>Boutique</h1>' };

  it('puts the site at monapp.idem.africa, then monapp-<id> for the next one with that name', async () => {
    const team = await makeTeam();
    await makeManagedServer();

    const first = await quickDeploy(team.id, { name: 'monapp', files: site, build_pack: 'static', platform_domain: true });
    const second = await quickDeploy(team.id, { name: 'monapp', files: site, build_pack: 'static', platform_domain: true });

    expect(first.url).toBe('https://monapp.idem.africa');
    expect(second.url).toMatch(/^https:\/\/monapp-[a-z0-9]{5}\.idem\.africa$/);
  });

  it('keeps the automatic address for callers that did not ask', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const result = await quickDeploy(team.id, { name: 'monapp', files: site, build_pack: 'static' });
    expect(result.url).toContain('sslip.io');
    expect(dns.writes).toBe(0);
  });

  it('gives a complete application monapp.idem.africa and monapp-api.idem.africa, linked', async () => {
    const team = await makeTeam();
    await makeManagedServer();

    const result = await quickDeployFullstack(team.id, {
      name: 'clinique',
      platform_domain: true,
      files: {
        'backend/package.json': '{"name":"backend"}',
        'frontend/package.json': '{"name":"frontend"}',
      },
    });

    expect(result.frontend.url).toBe('https://clinique.idem.africa');
    expect(result.backend.url).toBe('https://clinique-api.idem.africa');
    const frontendEnv = await envVarService.listForApplication(team.id, result.frontend.uuid);
    expect(frontendEnv.find((v) => v.key === 'VITE_API_URL')?.value).toBe('https://clinique-api.idem.africa');
    const backend = await appService.getApplication(team.id, result.backend.uuid);
    const backendEnv = await envVarService.listForApplication(team.id, backend!.uuid);
    expect(backendEnv.find((v) => v.key === 'CORS_ORIGIN')?.value).toBe('https://clinique.idem.africa');
  });
});
