/**
 * Geo-blocking, from a saved rule to a deployed label.
 *
 * A rule the interface reports as "enforceable, by the proxy" is a promise: at
 * the next deploy, the container will actually carry a label refusing the named
 * countries. This is the test that promise keeps — without it, `geo.setGeoRule`
 * and `docker/protection.ts` could each work perfectly in isolation while the
 * wiring between them silently did nothing, which is exactly the failure this
 * phase exists to catch.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as geo from '../../api/services/geo-blocking.service';
import { getOrCreateConfig, updateConfig } from '../../api/services/firewall.service';
import { getApplication } from '../../api/services/application.service';
import { resolveApplicationLabels } from '../../api/services/application-labels.service';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';

beforeEach(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error('Integration tests need the test database (scripts/prepare-test-db.sh).');
  }
  await truncateAll();
});

/** A routable application: a domain, a Traefik-fronted server, an enabled firewall. */
async function aRoutableApplication(): Promise<{ teamId: number; uuid: string }> {
  const team = await makeTeam();
  const server = await makeManagedServer();
  // The factory leaves `servers.proxy` empty, which resolves to no proxy at all
  // and skips routing labels entirely — this suite is about those labels.
  await testPool().query(`UPDATE servers SET proxy = '{"type":"traefik"}'::jsonb WHERE id = $1`, [
    server.id,
  ]);
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  await testPool().query('UPDATE applications SET fqdn = $2 WHERE id = $1', [
    app.id,
    'https://shop.example.com',
  ]);
  await getOrCreateConfig(team.id, app.uuid);
  await updateConfig(team.id, app.uuid, { enabled: true });
  return { teamId: team.id, uuid: app.uuid };
}

async function labelsFor(teamId: number, uuid: string): Promise<string[]> {
  const app = await getApplication(teamId, uuid);
  if (!app) throw new Error('fixture application vanished');
  return resolveApplicationLabels(app);
}

describe('a saved geo rule reaches the deployed labels', () => {
  it('carries the blocked countries onto the container', async () => {
    const { teamId, uuid } = await aRoutableApplication();
    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU', 'CN'] });

    const labels = await labelsFor(teamId, uuid);

    const countries = labels.filter((l) => l.includes('.plugin.geoblock.countries['));
    expect(countries.some((l) => l.endsWith('=RU'))).toBe(true);
    expect(countries.some((l) => l.endsWith('=CN'))).toBe(true);
  });

  it('references the middleware on the router, not only declares it', async () => {
    const { teamId, uuid } = await aRoutableApplication();
    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });

    const labels = await labelsFor(teamId, uuid);
    const middlewaresLabel = labels.find((l) =>
      l.startsWith('traefik.http.routers.https-0-' + uuid + '.middlewares=')
    );

    expect(middlewaresLabel).toBeDefined();
    expect(middlewaresLabel).toContain('geoblock-' + uuid);
  });

  it('stores an allow-list as the complement, and that is what reaches the label', async () => {
    const { teamId, uuid } = await aRoutableApplication();
    await geo.setGeoRule(teamId, uuid, { mode: 'allow_only', countries: ['FR'] });

    const labels = await labelsFor(teamId, uuid);

    expect(labels.some((l) => l.includes('.plugin.geoblock.countries[') && l.endsWith('=FR'))).toBe(
      false
    );
    expect(labels.some((l) => l.includes('.plugin.geoblock.countries['))).toBe(true);
  });

  it('emits no geo label when the firewall is turned off, even with a rule saved', async () => {
    // The rule still exists; `firewallEnabled` is the gate, mirroring the same
    // gate the CrowdSec bouncer's own labels are already subject to.
    const { teamId, uuid } = await aRoutableApplication();
    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });
    await updateConfig(teamId, uuid, { enabled: false });

    const labels = await labelsFor(teamId, uuid);

    expect(labels.some((l) => l.includes('geoblock'))).toBe(false);
  });

  it('emits no geo label when there is no geo rule at all', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    const labels = await labelsFor(teamId, uuid);

    expect(labels.some((l) => l.includes('geoblock'))).toBe(false);
  });

  it('drops the label once the rule is removed', async () => {
    const { teamId, uuid } = await aRoutableApplication();
    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });
    await geo.removeGeoRule(teamId, uuid);

    const labels = await labelsFor(teamId, uuid);

    expect(labels.some((l) => l.includes('geoblock'))).toBe(false);
  });
});
