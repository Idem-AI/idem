/**
 * SSH execution engine — faithful Node port of Coolify's
 * `App\Helpers\SshMultiplexingHelper` + `App\Traits\ExecuteRemoteCommand`.
 *
 * It shells out to the system `ssh`/`scp` binaries with ControlMaster
 * multiplexing (a persistent Unix socket per server) — exactly like the
 * Laravel app — so behaviour, options and the on-disk socket layout match.
 *
 * The private key is decrypted from the `private_keys` table (Laravel-encrypted)
 * and written to a 0600 file. Commands run with exponential-backoff retries and
 * secret redaction in logs.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import logger from '../config/logger';
import { decryptString } from '../utils/laravel-crypto';
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';

const SSH_DIR = process.env.IDEPLOY_SSH_DIR || path.join(process.cwd(), '.ssh-storage');
const KEYS_DIR = path.join(SSH_DIR, 'keys');
const MUX_DIR = path.join(SSH_DIR, 'mux');

const SSH = {
  muxEnabled: (process.env.SSH_MUX_ENABLED ?? 'true') !== 'false',
  muxPersistTime: parseInt(process.env.SSH_MUX_PERSIST_TIME || '3600', 10),
  connectionTimeout: 10,
  serverInterval: 20,
  commandTimeout: parseInt(process.env.SSH_COMMAND_TIMEOUT || '3600', 10),
  maxRetries: parseInt(process.env.SSH_MAX_RETRIES || '3', 10),
  retryBaseDelay: parseInt(process.env.SSH_RETRY_BASE_DELAY || '2', 10),
  retryMaxDelay: parseInt(process.env.SSH_RETRY_MAX_DELAY || '30', 10),
  retryMultiplier: parseInt(process.env.SSH_RETRY_MULTIPLIER || '2', 10),
};

function ensureDirs(): void {
  fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  fs.mkdirSync(MUX_DIR, { recursive: true, mode: 0o700 });
}

/** Write the decrypted private key to a 0600 file; returns its path. */
export function materializeKey(privateKey: PrivateKeyRow): string {
  ensureDirs();
  const keyPath = path.join(KEYS_DIR, privateKey.uuid);
  const pem = decryptString(privateKey.private_key);
  const normalized = pem.endsWith('\n') ? pem : pem + '\n';
  fs.writeFileSync(keyPath, normalized, { mode: 0o600 });
  return keyPath;
}

function muxPath(server: ServerRow): string {
  return path.join(MUX_DIR, `mux_${server.uuid}`);
}

function commonSshOptions(server: ServerRow, keyPath: string, isScp = false): string[] {
  return [
    '-i', keyPath,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'PasswordAuthentication=no',
    '-o', `ConnectTimeout=${SSH.connectionTimeout}`,
    '-o', `ServerAliveInterval=${SSH.serverInterval}`,
    '-o', 'RequestTTY=no',
    '-o', 'LogLevel=ERROR',
    isScp ? '-P' : '-p', String(server.port),
  ];
}

function muxOptions(server: ServerRow): string[] {
  return [
    '-o', 'ControlMaster=auto',
    '-o', `ControlPath=${muxPath(server)}`,
    '-o', `ControlPersist=${SSH.muxPersistTime}`,
  ];
}

/** Run a local command, capturing stdout/stderr. */
function run(
  cmd: string,
  args: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: err.message }));
  });
}

/** Ensure a multiplexed master connection exists (best-effort). */
export async function ensureMultiplexedConnection(
  server: ServerRow,
  keyPath: string
): Promise<boolean> {
  if (!SSH.muxEnabled) return false;
  const target = `${server.user}@${server.ip}`;

  const check = await run('ssh', ['-O', 'check', '-o', `ControlPath=${muxPath(server)}`, target]);
  if (check.code === 0) return true;

  const establish = await run('ssh', [
    '-fNM',
    ...muxOptions(server),
    ...commonSshOptions(server, keyPath),
    target,
  ]);
  return establish.code === 0;
}

/** Close + remove the multiplexed socket for a server. */
export async function removeMux(server: ServerRow): Promise<void> {
  await run('ssh', ['-O', 'exit', '-o', `ControlPath=${muxPath(server)}`, `${server.user}@${server.ip}`]);
}

export interface ExecOptions {
  /** Streamed callback for each stdout/stderr chunk (for live deploy logs). */
  onData?: (chunk: string, stream: 'stdout' | 'stderr') => void;
  /** Strings to redact from logs (secrets, tokens). */
  redact?: string[];
  /** Disable retries (e.g. for idempotency-sensitive commands). */
  noRetry?: boolean;
}

function redactText(text: string, secrets: string[] = []): string {
  let out = text;
  for (const s of secrets) {
    if (s) out = out.split(s).join('[REDACTED]');
  }
  return out;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute a command on the remote server over SSH, streaming output.
 * Mirrors ExecuteRemoteCommand: heredoc-wrapped `bash -se`, multiplexing,
 * retries with exponential backoff.
 */
export async function executeRemoteCommand(
  server: ServerRow,
  privateKey: PrivateKeyRow,
  command: string,
  opts: ExecOptions = {}
): Promise<ExecResult> {
  const keyPath = materializeKey(privateKey);
  const target = `${server.user}@${server.ip}`;

  const attempt = async (): Promise<ExecResult> => {
    const useMux = await ensureMultiplexedConnection(server, keyPath);
    const args = [
      ...(useMux ? muxOptions(server) : []),
      ...commonSshOptions(server, keyPath),
      target,
      'bash -se',
    ];

    return new Promise<ExecResult>((resolve) => {
      const child = spawn('timeout', [String(SSH.commandTimeout), 'ssh', ...args]);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        const chunk = d.toString();
        stdout += chunk;
        opts.onData?.(redactText(chunk, opts.redact), 'stdout');
      });
      child.stderr.on('data', (d) => {
        const chunk = d.toString();
        stderr += chunk;
        opts.onData?.(redactText(chunk, opts.redact), 'stderr');
      });
      child.on('close', (code) => resolve({ exitCode: code ?? -1, stdout, stderr }));
      child.on('error', (err) => resolve({ exitCode: -1, stdout, stderr: err.message }));

      // Feed the command via stdin (heredoc-style) and close.
      child.stdin.write(command + '\n');
      child.stdin.end();
    });
  };

  let lastResult: ExecResult = { exitCode: -1, stdout: '', stderr: '' };
  const maxAttempts = opts.noRetry ? 1 : SSH.maxRetries;

  for (let i = 0; i < maxAttempts; i++) {
    lastResult = await attempt();
    if (lastResult.exitCode === 0) return lastResult;

    if (i < maxAttempts - 1) {
      const backoff = Math.min(
        SSH.retryBaseDelay * Math.pow(SSH.retryMultiplier, i),
        SSH.retryMaxDelay
      );
      logger.warn('Remote command failed, retrying', {
        server: server.name,
        attempt: i + 1,
        backoffSeconds: backoff,
        stderr: redactText(lastResult.stderr, opts.redact).slice(0, 500),
      });
      await delay(backoff * 1000);
    }
  }

  return lastResult;
}

/** Quick connectivity probe (used by server validation). */
export async function testConnection(
  server: ServerRow,
  privateKey: PrivateKeyRow
): Promise<{ ok: boolean; output: string }> {
  const result = await executeRemoteCommand(
    server,
    privateKey,
    'echo "ideploy-ssh-ok"; uname -a',
    { noRetry: true }
  );
  return { ok: result.exitCode === 0 && result.stdout.includes('ideploy-ssh-ok'), output: result.stdout || result.stderr };
}
