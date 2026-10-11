/**
 * Domains applied live from the proxy's file provider, routed only once their
 * DNS reaches the server, and no squatting of a domain one does not own.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { findConflicts } from '../../api/services/domain.service';
import { applyRoutes, verifyDomains } from '../../api/services/routes-file.service';
import { getDomainOptions, updateDomainOptions } from '../../api/services/domain-options.service';
import * as appService from '../../api/services/application.service';
import * as serverService from '../../api/services/server.service';
import { setRemoteExecutor } from '../../api/ssh/ssh';
import { FakeRemoteExecutor } from '../helpers/fake-executor';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';
import { closeInfrastructure } from '../helpers/teardown';

let ssh: FakeRemoteExecutor;
beforeAll(async () => {
  if (!(await isTestDatabaseAvailable())) throw new Error('Integration tests need the test database.');
});
beforeEach(async () => {
  await truncateAll();
  ssh = new FakeRemoteExecutor();
  setRemoteExecutor(ssh);
});
afterAll(async () => closeInfrastructure());

async function anApp(fqdn: string, server?: { destinationId: number }) {
  const team = await makeTeam();
  const srv = server ?? (await makeManagedServer());
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, srv.destinationId);
  await testPool().query('UPDATE applications SET fqdn = $2 WHERE id = $1', [app.id, fqdn]);
  const { rows } = await testPool().query('SELECT s.* FROM servers s JOIN standalone_dockers d ON d.server_id = s.id WHERE d.id = $1', [srv.destinationId]);
  const row = (await appService.getApplication(team.id, app.uuid))!;
  return { teamId: team.id, app: row, ip: String(rows[0].ip), server: srv, serverId: Number(rows[0].id) };
}

const pointsTo = (ip: string, hosts: string[]) => async (host: string) => ({ a: hosts.includes(host) ? [ip] : [], aaaa: [], cname: null });

describe('domains applied live', () => {
  it('writes the routes of verified domains only, and marks the application as routed from the file', async () => {
    const { teamId, app, ip, serverId } = await anApp('https://boutique.com,https://pending.com');
    const server = (await serverService.getExecutionServer(teamId, serverId))!;
    const key = (await serverService.getExecutionKey(server))!;

    const { routed, waiting } = await applyRoutes(server, key, app, { port: 3000, look: pointsTo(ip, ['boutique.com']) });
    expect(routed).toEqual(['boutique.com']);
    expect(waiting).toEqual(['pending.com']);

    const write = ssh.calls.find((c) => c.command.includes('routes-') && c.command.includes('base64 -d'))!.command;
    const file = YAML.parse(Buffer.from(/echo '([^']+)'/.exec(write)![1], 'base64').toString());
    expect(Object.values(file.http.routers).map((r) => (r as { rule: string }).rule)).toEqual(['Host(`boutique.com`)', 'Host(`boutique.com`)']);
    const { rows } = await testPool().query('SELECT routes_file_at FROM applications WHERE id = $1', [app.id]);
    expect(rows[0].routes_file_at).not.toBeNull();
  });
});

describe('no squatting', () => {
  it('lets a team claim a domain another team declared without owning it, but not a verified one', async () => {
    const squatter = await anApp('https://boutique.com');
    await verifyDomains(squatter.app, squatter.ip, pointsTo('9.9.9.9', ['boutique.com']));
    const other = await makeTeam();
    expect(await findConflicts(['https://boutique.com'], undefined, other.id)).toEqual([]);

    // Its DNS now reaches the claimer's server: the domain is theirs.
    await verifyDomains(squatter.app, squatter.ip, pointsTo(squatter.ip, ['boutique.com']));
    expect((await findConflicts(['https://boutique.com'], undefined, other.id)).length).toBe(1);
  });

  it('still blocks two resources of the same team sharing a domain', async () => {
    const first = await anApp('https://boutique.com');
    expect((await findConflicts(['https://boutique.com'], undefined, first.teamId)).length).toBe(1);
  });

  it('on a shared server, keeps the domain with the application that verified it first', async () => {
    const first = await anApp('https://boutique.com');
    await verifyDomains(first.app, first.ip, pointsTo(first.ip, ['boutique.com']));
    const second = await anApp('https://boutique.com', first.server);
    const statuses = await verifyDomains(second.app, second.ip, pointsTo(second.ip, ['boutique.com']));
    expect(statuses.get('boutique.com')).toBe('taken');
  });
});

describe('domain options', () => {
  it('saves HTTPS, HSTS, primary redirect and www choice, and refuses HSTS without HTTPS', async () => {
    const { teamId, app } = await anApp('https://boutique.com');
    expect(await getDomainOptions(teamId, app.uuid)).toEqual({ forceHttps: true, hsts: false, redirectToPrimary: false, redirect: 'both' });
    expect(await updateDomainOptions(teamId, app.uuid, { hsts: true, redirectToPrimary: true, redirect: 'non-www' })).toEqual({
      forceHttps: true,
      hsts: true,
      redirectToPrimary: true,
      redirect: 'non-www',
    });
    await expect(updateDomainOptions(teamId, app.uuid, { forceHttps: false, hsts: true })).rejects.toThrow(/HSTS/);
  });
});
