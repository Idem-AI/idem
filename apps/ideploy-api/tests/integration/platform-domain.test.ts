/**
 * `monapp.ideploy.site` for what iCode publishes: the name of the application,
 * an id added only when it is taken, and a zone that never loses a record.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { claimPlatformHost, releasePlatformHost } from '../../api/services/platform-domain.service';
import { testPool } from '../helpers/db';
import { makeApplication, makeProject } from '../helpers/factories';
import { DnsProvider, DnsZone, resetDnsProvider, setDnsProvider } from '../../api/services/dns/namecheap.client';
import { quickDeploy, quickDeployFullstack } from '../../api/services/quick-deploy.service';
import * as appService from '../../api/services/application.service';
import * as envVarService from '../../api/services/env-var.service';
import { isTestDatabaseAvailable, truncateAll } from '../helpers/db';
import { makeManagedServer, makeTeam } from '../helpers/factories';
import { useFakeExecutor } from '../helpers/fake-executor';
import { closeInfrastructure } from '../helpers/teardown';

/** ideploy.site as an in-memory zone. */
class MemoryZone implements DnsProvider {
  readonly domain = 'ideploy.site';
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

    expect(host).toBe('boutique-amara.ideploy.site');
    expect(dns.record('boutique-amara')?.address).toBe('198.51.100.7');
    expect(dns.zone.hosts).toHaveLength(5);
    expect(dns.zone.hosts.filter((h) => h.type === 'MX')).toHaveLength(1);
    expect(dns.zone.emailType).toBe('MX');
  });

  it("adds an id when the name is one of IDEM's own services", async () => {
    const host = await claimPlatformHost('api', '198.51.100.7');
    expect(host).toMatch(/^api-[a-z0-9]{5}\.ideploy\.site$/);
  });

  it('adds an id when the zone already has that name', async () => {
    const host = await claimPlatformHost('shop', '198.51.100.7');
    expect(host).toMatch(/^shop-[a-z0-9]{5}\.ideploy\.site$/);
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

describe('releasePlatformHost', () => {
  it('removes the record of an address no resource uses any more, and nothing else', async () => {
    await claimPlatformHost('Boutique Amara', '198.51.100.7');

    expect(await releasePlatformHost('boutique-amara.ideploy.site')).toBe(true);

    expect(dns.record('boutique-amara')).toBeUndefined();
    expect(dns.zone.hosts).toHaveLength(4);
  });

  it("never touches IDEM's own names, the wildcard, or another domain", async () => {
    expect(await releasePlatformHost('api.ideploy.site')).toBe(false);
    expect(await releasePlatformHost('ideploy.site')).toBe(false);
    expect(await releasePlatformHost('shop.example.com')).toBe(false);
    expect(dns.writes).toBe(0);
  });

  it('keeps a record another application still serves', async () => {
    const host = await claimPlatformHost('vitrine', '198.51.100.7');
    const team = await makeTeam();
    const server = await makeManagedServer();
    const project = await makeProject(team.id);
    const app = await makeApplication(project.environmentId, server.destinationId);
    await testPool().query('UPDATE applications SET fqdn = $2 WHERE id = $1', [app.id, `https://${host}`]);

    expect(await releasePlatformHost(host!)).toBe(false);
    expect(dns.record('vitrine')).toBeDefined();
  });

  it('is released when its application is deleted', async () => {
    const host = await claimPlatformHost('ephemere', '198.51.100.7');
    const team = await makeTeam();
    const server = await makeManagedServer();
    const project = await makeProject(team.id);
    const app = await makeApplication(project.environmentId, server.destinationId);
    await testPool().query('UPDATE applications SET fqdn = $2 WHERE id = $1', [app.id, `https://${host}`]);

    await appService.deleteApplication(team.id, app.uuid);

    expect(dns.record('ephemere')).toBeUndefined();
  });
});

describe('publishing from iCode', () => {
  const site = { 'dist/index.html': '<h1>Boutique</h1>' };

  it('puts the site at monapp.ideploy.site, and keeps it there at every publish of that name', async () => {
    const team = await makeTeam();
    await makeManagedServer();

    const first = await quickDeploy(team.id, { name: 'monapp', files: site, build_pack: 'static', platform_domain: true });
    // The client lost the link to the first publish (another browser, a new chat): same application anyway.
    const second = await quickDeploy(team.id, { name: 'monapp', files: site, build_pack: 'static', platform_domain: true });

    expect(first.url).toBe('https://monapp.ideploy.site');
    expect(second.url).toBe('https://monapp.ideploy.site');
    expect(second.applicationUuid).toBe(first.applicationUuid);
    expect(second.reused).toBe(true);
    expect(dns.writes).toBe(1);
  });

  it('gives monapp-<id> to another team that wants the same name', async () => {
    await makeManagedServer();
    const first = await quickDeploy((await makeTeam()).id, { name: 'monapp', files: site, build_pack: 'static', platform_domain: true });
    const other = await quickDeploy((await makeTeam()).id, { name: 'monapp', files: site, build_pack: 'static', platform_domain: true });

    expect(first.url).toBe('https://monapp.ideploy.site');
    expect(other.url).toMatch(/^https:\/\/monapp-[a-z0-9]{5}\.ideploy\.site$/);
  });

  it('a reservation for a name already published is not a reservation', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const published = await quickDeploy(team.id, { name: 'monapp', files: site, build_pack: 'static', platform_domain: true });
    const reserved = await quickDeploy(team.id, { name: 'monapp', build_pack: 'static', platform_domain: true, reserve: true });

    expect(reserved.applicationUuid).toBe(published.applicationUuid);
    expect(reserved.reused).toBe(true);
  });

  it('keeps the automatic address for callers that turn it off', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const result = await quickDeploy(team.id, { name: 'monapp', files: site, build_pack: 'static', platform_domain: false });
    expect(result.url).toContain('sslip.io');
    expect(dns.writes).toBe(0);
  });

  it('gives a complete application monapp.ideploy.site and monapp-api.ideploy.site, linked', async () => {
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

    expect(result.frontend.url).toBe('https://clinique.ideploy.site');
    expect(result.backend.url).toBe('https://clinique-api.ideploy.site');
    const frontendEnv = await envVarService.listForApplication(team.id, result.frontend.uuid);
    expect(frontendEnv.find((v) => v.key === 'VITE_API_URL')?.value).toBe('https://clinique-api.ideploy.site');
    const backend = await appService.getApplication(team.id, result.backend.uuid);
    const backendEnv = await envVarService.listForApplication(team.id, backend!.uuid);
    expect(backendEnv.find((v) => v.key === 'CORS_ORIGIN')?.value).toBe('https://clinique.ideploy.site');
  });
});

describe('choosing the name of the free address', () => {
  const site = { 'dist/index.html': '<h1>Buni</h1>' };

  it('renames buni-k3x9p.ideploy.site to buni.ideploy.site, first address kept first, old record given back', async () => {
    const team = await makeTeam();
    await makeManagedServer();
    dns.zone.hosts.push({ name: 'buni', type: 'A', address: '203.0.113.9', mxPref: '10', ttl: '300' });
    const published = await quickDeploy(team.id, { name: 'buni', files: site, build_pack: 'static', platform_domain: true });
    const suffixed = published.url!.replace('https://', '');
    expect(suffixed).toMatch(/^buni-[a-z0-9]{5}\.ideploy\.site$/);

    // Taken by a record of the zone: refused, never replaced by another name.
    expect(await appService.renamePlatformAddress(team.id, published.applicationUuid!, 'buni')).toEqual({ ok: false, reason: 'taken' });

    dns.zone.hosts = dns.zone.hosts.filter((h) => h.name !== 'buni');
    const renamed = await appService.renamePlatformAddress(team.id, published.applicationUuid!, 'Buni');
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.app.fqdn?.split(',')[0]).toBe('https://buni.ideploy.site');
    expect(renamed.previous).toBe(suffixed);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dns.record(suffixed.split('.')[0])).toBeUndefined();
    expect(dns.record('buni')).toBeDefined();
  });

  it("refuses invalid names and IDEM's own", async () => {
    const team = await makeTeam();
    await makeManagedServer();
    const published = await quickDeploy(team.id, { name: 'vitrine', files: site, build_pack: 'static', platform_domain: true });
    expect(await appService.renamePlatformAddress(team.id, published.applicationUuid!, '-x')).toEqual({ ok: false, reason: 'invalid' });
    expect(await appService.renamePlatformAddress(team.id, published.applicationUuid!, 'console')).toEqual({ ok: false, reason: 'reserved' });
  });
});

describe('migration idem.africa → ideploy.site', () => {
  it('moves buni.idem.africa to buni.ideploy.site, removes the old record, and reports it', async () => {
    const legacy = new MemoryZone();
    Object.assign(legacy, { domain: 'idem.africa' });
    legacy.zone.hosts.push({ name: 'buni', type: 'A', address: '198.51.100.7', mxPref: '10', ttl: '300' });
    setDnsProvider(dns, legacy);

    const team = await makeTeam();
    const server = await makeManagedServer();
    const project = await makeProject(team.id);
    const app = await makeApplication(project.environmentId, server.destinationId);
    await testPool().query("UPDATE applications SET fqdn = $2, status = 'exited' WHERE id = $1", [app.id, 'https://buni.idem.africa,https://buni.198.51.100.7.sslip.io']);
    const other = await makeApplication(project.environmentId, server.destinationId);
    // Typed by a user, or IDEM's own: never moved.
    await testPool().query('UPDATE applications SET fqdn = $2 WHERE id = $1', [other.id, 'https://www.buni.idem.africa,https://console.idem.africa']);

    const { migrateAll, reportEmail } = await import('../../api/services/domain-migration.service');
    const report = await migrateAll();

    expect(report.state).toBe('succeeded');
    expect(report.entries).toHaveLength(1);
    const moved = await appService.getApplicationById(app.id);
    expect(moved?.fqdn).toBe('https://buni.ideploy.site,https://buni.198.51.100.7.sslip.io');
    expect(dns.record('buni')).toBeDefined();
    expect(legacy.record('buni')).toBeUndefined();
    const mail = reportEmail(report);
    expect(mail.to).toBe('beta@idem.africa');
    expect(mail.text).toContain('https://buni.ideploy.site');

    // Second start: nothing left, and the report says so.
    const again = await migrateAll();
    expect(again.state).toBe('nothing_to_do');
    expect(reportEmail(again).subject).toContain('déjà effectuée');
  });
});
