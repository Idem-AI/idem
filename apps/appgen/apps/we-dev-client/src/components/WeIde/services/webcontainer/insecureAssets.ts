/**
 * Makes `http://` assets visible inside the WebContainer preview. Local only.
 *
 * The preview is served on an HTTPS origin. In development the asset bucket is
 * `http://localhost:9000`, and a browser silently blocks an `http://` image
 * inside an HTTPS page as mixed content — no request, no console error from the
 * app, just a logo that never appears. In production the bucket is HTTPS and
 * none of this runs: the trigger is the scheme itself, so there is no flag to
 * forget to turn off.
 *
 * Each image is downloaded once and written as a real file into the
 * container (`public/_idem-assets/`), and the mounted copy of the code points
 * at `/_idem-assets/<name>`: the preview serves it from its own origin.
 *
 * It used to be inlined as a data URI. A redesigned site carries dozens of
 * photos (72 in a real one, up to 2.5 MB each): every module that listed them
 * became megabytes of base64, the preview took ages to start, and some images
 * never made it.
 *
 * The rewrite happens **only on the copy mounted into WebContainer**. The file
 * store keeps the original URL, and the file store is what `codeSync` pushes to
 * the bucket, so no image bytes are ever duplicated into stored project code.
 */

import type { WebContainer } from '@webcontainer/api';

const IMAGE_URL = /http:\/\/[^\s"'`)<>]+\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?[^\s"'`)<>]*)?/gi;

/** The folder, under each public directory, that holds the downloaded copies. Never read back into the store. */
export const LOCAL_ASSETS_DIR = '_idem-assets';

/** Text files worth scanning. Binary and lockfiles never carry an <img src>. */
const SCANNABLE = /\.(jsx?|tsx?|html|css|json|md)$/i;

/** How many images are fetched at once. */
const CONCURRENCY = 6;

/** A failed download is retried on a later mount, but not on every one. */
const RETRY_AFTER_MS = 30_000;

interface Entry {
  /** `/_idem-assets/<name>`, or null while unavailable. */
  local: string | null;
  bytes?: Uint8Array;
  failedAt?: number;
}

/** Resolved once per URL for the lifetime of the tab; mounts are frequent. */
const cache = new Map<string, Entry>();

/** Files already written into the current container. Forgotten when the container is replaced. */
const written = new Set<string>();

/** The container was replaced: its disk is empty, the files must be written again. */
export function resetLocalAssets(): void {
  written.clear();
}

export function collectInsecureAssetUrls(files: Record<string, unknown>): string[] {
  const found = new Set<string>();

  for (const [path, contents] of Object.entries(files)) {
    if (typeof contents !== 'string' || !SCANNABLE.test(path)) {
      continue;
    }

    // `String.match` with a /g regex returns the full matches; `matchAll`
    // would need downlevelIteration, which this build does not enable.
    const matches = contents.match(IMAGE_URL);

    if (matches) {
      matches.forEach((url) => found.add(url));
    }
  }

  return Array.from(found);
}

/** A short stable name: the same URL always lands on the same file. */
function localName(url: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) hash = Math.imul(hash ^ url.charCodeAt(i), 16777619);
  const base = (url.split(/[?#]/)[0].split('/').pop() || 'asset').replace(/[^\w.-]/g, '-').slice(-60);
  return `${(hash >>> 0).toString(36)}-${base}`;
}

/** The bytes of an asset: straight from the bucket (it answers the workspace's origin), else through the server. */
async function download(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (response.ok) return new Uint8Array(await response.arrayBuffer());
  } catch {
    // CORS or network: the server relay below.
  }

  try {
    const apiBase = process.env.REACT_APP_BASE_URL || '';
    const response = await fetch(`${apiBase}/api/assets/inline?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      console.warn(`[insecureAssets] ${url} → ${response.status}`);
      return null;
    }
    const { dataUri } = (await response.json()) as { dataUri?: string };
    const base64 = typeof dataUri === 'string' ? dataUri.split(',')[1] : '';
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (error) {
    console.warn(`[insecureAssets] could not resolve ${url}:`, error);
    return null;
  }
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(run));
  }
}

/**
 * Downloads every insecure asset the files mention (once), writes the copies into the container's public
 * directories, and returns the URL → local path replacements for the mounted code.
 */
export async function resolveInsecureAssets(
  files: Record<string, unknown>,
  instance?: WebContainer
): Promise<Map<string, string>> {
  const urls = collectInsecureAssetUrls(files);
  const now = Date.now();
  const pending = urls.filter((url) => {
    const entry = cache.get(url);
    return !entry || (!entry.local && (entry.failedAt ?? 0) + RETRY_AFTER_MS < now);
  });

  if (pending.length) {
    await inBatches(pending, CONCURRENCY, async (url) => {
      const bytes = await download(url);
      cache.set(url, bytes ? { local: `/${LOCAL_ASSETS_DIR}/${localName(url)}`, bytes } : { local: null, failedAt: Date.now() });
    });
    const resolved = pending.filter((url) => cache.get(url)?.local).length;
    console.warn(`[insecureAssets] ${resolved}/${pending.length} http asset(s) copied into the preview (not persisted)`);
  }

  // The copies go next to whichever Vite root serves the page: the project root (site, mobile app) and
  // `frontend/` for a full-stack app.
  const publicDirs = ['public', ...('frontend/package.json' in files ? ['frontend/public'] : [])];
  if (instance) {
    for (const dir of publicDirs) {
      const targets = urls.map((url) => cache.get(url)).filter((entry): entry is Entry & { local: string; bytes: Uint8Array } => !!entry?.local && !!entry.bytes);
      const missing = targets.filter((entry) => !written.has(`${dir}${entry.local}`));
      if (!missing.length) continue;
      await instance.fs.mkdir(`${dir}/${LOCAL_ASSETS_DIR}`, { recursive: true });
      await inBatches(missing, CONCURRENCY, async (entry) => {
        try {
          await instance.fs.writeFile(`${dir}${entry.local}`, entry.bytes);
          written.add(`${dir}${entry.local}`);
        } catch (error) {
          console.warn(`[insecureAssets] could not write ${dir}${entry.local}`, error);
        }
      });
    }
  }

  const replacements = new Map<string, string>();
  for (const url of urls) {
    const entry = cache.get(url);
    if (entry?.local && Array.from(written).some((path) => path.endsWith(entry.local!))) replacements.set(url, entry.local);
  }
  return replacements;
}

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function rewriteInsecureAssetUrls(
  contents: string,
  replacements: Map<string, string>
): string {
  if (!replacements.size) {
    return contents;
  }

  let next = contents;

  replacements.forEach((local, url) => {
    if (next.indexOf(url) !== -1) {
      next = next.replace(new RegExp(escapeForRegex(url), 'g'), local);
    }
  });

  return next;
}
