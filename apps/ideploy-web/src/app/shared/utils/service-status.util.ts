import { Service } from '../models/ideploy.models';

/**
 * Display for a service stack's aggregated status (`listServices()`'s own
 * `status` field — computed across every container in the stack, see
 * `service.service.ts::listServices`). `partial` is the state a single
 * blanket status used to hide entirely: one crashed container next to two
 * healthy ones looked identical to "everything is fine".
 */
export interface ServiceStatusDisplay {
  icon: string;
  color: string;
  labelKey: string;
}

export function serviceStatusDisplay(status: Service['status']): ServiceStatusDisplay {
  switch (status) {
    case 'running':
      return { icon: 'fa-solid fa-circle-check', color: 'var(--color-success)', labelKey: 'services.status.running' };
    case 'partial':
      return { icon: 'fa-solid fa-triangle-exclamation', color: 'var(--color-warning)', labelKey: 'services.status.partial' };
    case 'exited':
      return { icon: 'fa-solid fa-circle-stop', color: 'var(--color-text-tertiary)', labelKey: 'services.status.exited' };
    default:
      return { icon: 'fa-solid fa-circle-minus', color: 'var(--color-text-tertiary)', labelKey: 'services.status.unknown' };
  }
}
