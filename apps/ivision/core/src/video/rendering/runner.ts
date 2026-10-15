/**
 * LE RENDU SERVEUR — Motion Canvas dans Chromium (Puppeteer), puis ffmpeg.
 *
 *   page     servie depuis une origine locale fictive (`https://film.idem.local`) : la page, son
 *            paquet et ses médias y sont répondus depuis la mémoire ; TOUT autre accès réseau est
 *            refusé (le code des scènes est écrit par une IA : il ne parle à personne) ;
 *   contrôle `probeFilm` exécute chaque scène (compilation, calcul, une image par scène) : erreurs
 *            techniques attribuées à leur scène, effets sonores posés, vignettes ;
 *   rendu    `renderFilm` : le film découpé en tronçons rendus en parallèle (un onglet chacun),
 *            images JPEG envoyées directement à ffmpeg, recollés, puis le son est mixé.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../../runtime/logger';
import { safeFetch } from '../../render/safe-fetch';
import type { FilmData, SceneErrorRecord, SfxCueRecord } from '../../../motion/runtime/film-data';
import type { MotionStyle, SfxKind, VideoQuality } from '../contracts/model';
import { refineCues } from '../audio/sfx';
import { encoding, FFMPEG, mixAudio, run } from './ffmpeg';

const ORIGIN = 'https://film.idem.local';

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
      // WebGL logiciel : les filtres et shaders de Motion Canvas se rendent sans carte graphique.
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--autoplay-policy=no-user-gesture-required',
    ],
    timeout: 30000,
  });
  return browserJob;
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

/**
 * Les URL distantes du film (médias des scènes, logo) remplacées par des adresses de l'origine
 * locale ; les fichiers sont téléchargés une fois. Un média illisible garde son adresse : le code
 * de la scène lèvera son erreur (« Failed to load an image »), attribuée à sa scène.
 */
export async function localizeFilm(data: FilmData): Promise<{ data: FilmData; files: Map<string, ServedFile> }> {
  const files = new Map<string, ServedFile>();
  const local = new Map<string, string>();
  const localize = async (url?: string): Promise<string | undefined> => {
    if (!url || !/^(https?:|file:)/.test(url)) return url;
    if (local.has(url)) return local.get(url);
    try {
      const file = await fetchMedia(url);
      const id = `/m/${crypto.createHash('sha1').update(url).digest('hex').slice(0, 16)}`;
      files.set(id, file);
      local.set(url, `${ORIGIN}${id}`);
      return `${ORIGIN}${id}`;
    } catch (error) {
      logger.warn('video.render.media_unavailable', { url: url.slice(0, 160), error: (error as Error)?.message });
      return url;
    }
  };
  const scenes = await Promise.all(
    data.scenes.map(async (s) => ({ ...s, media: await Promise.all(s.media.map(async (m) => ({ ...m, url: (await localize(m.url)) || m.url }))) }))
  );
  const logo = data.brand.logo ? { ...data.brand.logo, light: await localize(data.brand.logo.light), dark: await localize(data.brand.logo.dark) } : undefined;
  return { data: { ...data, scenes, brand: { ...data.brand, ...(logo ? { logo } : {}) } }, files };
}

// ─── La page ────────────────────────────────────────────────────────────────

export interface FilmPageInput {
  data: FilmData;
  /** Paquet `render` (cf. compiler.ts#buildFilmBundle). */
  bundle: string;
  /** Polices embarquées (`<style>` avec data URI). */
  fontCss: string;
}

const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function renderPageHtml(input: FilmPageInput): string {
  return `<!doctype html><html><head><meta charset="utf-8">${input.fontCss}<style>html,body{margin:0;background:#000}</style></head><body>
<script>window.__IDEM_FILM__=${json(input.data)};</script>
<script src="${ORIGIN}/film.js"></script>
</body></html>`;
}

async function openFilmPage(browser: Browser, input: FilmPageInput, files: Map<string, ServedFile>): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 320, deviceScaleFactor: 1 });
  // Chaque onglet se croit au premier plan : ses clips vidéo restent décodés pendant le rendu parallèle.
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);
  await cdp.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => undefined);
  const html = renderPageHtml(input);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    void (async () => {
      if (req.isInterceptResolutionHandled()) return;
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return req.continue();
      if (!url.startsWith(`${ORIGIN}/`)) return req.abort('blockedbyclient');
      const pathname = url.slice(ORIGIN.length).split('?')[0];
      if (pathname === '/') return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      if (pathname === '/film.js') return req.respond({ status: 200, contentType: 'text/javascript; charset=utf-8', body: input.bundle });
      const file = files.get(pathname);
      if (!file) return req.respond({ status: 404, body: '' });
      const range = req.headers()['range'];
      // Un <video> lit par plages : la réponse 206 lui permet de chercher une image précise.
      const m = range?.match(/bytes=(\d+)-(\d*)/);
      if (m) {
        const start = Number(m[1]);
        const end = m[2] ? Math.min(Number(m[2]), file.buffer.length - 1) : file.buffer.length - 1;
        return req.respond({
          status: 206,
          headers: { 'Content-Range': `bytes ${start}-${end}/${file.buffer.length}`, 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' },
          contentType: file.mimeType,
          body: file.buffer.subarray(start, end + 1),
        });
      }
      return req.respond({ status: 200, headers: { 'Accept-Ranges': 'bytes', 'Access-Control-Allow-Origin': '*' }, contentType: file.mimeType, body: file.buffer });
    })().catch((error: Error) => logger.warn('video.render.request_failed', { error: error.message }));
  });
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String((e as Error)?.message || e)));
  await page.goto(`${ORIGIN}/`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__IDEM_RENDER__', { timeout: 30000 }).catch(() => {
    throw new Error(`film_page_failed: ${pageErrors.join(' · ').slice(0, 400) || 'runtime absent'}`);
  });
  return page;
}

interface InitResult {
  frames: number;
  errors: SceneErrorRecord[];
  cues: SfxCueRecord[];
}

// ─── Contrôle technique ─────────────────────────────────────────────────────

export interface ProbeResult {
  errors: SceneErrorRecord[];
  cues: SfxCueRecord[];
  /** Une image par scène (JPEG), au moment où elle est installée. */
  thumbnails: Record<string, Buffer>;
}

/**
 * Exécute le film une fois : chaque scène est calculée (Motion Canvas exécute tout son code), puis
 * une image par scène est dessinée. Rien n'est jugé : seules les erreurs d'exécution sont relevées.
 */
export async function probeFilm(input: FilmPageInput & { files?: Map<string, ServedFile> }, opts: { thumbnails?: boolean; timeoutMs?: number } = {}): Promise<ProbeResult> {
  active++;
  let page: Page | null = null;
  try {
    const browser = await getBrowser();
    page = await openFilmPage(browser, input, input.files || new Map());
    const p = page;
    const job = (async () => {
      const init = (await p.evaluate(() => (window as any).__IDEM_RENDER__.init(0))) as InitResult;
      const thumbnails: Record<string, Buffer> = {};
      const errors = new Map(init.errors.map((e) => [e.key, e]));
      if (opts.thumbnails !== false) {
        for (const scene of input.data.scenes) {
          const t = scene.start + Math.min(scene.duration * 0.6, 1.6);
          const still = (await p.evaluate((f: number) => (window as any).__IDEM_RENDER__.still(f, 0.8), Math.round(t * input.data.fps))) as { data: string; errors: SceneErrorRecord[] };
          thumbnails[scene.key] = Buffer.from(still.data, 'base64');
          for (const e of still.errors) if (!errors.has(e.key)) errors.set(e.key, e);
        }
      }
      return { errors: [...errors.values()], cues: init.cues, thumbnails };
    })();
    return await Promise.race([job, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('probe_timeout')), opts.timeoutMs ?? 120000))]);
  } finally {
    await page?.close().catch(() => undefined);
    active--;
    release();
  }
}

// ─── Rendu ──────────────────────────────────────────────────────────────────

export interface FilmRenderInput extends FilmPageInput {
  files?: Map<string, ServedFile>;
  durationSec: number;
  quality: VideoQuality;
  /** Piste locale et début de l'extrait. */
  music?: { file: string; startAt: number };
  /** Effets sonores : un fichier par type, et le style (densité du mixage). */
  sfx?: { files: Partial<Record<SfxKind, string>>; style: MotionStyle; intensity?: 'subtle' | 'normal' | 'punchy' };
  voice?: { file: string; at: number }[];
  posterAt?: number;
  onProgress?: (ratio: number) => void;
  concurrency?: number;
}

export interface FilmRenderOutput {
  file: string;
  poster: string;
  workDir: string;
  width: number;
  height: number;
  fps: number;
  sizeBytes: number;
  /** Les erreurs relevées pendant le rendu (une scène qui échoue en cours de route). */
  errors: SceneErrorRecord[];
}

async function renderChunk(page: Page, input: FilmRenderInput, from: number, to: number, out: string, tick: () => void): Promise<InitResult> {
  const init = (await page.evaluate((f: number) => (window as any).__IDEM_RENDER__.init(f), from)) as InitResult;
  const ff = spawn(
    FFMPEG,
    ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(input.data.fps), '-c:v', 'mjpeg', '-i', '-', ...encoding(input.quality, input.data.fps), '-r', String(input.data.fps), out],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );
  let err = '';
  ff.stderr.on('data', (c) => (err += c.toString()));
  const done = new Promise<void>((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg chunk ${code}: ${err.slice(-600)}`))));
  });
  try {
    for (let f = from; f < to; f++) {
      const shot = (await page.evaluate(() => (window as any).__IDEM_RENDER__.step(0.92))) as { data: string };
      if (!ff.stdin.write(Buffer.from(shot.data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      tick();
    }
  } finally {
    ff.stdin.end();
  }
  await done;
  return init;
}

export async function renderFilm(input: FilmRenderInput): Promise<FilmRenderOutput> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-film-'));
  const fps = input.data.fps;
  const total = Math.round(input.durationSec * fps);
  const concurrency = Math.max(1, Math.min(input.concurrency ?? (Number(process.env.VIDEO_RENDER_CONCURRENCY) || Math.min(6, Math.max(1, Math.floor(os.cpus().length * 0.75)))), 8, Math.ceil(total / 45)));
  active++;
  const pages: Page[] = [];
  let done = 0;
  let last = 0;
  const tick = () => {
    done++;
    const ratio = done / total;
    if (input.onProgress && (ratio - last >= 0.02 || done === total)) {
      last = ratio;
      input.onProgress(Math.min(0.97, ratio * 0.97));
    }
  };
  try {
    const browser = await getBrowser();
    const per = Math.ceil(total / concurrency);
    const chunks = Array.from({ length: concurrency }, (_, i) => ({ from: i * per, to: Math.min(total, (i + 1) * per), file: path.join(workDir, `part-${String(i).padStart(2, '0')}.mp4`) })).filter((c) => c.to > c.from);
    const inits = await Promise.all(
      chunks.map(async (chunk) => {
        const page = await openFilmPage(browser, input, input.files || new Map());
        pages.push(page);
        return renderChunk(page, input, chunk.from, chunk.to, chunk.file, tick);
      })
    );
    const errors = new Map<string, SceneErrorRecord>();
    for (const page of pages) for (const e of (await page.evaluate(() => (window as any).__IDEM_RENDER__.errors())) as SceneErrorRecord[]) errors.set(e.key, e);
    for (const init of inits) for (const e of init.errors) errors.set(e.key, e);

    const list = path.join(workDir, 'parts.txt');
    fs.writeFileSync(list, chunks.map((c) => `file '${c.file.replace(/'/g, "'\\''")}'`).join('\n'));
    const silent = path.join(workDir, 'silent.mp4');
    await run(['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

    const file = path.join(workDir, 'video.mp4');
    const d = input.durationSec;
    const rawCues = inits[0]?.cues || [];
    const cues = input.sfx ? refineCues(rawCues, input.sfx.style, d, input.sfx.intensity).filter((c) => input.sfx!.files[c.kind]) : [];
    await mixAudio({ silent, file, d, music: input.music, cues, files: input.sfx?.files || {}, voice: input.voice || [] });
    const poster = path.join(workDir, 'poster.jpg');
    const posterAt = Math.max(0, Math.min(d - 0.1, input.posterAt ?? d * 0.2));
    await run(['-y', '-v', 'error', '-ss', posterAt.toFixed(3), '-i', file, '-frames:v', '1', '-q:v', '3', poster]);
    input.onProgress?.(1);
    const scale = input.data.resolutionScale ?? 1;
    return {
      file,
      poster,
      workDir,
      width: Math.round(input.data.width * scale),
      height: Math.round(input.data.height * scale),
      fps,
      sizeBytes: fs.statSync(file).size,
      errors: [...errors.values()],
    };
  } catch (error) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw error;
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    active--;
    release();
  }
}

export function cleanupFilmRender(output: Pick<FilmRenderOutput, 'workDir'>): void {
  try {
    fs.rmSync(output.workDir, { recursive: true, force: true });
  } catch (error) {
    logger.warn('video.cleanup_failed', { error: (error as Error).message });
  }
}
