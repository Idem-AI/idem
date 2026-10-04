/**
 * The pure parts of the deployment worker: reading `docker compose ps`, and
 * the port the application is told to listen on.
 */
import { describe, expect, it } from 'vitest';
import { applicationPort, judgeContainers, normaliseBaseDirectory, parseComposePs } from '../../../api/jobs/deployment.worker';

describe('parseComposePs', () => {
  it('reads one object per line (current Compose)', () => {
    const out = [
      '{"Service":"web","State":"running","ExitCode":0,"Health":""}',
      '{"Service":"migrate","State":"exited","ExitCode":0,"Health":""}',
    ].join('\n');
    expect(parseComposePs(out)).toEqual([
      { service: 'web', state: 'running', exitCode: 0, health: '' },
      { service: 'migrate', state: 'exited', exitCode: 0, health: '' },
    ]);
  });

  it('reads a JSON array (older Compose)', () => {
    expect(parseComposePs('[{"Service":"web","State":"running"}]')).toHaveLength(1);
  });

  it('reports nothing running as an empty list, and anything else as unreadable', () => {
    expect(parseComposePs('')).toEqual([]);
    expect(parseComposePs('NAME  STATUS\napp   Up 2 seconds')).toBeNull();
  });
});

describe('judgeContainers', () => {
  const c = (state: string, exitCode = 0, health = '') => ({ service: 's', state, exitCode, health });

  it('does not count a step that finished cleanly as a crash', () => {
    // A one-shot migration exits 0 next to a running web container.
    expect(judgeContainers([c('running'), c('exited', 0)])).toEqual({ isUp: true, crashed: false });
  });

  it('counts an error exit, a restart loop or an unhealthy container as a crash', () => {
    expect(judgeContainers([c('running'), c('exited', 1)]).crashed).toBe(true);
    expect(judgeContainers([c('restarting')]).crashed).toBe(true);
    expect(judgeContainers([c('running', 0, 'unhealthy')]).crashed).toBe(true);
  });
});

describe('applicationPort', () => {
  it('is the exposed port Traefik routes to, not the host side of a mapping', () => {
    // 8080:3000 told the app to listen on 8080 while Traefik sent traffic to 3000.
    expect(applicationPort({ ports_exposes: '3000', ports_mappings: '8080:3000' })).toBe(3000);
  });

  it('falls back to the container side of a mapping, then 3000', () => {
    expect(applicationPort({ ports_exposes: '', ports_mappings: '8080:5000' })).toBe(5000);
    expect(applicationPort({ ports_exposes: null, ports_mappings: null } as never)).toBe(3000);
  });
});

describe('normaliseBaseDirectory', () => {
  it('reduces the ways of writing "the root" to nothing, and keeps a folder', () => {
    for (const root of ['', './', '/', '.', null]) expect(normaliseBaseDirectory(root)).toBe('');
    expect(normaliseBaseDirectory('./backend/')).toBe('backend');
    expect(normaliseBaseDirectory('./Dockerfile')).toBe('Dockerfile');
  });
});
