/**
 * Remote file inspection.
 *
 * Built on `executeRemoteCommand` rather than added to the executor port: a
 * `stat` is a few bytes of output, so it needs none of the streaming machinery
 * that `download`/`upload` do — and keeping the port small means the test double
 * stays honest.
 */
import { executeRemoteCommand, shellQuote } from './ssh';
import { PrivateKeyRow, ServerRow } from '../models/ideploy.types';

export interface RemoteFileInfo {
  path: string;
  /** Size in bytes. */
  size: number;
}

/**
 * Stat a file on the server.
 *
 * @returns null when the path does not exist or is not a regular file — the
 * caller usually wants to answer "is this downloadable?", and a directory or a
 * dangling symlink is not.
 */
export async function statRemoteFile(
  server: ServerRow,
  key: PrivateKeyRow,
  remotePath: string
): Promise<RemoteFileInfo | null> {
  const quoted = shellQuote(remotePath);
  // `-f` is the regular-file test: excludes directories and broken symlinks.
  const command = `if [ -f ${quoted} ]; then stat -c %s -- ${quoted}; else echo MISSING; fi`;

  const result = await executeRemoteCommand(server, key, command, { noRetry: true });
  const output = result.stdout.trim();

  if (result.exitCode !== 0 || output === '' || output.includes('MISSING')) {
    return null;
  }

  const size = Number(output.split('\n').pop());
  return Number.isFinite(size) ? { path: remotePath, size } : null;
}
