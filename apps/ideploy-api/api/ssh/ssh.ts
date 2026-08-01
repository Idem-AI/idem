/**
 * Remote execution facade — the single entry point every service uses to run a
 * command on a server.
 *
 * Why a facade rather than calling the SSH adapter directly: it holds the
 * currently active `RemoteExecutor`, which defaults to real SSH in normal
 * operation and can be swapped for an in-memory fake in tests. That indirection
 * is what makes deployment, backup and proxy logic testable without any server.
 *
 * Layout:
 *   types.ts         — the port (interface) + shared result types
 *   real-executor.ts — production adapter (system `ssh`, ControlMaster mux)
 *   testing/         — fake adapter for tests
 *   ssh.ts           — this facade (public API, executor registry)
 */
import { Writable } from 'stream';
import { ServerRow, PrivateKeyRow } from '../models/ideploy.types';
import { ConnectionProbe, ExecOptions, ExecResult, RemoteExecutor } from './types';
import { realExecutor } from './real-executor';

export type { ExecOptions, ExecResult, ConnectionProbe, RemoteExecutor } from './types';
export { isLocalServer } from './target';
export {
  materializeKey,
  removeMux,
  ensureMultiplexedConnection,
  shellQuote,
} from './real-executor';

let activeExecutor: RemoteExecutor = realExecutor;

/**
 * Substitute the remote executor — tests only.
 *
 * Guarded against production: silently swapping SSH for a fake in a live
 * instance would make every deployment appear to succeed while doing nothing.
 */
export function setRemoteExecutor(executor: RemoteExecutor): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setRemoteExecutor() is not allowed in production.');
  }
  activeExecutor = executor;
}

/** Restore the real SSH executor. Call this between tests. */
export function resetRemoteExecutor(): void {
  activeExecutor = realExecutor;
}

/** Run a command on a server, streaming output through `opts.onData`. */
export function executeRemoteCommand(
  server: ServerRow,
  privateKey: PrivateKeyRow,
  command: string,
  opts: ExecOptions = {}
): Promise<ExecResult> {
  return activeExecutor.execute(server, privateKey, command, opts);
}

/** Quick connectivity probe (used by server validation). */
export function testConnection(
  server: ServerRow,
  privateKey: PrivateKeyRow
): Promise<ConnectionProbe> {
  return activeExecutor.testConnection(server, privateKey);
}

/**
 * Stream a remote file into `destination`, without buffering it in memory.
 * @returns the number of bytes transferred.
 */
export function downloadRemoteFile(
  server: ServerRow,
  privateKey: PrivateKeyRow,
  remotePath: string,
  destination: Writable
): Promise<number> {
  return activeExecutor.download(server, privateKey, remotePath, destination);
}

/** Copy a local file onto the server. */
export function uploadRemoteFile(
  server: ServerRow,
  privateKey: PrivateKeyRow,
  localPath: string,
  remotePath: string
): Promise<void> {
  return activeExecutor.upload(server, privateKey, localPath, remotePath);
}
