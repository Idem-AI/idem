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
import { executeRemoteCommand, testConnection, isLocalServer } from '../ssh/ssh';
import logger from '../config/logger';

/** Docker releases before 24 lack BuildKit behaviour the build engine relies on. */
export const MINIMUM_DOCKER_MAJOR = 24;

/** Pinned Docker release, matching the Laravel side's `docker.minimum_required_version`. */
const DOCKER_PINNED_VERSION = '24.0';

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
  | 'nixpacks'
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
  'echo "NIXPACKS_VERSION=$(nixpacks --version 2>/dev/null)"',
  'echo "NETWORK=$(docker network inspect ideploy --format \'{{.Name}}\' 2>/dev/null)"',
  // A local server (ssh/target.ts's isLocalServer) runs this inside the
  // ideploy-api container itself, where `df /` would report the container's
  // own thin overlay layer — not the disk the check is meant to warn about.
  // /hostfs is that machine's real root, bind-mounted read-only for exactly
  // this (docker-compose.dev.yml); a remote server has no such path, so it
  // falls back to its own `/` as before.
  'DISK_TARGET=/; [ -d /hostfs ] && DISK_TARGET=/hostfs',
  'echo "DISK_USED_PCT=$(df -P $DISK_TARGET 2>/dev/null | awk \'NR==2{print $5}\' | tr -d %)"',
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
    values.NIXPACKS_VERSION
      ? { id: 'nixpacks', label: 'Nixpacks builder', status: 'ok', detail: values.NIXPACKS_VERSION }
      : {
          id: 'nixpacks',
          label: 'Nixpacks builder',
          // Not a hard failure: only the default build pack (apps with no
          // Dockerfile) needs it — a server serving only Dockerfile/Compose
          // apps is genuinely ready without it.
          status: 'warning',
          detail: 'Not installed — deploying an application without its own Dockerfile will fail.',
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
        { id: 'nixpacks', label: 'Nixpacks builder', status: 'skipped' },
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
 *
 * Deliberately `set +e`, not `set -e`: a fresh server is rarely pristine — a
 * held apt/dnf lock from unattended-upgrades or cloud-init still finishing is
 * the single most common reason a first provisioning attempt used to die
 * outright, on a problem that resolves itself in seconds if retried. Every
 * install step below is retried and every non-critical one degrades instead
 * of aborting the rest of the script; `checkReadiness` afterwards — not this
 * script's exit code — is what actually decides success (see `provision`).
 *
 * Ports Coolify's `InstallDocker` action: OS-family prerequisite install,
 * a pinned Docker version (not whatever `get.docker.com` resolves to today),
 * and a `jq`-merged daemon.json rather than an overwrite — a server that
 * already runs Docker with its own daemon.json keeps its own settings.
 */
function provisioningScript(local: boolean): string {
  // A local server's Docker is the host's own daemon, reached through the
  // docker.sock mount (ssh/target.ts's isLocalServer) — nothing to install or
  // reconfigure, only the shared network is ours to ensure.
  if (local) {
    return [
      'set +e',
      'echo "→ Local server — Docker is this machine\'s own daemon; nothing to install"',
      // Baked into the ideploy-api image's own Dockerfile too — this is the
      // fallback for whenever that image predates it, since this container's
      // filesystem (outside its bind mounts) does not survive a rebuild.
      'echo "→ Checking nixpacks"',
      'if ! command -v nixpacks >/dev/null 2>&1; then',
      '  echo "→ Installing nixpacks"',
      '  curl -fsSL https://nixpacks.com/install.sh | bash',
      '  for candidate in /root/.nixpacks/bin/nixpacks "$HOME/.nixpacks/bin/nixpacks"; do',
      '    [ -x "$candidate" ] && [ ! -e /usr/local/bin/nixpacks ] && ln -sf "$candidate" /usr/local/bin/nixpacks',
      '  done',
      'else',
      '  echo "→ nixpacks already present"',
      'fi',
      'echo "→ Ensuring the shared network"',
      'docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy',
      'echo "→ Verifying"',
      'docker version --format "Docker {{.Server.Version}}" 2>&1',
      'docker compose version --short 2>&1',
      'nixpacks --version 2>&1',
      'echo "→ Setup complete"',
    ].join('\n');
  }

  return [
    'set +e',
    '. /etc/os-release 2>/dev/null',
    // Retries a flaky/locked package-manager call a few times before giving
    // up on it — a held lock clears on its own far more often than not.
    'retry() {',
    '  n=0',
    '  until [ "$n" -ge 6 ]; do',
    '    "$@" && return 0',
    '    n=$((n + 1))',
    '    echo "→ Package manager busy, retrying in 5s ($n/6)..."',
    '    sleep 5',
    '  done',
    '  echo "→ Still busy after retries — continuing, some packages may already be present"',
    '  return 0',
    '}',
    // A held apt/dpkg lock is not always someone else's apt-get finishing in
    // the next few seconds — cloud images occasionally leave `apt.systemd.daily`
    // wedged indefinitely (a stalled network fetch on first boot, months
    // before anyone notices), which no bounded wait ever outlives. Only a lock
    // held for a genuinely long time (10+ minutes — far past any legitimate
    // apt run) is treated as stale and cleared; anything more recent is left
    // alone; `fuser` missing (rare, non-Debian minimal images) just skips this.
    'clear_stale_apt_lock() {',
    '  command -v fuser >/dev/null 2>&1 || return 0',
    '  for lockfile in /var/lib/apt/lists/lock /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock; do',
    '    pid=$(fuser "$lockfile" 2>/dev/null | tr -d " ")',
    '    [ -n "$pid" ] || continue',
    '    elapsed=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d " ")',
    '    if [ -n "$elapsed" ] && [ "$elapsed" -gt 600 ] 2>/dev/null; then',
    '      echo "→ $lockfile held by PID $pid for ${elapsed}s — stale, clearing it"',
    '      kill -9 "$pid" 2>/dev/null || true',
    '      rm -f /var/lib/apt/lists/lock /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock 2>/dev/null',
    '      dpkg --configure -a >/dev/null 2>&1 || true',
    '    fi',
    '  done',
    '}',
    // A third-party repo (security scanners, monitoring agents — added by
    // some other tool at some other time, not ours to assume is healthy) can
    // fail `apt-get update` *permanently*, not transiently: a malformed
    // entry, an expired key, a repo that stopped existing. No amount of
    // retrying changes that outcome, and it silently takes the *entire*
    // update down — including the packages we actually need from the distro's
    // own, perfectly fine repos. Named in the error output (apt says exactly
    // which sources.list.d file it came from), so it can be disabled
    // specifically rather than guessed at.
    'apt_update_resilient() {',
    '  out=$(apt-get update -y 2>&1)',
    '  rc=$?',
    '  if [ $rc -ne 0 ]; then',
    '    broken=$(echo "$out" | grep -oE "/etc/apt/sources\\.list\\.d/[A-Za-z0-9._-]+\\.list" | sort -u)',
    '    if [ -n "$broken" ]; then',
    '      echo "$broken" | while read -r f; do',
    '        [ -f "$f" ] && echo "→ Disabling broken third-party repo: $f" && mv "$f" "$f.disabled-by-ideploy"',
    '      done',
    '      out=$(apt-get update -y 2>&1)',
    '      rc=$?',
    '    fi',
    '  fi',
    '  echo "$out"',
    '  return $rc',
    '}',
    'echo "→ Installing prerequisites (curl, wget, git, jq)"',
    'case "$ID" in',
    '  ubuntu|debian|raspbian)',
    '    clear_stale_apt_lock',
    '    retry apt_update_resilient >/dev/null',
    '    for pkg in curl wget git jq; do command -v "$pkg" >/dev/null || retry apt-get install -y "$pkg" >/dev/null 2>&1; done',
    '    ;;',
    '  centos|fedora|rhel|rocky|almalinux)',
    '    for pkg in curl wget git jq; do command -v "$pkg" >/dev/null || retry dnf install -y "$pkg" >/dev/null 2>&1; done',
    '    ;;',
    '  sles|opensuse-leap|opensuse-tumbleweed)',
    '    for pkg in curl wget git jq; do command -v "$pkg" >/dev/null || retry zypper install -y "$pkg" >/dev/null 2>&1; done',
    '    ;;',
    '  alpine)',
    '    for pkg in curl wget git jq; do command -v "$pkg" >/dev/null || retry apk add --no-cache "$pkg" >/dev/null 2>&1; done',
    '    ;;',
    '  *)',
    '    echo "→ Unrecognised distribution (${ID:-unknown}) — skipping prerequisite install, hoping curl/git/jq are already there"',
    '    ;;',
    'esac',
    'echo "→ Checking Docker"',
    'if ! docker version >/dev/null 2>&1; then',
    `  echo "→ Installing Docker ${DOCKER_PINNED_VERSION}"`,
    '  clear_stale_apt_lock',
    // Same fallback chain as the Laravel side: the pinned-version installer
    // first, the convenience script (latest) if that one is unreachable —
    // and the whole attempt is retried, not just our own apt-get calls: the
    // installer runs its own `apt-get update` internally, which hits the
    // exact same lock our prerequisite step already cleared once but a
    // concurrent process could still be contending for.
    `  install_docker() { curl -fsSL https://releases.rancher.com/install-docker/${DOCKER_PINNED_VERSION}.sh | sh || curl -fsSL https://get.docker.com | sh; }`,
    '  retry install_docker',
    'else',
    '  echo "→ Docker already present"',
    'fi',
    'echo "→ Configuring the Docker daemon (log rotation)"',
    'mkdir -p /etc/docker',
    `cat > /tmp/ideploy-daemon.json <<'IDEPLOY_EOF'\n${DAEMON_CONFIG}\nIDEPLOY_EOF`,
    // Merge onto whatever daemon.json already exists rather than overwrite it —
    // a server provisioned before iDeploy touched it may have its own settings
    // (registry mirrors, storage driver) that a blind overwrite would silently
    // drop.
    'if command -v jq >/dev/null 2>&1 && [ -s /etc/docker/daemon.json ]; then',
    '  jq -s ".[0] * .[1]" /etc/docker/daemon.json /tmp/ideploy-daemon.json > /tmp/ideploy-daemon-merged.json 2>/dev/null',
    '  [ -s /tmp/ideploy-daemon-merged.json ] && mv /tmp/ideploy-daemon-merged.json /tmp/ideploy-daemon.json',
    'fi',
    'if ! cmp -s /tmp/ideploy-daemon.json /etc/docker/daemon.json 2>/dev/null; then',
    '  mv /tmp/ideploy-daemon.json /etc/docker/daemon.json',
    '  echo "→ Restarting Docker to apply the configuration"',
    '  systemctl enable docker >/dev/null 2>&1 || true',
    '  systemctl restart docker 2>/dev/null || service docker restart 2>/dev/null || true',
    '  sleep 2',
    'else',
    '  rm -f /tmp/ideploy-daemon.json',
    '  echo "→ Daemon configuration already current"',
    '  systemctl enable docker >/dev/null 2>&1 || true',
    'fi',
    // The build engine's nixpacks build pack (Vite/Node/Python/… without a
    // Dockerfile — the common case) runs the real `nixpacks` binary directly
    // on this server, not through any "nixpacks Docker image": no such
    // general-purpose image exists. Installed to /usr/local/bin explicitly
    // rather than trusting the installer's default, which can land somewhere
    // only an interactive login shell's PATH would pick up — a deployment
    // runs over a plain non-interactive SSH command.
    'echo "→ Checking nixpacks"',
    'if ! command -v nixpacks >/dev/null 2>&1; then',
    '  echo "→ Installing nixpacks"',
    '  install_nixpacks() { curl -fsSL https://nixpacks.com/install.sh | bash; }',
    '  retry install_nixpacks',
    '  for candidate in /root/.nixpacks/bin/nixpacks "$HOME/.nixpacks/bin/nixpacks"; do',
    '    [ -x "$candidate" ] && [ ! -e /usr/local/bin/nixpacks ] && ln -sf "$candidate" /usr/local/bin/nixpacks',
    '  done',
    'else',
    '  echo "→ nixpacks already present"',
    'fi',
    'echo "→ Ensuring the shared network"',
    'docker network inspect ideploy >/dev/null 2>&1 || docker network create --attachable ideploy',
    'echo "→ Verifying"',
    'docker version --format "Docker {{.Server.Version}}" 2>&1',
    'docker compose version --short 2>&1',
    'nixpacks --version 2>&1',
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

  const result = await executeRemoteCommand(server, key, provisioningScript(isLocalServer(server)), {
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
