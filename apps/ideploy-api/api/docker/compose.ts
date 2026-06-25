/**
 * docker-compose generation — minimal port of Coolify's ConfigurationGenerator
 * for the vertical slice. Produces a compose file string for a single
 * application service. Real Coolify adds Traefik labels, healthchecks,
 * networks, volumes, env injection, etc. — those land in later phases.
 */
import YAML from 'yaml';
import { ApplicationRow } from '../models/ideploy.types';
import { appWorkdirFor } from '../utils/paths';

export function generateComposeFile(app: ApplicationRow, imageTag: string): string {
  const serviceName = `${app.name}-${app.uuid}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Publish ports so the app is reachable. Prefer explicit ports_mappings
  // ("host:container[,host:container]"), else publish the exposed port 1:1.
  const mappings = (app.ports_mappings || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (mappings.length === 0 && app.ports_exposes) {
    const exposed = app.ports_exposes.split(',')[0].trim();
    if (exposed) mappings.push(`${exposed}:${exposed}`);
  }

  const compose = {
    services: {
      [serviceName]: {
        image: imageTag,
        container_name: serviceName,
        restart: 'unless-stopped',
        ...(mappings.length ? { ports: mappings } : {}),
        labels: {
          'ideploy.managed': 'true',
          'ideploy.applicationUuid': app.uuid,
        },
      },
    },
  };

  return YAML.stringify(compose);
}

/** Build the remote working directory path for an application's compose stack. */
export function appWorkdir(app: ApplicationRow): string {
  return appWorkdirFor(app.uuid);
}
