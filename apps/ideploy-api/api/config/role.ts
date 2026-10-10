/**
 * What this process runs, from IDEPLOY_ROLE:
 *
 *   all    — the API and the background workers (default; development, small installs)
 *   api    — HTTP only: requests stay fast whatever the deployments are doing
 *   worker — background jobs only: several can run side by side, and one that
 *            crashes or restarts never takes the API down with it
 */
export type ProcessRole = 'all' | 'api' | 'worker';

export function processRole(env: NodeJS.ProcessEnv = process.env): ProcessRole {
  const role = (env.IDEPLOY_ROLE || 'all').toLowerCase();
  return role === 'api' || role === 'worker' ? role : 'all';
}

export const runsApi = (role = processRole()) => role !== 'worker';
export const runsWorkers = (role = processRole()) => role !== 'api';
