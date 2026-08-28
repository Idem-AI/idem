/**
 * Server readiness logic, tested without a server.
 *
 * This is what the remote-execution port was extracted for: every branch below —
 * an unreachable host, an OS we do not support, Docker too old, a missing Compose
 * plugin, a full disk — is a state that is impractical to reproduce against real
 * infrastructure, and each one used to be untested.
 *
 * The pure interpreters (`parseProbe`, `majorVersion`, `interpretProbe`) are
 * exercised directly; `checkReadiness` and `provision` go through the fake
 * executor so the commands actually sent are asserted too.
 */
import { describe, expect, it } from 'vitest';
import {
  DISK_WARNING_PERCENT,
  MINIMUM_DOCKER_MAJOR,
  checkReadiness,
  interpretProbe,
  majorVersion,
  parseProbe,
  provision,
} from '../../../api/services/server-setup.service';
import { useFakeExecutor } from '../../helpers/fake-executor';
import { privateKeyRow, serverRow } from '../../helpers/rows';

const ssh = useFakeExecutor();

/** Probe output for a fully healthy host. */
function healthyProbe(overrides: Record<string, string> = {}): string {
  const values = {
    OS_ID: 'ubuntu',
    OS_VERSION: '24.04',
    OS_NAME: 'Ubuntu 24.04 LTS',
    DOCKER_VERSION: '27.1.1',
    COMPOSE_VERSION: 'v2.29.1',
    NETWORK: 'ideploy',
    DISK_USED_PCT: '42',
    PROBE_DONE: '1',
    ...overrides,
  };
  return Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

/** Find a check by id, failing loudly if it is absent. */
function check(checks: ReturnType<typeof interpretProbe>, id: string) {
  const found = checks.find((c) => c.id === id);
  expect(found, `expected a "${id}" check`).toBeDefined();
  return found!;
}

describe('parseProbe', () => {
  it('reads KEY=value lines', () => {
    expect(parseProbe('OS_ID=ubuntu\nDOCKER_VERSION=27.1.1')).toEqual({
      OS_ID: 'ubuntu',
      DOCKER_VERSION: '27.1.1',
    });
  });

  it('drops empty values so absent tools read as undefined, not as ""', () => {
    // The probe emits every key unconditionally; a missing tool yields an empty
    // value, which must not be mistaken for a real answer.
    expect(parseProbe('DOCKER_VERSION=\nOS_ID=ubuntu')).toEqual({ OS_ID: 'ubuntu' });
  });

  it('ignores noise the shell may interleave', () => {
    const values = parseProbe('Warning: something\nOS_ID=debian\n\nsudo: unable to resolve host');
    expect(values).toEqual({ OS_ID: 'debian' });
  });

  it('keeps values containing spaces, such as the OS name', () => {
    expect(parseProbe('OS_NAME=Ubuntu 24.04 LTS').OS_NAME).toBe('Ubuntu 24.04 LTS');
  });
});

describe('majorVersion', () => {
  it.each([
    ['27.1.1', 27],
    ['24.0.7', 24],
    ['20.10.21', 20],
    ['24', 24],
  ])('reads %s as %i', (input, expected) => {
    expect(majorVersion(input)).toBe(expected);
  });

  it('returns null for input that is not a version', () => {
    expect(majorVersion(undefined)).toBeNull();
    expect(majorVersion('')).toBeNull();
    expect(majorVersion('command not found')).toBeNull();
  });
});

describe('interpretProbe', () => {
  it('passes every check on a healthy host', () => {
    const checks = interpretProbe(parseProbe(healthyProbe()));

    expect(checks.filter((c) => c.status !== 'ok')).toEqual([]);
  });

  it('fails an unsupported distribution and lists the supported ones', () => {
    const result = check(interpretProbe(parseProbe(healthyProbe({ OS_ID: 'gentoo' }))), 'os');

    expect(result.status).toBe('failed');
    expect(result.remedy).toMatch(/ubuntu/);
  });

  it('fails when /etc/os-release cannot be read', () => {
    const checks = interpretProbe({ DOCKER_VERSION: '27.1.1' });
    expect(check(checks, 'os').status).toBe('failed');
  });

  it('reports Docker as absent, and skips the version check it cannot make', () => {
    const checks = interpretProbe(parseProbe(healthyProbe({ DOCKER_VERSION: '' })));

    expect(check(checks, 'docker_engine').status).toBe('failed');
    expect(check(checks, 'docker_engine').remedy).toMatch(/setup step/i);
    // Reporting a version failure with no version would be a claim we cannot back.
    expect(check(checks, 'docker_version').status).toBe('skipped');
  });

  it(`fails Docker older than ${MINIMUM_DOCKER_MAJOR} while acknowledging it is installed`, () => {
    const checks = interpretProbe(parseProbe(healthyProbe({ DOCKER_VERSION: '20.10.21' })));

    expect(check(checks, 'docker_engine').status).toBe('ok');
    expect(check(checks, 'docker_version').status).toBe('failed');
    expect(check(checks, 'docker_version').detail).toMatch(/20\.10\.21/);
  });

  it('accepts exactly the minimum supported Docker major', () => {
    const checks = interpretProbe(
      parseProbe(healthyProbe({ DOCKER_VERSION: `${MINIMUM_DOCKER_MAJOR}.0.0` }))
    );
    expect(check(checks, 'docker_version').status).toBe('ok');
  });

  it('fails a missing Compose plugin', () => {
    const checks = interpretProbe(parseProbe(healthyProbe({ COMPOSE_VERSION: '' })));
    expect(check(checks, 'docker_compose').status).toBe('failed');
  });

  it('fails a missing shared network', () => {
    const checks = interpretProbe(parseProbe(healthyProbe({ NETWORK: '' })));

    expect(check(checks, 'network').status).toBe('failed');
    expect(check(checks, 'network').remedy).toMatch(/setup step/i);
  });

  it('warns — but does not fail — on a nearly full disk', () => {
    // A full disk breaks deployments, but refusing to deploy is the user's call.
    const checks = interpretProbe(
      parseProbe(healthyProbe({ DISK_USED_PCT: String(DISK_WARNING_PERCENT + 5) }))
    );

    expect(check(checks, 'disk').status).toBe('warning');
  });

  it('omits the disk check when df gave nothing usable', () => {
    const checks = interpretProbe(parseProbe(healthyProbe({ DISK_USED_PCT: '' })));
    expect(checks.find((c) => c.id === 'disk')).toBeUndefined();
  });
});

describe('checkReadiness', () => {
  const server = serverRow({ ip: '203.0.113.10', user: 'root' });
  const key = privateKeyRow();

  it('reports ready for a healthy host', async () => {
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe() });

    const readiness = await checkReadiness(server, key);

    expect(readiness.ready).toBe(true);
    expect(readiness.checks.every((c) => c.status === 'ok')).toBe(true);
  });

  it('reports not-ready when a blocking check fails', async () => {
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe({ NETWORK: '' }) });

    expect((await checkReadiness(server, key)).ready).toBe(false);
  });

  it('stays ready when the only problem is a warning', async () => {
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe({ DISK_USED_PCT: '95' }) });

    const readiness = await checkReadiness(server, key);

    expect(readiness.ready).toBe(true);
    expect(readiness.checks.some((c) => c.status === 'warning')).toBe(true);
  });

  it('skips the remote checks when SSH itself fails, and explains how to fix it', async () => {
    ssh.connection({ ok: false, output: 'Permission denied (publickey)' });

    const readiness = await checkReadiness(server, key);

    expect(readiness.ready).toBe(false);
    expect(check(readiness.checks, 'ssh').status).toBe('failed');
    expect(check(readiness.checks, 'ssh').detail).toMatch(/Permission denied/);
    expect(check(readiness.checks, 'ssh').remedy).toMatch(/authorized_keys/);

    // Claims about Docker cannot be made without a session.
    for (const id of ['os', 'docker_engine', 'docker_compose', 'network']) {
      expect(check(readiness.checks, id).status).toBe('skipped');
    }
  });

  it('does not run the probe at all when the connection is refused', async () => {
    ssh.connection({ ok: false, output: 'Connection refused' });

    await checkReadiness(server, key);

    expect(ssh.calls).toHaveLength(0);
  });

  it('gathers everything in a single round trip', async () => {
    // Six sequential SSH calls to a distant host is seconds of avoidable latency.
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe() });

    await checkReadiness(server, key);

    expect(ssh.calls).toHaveLength(1);
  });
});

describe('provision', () => {
  const server = serverRow();
  const key = privateKeyRow();

  it('installs Docker only when it is missing', async () => {
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe() });

    await provision(server, key);

    const script = ssh.calls[0].command;
    // Guarded by a check rather than run unconditionally: reinstalling Docker on
    // a working host is a good way to interrupt everything running on it.
    expect(script).toMatch(/if ! docker version/);
    expect(script).toMatch(/get\.docker\.com/);
  });

  it('configures log rotation, which is what keeps the disk from filling', async () => {
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe() });

    await provision(server, key);

    const script = ssh.calls[0].command;
    expect(script).toMatch(/\/etc\/docker\/daemon\.json/);
    expect(script).toMatch(/max-size/);
    expect(script).toMatch(/max-file/);
  });

  it('only restarts Docker when the daemon config actually changed', async () => {
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe() });

    await provision(server, key);

    // Restarting on every run would interrupt running containers each time.
    expect(ssh.calls[0].command).toMatch(/cmp -s/);
  });

  it('creates the shared network idempotently', async () => {
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe() });

    await provision(server, key);

    expect(ssh.calls[0].command).toMatch(
      /docker network inspect ideploy .* \|\| docker network create --attachable ideploy/
    );
  });

  it('re-checks readiness afterwards and reports success', async () => {
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe() });

    const result = await provision(server, key);

    expect(result.success).toBe(true);
    expect(result.readiness.ready).toBe(true);
  });

  it('reports failure when the host is still not ready afterwards', async () => {
    // The script can exit 0 while leaving the host unusable — for instance when
    // Docker installs but the daemon never comes up.
    ssh.connection({ ok: true }).on(/OS_ID/, { stdout: healthyProbe({ DOCKER_VERSION: '' }) });

    const result = await provision(server, key);

    expect(result.success).toBe(false);
    expect(result.readiness.ready).toBe(false);
  });

  it('reports failure when the provisioning script itself fails', async () => {
    ssh
      .connection({ ok: true })
      .on(/get\.docker\.com/, { exitCode: 1, stderr: 'E: Unable to locate package' })
      .on(/OS_ID/, { stdout: healthyProbe() });

    expect((await provision(server, key)).success).toBe(false);
  });

  it('streams progress so the UI can show it live', async () => {
    ssh
      .connection({ ok: true })
      .on(/get\.docker\.com/, {}, ['→ Installing Docker\n', '→ Setup complete\n'])
      .on(/OS_ID/, { stdout: healthyProbe() });

    const chunks: string[] = [];
    await provision(server, key, (chunk) => chunks.push(chunk));

    expect(chunks.join('')).toMatch(/Installing Docker/);
  });
});
