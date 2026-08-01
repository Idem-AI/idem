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
 * The rewrite happens **only on the copy mounted into WebContainer**. The file
 * store keeps the original URL, and the file store is what `codeSync` pushes to
 * the bucket, so no image bytes are ever duplicated into stored project code.
 */

const IMAGE_URL = /http:\/\/[^\s"'`)<>]+\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?[^\s"'`)<>]*)?/gi;

/** Resolved once per URL for the lifetime of the tab; mounts are frequent. */
const cache = new Map<string, string | null>();

/** Text files worth scanning. Binary and lockfiles never carry an <img src>. */
const SCANNABLE = /\.(jsx?|tsx?|html|css|json|md)$/i;

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

async function fetchDataUri(url: string): Promise<string | null> {
  const apiBase = process.env.REACT_APP_BASE_URL || '';

  try {
    const response = await fetch(`${apiBase}/api/assets/inline?url=${encodeURIComponent(url)}`);

    if (!response.ok) {
      console.warn(`[insecureAssets] ${url} → ${response.status}`);
      return null;
    }

    const { dataUri } = (await response.json()) as { dataUri?: string };
    return typeof dataUri === 'string' && dataUri.startsWith('data:') ? dataUri : null;
  } catch (error) {
    console.warn(`[insecureAssets] could not resolve ${url}:`, error);
    return null;
  }
}

/**
 * Resolves every insecure asset URL to a data URI. Failures are remembered as
 * `null` so a dead asset is not re-fetched on every mount.
 */
export async function resolveInsecureAssets(
  files: Record<string, unknown>
): Promise<Map<string, string>> {
  const urls = collectInsecureAssetUrls(files);
  const pending = urls.filter((url) => !cache.has(url));

  if (pending.length) {
    await Promise.all(
      pending.map(async (url) => {
        cache.set(url, await fetchDataUri(url));
      })
    );

    const resolved = pending.filter((url) => cache.get(url));
    if (resolved.length) {
      console.warn(
        `[insecureAssets] inlined ${resolved.length}/${pending.length} http asset(s) for the preview (not persisted)`
      );
    }
  }

  const replacements = new Map<string, string>();

  for (const url of urls) {
    const dataUri = cache.get(url);
    if (dataUri) {
      replacements.set(url, dataUri);
    }
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

  replacements.forEach((dataUri, url) => {
    if (next.indexOf(url) !== -1) {
      next = next.replace(new RegExp(escapeForRegex(url), 'g'), dataUri);
    }
  });

  return next;
}
