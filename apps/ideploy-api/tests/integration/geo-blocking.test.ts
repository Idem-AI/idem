/**
 * Geo-blocking.
 *
 * Two properties matter.
 *
 * The selection must be **safe to express**: expanding continents, refusing a
 * choice that blocks the entire world, and warning when it blocks the country
 * the application's own server sits in.
 *
 * And it must be **attributed to the right layer**. A country rule can never
 * become a CrowdSec decision — the bouncer has no GeoIP, and the Local API
 * matches decisions by address range — so it is enforced by the proxy instead,
 * as a native Traefik middleware, and `enforcedBy: 'proxy'` is what the rest of
 * the enforcement service uses to keep the two layers from being conflated.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as geo from '../../api/services/geo-blocking.service';
import { analyseRule } from '../../api/services/firewall-enforcement.service';
import { getOrCreateConfig, listRules } from '../../api/services/firewall.service';
import { isTestDatabaseAvailable, testPool, truncateAll } from '../helpers/db';
import { makeApplication, makeManagedServer, makeProject, makeTeam } from '../helpers/factories';

beforeEach(async () => {
  if (!(await isTestDatabaseAvailable())) {
    throw new Error('Integration tests need the test database (scripts/prepare-test-db.sh).');
  }
  await truncateAll();
});

/** An application with a firewall config, ready to hold rules. */
async function anApplication(serverCountry?: string): Promise<{ teamId: number; uuid: string }> {
  const team = await makeTeam();
  const server = await makeManagedServer();
  if (serverCountry) {
    await testPool().query('UPDATE servers SET country_code = $2 WHERE id = $1', [
      server.id,
      serverCountry,
    ]);
  }
  const project = await makeProject(team.id);
  const app = await makeApplication(project.environmentId, server.destinationId);
  await getOrCreateConfig(team.id, app.uuid);
  return { teamId: team.id, uuid: app.uuid };
}

describe('the country catalogue', () => {
  it('names countries in the caller’s language', () => {
    // The interface is bilingual; ICU supplies both, so no translated list has
    // to be maintained here.
    const en = geo.listCountries('en').find((c) => c.code === 'DE');
    const fr = geo.listCountries('fr').find((c) => c.code === 'DE');

    expect(en?.name).toBe('Germany');
    expect(fr?.name).toBe('Allemagne');
  });

  it('places each country on exactly one continent', () => {
    const codes = geo.listCountries().map((c) => c.code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('does not confuse a continent code with the country sharing its letters', () => {
    // `AS` is Asia and American Samoa; `NA` is North America and Namibia.
    expect(geo.listCountries().find((c) => c.code === 'AS')?.continent).toBe('OC');
    expect(geo.listCountries().find((c) => c.code === 'NA')?.continent).toBe('AF');
  });

  it('sorts by name in the requested language, not by code', () => {
    const names = geo.listCountries('fr').map((c) => c.name);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'fr')));
  });
});

describe('expandSelection', () => {
  it('expands a continent to its countries', () => {
    const codes = geo.expandSelection({ continents: ['SA'] });

    expect(codes).toContain('BR');
    expect(codes).toContain('AR');
    expect(codes).not.toContain('FR');
  });

  it('merges continents and countries without duplicating', () => {
    const codes = geo.expandSelection({ continents: ['SA'], countries: ['BR', 'FR'] });

    expect(codes.filter((c) => c === 'BR')).toHaveLength(1);
    expect(codes).toContain('FR');
  });

  it('normalises a lower-case code', () => {
    expect(geo.expandSelection({ countries: ['fr'] })).toEqual(['FR']);
  });

  it('refuses a code that is not a country', async () => {
    // Silently dropping it would produce a rule that blocks less than the
    // operator selected, with nothing to indicate it.
    await expect(async () => geo.expandSelection({ countries: ['ZZ'] })).rejects.toThrow(
      /not a country code/i
    );
  });
});

describe('the lockout guards', () => {
  it('refuses a selection that blocks every country', async () => {
    const { teamId, uuid } = await anApplication();
    const everywhere = Object.keys(geo.CONTINENT_NAMES) as geo.ContinentCode[];

    await expect(
      geo.setGeoRule(teamId, uuid, { mode: 'block', continents: everywhere })
    ).rejects.toThrow(/every country/i);
  });

  it('refuses an allow-list that allows nothing', async () => {
    const { teamId, uuid } = await anApplication();

    await expect(
      geo.setGeoRule(teamId, uuid, { mode: 'allow_only', countries: [] })
    ).rejects.toThrow(/at least one country/i);
  });

  it('warns — but does not refuse — when blocking the server’s own country', async () => {
    // Unusual, not invalid. Refusing would be deciding for the operator with
    // less information than they have; staying silent would let them lock
    // themselves out without noticing.
    const { teamId, uuid } = await anApplication('FR');

    const result = await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['FR'] });

    expect(result.warnings.map((w) => w.code)).toContain('BLOCKS_SERVER_COUNTRY');
    expect(result.blockedCountries).toContain('FR');
  });

  it('stays quiet when the server’s country is not in the list', async () => {
    const { teamId, uuid } = await anApplication('FR');

    const result = await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });

    expect(result.warnings.map((w) => w.code)).not.toContain('BLOCKS_SERVER_COUNTRY');
  });

  it('warns how wide an allow-list really is', async () => {
    const { teamId, uuid } = await anApplication();

    const result = await geo.setGeoRule(teamId, uuid, { mode: 'allow_only', countries: ['FR'] });

    expect(result.warnings.map((w) => w.code)).toContain('ALLOW_ONLY_IS_BROAD');
  });
});

describe('saving the selection', () => {
  it('stores an allow-list as the complement, because enforcement only blocks', async () => {
    const { teamId, uuid } = await anApplication();

    const result = await geo.setGeoRule(teamId, uuid, { mode: 'allow_only', countries: ['FR'] });

    expect(result.blockedCountries).not.toContain('FR');
    expect(result.blockedCountries).toContain('RU');
    expect(result.blockedCountries).toHaveLength(geo.COUNTRY_COUNT - 1);
  });

  it('replaces the previous selection instead of adding to it', async () => {
    // Two geo rules disagreeing would leave reconciliation applying both, and
    // the interface shows one setting.
    const { teamId, uuid } = await anApplication();

    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });
    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['CN'] });

    const geoRules = (await listRules(teamId, uuid)).filter((r) => r.name === geo.GEO_RULE_NAME);
    expect(geoRules).toHaveLength(1);
  });

  it('leaves other rules alone', async () => {
    const { teamId, uuid } = await anApplication();
    const { createRule } = await import('../../api/services/firewall.service');
    await createRule(teamId, uuid, {
      name: 'block-one-address',
      conditions: [{ field: 'ip', operator: 'equals', value: '203.0.113.1' }],
    });

    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });

    expect(await listRules(teamId, uuid)).toHaveLength(2);
  });

  it('reads the selection back with names', async () => {
    const { teamId, uuid } = await anApplication();
    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['DE'] });

    const selection = await geo.getSelection(teamId, uuid, 'fr');

    expect(selection?.countries.map((c) => c.name)).toEqual(['Allemagne']);
  });

  it('returns nothing when no selection was ever made', async () => {
    const { teamId, uuid } = await anApplication();

    expect(await geo.getSelection(teamId, uuid)).toBeNull();
  });

  it('removes the rule', async () => {
    const { teamId, uuid } = await anApplication();
    await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });

    expect(await geo.removeGeoRule(teamId, uuid)).toBe(true);
    expect(await geo.getGeoRule(teamId, uuid)).toBeNull();
  });

  it('reports nothing removed when there was no rule', async () => {
    const { teamId, uuid } = await anApplication();

    expect(await geo.removeGeoRule(teamId, uuid)).toBe(false);
  });
});

describe('the rule reaches enforcement, via the proxy rather than CrowdSec', () => {
  it('is classified enforceable, attributed to the proxy layer', async () => {
    // Blocking by country is now a native Traefik middleware (see
    // docker/protection.ts), not a CrowdSec decision — the bouncer has no GeoIP
    // and the Local API matches decisions by address range, so a country
    // decision pushed there would sit looking applied while every request
    // sailed past. `enforcedBy` is what tells the two layers apart.
    const { teamId, uuid } = await anApplication();
    const { rule } = await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU', 'CN'] });

    const analysis = analyseRule(rule);

    expect(analysis.enforceability).toBe('enforceable');
    expect(analysis.enforcedBy).toBe('proxy');
    expect(analysis.reason).toBeUndefined();
  });

  it('produces one country-scoped target per country', async () => {
    const { teamId, uuid } = await anApplication();
    const { rule } = await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU', 'CN'] });

    const analysis = analyseRule(rule);

    expect(analysis.targets).toEqual(
      expect.arrayContaining([
        { scope: 'country', value: 'RU' },
        { scope: 'country', value: 'CN' },
      ])
    );
  });

  it('warns that a redeploy is needed, where the operator is looking', async () => {
    // A Docker label is read when the container starts, not while it runs — so
    // saving the rule changes nothing for a visitor until the next deploy.
    const { teamId, uuid } = await anApplication();

    const result = await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });

    expect(result.warnings[0].code).toBe('REDEPLOY_REQUIRED');
  });

  it('stores the selection in the shape the deploy pipeline reads back', async () => {
    // `application-labels.service`'s `parseGeoBlockedCountries` reads exactly
    // this shape on every deploy; a stored rule that does not match it would be
    // silently dropped from the container's labels.
    const { teamId, uuid } = await anApplication();
    const { rule } = await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU', 'CN'] });

    const raw = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
    expect(raw[0]).toMatchObject({ field: 'country', operator: 'in' });
    expect(raw[0].value).toEqual(expect.arrayContaining(['RU', 'CN']));
  });

  it('sits ahead of ordinary rules in priority', async () => {
    const { teamId, uuid } = await anApplication();
    const { rule } = await geo.setGeoRule(teamId, uuid, { mode: 'block', countries: ['RU'] });

    expect(rule.priority).toBeLessThan(100);
  });
});
