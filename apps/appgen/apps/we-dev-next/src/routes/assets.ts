import { Router, Request, Response } from 'express';
import { ChatLogger } from '../utils/logger.js';

const router = Router();

/**
 * Reads a bucket asset back as a data URI. Local development only.
 *
 * In production the bucket is served over HTTPS and the generated `<img src>`
 * loads normally. In development `MINIO_PUBLIC_URL` is `http://localhost:9000`,
 * and the WebContainer preview runs on an HTTPS origin, so the browser blocks
 * the image as mixed content: no request, nothing logged by the app, just a
 * logo that never appears.
 *
 * The caller uses this to patch the copy it mounts into WebContainer. The
 * project's own files keep the original URL, so nothing extra is ever persisted
 * to the bucket.
 *
 * It runs server-side rather than in the browser so there is no CORS
 * configuration to depend on, and the bytes never pass through the model.
 */

/** Beyond this the data URI is worse than the problem it solves. */
const MAX_ASSET_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 5000;

const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/avif',
];

/**
 * Hosts this endpoint may fetch from.
 *
 * Without an allowlist the route is an open proxy: anyone could make the server
 * fetch an internal address and read the response back. Defaults cover the
 * bucket and the local development setup.
 */
function allowedHosts(): string[] {
  const configured = (process.env.ASSET_INLINE_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const fromBucket: string[] = [];

  for (const candidate of [process.env.MINIO_PUBLIC_URL, process.env.ASSET_BASE_URL]) {
    if (!candidate) continue;
    try {
      fromBucket.push(new URL(candidate).host.toLowerCase());
    } catch {
      // Ignore a malformed env value rather than refusing to start.
    }
  }

  return [...new Set([...configured, ...fromBucket, 'localhost:9000', '127.0.0.1:9000'])];
}

function isAllowed(target: URL): boolean {
  // Only insecure origins need this treatment; an HTTPS asset loads by itself.
  if (target.protocol !== 'http:') {
    return false;
  }

  return allowedHosts().includes(target.host.toLowerCase());
}

router.get('/inline', async (req: Request, res: Response) => {
  const raw = typeof req.query.url === 'string' ? req.query.url : '';

  let target: URL;

  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ error: 'A valid absolute `url` is required.' });
  }

  if (!isAllowed(target)) {
    ChatLogger.setContext('AssetsRoute');
    ChatLogger.warn('INLINE_BLOCKED', 'Host not allowed or already secure', {
      host: target.host,
      protocol: target.protocol,
    });
    return res.status(403).json({ error: `Not inlinable: ${target.protocol}//${target.host}` });
  }

  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream responded ${upstream.status}` });
    }

    const contentType = (upstream.headers.get('content-type') ?? '').split(';')[0].trim();

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return res
        .status(415)
        .json({ error: `Unsupported content type: ${contentType || 'unknown'}` });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    if (buffer.byteLength > MAX_ASSET_BYTES) {
      return res.status(413).json({ error: `Asset is ${buffer.byteLength} bytes, over the limit.` });
    }

    return res.json({
      dataUri: `data:${contentType};base64,${buffer.toString('base64')}`,
      bytes: buffer.byteLength,
      contentType,
    });
  } catch (error) {
    ChatLogger.setContext('AssetsRoute');
    ChatLogger.error('INLINE_FAILED', 'Could not fetch the asset', error);
    return res.status(502).json({ error: 'Could not fetch the asset.' });
  }
});

export default router;
