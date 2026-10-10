import { describe, expect, it } from 'vitest';
import { processRole, runsApi, runsWorkers } from '../../../api/config/role';
import { workerConcurrency } from '../../../api/queue/worker';

describe('process role', () => {
  it('runs everything by default, the API or the workers alone when asked', () => {
    expect(processRole({})).toBe('all');
    expect(processRole({ IDEPLOY_ROLE: 'API' })).toBe('api');
    expect(processRole({ IDEPLOY_ROLE: 'nonsense' })).toBe('all');
    expect([runsApi('api'), runsWorkers('api')]).toEqual([true, false]);
    expect([runsApi('worker'), runsWorkers('worker')]).toEqual([false, true]);
    expect([runsApi('all'), runsWorkers('all')]).toEqual([true, true]);
  });

  it('takes a queue concurrency from the environment, else the default', () => {
    expect(workerConcurrency('ideploy-deployments', 3, { WORKER_CONCURRENCY_DEPLOYMENTS: '8' })).toBe(8);
    expect(workerConcurrency('ideploy-deployments', 3, { WORKER_CONCURRENCY_DEPLOYMENTS: '0' })).toBe(3);
    expect(workerConcurrency('ideploy-pipelines', 2, {})).toBe(2);
  });
});
