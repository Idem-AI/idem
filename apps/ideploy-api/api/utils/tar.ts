/**
 * A gzipped tar archive built in memory, without a dependency.
 *
 * Used to hand the files iCode sends to a server: one `scp` of one archive,
 * then one `tar xzf` there — instead of a command per file. The format is the
 * plain POSIX `ustar` the `tar` of every Linux server reads: 512-byte header
 * blocks, contents padded to 512 bytes, two empty blocks at the end.
 */
import { gunzipSync, gzipSync } from 'zlib';

const BLOCK = 512;

/** File contents: text as a string, binary (images, fonts) as a Buffer. */
export type ArchiveFiles = Record<string, string | Buffer>;

function octal(value: number, length: number): string {
  // `length - 1` digits, then the NUL the field reserves.
  return value.toString(8).padStart(length - 1, '0') + '\0';
}

/**
 * Split a path into ustar's `name` (100 bytes) and `prefix` (155 bytes).
 * Longer paths are refused rather than silently truncated.
 */
function splitPath(path: string): { name: string; prefix: string } {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' };
  for (let cut = path.lastIndexOf('/'); cut > 0; cut = path.lastIndexOf('/', cut - 1)) {
    const prefix = path.slice(0, cut);
    const name = path.slice(cut + 1);
    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) return { name, prefix };
  }
  throw new Error(`Path too long for the archive: ${path}`);
}

function header(path: string, size: number): Buffer {
  const block = Buffer.alloc(BLOCK, 0);
  const { name, prefix } = splitPath(path);
  block.write(name, 0, 100, 'utf8');
  block.write(octal(0o644, 8), 100, 8, 'ascii'); // mode
  block.write(octal(0, 8), 108, 8, 'ascii'); // uid
  block.write(octal(0, 8), 116, 8, 'ascii'); // gid
  block.write(octal(size, 12), 124, 12, 'ascii');
  block.write(octal(Math.floor(Date.now() / 1000), 12), 136, 12, 'ascii'); // mtime
  block.write('        ', 148, 8, 'ascii'); // checksum placeholder: spaces while summing
  block.write('0', 156, 1, 'ascii'); // regular file
  block.write('ustar\0', 257, 6, 'ascii');
  block.write('00', 263, 2, 'ascii');
  block.write(prefix, 345, 155, 'utf8');

  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(octal(sum, 7) + ' ', 148, 8, 'ascii');
  return block;
}

/** Build a `.tar.gz` holding `files`, with their paths as given. */
export function createTarGz(files: ArchiveFiles): Buffer {
  const parts: Buffer[] = [];
  for (const [path, contents] of Object.entries(files)) {
    const data = typeof contents === 'string' ? Buffer.from(contents, 'utf8') : contents;
    parts.push(header(path, data.length), data);
    const padding = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (padding) parts.push(Buffer.alloc(padding, 0));
  }
  parts.push(Buffer.alloc(BLOCK * 2, 0));
  return gzipSync(Buffer.concat(parts));
}

/**
 * Read back a `.tar.gz` made by `createTarGz` (or any plain ustar archive):
 * regular files only, with their full paths. A malformed archive throws.
 */
export function readTarGz(archive: Buffer): Record<string, Buffer> {
  const tar = gunzipSync(archive);
  const files: Record<string, Buffer> = {};
  const field = (block: Buffer, start: number, length: number) => {
    const raw = block.subarray(start, start + length);
    const end = raw.indexOf(0);
    return raw.subarray(0, end === -1 ? length : end).toString('utf8');
  };
  for (let offset = 0; offset + BLOCK <= tar.length; ) {
    const block = tar.subarray(offset, offset + BLOCK);
    if (block.every((byte) => byte === 0)) break;
    const size = parseInt(field(block, 124, 12).trim() || '0', 8);
    if (!Number.isFinite(size) || size < 0) throw new Error('Malformed archive');
    const type = field(block, 156, 1) || '0';
    const name = field(block, 0, 100);
    const prefix = field(block, 345, 155);
    const start = offset + BLOCK;
    if (start + size > tar.length) throw new Error('Truncated archive');
    if (type === '0') files[prefix ? `${prefix}/${name}` : name] = Buffer.from(tar.subarray(start, start + size));
    offset = start + Math.ceil(size / BLOCK) * BLOCK;
  }
  return files;
}
