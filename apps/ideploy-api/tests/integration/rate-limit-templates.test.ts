/**
 * Rate limiting, from a template pick (or custom numbers) to a deployed label.
 *
 * The property worth testing twice: this is real, temporal rate limiting —
 * unlike Laravel's `RateLimitTemplateService`, whose numbers are generated for
 * the description text and then never saved, let alone enforced. Here the
 * numbers are what `application-labels.service` reads back on every deploy, so
 * the suite checks the whole path, not just the storage.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as rateLimit from '../../api/services/rate-limit-templates.service';
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

async function aRoutableApplication(): Promise<{ teamId: number; uuid: string }> {
  const team = await makeTeam();
  const server = await makeManagedServer();
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

describe('listTemplates', () => {
  it('gives every template a burst at or above its own average', () => {
    // A burst below the average is a limit tighter than the average advertised
    // — the same trap `setCustomRateLimit` refuses for a caller-supplied one.
    for (const template of rateLimit.listTemplates()) {
      expect(template.burst, template.key).toBeGreaterThanOrEqual(template.averagePerSecond);
    }
  });

  it('gives every template a positive concurrency cap', () => {
    for (const template of rateLimit.listTemplates()) {
      expect(template.concurrencyLimit, template.key).toBeGreaterThan(0);
    }
  });
});

describe('applyTemplate', () => {
  it('saves the named template’s numbers', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    const settings = await rateLimit.applyTemplate(teamId, uuid, 'api_heavy');

    expect(settings).toMatchObject({
      averagePerSecond: rateLimit.RATE_LIMIT_TEMPLATES.api_heavy.averagePerSecond,
      template: 'api_heavy',
    });
  });

  it('rejects an unknown template rather than silently doing nothing', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    await expect(rateLimit.applyTemplate(teamId, uuid, 'nonexistent')).rejects.toThrow(
      /not a rate limit template/i
    );
  });

  it('replaces a previous template rather than adding to it', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    await rateLimit.applyTemplate(teamId, uuid, 'strict');
    const settings = await rateLimit.applyTemplate(teamId, uuid, 'lenient');

    expect(settings.template).toBe('lenient');
    expect(await rateLimit.getRateLimit(teamId, uuid)).toMatchObject({ template: 'lenient' });
  });
});

describe('setCustomRateLimit', () => {
  it('derives a burst when none is given, above the average', async () => {
    // Traefik's own default burst is 1, which refuses the second of two
    // simultaneous requests.
    const { teamId, uuid } = await aRoutableApplication();

    const settings = await rateLimit.setCustomRateLimit(teamId, uuid, {
      averagePerSecond: 5,
      concurrencyLimit: 10,
    });

    expect(settings.burst).toBeGreaterThan(settings.averagePerSecond);
    expect(settings.template).toBe('custom');
  });

  it('rejects a burst below the average', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    await expect(
      rateLimit.setCustomRateLimit(teamId, uuid, {
        averagePerSecond: 20,
        burst: 5,
        concurrencyLimit: 10,
      })
    ).rejects.toThrow(/burst must be at least the average/i);
  });

  it('rejects a zero or negative average', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    await expect(
      rateLimit.setCustomRateLimit(teamId, uuid, { averagePerSecond: 0, concurrencyLimit: 10 })
    ).rejects.toThrow(/greater than zero/i);
  });

  it('rejects a zero or negative concurrency cap', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    await expect(
      rateLimit.setCustomRateLimit(teamId, uuid, { averagePerSecond: 10, concurrencyLimit: 0 })
    ).rejects.toThrow(/greater than zero/i);
  });
});

describe('getRateLimit / clearRateLimit', () => {
  it('returns null when nothing is configured', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    expect(await rateLimit.getRateLimit(teamId, uuid)).toBeNull();
  });

  it('clears a configured limit and reports it was removed', async () => {
    const { teamId, uuid } = await aRoutableApplication();
    await rateLimit.applyTemplate(teamId, uuid, 'standard');

    expect(await rateLimit.clearRateLimit(teamId, uuid)).toBe(true);
    expect(await rateLimit.getRateLimit(teamId, uuid)).toBeNull();
  });

  it('reports nothing removed when there was nothing to clear', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    expect(await rateLimit.clearRateLimit(teamId, uuid)).toBe(false);
  });
});

describe('the configured limit reaches the deployed labels', () => {
  it('carries the average, burst, period and concurrency onto the container', async () => {
    const { teamId, uuid } = await aRoutableApplication();
    await rateLimit.applyTemplate(teamId, uuid, 'strict');
    const template = rateLimit.RATE_LIMIT_TEMPLATES.strict;

    const app = await getApplication(teamId, uuid);
    const labels = await resolveApplicationLabels(app!);

    expect(labels).toContain(`traefik.http.middlewares.ratelimit-${uuid}.ratelimit.average=${template.averagePerSecond}`);
    expect(labels).toContain(`traefik.http.middlewares.ratelimit-${uuid}.ratelimit.burst=${template.burst}`);
    expect(labels).toContain(`traefik.http.middlewares.inflight-${uuid}.inflightreq.amount=${template.concurrencyLimit}`);
  });

  it('references both middlewares on the router, not only declares them', async () => {
    const { teamId, uuid } = await aRoutableApplication();
    await rateLimit.applyTemplate(teamId, uuid, 'standard');

    const app = await getApplication(teamId, uuid);
    const labels = await resolveApplicationLabels(app!);
    const middlewaresLabel = labels.find((l) =>
      l.startsWith(`traefik.http.routers.https-0-${uuid}.middlewares=`)
    );

    expect(middlewaresLabel).toContain(`ratelimit-${uuid}`);
    expect(middlewaresLabel).toContain(`inflight-${uuid}`);
  });

  it('emits neither label when the firewall is turned off', async () => {
    const { teamId, uuid } = await aRoutableApplication();
    await rateLimit.applyTemplate(teamId, uuid, 'standard');
    await updateConfig(teamId, uuid, { enabled: false });

    const app = await getApplication(teamId, uuid);
    const labels = await resolveApplicationLabels(app!);

    expect(labels.some((l) => l.includes('ratelimit-') || l.includes('inflight-'))).toBe(false);
  });

  it('emits nothing when no rate limit is configured', async () => {
    const { teamId, uuid } = await aRoutableApplication();

    const app = await getApplication(teamId, uuid);
    const labels = await resolveApplicationLabels(app!);

    expect(labels.some((l) => l.includes('ratelimit-') || l.includes('inflight-'))).toBe(false);
  });
});
