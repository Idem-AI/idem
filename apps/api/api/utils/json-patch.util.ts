/**
 * Minimal, dependency-free JSON diff / patch implementation (RFC 6902 subset:
 * add / remove / replace, with RFC 6901 JSON Pointer paths).
 *
 * Used by the project versioning system ("Chronicle") to store compact deltas
 * between two versions of a project section, and to rebuild any past version
 * from the nearest snapshot. Kept in-house so the history format is stable and
 * auditable, with no external dependency.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

/** Escape a single path segment per RFC 6901 ("~" -> "~0", "/" -> "~1"). */
function escapeSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Unescape a single path segment per RFC 6901. */
function unescapeSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * Normalize values before comparison so that semantically identical values do
 * not produce noise revisions (Dates vs ISO strings, undefined vs missing).
 */
function normalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) {
        out[key] = normalize(v);
      }
    }
    return out;
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}

function diffInto(before: unknown, after: unknown, path: string, ops: JsonPatchOp[]): void {
  if (deepEqual(before, after)) {
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const common = Math.min(before.length, after.length);
    for (let i = 0; i < common; i++) {
      diffInto(before[i], after[i], `${path}/${i}`, ops);
    }
    // Additions (ascending) then removals (descending) keep sequential apply valid.
    for (let i = common; i < after.length; i++) {
      ops.push({ op: 'add', path: `${path}/${i}`, value: after[i] });
    }
    for (let i = before.length - 1; i >= common; i--) {
      ops.push({ op: 'remove', path: `${path}/${i}` });
    }
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    for (const key of Object.keys(before)) {
      const childPath = `${path}/${escapeSegment(key)}`;
      if (!(key in after)) {
        ops.push({ op: 'remove', path: childPath });
      } else {
        diffInto(before[key], after[key], childPath, ops);
      }
    }
    for (const key of Object.keys(after)) {
      if (!(key in before)) {
        ops.push({ op: 'add', path: `${path}/${escapeSegment(key)}`, value: after[key] });
      }
    }
    return;
  }

  ops.push({ op: 'replace', path: path || '', value: after });
}

/**
 * Compute the RFC 6902 patch that transforms `before` into `after`.
 * Returns an empty array when both values are semantically identical.
 */
export function compareJson(before: unknown, after: unknown): JsonPatchOp[] {
  const ops: JsonPatchOp[] = [];
  const normBefore = normalize(before);
  const normAfter = normalize(after);

  if (normBefore === undefined && normAfter === undefined) {
    return ops;
  }
  if (normBefore === undefined) {
    ops.push({ op: 'add', path: '', value: normAfter });
    return ops;
  }
  if (normAfter === undefined) {
    ops.push({ op: 'remove', path: '' });
    return ops;
  }

  diffInto(normBefore, normAfter, '', ops);
  return ops;
}

function parsePointer(path: string): string[] {
  if (path === '') return [];
  if (!path.startsWith('/')) {
    throw new Error(`Invalid JSON Pointer: "${path}"`);
  }
  return path.substring(1).split('/').map(unescapeSegment);
}

/**
 * Apply an RFC 6902 patch (add/remove/replace subset) to a document and return
 * the new value. The input document is not mutated.
 */
export function applyJsonPatch<T = unknown>(document: unknown, ops: JsonPatchOp[]): T {
  let root: unknown = normalize(structuredCloneSafe(document));

  for (const op of ops) {
    const segments = parsePointer(op.path);

    if (segments.length === 0) {
      if (op.op === 'remove') {
        root = undefined;
      } else {
        root = op.value;
      }
      continue;
    }

    const parentSegments = segments.slice(0, -1);
    const lastSegment = segments[segments.length - 1];
    let parent: unknown = root;
    for (const segment of parentSegments) {
      if (Array.isArray(parent)) {
        parent = parent[Number(segment)];
      } else if (isPlainObject(parent)) {
        parent = parent[segment];
      } else {
        throw new Error(`Cannot resolve path "${op.path}": segment "${segment}" not found`);
      }
    }

    if (Array.isArray(parent)) {
      const index = lastSegment === '-' ? parent.length : Number(lastSegment);
      if (Number.isNaN(index)) {
        throw new Error(`Invalid array index "${lastSegment}" in path "${op.path}"`);
      }
      if (op.op === 'add') {
        parent.splice(index, 0, op.value);
      } else if (op.op === 'remove') {
        parent.splice(index, 1);
      } else {
        parent[index] = op.value;
      }
    } else if (isPlainObject(parent)) {
      if (op.op === 'remove') {
        delete parent[lastSegment];
      } else {
        parent[lastSegment] = op.value;
      }
    } else {
      throw new Error(`Cannot apply op at path "${op.path}": parent is not a container`);
    }
  }

  return root as T;
}

/** Deep clone that tolerates Dates and plain JSON structures. */
function structuredCloneSafe(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Human-readable summary of a patch: the list of top-level changed paths
 * (depth-limited), deduplicated, capped. Used as the default revision message,
 * git-log style, without any LLM call.
 */
export function summarizePatch(ops: JsonPatchOp[], maxPaths = 8, depth = 2): string {
  const seen = new Set<string>();
  for (const op of ops) {
    const segments = parsePointer(op.path);
    const top = segments.slice(0, depth).join('.') || '(racine)';
    seen.add(`${top}`);
    if (seen.size >= maxPaths * 2) break;
  }
  const paths = Array.from(seen).slice(0, maxPaths);
  const suffix = seen.size > maxPaths ? ', …' : '';
  return `${ops.length} changement(s): ${paths.join(', ')}${suffix}`;
}

/** Approximate serialized size in bytes of a JSON value. */
export function jsonSizeBytes(value: unknown): number {
  if (value === undefined) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}
