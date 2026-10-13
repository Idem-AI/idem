import { getProjectCodeManifest, syncProjectCode } from '@/api/persistence/db';

/**
 * Fast, non-cryptographic content hash (cyrb53). It only has to detect that a
 * file changed, so a 53-bit digest computed synchronously beats hauling in
 * SubtleCrypto — which is async and unavailable outside secure contexts.
 */
export function hashContent(content: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Strips the leading slash so workspace paths and stored keys always match. */
const normalizePath = (path: string) => path.replace(/^\/+/, '');

export interface CodeDiff {
  upserts: Record<string, string>;
  deletions: string[];
  manifest: Record<string, string>;
}

/**
 * Computes what changed between the workspace and what the bucket already holds.
 */
export function diffAgainstManifest(
  files: Record<string, string>,
  storedManifest: Record<string, string>
): CodeDiff {
  const upserts: Record<string, string> = {};
  const manifest: Record<string, string> = {};

  for (const [rawPath, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;

    const path = normalizePath(rawPath);
    if (!path) continue;

    const hash = hashContent(content);
    manifest[path] = hash;

    if (storedManifest[path] !== hash) {
      upserts[path] = content;
    }
  }

  const deletions = Object.keys(storedManifest).filter((path) => !(path in manifest));

  return { upserts, deletions, manifest };
}

/**
 * Bookkeeping that lets the workspace delete a generation without an upload in
 * flight writing the old code back afterwards.
 *
 * A push reads the stored manifest, diffs, then writes: three steps over the
 * network. If the user deletes the generation in between, the write lands after
 * the deletion and part of the old project is back in the bucket — to be read on
 * the next open and merged into the "fresh" one.
 */
let syncEpoch = 0;
const inFlightSyncs = new Set<Promise<unknown>>();

/** Abandons every push that has not written yet (they notice before writing). */
export const cancelPendingCodeSync = (): void => {
  syncEpoch += 1;
};

/** Resolves once the pushes already writing have settled, whatever their outcome. */
export async function waitForCodeSync(): Promise<void> {
  await Promise.allSettled(Array.from(inFlightSyncs));
}

/**
 * Pushes the workspace to object storage, uploading only the files that differ
 * from the stored manifest and removing the ones deleted since the last sync.
 * Returns null when there was nothing to do.
 */
export function pushProjectCode(
  projectId: string,
  files: Record<string, string>
): Promise<{ written: number; deleted: number; total: number } | null> {
  const run = pushProjectCodeNow(projectId, files, syncEpoch);

  inFlightSyncs.add(run);
  const forget = () => inFlightSyncs.delete(run);
  run.then(forget, forget);

  return run;
}

async function pushProjectCodeNow(
  projectId: string,
  files: Record<string, string>,
  epoch: number
): Promise<{ written: number; deleted: number; total: number } | null> {
  if (!projectId || !files || Object.keys(files).length === 0) return null;

  const storedManifest = await getProjectCodeManifest(projectId);
  const diff = diffAgainstManifest(files, storedManifest);

  const hasChanges = Object.keys(diff.upserts).length > 0 || diff.deletions.length > 0;
  if (!hasChanges) {
    console.log('Code sync skipped: workspace already matches the stored version');
    return null;
  }

  // The generation was deleted while this push was reading the manifest.
  if (epoch !== syncEpoch) {
    console.log('Code sync abandoned: the generation was deleted meanwhile');
    return null;
  }

  return syncProjectCode(projectId, diff);
}
