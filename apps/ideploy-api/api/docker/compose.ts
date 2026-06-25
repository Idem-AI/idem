/**
 * docker-compose generation — minimal port of Coolify's ConfigurationGenerator
 * for the vertical slice. Produces a compose file string for a single
 * application service. Real Coolify adds Traefik labels, healthchecks,
 * networks, volumes, env injection, etc. — those land in later phases.
 */
import YAML from 'yaml';
import { ApplicationRow } from '../models/ideploy.types';

export function generateComposeFile(app: ApplicationRow, imageTag: string): string {
  const serviceName = `${app.name}-${app.uuid}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const compose = {
    services: {
      [serviceName]: {
        image: imageTag,
        container_name: serviceName,
        restart: 'unless-stopped',
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
  return `/data/ideploy/applications/${app.uuid}`;
}
