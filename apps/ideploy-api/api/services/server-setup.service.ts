/**
 * Server readiness checks and provisioning.
 *
 * Ports Coolify's `ValidateServer` / `InstallDocker` actions, which the rewrite
 * had reduced to "can we SSH in, and is `docker` on the PATH". That is not enough
 * to call a server ready: a host can answer SSH and still be unable to run a
 * deployment because Compose is missing, the shared network was never created,
 * or Docker is too old for the build features we use.
 *
 * Two design choices worth knowing:
 *
 *  - **One probe, not one round trip per check.** Everything is gathered by a
 *    single remote script emitting `KEY=value` lines, then interpreted locally.
 *    Six sequential SSH round trips to a distant host is seconds of latency for
 *    information that costs nothing to collect together.
 *
 *  - **Every failed check carries a remedy.** "Validation failed" tells the user
 *    nothing. "Docker is 20.10, we need 24 or newer — run the setup step" tells
 *    them what happens next.
 */
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';
import { executeRemoteCommand, testConnection } from '../ssh/ssh';
import logger from '../config/logger';

/** Docker releases before 24 lack BuildKit behaviour the build engine relies on. */
export const MINIMUM_DOCKER_MAJOR = 24;

/** Disk fullness at which deployments start failing in confusing ways. */
export const DISK_WARNING_PERCENT = 90;

/**
 * Distributions the Docker convenience script supports. An unsupported OS is
 * reported rather than attempted: a half-installed Docker is harder to recover
 * from than a refusal.
 */
export const SUPPORTED_OS_IDS = [
  'ubuntu',
  'debian',
  'raspbian',
  'centos',
  'fedora',
  'rhel',
  'rocky',
  'almalinux',
  'sles',
  'opensuse-leap',
  'opensuse-tumbleweed',
  'arch',
  'alpine',
] as const;

export type CheckId =
  | 'ssh'
  | 'os'
  | 'docker_engine'
  | 'docker_version'
  | 'docker_compose'
  | 'network'
  | 'disk';

export type CheckStatus = 'ok' | 'failed' | 'warning' | 'skipped';

export interface CheckResult {
  id: CheckId;
  /** Short human label for the UI row. */
  label: string;
  status: CheckStatus;
  /** What we actually observed. */
  detail?: string;
  /** What the user should do about it, when there is something to do. */
  remedy?: string;
}

export interface ServerReadiness {
  /** True when nothing blocks a deployment. Warnings do not block. */
  ready: boolean;
  checks: CheckResult[];
  /** Raw probe output, for support and debugging. */
  raw: string;
}

/**
 * Single remote script collecting everything the checks need.
 *
 * Written defensively: every field falls back to an empty value rather than
 * failing the whole script, so one missing tool does not blind the other checks.
 * Built by concatenation (not a template literal) so `$` needs no escaping.
 */
const PROBE_SCRIPT = [
  'set +e',
  '. /etc/os-release 2>/dev/null',
  'echo "OS_ID=$ID"',
  'echo "OS_VERSION=$VERSION_ID"',
  'echo "OS_NAME=$PRETTY_NAME"',
  'echo "DOCKER_VERSION=$(docker version --format \'{{.Server.Version}}\' 2>/dev/null)"',
  'echo "COMPOSE_VERSION=$(docker compose version --short 2>/dev/null)"',
  'echo "NETWORK=$(docker network inspect ideploy --format \'{{.Name}}\' 2>/dev/null)"',
  'echo "DISK_USED_PCT=$(df -P / 2>/dev/null | awk \'NR==2{print $5}\' | tr -d %)"',
  'echo "PROBE_DONE=1"',
].join('\n');

/** Parse the probe's `KEY=value` lines. Unknown or empty values become undefined. */
export function parseProbe(output: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const value = match[2].trim();
    if (value !== '') values[match[1]] = value;
  }
  return values;
}

/**
 * Leading integer of a Docker version string (`24.0.7` → 24, `20.10.21-ce` → 20).
 * Returns null when the string is not a version at all.
 */
export function majorVersion(version: string | undefined): number | null {
  if (!version) return null;
  const match = /^(\d+)\./.exec(version) ?? /^(\d+)$/.exec(version);
  return match ? Number(match[1]) : null;
}

/** Turn probe values into user-facing checks. Pure: unit-testable in isolation. */
export function interpretProbe(values: Record<string, string>): CheckResult[] {
  const checks: CheckResult[] = [];

  const osId = values.OS_ID?.toLowerCase();
  const osName = values.OS_NAME ?? osId;
  if (!osId) {
    checks.push({
      id: 'os',
      label: 'Operating system',
      status: 'failed',
      detail: 'Could not read /etc/os-release.',
      remedy: 'This does not look like a supported Linux distribution.',
    });
  } else if (!SUPPORTED_OS_IDS.includes(osId as (typeof SUPPORTED_OS_IDS)[number])) {
    checks.push({
      id: 'os',
      label: 'Operating system',
      status: 'failed',
      detail: `${osName} is not a supported distribution.`,
      remedy: `Supported: ${SUPPORTED_OS_IDS.join(', ')}.`,
    });
  } else {
    checks.push({ id: 'os', label: 'Operating system', status: 'ok', detail: osName });
  }

  const dockerVersion = values.DOCKER_VERSION;
  const dockerMajor = majorVersion(dockerVersion);
  if (!dockerVersion) {
    checks.push({
      id: 'docker_engine',
      label: 'Docker Engine',
      status: 'failed',
      detail: 'Docker is not installed, or the daemon is not running.',
      remedy: 'Run the server setup step to install it.',
    });
    checks.push({ id: 'docker_version', label: 'Docker version', status: 'skipped' });
  } else {
    checks.push({ id: 'docker_engine', label: 'Docker Engine', status: 'ok', detail: dockerVersion });
    checks.push(
      dockerMajor !== null && dockerMajor >= MINIMUM_DOCKER_MAJOR
        ? { id: 'docker_version', label: 'Docker version', status: 'ok', detail: dockerVersion }
        : {
            id: 'docker_version',
            label: 'Docker version',
            status: 'failed',
            detail: `Docker ${dockerVersion} is older than the required ${MINIMUM_DOCKER_MAJOR}.`,
            remedy: `Upgrade Docker to ${MINIMUM_DOCKER_MAJOR} or newer.`,
          }
    );
  }

  checks.push(
    values.COMPOSE_VERSION
      ? {
          id: 'docker_compose',
          label: 'Docker Compose plugin',
          status: 'ok',
          detail: values.COMPOSE_VERSION,
        }
      : {
          id: 'docker_compose',
          label: 'Docker Compose plugin',
          status: 'failed',
          detail: 'The `docker compose` plugin is not available.',
          remedy: 'Run the server setup step to install it.',
        }
  );

  checks.push(
    values.NETWORK
      ? { id: 'network', label: 'Shared Docker network', status: 'ok', detail: values.NETWORK }
      : {
          id: 'network',
          label: 'Shared Docker network',
          status: 'failed',
          detail: 'The `ideploy` network does not exist.',
          remedy: 'Run the server setup step to create it.',
        }
  );

  const diskUsed = Number(values.DISK_USED_PCT);
  if (Number.isFinite(diskUsed)) {
    checks.push(
      diskUsed >= DISK_WARNING_PERCENT
        ? {
            id: 'disk',
            label: 'Disk space',
            status: 'warning',
            detail: `The root filesystem is ${diskUsed}% full.`,
            remedy: 'Free up space — builds and image pulls will start failing.',
          }
        : { id: 'disk', label: 'Disk space', status: 'ok', detail: `${diskUsed}% used` }
    );
  }

  return checks;
}

/** Only a hard failure blocks deployment; a warning is informational. */
function isReady(checks: CheckResult[]): boolean {
  return !checks.some((c) => c.status === 'failed');
}

/**
 * Run the full readiness check against a server.
 *
 * When SSH itself fails there is nothing to interpret, so the remaining checks
 * are reported as skipped rather than as failures we cannot substantiate.
 */
export async function checkReadiness(
  server: ServerRow,
  key: PrivateKeyRow
): Promise<ServerReadiness> {
  const connection = await testConnection(server, key);
  if (!connection.ok) {
    return {
      ready: false,
      raw: connection.output,
      checks: [
        {
          id: 'ssh',
          label: 'SSH connection',
          status: 'failed',
          detail: connection.output.trim().slice(0, 500) || 'Could not open an SSH session.',
          remedy:
            'Check the address, port and user, and that the public key is in the ' +
            'authorized_keys file of that user on the server.',
        },
        { id: 'os', label: 'Operating system', status: 'skipped' },
        { id: 'docker_engine', label: 'Docker Engine', status: 'skipped' },
        { id: 'docker_version', label: 'Docker version', status: 'skipped' },
        { id: 'docker_compose', label: 'Docker Compose plugin', status: 'skipped' },
        { id: 'network', label: 'Shared Docker network', status: 'skipped' },
      ],
    };
  }

  const probe = await executeRemoteCommand(server, key, PROBE_SCRIPT, { noRetry: true });
  const values = parseProbe(probe.stdout);

  const checks: CheckResult[] = [
    { id: 'ssh', label: 'SSH connection', status: 'ok', detail: `${server.user}@${server.ip}` },
    ...interpretProbe(values),
  ];

  return { ready: isReady(checks), checks, raw: probe.stdout };
}

/**
 * Docker daemon configuration applied at setup.
 *
 * Log rotation is not a nicety: without it, container logs grow without bound
 * and eventually fill the disk, which surfaces as unrelated deployment failures
 * weeks later. `live-restore` keeps containers running across a daemon restart.
 */
const DAEMON_CONFIG = JSON.stringify(
  {
    'log-driver': 'json-file',
    'log-opts': { 'max-size': '10m', 'max-file': '3' },
    'live-restore': true,
  },
  null,
  2
);

/**
 * Steps run by `provision`, in order. Each is idempotent so the whole thing can
 * be re-run safely on a partially configured host.
 */
function provisioningScript(): string {
  return [
    'set -e',
    'echo "→ Checking Docker"',
    // The convenience script is what Coolify uses, and it handles the
    // distribution differences for us.
    'if ! docker version >/dev/null 2>&1; then',
    '  echo "→ Installing Docker"',
    '  curl -fsSL https://get.docker.com | sh',
    'else',
    '  echo "→ Docker already present"',
    'fi',
    'echo "→ Configuring the Docker daemon (log rotation)"',
    'mkdir -p /etc/docker',
    // Only write when the content differs, so we do not restart the daemon —
    // and interrupt running containers — on every re-run.
    `cat > /tmp/ideploy-daemon.json <<'IDEPLOY_EOF'\n${DAEMON_CONFIG}\nIDEPLOY_EOF`,
    'if ! cmp -s /tmp/ideploy-daemon.json /etc/docker/daemon.json; then',
    '  mv /tmp/ideploy-daemon.json /etc/docker/daemon.json',
    '  echo "→ Restarting Docker to apply the configuration"',
    '  systemctl restart docker 2>/dev/null || service docker restart 2>/dev/null || true',
    'else',
    '  rm -f /tmp/ideploy-daemon.json',
    '  echo "→ Daemon configuration already current"',
    'fi',
    'echo "→ Ensuring the shared network"',
    'docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy',
    'echo "→ Verifying"',
    'docker version --format "Docker {{.Server.Version}}"',
    'docker compose version --short',
    'echo "→ Setup complete"',
  ].join('\n');
}

export interface ProvisionResult {
  success: boolean;
  output: string;
  /** Readiness re-checked after provisioning, so the caller sees the outcome. */
  readiness: ServerReadiness;
}

/**
 * Bring a server to a deployable state: Docker installed, daemon configured with
 * log rotation, shared network present. Idempotent.
 */
export async function provision(
  server: ServerRow,
  key: PrivateKeyRow,
  onData?: (chunk: string) => void
): Promise<ProvisionResult> {
  logger.info('Provisioning server', { uuid: server.uuid, ip: server.ip });

  const result = await executeRemoteCommand(server, key, provisioningScript(), {
    onData: (chunk) => onData?.(chunk),
    noRetry: true,
  });

  const readiness = await checkReadiness(server, key);

  return {
    success: result.exitCode === 0 && readiness.ready,
    output: result.stdout + result.stderr,
    readiness,
  };
}
