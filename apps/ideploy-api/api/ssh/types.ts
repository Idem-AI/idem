/**
 * Remote-execution port.
 *
 * Every server-side operation in iDeploy (deploy, backup, proxy, database
 * lifecycle, …) ultimately runs a shell command on a remote host. Declaring that
 * capability as an interface — rather than importing the SSH implementation
 * directly — is what makes the business logic testable without a real server:
 * tests register an in-memory executor (see `testing/fake-executor.ts`) instead
 * of spawning `ssh`.
 *
 * The real adapter lives in `real-executor.ts`; `ssh.ts` is the facade that
 * services import.
 */
import { Writable } from 'stream';
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';

export interface ExecOptions {
  /** Streamed callback for each stdout/stderr chunk (for live deploy logs). */
  onData?: (chunk: string, stream: 'stdout' | 'stderr') => void;
  /** Strings to redact from logs (secrets, tokens). */
  redact?: string[];
  /** Disable retries (e.g. for idempotency-sensitive commands). */
  noRetry?: boolean;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ConnectionProbe {
  ok: boolean;
  output: string;
}

/**
 * Anything able to run a command on a server on our behalf. Implemented once for
 * real SSH, once for tests.
 *
 * File transfer is part of the port rather than built on `execute` because it
 * needs different process plumbing: `execute` accumulates output into a string,
 * which is fine for a command's few kilobytes and ruinous for a multi-gigabyte
 * database backup.
 */
export interface RemoteExecutor {
  execute(
    server: ServerRow,
    privateKey: PrivateKeyRow,
    command: string,
    opts?: ExecOptions
  ): Promise<ExecResult>;

  testConnection(server: ServerRow, privateKey: PrivateKeyRow): Promise<ConnectionProbe>;

  /**
   * Stream a remote file into `destination` without buffering it in memory.
   * @returns the number of bytes transferred.
   */
  download(
    server: ServerRow,
    privateKey: PrivateKeyRow,
    remotePath: string,
    destination: Writable
  ): Promise<number>;

  /** Copy a local file onto the server. */
  upload(
    server: ServerRow,
    privateKey: PrivateKeyRow,
    localPath: string,
    remotePath: string
  ): Promise<void>;
}
