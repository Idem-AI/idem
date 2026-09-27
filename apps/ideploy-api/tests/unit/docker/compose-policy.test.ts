/**
 * Politique des compose utilisateur.
 *
 * Un compose accepté s'exécute avec les droits du démon Docker de l'hôte : ces
 * tests verrouillent ce qui doit être refusé, et vérifient qu'un compose
 * ordinaire (image, ports, volumes nommés, variables) passe sans friction.
 */
import { describe, expect, it } from 'vitest';
import { assertComposeIsSafe, ComposePolicyError } from '../../../api/docker/compose-policy';

function refused(yaml: string): string[] {
  try {
    assertComposeIsSafe(yaml);
  } catch (error) {
    if (error instanceof ComposePolicyError) return error.violations;
    throw error;
  }
  return [];
}

describe('assertComposeIsSafe', () => {
  it('accepts an ordinary stack', () => {
    expect(
      refused(`
services:
  web:
    image: nginx:1.27
    ports: ['8080:80']
    environment: { FOO: bar }
    volumes:
      - data:/var/lib/data
      - ./config:/etc/app:ro
volumes:
  data: {}
`)
    ).toEqual([]);
  });

  it('refuses privileged mode and host namespaces', () => {
    const violations = refused(`
services:
  a: { image: x, privileged: true }
  b: { image: x, network_mode: host }
  c: { image: x, pid: host }
`);
    expect(violations).toHaveLength(3);
  });

  it('refuses host bind mounts, including the Docker socket and parent traversal', () => {
    const violations = refused(`
services:
  a:
    image: x
    volumes:
      - /:/host
      - /var/run/docker.sock:/var/run/docker.sock
      - ../../etc:/etc2
      - type: bind
        source: /etc
        target: /x
`);
    expect(violations).toHaveLength(4);
  });

  it('refuses dangerous capabilities and unconfined security options', () => {
    const violations = refused(`
services:
  a:
    image: x
    cap_add: [SYS_ADMIN, NET_BIND_SERVICE]
    security_opt: ['seccomp:unconfined']
    devices: ['/dev/sda:/dev/sda']
`);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('SYS_ADMIN'),
        expect.stringContaining('security_opt'),
        expect.stringContaining('devices'),
      ])
    );
    expect(violations.some((v) => v.includes('NET_BIND_SERVICE'))).toBe(false);
  });

  it('refuses named volumes that are really host binds', () => {
    expect(
      refused(`
services: { a: { image: x, volumes: ['hostroot:/h'] } }
volumes:
  hostroot:
    driver: local
    driver_opts: { type: none, o: bind, device: / }
`)
    ).toHaveLength(1);
  });

  it('refuses a build context outside the repository', () => {
    expect(refused(`services: { a: { build: { context: / } } }`)).toHaveLength(1);
  });

  it('reports invalid YAML as a policy error', () => {
    expect(refused('services: [')).toHaveLength(1);
  });
});
