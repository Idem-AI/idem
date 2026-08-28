/**
 * Remote file inspection and transfer.
 *
 * Covers the paths that matter for backup downloads and are awkward to reproduce
 * against real infrastructure: a pruned file, a directory where a file was
 * expected, a path containing shell metacharacters, and a transfer that dies
 * partway through.
 */
import { describe, expect, it } from 'vitest';
import { Writable } from 'stream';
import { statRemoteFile } from '../../../api/ssh/files';
import { downloadRemoteFile, shellQuote, uploadRemoteFile } from '../../../api/ssh/ssh';
import { useFakeExecutor } from '../../helpers/fake-executor';
import { privateKeyRow, serverRow } from '../../helpers/rows';

const ssh = useFakeExecutor();
const server = serverRow();
const key = privateKeyRow();

/** Collect everything written into a stream, for assertions. */
function collector(): { stream: Writable; text: () => string } {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  return { stream, text: () => Buffer.concat(chunks).toString() };
}

describe('shellQuote', () => {
  it('wraps a plain path', () => {
    expect(shellQuote('/backups/dump.sql')).toBe("'/backups/dump.sql'");
  });

  it('neutralises a path that would otherwise inject a command', () => {
    // Backup filenames come from the database. Interpolating one unquoted into a
    // remote shell command is a command-injection primitive.
    const quoted = shellQuote("/backups/x'; rm -rf /; echo '");

    expect(quoted).toBe(`'/backups/x'\\''; rm -rf /; echo '\\'''`);
    // Every original quote is escaped, so the payload cannot terminate the string.
    expect(quoted.startsWith("'")).toBe(true);
    expect(quoted.endsWith("'")).toBe(true);
  });

  it('leaves spaces and parentheses inside the quotes, where they are inert', () => {
    expect(shellQuote('/backups/my dump (1).sql')).toBe("'/backups/my dump (1).sql'");
  });
});

describe('statRemoteFile', () => {
  it('returns the size of an existing file', async () => {
    ssh.on(/stat -c %s/, { stdout: '4096\n' });

    expect(await statRemoteFile(server, key, '/backups/dump.sql')).toEqual({
      path: '/backups/dump.sql',
      size: 4096,
    });
  });

  it('returns null when the file is gone', async () => {
    // The common case: the retention policy pruned it since the UI last listed it.
    ssh.on(/stat -c %s/, { stdout: 'MISSING\n' });

    expect(await statRemoteFile(server, key, '/backups/dump.sql')).toBeNull();
  });

  it('returns null when the path is a directory rather than a file', async () => {
    ssh.on(/stat -c %s/, { stdout: 'MISSING\n' });

    expect(await statRemoteFile(server, key, '/backups')).toBeNull();
  });

  it('returns null when the command fails outright', async () => {
    ssh.on(/stat -c %s/, { exitCode: 255, stderr: 'Connection closed' });

    expect(await statRemoteFile(server, key, '/backups/dump.sql')).toBeNull();
  });

  it('quotes the path it stats', async () => {
    ssh.on(/stat -c %s/, { stdout: '10\n' });

    await statRemoteFile(server, key, "/backups/weird'name.sql");

    expect(ssh.calls[0].command).toContain(shellQuote("/backups/weird'name.sql"));
  });

  it('tolerates a warning line printed before the size', async () => {
    ssh.on(/stat -c %s/, { stdout: 'sudo: unable to resolve host\n2048\n' });

    expect(await statRemoteFile(server, key, '/b/d.sql')).toEqual({ path: '/b/d.sql', size: 2048 });
  });
});

describe('downloadRemoteFile', () => {
  it('streams the file contents into the destination', async () => {
    ssh.withFile('/backups/dump.sql', 'PGDMP fake dump contents');
    const sink = collector();

    const bytes = await downloadRemoteFile(server, key, '/backups/dump.sql', sink.stream);

    expect(sink.text()).toBe('PGDMP fake dump contents');
    expect(bytes).toBe('PGDMP fake dump contents'.length);
  });

  it('records which file was requested from which server', async () => {
    ssh.withFile('/backups/dump.sql', 'x');
    await downloadRemoteFile(server, key, '/backups/dump.sql', collector().stream);

    expect(ssh.transfers).toEqual([
      { direction: 'download', serverUuid: server.uuid, remotePath: '/backups/dump.sql' },
    ]);
  });

  it('rejects when the file is absent, naming the path', async () => {
    await expect(
      downloadRemoteFile(server, key, '/backups/missing.sql', collector().stream)
    ).rejects.toThrow(/missing\.sql/);
  });

  it('propagates a mid-transfer failure rather than truncating silently', async () => {
    // A connection dropped halfway must not look like a complete small file.
    ssh.withFile('/backups/dump.sql', 'x').failTransfers('Connection reset by peer');

    await expect(
      downloadRemoteFile(server, key, '/backups/dump.sql', collector().stream)
    ).rejects.toThrow(/Connection reset/);
  });
});

describe('uploadRemoteFile', () => {
  it('records the local and remote paths', async () => {
    await uploadRemoteFile(server, key, '/tmp/local.conf', '/etc/ideploy/app.conf');

    expect(ssh.transfers).toEqual([
      {
        direction: 'upload',
        serverUuid: server.uuid,
        remotePath: '/etc/ideploy/app.conf',
        localPath: '/tmp/local.conf',
      },
    ]);
  });

  it('propagates a failure', async () => {
    ssh.failTransfers('Permission denied');

    await expect(uploadRemoteFile(server, key, '/tmp/a', '/etc/b')).rejects.toThrow(
      /Permission denied/
    );
  });
});
