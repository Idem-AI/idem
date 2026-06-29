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

/**
 * "Buildless" compose — runs the cloned source directly in a base Node image
 * (no Dockerfile, no image build). Mounts the source, installs deps and starts
 * the app, trying common scripts (start / preview / dev) and a static fallback.
 * Lets users deploy a repo without containerizing it.
 */
export function generateBuildlessCompose(app: ApplicationRow, srcDir: string, port: number): string {
  const serviceName = `${app.name}-${app.uuid}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const start =
    `npm install` +
    ` && (npm run build || true)` +
    ` && (npm start` +
    ` || npm run preview -- --host 0.0.0.0 --port ${port}` +
    ` || npm run dev -- --host 0.0.0.0 --port ${port}` +
    ` || npx --yes serve -s dist -l ${port}` +
    ` || npx --yes serve -s . -l ${port})`;

  const compose = {
    services: {
      [serviceName]: {
        image: 'node:20-alpine',
        container_name: serviceName,
        restart: 'unless-stopped',
        working_dir: '/app',
        volumes: [`${srcDir}:/app`],
        environment: [`PORT=${port}`, 'HOST=0.0.0.0'],
        command: ['sh', '-lc', start],
        ports: [`${port}:${port}`],
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
