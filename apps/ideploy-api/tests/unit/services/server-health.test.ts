/**
 * Health monitoring state machine.
 *
 * The behaviours worth protecting here are all about *when not to notify*:
 * paging on a one-off network blip, or once per minute for a week while a server
 * is down, is how alerting gets muted and then ignored. Every case below is a
 * timing scenario that would be impractical to stage against real servers.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISK_THRESHOLD_PERCENT,
  HealthProbe,
  UNREACHABLE_ALERT_THRESHOLD,
  decideTransitions,
  describeNotification,
  parseHealthProbe,
  probeServer,
} from '../../../api/services/server-health.service';
import { useFakeExecutor } from '../../helpers/fake-executor';
import { privateKeyRow, serverRow } from '../../helpers/rows';

const ssh = useFakeExecutor();

/** Previous monitoring state, healthy unless overridden. */
function state(
  overrides: Partial<{
    unreachableCount: number;
    unreachableNotificationSent: boolean;
    diskNotificationSent: boolean;
    diskThresholdPercent: number;
  }> = {}
) {
  return {
    unreachableCount: 0,
    unreachableNotificationSent: false,
    diskNotificationSent: false,
    diskThresholdPercent: DEFAULT_DISK_THRESHOLD_PERCENT,
    ...overrides,
  };
}

function probe(overrides: Partial<HealthProbe> = {}): HealthProbe {
  return { reachable: true, diskUsedPercent: 40, output: '', ...overrides };
}

const kinds = (notifications: { kind: string }[]) => notifications.map((n) => n.kind);

describe('parseHealthProbe', () => {
  it('extracts the disk percentage', () => {
    expect(parseHealthProbe('ALIVE\nDISK_USED_PCT=73\n', true)).toMatchObject({
      reachable: true,
      diskUsedPercent: 73,
    });
  });

  it('reports the disk as unknown when df gave nothing', () => {
    expect(parseHealthProbe('ALIVE\nDISK_USED_PCT=\n', true).diskUsedPercent).toBeNull();
  });
});

describe('decideTransitions — reachability', () => {
  it('does not notify on the first failure', () => {
    // Almost always a transient blip; alerting here is how people learn to
    // ignore the alerts.
    const { unreachableCount, notifications } = decideTransitions(
      state(),
      probe({ reachable: false })
    );

    expect(unreachableCount).toBe(1);
    expect(notifications).toEqual([]);
  });

  it(`notifies exactly once, on failure ${UNREACHABLE_ALERT_THRESHOLD}`, () => {
    const result = decideTransitions(
      state({ unreachableCount: UNREACHABLE_ALERT_THRESHOLD - 1 }),
      probe({ reachable: false })
    );

    expect(result.unreachableCount).toBe(UNREACHABLE_ALERT_THRESHOLD);
    expect(kinds(result.notifications)).toEqual(['unreachable']);
  });

  it('stays silent on subsequent failures once alerted', () => {
    // A server down for a week must produce one alert, not ten thousand.
    const result = decideTransitions(
      state({ unreachableCount: 500, unreachableNotificationSent: true }),
      probe({ reachable: false })
    );

    expect(result.notifications).toEqual([]);
    expect(result.unreachableCount).toBe(501);
  });

  it('notifies recovery, and only when an alert had been sent', () => {
    const recovered = decideTransitions(
      state({ unreachableCount: 7, unreachableNotificationSent: true }),
      probe({ reachable: true })
    );
    expect(kinds(recovered.notifications)).toEqual(['recovered']);
    expect(recovered.unreachableCount).toBe(0);

    const neverAlerted = decideTransitions(
      state({ unreachableCount: 2, unreachableNotificationSent: false }),
      probe({ reachable: true })
    );
    expect(neverAlerted.notifications).toEqual([]);
  });

  it('resets the counter as soon as the server answers', () => {
    // Flapping must not accumulate towards the threshold across recoveries.
    expect(decideTransitions(state({ unreachableCount: 2 }), probe()).unreachableCount).toBe(0);
  });

  it('makes no claim about the disk while the server is unreachable', () => {
    // We cannot observe the disk without a session, so neither "high" nor
    // "recovered" would be honest.
    const result = decideTransitions(
      state({ diskNotificationSent: true }),
      probe({ reachable: false })
    );

    expect(result.notifications).toEqual([]);
  });
});

describe('decideTransitions — disk usage', () => {
  it('notifies when usage crosses the threshold', () => {
    const result = decideTransitions(state(), probe({ diskUsedPercent: 85 }));

    expect(kinds(result.notifications)).toEqual(['disk_high']);
  });

  it('notifies at exactly the threshold', () => {
    const result = decideTransitions(
      state({ diskThresholdPercent: 80 }),
      probe({ diskUsedPercent: 80 })
    );

    expect(kinds(result.notifications)).toEqual(['disk_high']);
  });

  it('stays silent while usage remains high', () => {
    const result = decideTransitions(
      state({ diskNotificationSent: true }),
      probe({ diskUsedPercent: 92 })
    );

    expect(result.notifications).toEqual([]);
  });

  it('notifies once usage drops back below the threshold', () => {
    const result = decideTransitions(
      state({ diskNotificationSent: true }),
      probe({ diskUsedPercent: 40 })
    );

    expect(kinds(result.notifications)).toEqual(['disk_recovered']);
  });

  it('honours a per-server threshold', () => {
    const strict = decideTransitions(
      state({ diskThresholdPercent: 50 }),
      probe({ diskUsedPercent: 60 })
    );
    expect(kinds(strict.notifications)).toEqual(['disk_high']);

    const lenient = decideTransitions(
      state({ diskThresholdPercent: 95 }),
      probe({ diskUsedPercent: 60 })
    );
    expect(lenient.notifications).toEqual([]);
  });

  it('says nothing when the disk reading is unavailable', () => {
    const result = decideTransitions(state(), probe({ diskUsedPercent: null }));
    expect(result.notifications).toEqual([]);
  });

  it('can report recovery and a high disk in the same check', () => {
    // A server that came back up with a full disk needs both facts.
    const result = decideTransitions(
      state({ unreachableCount: 5, unreachableNotificationSent: true }),
      probe({ reachable: true, diskUsedPercent: 95 })
    );

    expect(kinds(result.notifications)).toEqual(['recovered', 'disk_high']);
  });
});

describe('describeNotification', () => {
  const server = serverRow({ name: 'web-1', ip: '203.0.113.10' });

  it('names the server and the consequence when unreachable', () => {
    const message = describeNotification(server, { kind: 'unreachable' });

    expect(message).toContain('web-1');
    expect(message).toContain('203.0.113.10');
    expect(message).toMatch(/deployments and backups/i);
  });

  it('tells the user what to do about a full disk', () => {
    const message = describeNotification(server, {
      kind: 'disk_high',
      usedPercent: 91,
      threshold: 80,
    });

    expect(message).toContain('91%');
    expect(message).toMatch(/free up space|cleanup/i);
  });

  it('confirms recovery plainly', () => {
    expect(describeNotification(server, { kind: 'recovered' })).toMatch(/reachable again/i);
  });
});

describe('probeServer', () => {
  const server = serverRow();
  const key = privateKeyRow();

  it('reports a healthy server with its disk usage', async () => {
    ssh.connection({ ok: true }).on(/ALIVE/, { stdout: 'ALIVE\nDISK_USED_PCT=55\n' });

    expect(await probeServer(server, key)).toMatchObject({
      reachable: true,
      diskUsedPercent: 55,
    });
  });

  it('reports unreachable when the connection fails, without probing', async () => {
    ssh.connection({ ok: false, output: 'Connection timed out' });

    const result = await probeServer(server, key);

    expect(result.reachable).toBe(false);
    expect(result.output).toContain('Connection timed out');
    expect(ssh.calls).toHaveLength(0);
  });

  it('reports unreachable when the probe command fails', async () => {
    ssh.connection({ ok: true }).on(/ALIVE/, { exitCode: 255, stderr: 'Broken pipe' });

    expect((await probeServer(server, key)).reachable).toBe(false);
  });

  it('treats a session that answers without the marker as unreachable', async () => {
    // A truncated or hijacked session must not read as healthy.
    ssh.connection({ ok: true }).on(/ALIVE/, { stdout: 'some other output' });

    expect((await probeServer(server, key)).reachable).toBe(false);
  });

  it('never throws — an unreachable host is a result, not an error', async () => {
    ssh.connection({ ok: true }).on(/ALIVE/, { exitCode: -1, stderr: 'spawn ENOENT' });

    await expect(probeServer(server, key)).resolves.toMatchObject({ reachable: false });
  });

  it('collects liveness and disk usage in one round trip', async () => {
    ssh.connection({ ok: true }).on(/ALIVE/, { stdout: 'ALIVE\nDISK_USED_PCT=10\n' });

    await probeServer(server, key);

    expect(ssh.calls).toHaveLength(1);
  });
});
