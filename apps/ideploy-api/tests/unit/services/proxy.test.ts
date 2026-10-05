/**
 * The Traefik container's own bootstrap.
 *
 * A dynamic label referencing `plugin.bouncer` or `plugin.geoblock` means
 * nothing to a Traefik instance that was never told the plugin exists — that
 * declaration belongs in the proxy's own static command, not in a per-application
 * label. Task 4.2 wired the bouncer's dynamic labels but never checked whether
 * anything told the proxy the plugin existed; this suite exists because that gap
 * would have made both the bouncer and geo-blocking silently inert regardless of
 * how correct every other label is.
 */
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  buildTraefikCompose,
  isBouncerKey,
  releaseForeignContainers,
  parseMachineCredentials,
} from '../../../api/services/proxy.service';

function command(): string[] {
  const doc = parse(buildTraefikCompose()) as {
    services: { traefik: { command: string[] } };
  };
  return doc.services.traefik.command;
}

describe('buildTraefikCompose', () => {
  it('produces valid YAML', () => {
    expect(() => parse(buildTraefikCompose())).not.toThrow();
  });

  it('declares the CrowdSec bouncer plugin, so plugin.bouncer labels are not inert', () => {
    const cmd = command();

    expect(cmd.some((f) => f.startsWith('--experimental.plugins.bouncer.modulename='))).toBe(true);
    expect(cmd.some((f) => f.includes('crowdsec-bouncer-traefik-plugin'))).toBe(true);
  });

  it('declares the geoblock plugin, so plugin.geoblock labels are not inert', () => {
    const cmd = command();

    expect(cmd.some((f) => f.startsWith('--experimental.plugins.geoblock.modulename='))).toBe(true);
    expect(cmd.some((f) => f.includes('PascalMinder/geoblock'))).toBe(true);
  });

  it('pins a version for each plugin', () => {
    // An unpinned plugin can change its option names on the maintainer's
    // schedule, not ours, and that failure is silent — a middleware that loads
    // with defaults, not an error.
    const cmd = command();

    expect(cmd.some((f) => f.startsWith('--experimental.plugins.bouncer.version='))).toBe(true);
    expect(cmd.some((f) => f.startsWith('--experimental.plugins.geoblock.version='))).toBe(true);
  });

  it('keeps the pre-existing entrypoints and providers', () => {
    const cmd = command();

    expect(cmd).toContain('--entrypoints.https.address=:443');
    expect(cmd).toContain('--providers.docker=true');
  });
});

describe('CrowdSec credentials read at provisioning', () => {
  it('reads the machine login CrowdSec generated, not an assumed one', () => {
    const yaml = 'url: http://0.0.0.0:8080\nlogin: 3f2a9c1b7e\npassword: s3cr3t-value\n';

    expect(parseMachineCredentials(yaml)).toEqual({ machineId: '3f2a9c1b7e', password: 's3cr3t-value' });
  });

  it('falls back to "localhost" when the file names no login', () => {
    expect(parseMachineCredentials('password: s3cr3t-value').machineId).toBe('localhost');
  });

  it('reports no password when the file was not written yet', () => {
    expect(parseMachineCredentials('').password).toBeUndefined();
  });

  it('accepts a bouncer key and refuses an error message', () => {
    expect(isBouncerKey('aB3dE5fG7hJ9kL1mN3pQ5rS7')).toBe(true);
    expect(isBouncerKey('Error: bouncer ideploy-x already exists')).toBe(false);
    expect(isBouncerKey('')).toBe(false);
  });
});

describe('releaseForeignContainers', () => {
  // The former "Install CrowdSec" ran `docker run --name ideploy-crowdsec`
  // outside the proxy's Compose project: Compose then failed on the name
  // conflict at every later start. Verified on a managed server.
  const step = releaseForeignContainers('/data/ideploy/proxy');

  it('checks both container names against the proxy project directory', () => {
    for (const name of ['ideploy-proxy', 'ideploy-crowdsec']) {
      expect(step).toContain(`docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' ${name}`);
      expect(step).toContain(`docker rm -f ${name}`);
    }
    expect(step).toContain('[ "$owner" != "/data/ideploy/proxy" ]');
  });

  it('never fails the provisioning chain itself', () => {
    // Each check ends in `true`: an absent container, or one already owned by
    // the project, must let `docker compose up` run.
    expect(step.match(/; true; }/g)).toHaveLength(2);
  });
});

describe('the proxy sees what it serves', () => {
  const compose = parse(buildTraefikCompose('203.0.113.10'));

  it('writes a JSON access log CrowdSec and iDeploy both read', () => {
    const cmd: string[] = compose.services.traefik.command;
    expect(cmd).toEqual(expect.arrayContaining(['--accesslog=true', '--accesslog.format=json', '--accesslog.filepath=/traefik/logs/access.log']));
    expect(compose.services.crowdsec.volumes).toEqual(expect.arrayContaining([expect.stringMatching(/\/logs:\/var\/log\/traefik:ro$/)]));
    expect(compose.services.crowdsec.environment.COLLECTIONS).toContain('crowdsecurity/traefik');
  });

  it('never publishes the unauthenticated dashboard to the Internet', () => {
    expect(compose.services.traefik.ports).toContain('127.0.0.1:8080:8080');
    expect(compose.services.traefik.ports).not.toContain('8080:8080');
  });
});
