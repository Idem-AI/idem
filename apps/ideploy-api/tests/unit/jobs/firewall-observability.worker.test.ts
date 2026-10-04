/**
 * The firewall worker's queue.
 *
 * It used to share `scheduler` with users' scheduled tasks. BullMQ hands every
 * job of a queue to any worker on it, so this worker received scheduled tasks,
 * ignored them, and marked them done: those tasks silently never ran.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processFirewallJob, PURGE_JOB, SYNC_JOB } from '../../../api/jobs/firewall-observability.worker';
import { QUEUE_NAMES } from '../../../api/queue/queues';

const { purgeExpired, listServersToSync, syncServer } = vi.hoisted(() => ({
  purgeExpired: vi.fn(),
  listServersToSync: vi.fn(),
  syncServer: vi.fn(),
}));
vi.mock('../../../api/services/firewall-observability.service', () => ({
  purgeExpired,
  listServersToSync,
  syncServer,
}));

const job = (name: string) => ({ name }) as Parameters<typeof processFirewallJob>[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('firewall observability worker', () => {
  it('has a queue of its own, apart from scheduled tasks', () => {
    expect(QUEUE_NAMES.firewall).not.toBe(QUEUE_NAMES.scheduler);
  });

  it('purges on the purge job', async () => {
    await processFirewallJob(job(PURGE_JOB));

    expect(purgeExpired).toHaveBeenCalledOnce();
    expect(syncServer).not.toHaveBeenCalled();
  });

  it('syncs every server, and one failure does not stop the others', async () => {
    listServersToSync.mockResolvedValue([1, 2]);
    syncServer.mockRejectedValueOnce(new Error('unreachable'));

    await processFirewallJob(job(SYNC_JOB));

    expect(syncServer).toHaveBeenCalledTimes(2);
    expect(syncServer).toHaveBeenLastCalledWith(2);
  });

  it('does nothing with a job it does not know', async () => {
    await processFirewallJob(job('scheduled-task'));

    expect(purgeExpired).not.toHaveBeenCalled();
    expect(syncServer).not.toHaveBeenCalled();
  });
});
