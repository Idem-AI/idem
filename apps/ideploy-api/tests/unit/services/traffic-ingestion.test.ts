/**
 * Reading Traefik's access log: which requests reached an application, which
 * the firewall stopped.
 */
import { describe, expect, it } from 'vitest';
import { countByMinute, parseAccessLogLine } from '../../../api/services/traffic-ingestion.service';

const UUID = '68351ee5-67d8-4314-8561-0d31f62482cf';
const line = (fields: Record<string, unknown>) =>
  JSON.stringify({
    RouterName: `https-0-${UUID}@docker`,
    ClientHost: '203.0.113.7',
    RequestMethod: 'GET',
    RequestPath: '/',
    RequestHost: 'shop.example.com',
    StartUTC: '2026-10-05T10:15:42.1Z',
    ...fields,
  });

describe('parseAccessLogLine', () => {
  it('counts a request that reached the application as allowed, even when it answered 403', () => {
    const e = parseAccessLogLine(line({ DownstreamStatus: 403, OriginStatus: 403 }));
    expect(e).toMatchObject({ applicationUuid: UUID, blocked: false, status: 403 });
  });

  it('counts a 403 or 429 the proxy answered itself as blocked, with the reason', () => {
    expect(parseAccessLogLine(line({ DownstreamStatus: 403, OriginStatus: 0 }))).toMatchObject({
      blocked: true,
      reason: 'firewall',
    });
    expect(parseAccessLogLine(line({ DownstreamStatus: 429 }))).toMatchObject({ blocked: true, reason: 'rate-limit' });
  });

  it('ignores the http → https redirect, other routers, and broken lines', () => {
    expect(
      parseAccessLogLine(line({ RouterName: `http-0-${UUID}@docker`, DownstreamStatus: 308 }))
    ).toBeNull();
    expect(parseAccessLogLine(line({ RouterName: 'ideploy-crowdsec@docker', DownstreamStatus: 200 }))).toBeNull();
    expect(parseAccessLogLine('not json')).toBeNull();
  });
});

describe('countByMinute', () => {
  it('adds up allowed and blocked requests per application and minute', () => {
    const entries = [
      line({ DownstreamStatus: 200, OriginStatus: 200 }),
      line({ DownstreamStatus: 200, OriginStatus: 200, StartUTC: '2026-10-05T10:15:59Z' }),
      line({ DownstreamStatus: 403 }),
      line({ DownstreamStatus: 200, OriginStatus: 200, StartUTC: '2026-10-05T10:16:01Z' }),
    ].map((l) => parseAccessLogLine(l)!);

    expect(countByMinute(entries)).toEqual([
      { applicationUuid: UUID, bucket: '2026-10-05T10:15:00.000Z', allowed: 2, blocked: 1 },
      { applicationUuid: UUID, bucket: '2026-10-05T10:16:00.000Z', allowed: 1, blocked: 0 },
    ]);
  });
});
