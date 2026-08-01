/**
 * In-memory `RemoteExecutor` for tests.
 *
 * Replaces real SSH so deployment / backup / proxy logic can be exercised with
 * no server, no network and no timing. It records every command it was asked to
 * run (assert on those) and lets a test program specific responses — including
 * failures, which is how we cover error paths that are impractical to reproduce
 * against a real host.
 *
 * Usage:
 *   const ssh = useFakeExecutor();                       // registers + auto-resets
 *   ssh.on(/docker compose up/, { exitCode: 1, stderr: 'boom' });
 *   ...
 *   expect(ssh.ranMatching(/docker network create/)).toBe(true);
 */
import { Writable } from 'stream';
import { afterEach, beforeEach } from 'vitest';
import {
  ConnectionProbe,
  ExecOptions,
  ExecResult,
  RemoteExecutor,
} from '../../api/ssh/types';
import { PrivateKeyRow, ServerRow } from '../../api/models/ideploy.types';
import { resetRemoteExecutor, setRemoteExecutor } from '../../api/ssh/ssh';

export interface RecordedCall {
  serverUuid: string;
  serverIp: string;
  command: string;
  opts: ExecOptions;
}

export interface RecordedTransfer {
  direction: 'download' | 'upload';
  serverUuid: string;
  remotePath: string;
  /** Local path, for uploads only. */
  localPath?: string;
}

interface Rule {
  match: RegExp;
  result: Partial<ExecResult>;
  /** Emit these chunks through `opts.onData` before resolving. */
  stream?: string[];
}

const SUCCESS: ExecResult = { exitCode: 0, stdout: '', stderr: '' };

export class FakeRemoteExecutor implements RemoteExecutor {
  readonly calls: RecordedCall[] = [];
  readonly transfers: RecordedTransfer[] = [];
  private readonly rules: Rule[] = [];
  private defaultResult: ExecResult = SUCCESS;
  private connectionProbe: ConnectionProbe = { ok: true, output: 'ideploy-ssh-ok' };
  /** Contents served by `download`, keyed by remote path. */
  private readonly files = new Map<string, string>();
  private transferError: Error | null = null;

  /** Program the response for commands matching `match`. First match wins. */
  on(match: RegExp, result: Partial<ExecResult>, stream?: string[]): this {
    this.rules.push({ match, result, stream });
    return this;
  }

  /** Response for any command with no matching rule. */
  fallback(result: Partial<ExecResult>): this {
    this.defaultResult = { ...SUCCESS, ...result };
    return this;
  }

  /** Program what `testConnection()` reports. */
  connection(probe: Partial<ConnectionProbe>): this {
    this.connectionProbe = { ...this.connectionProbe, ...probe };
    return this;
  }

  async execute(
    server: ServerRow,
    _privateKey: PrivateKeyRow,
    command: string,
    opts: ExecOptions = {}
  ): Promise<ExecResult> {
    this.calls.push({
      serverUuid: server.uuid,
      serverIp: server.ip,
      command,
      opts,
    });

    const rule = this.rules.find((r) => r.match.test(command));
    for (const chunk of rule?.stream ?? []) {
      opts.onData?.(chunk, 'stdout');
    }
    return { ...this.defaultResult, ...(rule?.result ?? {}) };
  }

  async testConnection(): Promise<ConnectionProbe> {
    return this.connectionProbe;
  }

  /** Make `remotePath` downloadable with the given contents. */
  withFile(remotePath: string, contents: string): this {
    this.files.set(remotePath, contents);
    return this;
  }

  /** Make the next transfer fail — covers a mid-download connection drop. */
  failTransfers(message: string): this {
    this.transferError = new Error(message);
    return this;
  }

  async download(
    server: ServerRow,
    _privateKey: PrivateKeyRow,
    remotePath: string,
    destination: Writable
  ): Promise<number> {
    this.transfers.push({ direction: 'download', serverUuid: server.uuid, remotePath });
    if (this.transferError) throw this.transferError;

    const contents = this.files.get(remotePath);
    if (contents === undefined) {
      throw new Error(`Could not read ${remotePath} from ${server.name}: No such file or directory`);
    }

    const buffer = Buffer.from(contents);
    await new Promise<void>((resolve, reject) => {
      destination.write(buffer, (err) => (err ? reject(err) : resolve()));
    });
    return buffer.length;
  }

  async upload(
    server: ServerRow,
    _privateKey: PrivateKeyRow,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    this.transfers.push({ direction: 'upload', serverUuid: server.uuid, remotePath, localPath });
    if (this.transferError) throw this.transferError;
  }

  // ── Assertion helpers ───────────────────────────────────

  /** Every command received, in order. */
  commands(): string[] {
    return this.calls.map((c) => c.command);
  }

  /** True if any received command matches `pattern`. */
  ranMatching(pattern: RegExp): boolean {
    return this.calls.some((c) => pattern.test(c.command));
  }

  /** All commands matching `pattern`. */
  matching(pattern: RegExp): RecordedCall[] {
    return this.calls.filter((c) => pattern.test(c.command));
  }

  /** Index of the first command matching `pattern`, or -1. Useful for ordering assertions. */
  indexOf(pattern: RegExp): number {
    return this.calls.findIndex((c) => pattern.test(c.command));
  }

  clear(): void {
    this.calls.length = 0;
    this.transfers.length = 0;
    this.rules.length = 0;
    this.defaultResult = SUCCESS;
    this.files.clear();
    this.transferError = null;
  }
}

/**
 * Register a fresh fake executor for each test in the current suite and restore
 * the real one afterwards. Returns a stable reference whose state is reset
 * between tests.
 */
export function useFakeExecutor(): FakeRemoteExecutor {
  const fake = new FakeRemoteExecutor();

  beforeEach(() => {
    fake.clear();
    setRemoteExecutor(fake);
  });

  afterEach(() => {
    resetRemoteExecutor();
  });

  return fake;
}
