/**
 * Placement policy: which managed server is most ready to take a new workspace.
 *
 * The policy is pure (assessReadiness / compareCandidates), so every rule is
 * tested here without a database or a server.
 */
import { describe, expect, it } from 'vitest';
import {
  assessReadiness,
  compareCandidates,
  ManagedServerCandidate,
  METRICS_MAX_AGE_MS,
  parseMemoryLimit,
  ServerCapacity,
} from '../../../api/services/server-scheduling.service';

const NOW = new Date('2026-10-03T12:00:00Z');

/** A healthy 4-core / 8 GB / 100 GB server measured a minute ago, half used. */
function capacity(overrides: Partial<ServerCapacity> = {}): ServerCapacity {
  return {
    cpuCores: 4,
    load1m: 2,
    ramMb: 8192,
    memAvailableMb: 4096,
    diskGb: 100,
    diskFreeGb: 50,
    resourcesUpdatedAt: new Date(NOW.getTime() - 60_000),
    reservedMemoryMb: 0,
    resourceCount: 10,
    maxResources: 50,
    ...overrides,
  };
}

function candidate(id: number, cap: ServerCapacity, loadScore = 0): ManagedServerCandidate {
  return {
    id,
    uuid: `uuid-${id}`,
    name: `server-${id}`,
    countryCode: 'DE',
    loadScore,
    capacity: cap,
    readiness: assessReadiness(cap, undefined, NOW),
  };
}

describe('parseMemoryLimit', () => {
  it('reads Docker memory limits as megabytes', () => {
    expect(parseMemoryLimit('512m')).toBe(512);
    expect(parseMemoryLimit('2g')).toBe(2048);
    expect(parseMemoryLimit('2G')).toBe(2048);
    expect(parseMemoryLimit('1024k')).toBe(1);
    expect(parseMemoryLimit('536870912')).toBe(512);
  });

  it('treats "0", empty and unreadable values as no limit', () => {
    expect(parseMemoryLimit('0')).toBe(0);
    expect(parseMemoryLimit('')).toBe(0);
    expect(parseMemoryLimit(null)).toBe(0);
    expect(parseMemoryLimit('lots')).toBe(0);
  });
});

describe('assessReadiness', () => {
  it('scores a measured server between 0 and 1', () => {
    const r = assessReadiness(capacity(), undefined, NOW);

    expect(r.measured).toBe(true);
    expect(r.excluded).toBeNull();
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('gives a higher score to the server with more free memory, CPU and disk', () => {
    const idle = assessReadiness(capacity({ load1m: 0.2, memAvailableMb: 7000, diskFreeGb: 90 }), undefined, NOW);
    const busy = assessReadiness(capacity({ load1m: 3.8, memAvailableMb: 1000, diskFreeGb: 20 }), undefined, NOW);

    expect(idle.score).toBeGreaterThan(busy.score);
  });

  it('counts memory already promised to hosted resources, not only current usage', () => {
    // 6 GB available right now, but 7 GB of the 8 GB are reserved by limits.
    const r = assessReadiness(capacity({ memAvailableMb: 6000, reservedMemoryMb: 7168 }), undefined, NOW);

    expect(r.freeMemoryMb).toBe(1024);
  });

  it('excludes a server without enough free memory for the request', () => {
    const r = assessReadiness(capacity({ memAvailableMb: 1500 }), { memoryMb: 2048 }, NOW);

    expect(r.excluded).toBe('memory');
  });

  it('excludes a server below the memory floor even when nothing is requested', () => {
    expect(assessReadiness(capacity({ memAvailableMb: 100 }), undefined, NOW).excluded).toBe('memory');
  });

  it('excludes a server with less than 10% free disk', () => {
    expect(assessReadiness(capacity({ diskFreeGb: 5 }), undefined, NOW).excluded).toBe('disk');
  });

  it('excludes a server that hosts its maximum number of resources', () => {
    expect(assessReadiness(capacity({ resourceCount: 50 }), undefined, NOW).excluded).toBe('full');
  });

  it('does not trust stale measurements', () => {
    const stale = capacity({ resourcesUpdatedAt: new Date(NOW.getTime() - METRICS_MAX_AGE_MS - 1000) });
    const r = assessReadiness(stale, undefined, NOW);

    expect(r.measured).toBe(false);
    expect(r.excluded).toBeNull();
  });

  it('treats a never-measured server as unmeasured, not as excluded', () => {
    const r = assessReadiness(capacity({ resourcesUpdatedAt: null, memAvailableMb: null }), undefined, NOW);

    expect(r).toMatchObject({ measured: false, excluded: null });
  });

  it('scores an unknown component as average instead of failing', () => {
    const r = assessReadiness(capacity({ cpuCores: null, load1m: null, diskGb: null, diskFreeGb: null }), undefined, NOW);

    expect(r.excluded).toBeNull();
    expect(r.score).toBeGreaterThan(0);
  });
});

describe('compareCandidates', () => {
  it('ranks measured servers by readiness, best first', () => {
    const busy = candidate(1, capacity({ load1m: 3.9, memAvailableMb: 800 }));
    const idle = candidate(2, capacity({ load1m: 0.1, memAvailableMb: 7500 }));

    expect([busy, idle].sort(compareCandidates).map((c) => c.id)).toEqual([2, 1]);
  });

  it('puts measured servers before unmeasured ones', () => {
    const unmeasured = candidate(1, capacity({ resourcesUpdatedAt: null }), 0);
    const measured = candidate(2, capacity({ load1m: 3.9, memAvailableMb: 600 }), 40);

    expect([unmeasured, measured].sort(compareCandidates).map((c) => c.id)).toEqual([2, 1]);
  });

  it('orders unmeasured servers by the number of resources they host', () => {
    const crowded = candidate(1, capacity({ resourcesUpdatedAt: null }), 30);
    const empty = candidate(2, capacity({ resourcesUpdatedAt: null }), 2);

    expect([crowded, empty].sort(compareCandidates).map((c) => c.id)).toEqual([2, 1]);
  });
});
