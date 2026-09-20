/**
 * An application's `status` column is the container's own reported state,
 * not a fixed enum — `running`, `running:unhealthy` (a health check defined
 * on the container failing) and `exited` are the values actually written
 * (`application.service.ts::setStatus`, `deployment.worker.ts::finalize`);
 * anything else (including null, before the first deploy) means nobody has
 * started this application's container yet.
 */
export interface AppStatusDisplay {
  icon: string;
  color: string;
  labelKey: string;
}

export function appStatusDisplay(status: string | null | undefined): AppStatusDisplay {
  if (!status) return { icon: 'fa-solid fa-circle-minus', color: 'var(--color-text-tertiary)', labelKey: 'appStatus.notDeployed' };
  if (status.startsWith('running')) {
    return status.includes('unhealthy')
      ? { icon: 'fa-solid fa-triangle-exclamation', color: 'var(--color-warning)', labelKey: 'appStatus.unhealthy' }
      : { icon: 'fa-solid fa-circle-check', color: 'var(--color-success)', labelKey: 'appStatus.running' };
  }
  if (status === 'exited') return { icon: 'fa-solid fa-circle-stop', color: 'var(--color-text-tertiary)', labelKey: 'appStatus.stopped' };
  return { icon: 'fa-solid fa-circle-question', color: 'var(--color-text-tertiary)', labelKey: 'appStatus.unknown' };
}
