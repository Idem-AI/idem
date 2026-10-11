/**
 * The DNS guide gives the IP of the server the application runs on — the one
 * a user of an IDEM-managed server cannot look up — and checks public DNS.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { domainGuide } from '../../api/services/domain-dns.service';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) throw new Error('Integration tests need the test database.');
});
beforeEach(async () => truncateAll());
afterAll(async () => closeInfrastructure());

async function anApp(fqdn: string) {
  const team = await makeTeam();
  const server = await makeManagedServer();
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  await testPool().query('UPDATE applications SET fqdn = $2 WHERE id = $1', [app.id, fqdn]);
  const { rows } = await testPool().query('SELECT ip FROM servers WHERE id = (SELECT server_id FROM standalone_dockers WHERE id = $1)', [server.destinationId]);
  return { teamId: team.id, app, ip: String(rows[0].ip) };
}

const https = async () => ({ status: 'valid' as const, issuer: "Let's Encrypt" });

describe('the DNS guide of an application', () => {
  it('gives the record with the server IP, and checks HTTPS once DNS reaches the server', async () => {
    const { teamId, app, ip } = await anApp('https://boutique.com,https://shop.boutique.com');
    const guide = await domainGuide(teamId, app.uuid, undefined, {
      lookup: async (host) => ({ a: host === 'boutique.com' ? [ip] : [], aaaa: [], cname: null }),
      checkHttps: https,
    });
    expect(guide.serverIp).toBe(ip);
    expect(guide.managed).toBe(true);
    expect(guide.domains[0]).toMatchObject({ host: 'boutique.com', status: 'ok', record: { type: 'A', name: '@', value: ip }, https: { status: 'valid' } });
    expect(guide.domains[1]).toMatchObject({ host: 'shop.boutique.com', status: 'missing', record: { name: 'shop' }, https: { status: 'not_checked' } });
  });

  it('checks domains as typed, before saving, and needs no DNS for automatic hostnames', async () => {
    const { teamId, app } = await anApp('');
    const guide = await domainGuide(teamId, app.uuid, 'https://x-1.1.2.3.4.sslip.io, autre.com', {
      lookup: async () => ({ a: ['104.21.5.9'], aaaa: [], cname: null }),
      checkHttps: https,
    });
    expect(guide.domains.map((d) => d.status)).toEqual(['automatic', 'proxied']);
  });

  it('refuses an application of another team', async () => {
    const { app } = await anApp('boutique.com');
    const other = await makeTeam();
    await expect(domainGuide(other.id, app.uuid)).rejects.toThrow(/not found/i);
  });
});
