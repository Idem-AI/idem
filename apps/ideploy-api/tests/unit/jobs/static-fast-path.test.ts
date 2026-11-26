import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { FAST_STATIC_NGINX_CONF, fastStaticCompose, isPrebuiltStatic } from '../../../api/jobs/static-fast-path';
import { deploysOnFastLaneFields } from '../../../api/jobs/prebuilt-static';
import type { ApplicationRow } from '../../../api/models/ideploy.types';

const app = {
  id: 7,
  uuid: 'abc-123',
  name: 'mon-site',
  build_pack: 'static',
  git_repository: '',
  install_command: null,
  build_command: null,
  start_command: null,
  publish_directory: 'dist',
  ports_exposes: '80',
  ports_mappings: null,
} as unknown as ApplicationRow;

describe('prebuilt static sites (iCode)', () => {
  it('takes the express path only for files with nothing to build or run', () => {
    expect(isPrebuiltStatic(app, true)).toBe(true);
    expect(isPrebuiltStatic(app, false)).toBe(false);
    expect(isPrebuiltStatic({ ...app, git_repository: 'https://github.com/a/b' } as ApplicationRow, true)).toBe(false);
    expect(isPrebuiltStatic({ ...app, build_command: 'npm run build' } as ApplicationRow, true)).toBe(false);
    expect(isPrebuiltStatic({ ...app, build_pack: 'nixpacks' } as ApplicationRow, true)).toBe(false);
  });

  it('sends every static site sent as files to the fast lane, built or not', () => {
    expect(deploysOnFastLaneFields(app, true)).toBe(true);
    expect(deploysOnFastLaneFields({ ...app, build_command: 'npm run build' } as ApplicationRow, true)).toBe(true);
    expect(deploysOnFastLaneFields({ ...app, start_command: 'node server.js' } as ApplicationRow, true)).toBe(false);
    expect(deploysOnFastLaneFields({ ...app, git_repository: 'https://github.com/a/b' } as ApplicationRow, true)).toBe(false);
    expect(deploysOnFastLaneFields(app, false)).toBe(false);
  });

  it('serves the current release from the mounted site directory', () => {
    expect(FAST_STATIC_NGINX_CONF).toContain('root /site/current/html;');
    expect(FAST_STATIC_NGINX_CONF).not.toContain('/usr/share/nginx/html');
    // The SPA fallback and the immutable assets of the general path are kept.
    expect(FAST_STATIC_NGINX_CONF).toContain('try_files $uri $uri/ /index.html;');
    expect(FAST_STATIC_NGINX_CONF).toContain('immutable');
  });

  it('runs one long-lived nginx with the site and its configuration mounted read-only', () => {
    const compose = YAML.parse(fastStaticCompose(app, '/data/ideploy/applications/abc-123/static', ['ideploy.managed=true'], 'ws-net'));
    const service = Object.values(compose.services)[0] as Record<string, unknown>;
    expect(service.image).toBe('nginx:alpine');
    expect(service.volumes).toEqual([
      '/data/ideploy/applications/abc-123/static:/site:ro',
      '/data/ideploy/applications/abc-123/static/conf:/etc/nginx/conf.d:ro',
    ]);
    expect(service.healthcheck).toBeTruthy();
  });
});
