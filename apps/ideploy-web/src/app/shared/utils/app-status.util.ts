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
  if (!status) return { icon: 'pi pi-minus-circle', color: 'var(--color-text-tertiary)', labelKey: 'appStatus.notDeployed' };
  if (status.startsWith('running')) {
    return status.includes('unhealthy')
      ? { icon: 'pi pi-exclamation-triangle', color: 'var(--color-warning)', labelKey: 'appStatus.unhealthy' }
      : { icon: 'pi pi-check-circle', color: 'var(--color-success)', labelKey: 'appStatus.running' };
  }
  if (status === 'exited') return { icon: 'pi pi-stop-circle', color: 'var(--color-text-tertiary)', labelKey: 'appStatus.stopped' };
  return { icon: 'pi pi-question-circle', color: 'var(--color-text-tertiary)', labelKey: 'appStatus.unknown' };
}
