import { describe, expect, it } from 'vitest';
import { createTarGz } from '../../../api/utils/tar';
import { containerScript, dockerRunCommand, normalizeBaseDir, siteBuildFor } from '../../../api/jobs/static-build';
import type { ApplicationRow } from '../../../api/models/ideploy.types';

const app = {
  id: 7,
  uuid: 'abc-123',
  build_pack: 'static',
  git_repository: '',
  install_command: null,
  build_command: null,
  start_command: null,
  base_directory: null,
  publish_directory: 'dist',
} as unknown as ApplicationRow;

const vite = JSON.stringify({ scripts: { build: 'vite build' } });

describe('what iDeploy does with the files iCode sends', () => {
  it('builds the sources of a site, serves a site already built as is', () => {
    const sources = siteBuildFor(app, createTarGz({ 'package.json': vite, 'src/main.tsx': 'x' }));
    expect(sources).toMatchObject({ baseDir: '', build: 'npm run build', nodeImage: 'node:20-slim' });
    expect(siteBuildFor(app, createTarGz({ 'dist/index.html': '<h1>ok</h1>' }))).toBe('prebuilt');
    // Neither a project nor a site: the caller takes the general path, which reports it.
    expect(siteBuildFor(app, createTarGz({ 'notes.txt': 'x' }))).toBeNull();
    expect(siteBuildFor(app, createTarGz({ 'package.json': '{}' }))).toBeNull();
  });

  it('builds the interface of a complete application in its folder, with its build variables', () => {
    const frontend = { ...app, base_directory: '/frontend', install_command: 'npm install', build_command: 'npm run build' } as ApplicationRow;
    const plan = siteBuildFor(frontend, createTarGz({ 'frontend/package.json': vite, 'backend/package.json': '{}' }), ['VITE_API_URL=https://api.x']);
    expect(plan).toMatchObject({ baseDir: 'frontend', install: 'npm install', env: ['VITE_API_URL=https://api.x'] });
    expect(normalizeBaseDir('/')).toBe('');
  });

  it('runs the build isolated and bounded, on the build folder only', () => {
    const command = dockerRunCommand({ name: 'ideploy-build-1', buildRoot: '/data/app/build', workDir: '/work/src', image: 'node:20-slim', env: ['A=1'], script: 'npm run build' });
    for (const flag of ['--user 1000:1000', '--cap-drop ALL', '--security-opt no-new-privileges', '--memory 1536m', '--pids-limit 1024', '--cpus 2', 'timeout 600']) {
      expect(command).toContain(flag);
    }
    expect(command).toContain("-v '/data/app/build:/work'");
    // Never on the applications' network: it reaches npm and fonts, not its neighbours.
    expect(command).not.toContain('--network');
    expect(command).toContain("-e 'npm_config_cache=/work/.npm'");
  });

  it('installs dependencies only when the manifests changed', () => {
    const script = containerScript({ install: 'npm install', build: 'npm run build' });
    expect(script).toMatch(/sha256sum/);
    expect(script).toMatch(/node_modules\/\.ideploy-deps/);
    expect(script.indexOf('npm install')).toBeLessThan(script.indexOf('npm run build'));
    expect(containerScript({ install: 'npm install', build: 'npm run build' }, true)).not.toContain('npm run build');
  });
});
