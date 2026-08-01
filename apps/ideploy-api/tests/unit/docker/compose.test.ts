import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { generateBuildlessCompose, generateComposeFile } from '../../../api/docker/compose';
import { applicationRow } from '../../helpers/rows';

/** Parse the generated YAML and return the single service definition. */
function onlyService(yaml: string): { name: string; def: Record<string, unknown> } {
  const parsed = YAML.parse(yaml) as { services: Record<string, Record<string, unknown>> };
  const names = Object.keys(parsed.services);
  expect(names).toHaveLength(1);
  return { name: names[0], def: parsed.services[names[0]] };
}

describe('generateComposeFile', () => {
  it('produces valid YAML with one service named after the app and its uuid', () => {
    const yaml = generateComposeFile(applicationRow({ name: 'my-app', uuid: 'abc123' }), 'img:tag');
    const { name, def } = onlyService(yaml);

    expect(name).toBe('my-app-abc123');
    expect(def.image).toBe('img:tag');
    expect(def.container_name).toBe('my-app-abc123');
    expect(def.restart).toBe('unless-stopped');
  });

  it('sanitises names that are not valid Docker service identifiers', () => {
    const yaml = generateComposeFile(
      applicationRow({ name: 'My App (Prod)!', uuid: 'ABC_123' }),
      'img:tag'
    );
    const { name } = onlyService(yaml);

    expect(name).toBe('my-app--prod---abc-123');
    expect(name).toMatch(/^[a-z0-9-]+$/);
  });

  it('tags every container so we can tell ours apart from the user’s', () => {
    const yaml = generateComposeFile(applicationRow({ uuid: 'abc123' }), 'img:tag');
    const { def } = onlyService(yaml);

    // The list form, not a mapping: labels are produced as `key=value` strings by
    // the label generators, and it matches what the Laravel side emits.
    expect(def.labels).toEqual(['ideploy.managed=true', 'ideploy.applicationUuid=abc123']);
  });

  it('attaches the resolved proxy labels when they are supplied', () => {
    const yaml = generateComposeFile(
      applicationRow({ uuid: 'abc123' }),
      'img:tag',
      ['traefik.enable=true', 'ideploy.managed=true'],
      'ideploy'
    );
    const { def } = onlyService(yaml);

    expect(def.labels).toEqual(['traefik.enable=true', 'ideploy.managed=true']);
  });

  it('joins the shared network, and declares it as pre-existing', () => {
    // Without this the container cannot be reached by the proxy, nor by its
    // neighbours in the same workspace.
    const yaml = generateComposeFile(applicationRow(), 'img:tag', [], 'ideploy');
    const parsed = YAML.parse(yaml) as {
      services: Record<string, { networks?: string[] }>;
      networks?: Record<string, { external?: boolean }>;
    };

    expect(Object.values(parsed.services)[0].networks).toEqual(['ideploy']);
    expect(parsed.networks?.ideploy).toEqual({ external: true });
  });

  it('omits networking entirely when no network is given', () => {
    const parsed = YAML.parse(generateComposeFile(applicationRow(), 'img:tag')) as {
      networks?: unknown;
    };

    expect(parsed.networks).toBeUndefined();
  });

  it('publishes the exposed port one-to-one when no explicit mapping is given', () => {
    const yaml = generateComposeFile(
      applicationRow({ ports_exposes: '8080', ports_mappings: null }),
      'img:tag'
    );
    expect(onlyService(yaml).def.ports).toEqual(['8080:8080']);
  });

  it('prefers explicit mappings over the exposed port', () => {
    const yaml = generateComposeFile(
      applicationRow({ ports_exposes: '3000', ports_mappings: '8080:3000, 9090:9090' }),
      'img:tag'
    );
    expect(onlyService(yaml).def.ports).toEqual(['8080:3000', '9090:9090']);
  });

  it('uses only the first exposed port when several are declared', () => {
    const yaml = generateComposeFile(
      applicationRow({ ports_exposes: '3000,3001', ports_mappings: null }),
      'img:tag'
    );
    expect(onlyService(yaml).def.ports).toEqual(['3000:3000']);
  });

  it('omits the ports key entirely when the app exposes nothing', () => {
    const yaml = generateComposeFile(
      applicationRow({ ports_exposes: null, ports_mappings: null }),
      'img:tag'
    );
    expect(onlyService(yaml).def).not.toHaveProperty('ports');
  });
});

describe('generateBuildlessCompose', () => {
  it('mounts the source and runs install, build then start in order', () => {
    const yaml = generateBuildlessCompose(
      applicationRow({ install_command: 'pnpm i', build_command: 'pnpm build', start_command: 'pnpm start' }),
      '/data/src',
      3000
    );
    const { def } = onlyService(yaml);

    expect(def.volumes).toEqual(['/data/src:/app']);
    const command = def.command as string[];
    expect(command[0]).toBe('sh');
    expect(command[2]).toBe('pnpm i && (pnpm build) && (pnpm start)');
  });

  it('resolves the working directory from the base directory', () => {
    const cases: Array<[string | null, string]> = [
      [null, '/app'],
      ['/', '/app'],
      ['./packages/web', '/app/packages/web'],
      ['/packages/web/', '/app/packages/web'],
      ['packages/web', '/app/packages/web'],
    ];

    for (const [baseDirectory, expected] of cases) {
      const yaml = generateBuildlessCompose(
        applicationRow({ base_directory: baseDirectory }),
        '/data/src',
        3000
      );
      expect(onlyService(yaml).def.working_dir, `base_directory=${baseDirectory}`).toBe(expected);
    }
  });

  it('binds the app to all interfaces so the container is reachable', () => {
    const yaml = generateBuildlessCompose(applicationRow(), '/data/src', 4000);
    const { def } = onlyService(yaml);

    expect(def.environment).toEqual(['PORT=4000', 'HOST=0.0.0.0']);
    expect(def.ports).toEqual(['4000:4000']);
  });
});
