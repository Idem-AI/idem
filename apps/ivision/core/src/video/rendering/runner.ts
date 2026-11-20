/**
 * LE NAVIGATEUR PARTAGÉ ET LES MÉDIAS — module partagé par les rendus HyperFrames (`hyperframes/probe.ts`,
 * `hyperframes/render.ts`) et Lottie (`assets/lottie.ts`) : un Chromium (Puppeteer) gardé ouvert entre deux rendus,
 * et les médias distants téléchargés une fois, mis en cache.
 */
import fs from 'fs';
import path from 'path';
import puppeteer, { Browser } from 'puppeteer';
import { safeFetch } from '../../render/safe-fetch';

// ─── Navigateur partagé ─────────────────────────────────────────────────────

let browserJob: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let active = 0;

async function getBrowser(): Promise<Browser> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const current = browserJob ? await browserJob.catch(() => null) : null;
  if (current?.isConnected()) return current;
  browserJob = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--mute-audio',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-background-media-suspend',
      // Canvas 2D en mémoire (pas de relecture GPU) : l'encodage JPEG de chaque image passe de ~200 à ~40 ms en 1080p.
      '--disable-accelerated-2d-canvas',
      // WebGL logiciel : les filtres et effets se rendent sans carte graphique.
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
    ],
    timeout: 30000,
  });
  return browserJob;
}

/** Le navigateur partagé, pour un autre rendu image par image (animations Lottie) ; `releaseFilmBrowser` après usage. */
export async function filmBrowser(): Promise<Browser> {
  active++;
  return getBrowser();
}
export function releaseFilmBrowser(): void {
  active = Math.max(0, active - 1);
  release();
}

function release(): void {
  if (active > 0) return;
  idleTimer = setTimeout(() => void closeFilmBrowser(), 120000);
  idleTimer.unref?.();
}

export async function closeFilmBrowser(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  const b = browserJob ? await browserJob.catch(() => null) : null;
  browserJob = null;
  await b?.close().catch(() => undefined);
}

// ─── Les médias, servis depuis la mémoire ───────────────────────────────────

interface ServedFile {
  buffer: Buffer;
  mimeType: string;
}

const mediaCache = new Map<string, Promise<ServedFile>>();
const MAX_CACHE = 80;

export function fetchMedia(url: string): Promise<ServedFile> {
  let job = mediaCache.get(url);
  if (!job) {
    job = (async () => {
      if (url.startsWith('file://') && process.env.VIDEO_ALLOW_FILE_URLS === '1' && process.env.NODE_ENV !== 'production') {
        const file = url.slice('file://'.length);
        const ext = path.extname(file).toLowerCase();
        const mimeType = ext === '.webm' ? 'video/webm' : ext === '.mp4' ? 'video/mp4' : ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
        return { buffer: fs.readFileSync(file), mimeType };
      }
      const res = await safeFetch(url, { maxBytes: 80 * 1024 * 1024, timeoutMs: 60_000, accept: ['image/', 'video/', 'application/octet-stream', 'binary/octet-stream'] });
      return { buffer: res.buffer, mimeType: res.mimeType || 'application/octet-stream' };
    })();
    mediaCache.set(url, job);
    job.catch(() => mediaCache.delete(url));
    if (mediaCache.size > MAX_CACHE) mediaCache.delete(mediaCache.keys().next().value as string);
  }
  return job;
}

