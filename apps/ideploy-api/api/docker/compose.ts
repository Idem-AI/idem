/**
 * docker-compose generation — minimal port of Coolify's ConfigurationGenerator
 * for the vertical slice. Produces a compose file string for a single
 * application service. Real Coolify adds Traefik labels, healthchecks,
 * networks, volumes, env injection, etc. — those land in later phases.
 */
import YAML from 'yaml';
import { ApplicationRow } from '../models/ideploy.types';
import { appWorkdirFor } from '../utils/paths';

/**
 * Attach the resolved labels, and join the shared network so the container is
 * both reachable from the proxy and from its neighbours in the same workspace.
 */
function networkingFor(
  labels: string[] | undefined,
  network: string | undefined
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  if (labels && labels.length > 0) extras.labels = labels;
  if (network) extras.networks = [network];
  return extras;
}

/** Top-level `networks:` declaring the shared network as pre-existing. */
function externalNetwork(network: string | undefined): Record<string, unknown> {
  return network ? { networks: { [network]: { external: true } } } : {};
}

export function generateComposeFile(
  app: ApplicationRow,
  imageTag: string,
  labels?: string[],
  network?: string,
  /**
   * `KEY=value` runtime environment — an operator's own settings (the
   * Variables tab) were being stored and shown right back to them, and then
   * never once reaching the container: nothing here ever read them. `PORT`
   * is added automatically when not already one of them, because the port
   * Traefik was told to route to (`ports_exposes`) and the port the app
   * actually listens on are only the same value if something tells the app
   * so — most frameworks bind `process.env.PORT` given the chance, but
   * nothing was ever giving it the chance.
   */
  envVars?: string[],
  port?: number
): string {
  const serviceName = `${app.name}-${app.uuid}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Publish ports so the app is reachable. Prefer explicit ports_mappings
  // ("host:container[,host:container]") — an operator setting that always
  // wins, e.g. for a raw TCP service Traefik's http/https entrypoints can't
  // route. Otherwise, only fall back to auto-publishing the exposed port 1:1
  // when there is no Traefik routing to reach it through instead: every
  // application defaults to port 3000, so unconditionally publishing it on
  // the host made any two applications on the same server guaranteed to
  // collide the moment both had a domain and neither operator had thought to
  // pick a different port — the domain was the whole point of not needing to.
  const hasTraefikRouting = Boolean(labels && labels.length > 0);
  const mappings = (app.ports_mappings || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (mappings.length === 0 && app.ports_exposes && !hasTraefikRouting) {
    const exposed = app.ports_exposes.split(',')[0].trim();
    if (exposed) mappings.push(`${exposed}:${exposed}`);
  }

  // The operator's own vars, plus PORT/HOST — but never overriding a PORT the
  // operator explicitly set themselves under Variables; their value is the
  // one that should reach the app either way.
  const environment = [...(envVars ?? [])];
  const hasOwnPort = environment.some((e) => /^PORT=/.test(e));
  if (!hasOwnPort && port) environment.push(`PORT=${port}`);
  if (!environment.some((e) => /^HOST=/.test(e))) environment.push('HOST=0.0.0.0');

  const compose = {
    services: {
      [serviceName]: {
        image: imageTag,
        container_name: serviceName,
        restart: 'unless-stopped',
        ...(environment.length ? { environment } : {}),
        ...(mappings.length ? { ports: mappings } : {}),
        ...networkingFor(labels ?? defaultOwnershipLabels(app), network),
      },
    },
    ...externalNetwork(network),
  };

  return YAML.stringify(compose);
}

/**
 * Minimal ownership labels, used when no resolved set was supplied.
 *
 * A container we cannot recognise later is a container we cannot show, restart or
 * clean up, so this floor is never skipped.
 */
function defaultOwnershipLabels(app: ApplicationRow): string[] {
  return ['ideploy.managed=true', `ideploy.applicationUuid=${app.uuid}`];
}

/**
 * "Buildless" compose — runs the cloned source directly in a base Node image
 * (no Dockerfile, no image build). Mounts the source, installs deps and starts
 * the app, trying common scripts (start / preview / dev) and a static fallback.
 * Lets users deploy a repo without containerizing it.
 */
export function generateBuildlessCompose(
  app: ApplicationRow,
  srcDir: string,
  port: number,
  labels?: string[],
  network?: string
): string {
  const serviceName = `${app.name}-${app.uuid}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  let baseDir = app.base_directory || '/';
  if (baseDir.startsWith('./')) {
    baseDir = baseDir.slice(2);
  }
  baseDir = baseDir.replace(/^\/+|\/+$/g, '');
  const workingDir = baseDir ? `/app/${baseDir}` : '/app';

  const installCmd = app.install_command || 'npm install';
  const buildCmd = app.build_command || 'npm run build || true';
  const startCmd = app.start_command ||
    `npm start -- --host 0.0.0.0 --port ${port} || npm start || npm run preview -- --host 0.0.0.0 --port ${port} || npm run dev -- --host 0.0.0.0 --port ${port} || npx --yes serve -s dist -l ${port} || npx --yes serve -s . -l ${port}`;

  const startScript = `${installCmd} && (${buildCmd}) && (${startCmd})`;

  const compose = {
    services: {
      [serviceName]: {
        image: 'node:20-alpine',
        container_name: serviceName,
        restart: 'unless-stopped',
        working_dir: workingDir,
        volumes: [`${srcDir}:/app`],
        environment: [`PORT=${port}`, 'HOST=0.0.0.0'],
        command: ['sh', '-lc', startScript],
        ports: [`${port}:${port}`],
        ...networkingFor(labels ?? defaultOwnershipLabels(app), network),
      },
    },
    ...externalNetwork(network),
  };
  return YAML.stringify(compose);
}

/** Build the remote working directory path for an application's compose stack. */
export function appWorkdir(app: ApplicationRow): string {
  return appWorkdirFor(app.uuid);
}
