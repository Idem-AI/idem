import { describe, expect, it } from 'vitest';
import { autoscaleSettings, decide, freeMemoryMb, ScaleInput } from '../../../api/autoscale/autoscaler';

const settings = { ...autoscaleSettings({}), enabled: true, min: 1, max: 3, cooldownMs: 600_000, minFreeMemoryMb: 768 };
const base: ScaleInput = {
  demand: 0,
  perWorker: 3,
  running: 1,
  stoppedElastic: 2,
  runningElastic: 0,
  freeMemoryMb: 2000,
  lastBusyAt: 0,
  now: 1_000_000,
  settings,
};

describe('worker autoscaling', () => {
  it('starts a worker when the jobs ready to run exceed what the running ones take', () => {
    expect(decide({ ...base, demand: 3 }).action).toBe('hold');
    expect(decide({ ...base, demand: 4 })).toMatchObject({ action: 'up', wanted: 2 });
    expect(decide({ ...base, demand: 20 })).toMatchObject({ action: 'up', wanted: 3 });
  });

  it('never goes above the maximum, nor starts without an elastic worker or with the host short of memory', () => {
    expect(decide({ ...base, demand: 20, running: 3, stoppedElastic: 0, runningElastic: 2 }).action).toBe('hold');
    expect(decide({ ...base, demand: 9, stoppedElastic: 0 })).toMatchObject({ action: 'hold', reason: 'no elastic worker left to start' });
    expect(decide({ ...base, demand: 9, freeMemoryMb: 500 }).reason).toMatch(/memory low/);
  });

  it('stops an elastic worker only after the cool-down, and never a fixed one', () => {
    const quiet = { ...base, demand: 0, running: 2, runningElastic: 1, stoppedElastic: 1 };
    expect(decide({ ...quiet, lastBusyAt: quiet.now - 60_000 })).toMatchObject({ action: 'hold', reason: 'cooling down' });
    expect(decide({ ...quiet, lastBusyAt: quiet.now - 700_000 })).toMatchObject({ action: 'down', wanted: 1 });
    expect(decide({ ...quiet, runningElastic: 0, lastBusyAt: 0 }).action).toBe('hold');
  });

  it('reads the host memory available', () => {
    expect(freeMemoryMb('MemTotal: 8000000 kB\nMemAvailable:    1048576 kB\n')).toBe(1024);
    expect(freeMemoryMb('nothing')).toBeNull();
  });

  it('is off unless enabled, with safe defaults', () => {
    expect(autoscaleSettings({}).enabled).toBe(false);
    expect(autoscaleSettings({ AUTOSCALE_ENABLED: 'true', AUTOSCALE_MAX: '5' })).toMatchObject({ enabled: true, max: 5, min: 1 });
  });
});
