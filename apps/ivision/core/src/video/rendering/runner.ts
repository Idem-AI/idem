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
  /** Les défauts d'AFFICHAGE de chaque scène (texte coupé par le cadre, textes qui se chevauchent), en clair. */
  layout: Record<string, string[]>;
  /** Les textes illisibles sur leur fond et la couleur de ce fond (dernier recours du moteur). */
  contrast: Record<string, ContrastFix[]>;
}

export interface TextBox { text: string; x0: number; y0: number; x1: number; y1: number; group: string; order?: number; contrast?: number; bg?: number[]; best?: string; bestContrast?: number }
export interface ShapeBox { kind: 'fill' | 'image' | 'line' | 'outline'; x0: number; y0: number; x1: number; y1: number; order: number }
/**
 * Le dernier recours d'affichage d'un texte : `ink` (illisible sur son fond : la couleur réelle de ce fond) ou `plate`
 * (posé sur une image, traversé par un trait, à cheval sur un contour : un aplat sous le texte).
 */
export interface ContrastFix { text: string; kind?: 'ink' | 'plate'; bg?: number[]; ink?: string }

/**
 * Les défauts d'affichage d'un instant : un texte qui dépasse du cadre (au-delà de 1,5 %), deux textes dont les
 * boîtes se recouvrent (plus de 18 % de la plus petite). Rien d'esthétique : un texte coupé ou recouvert ne se lit pas.
 */
export function layoutIssues(texts: TextBox[], width: number, height: number, at: number, shapes: ShapeBox[] = []): string[] {
  const out: string[] = [];
  const area = (b: { x0: number; y0: number; x1: number; y1: number }) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
  const inter = (a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const label = (t: TextBox) => `« ${t.text.length > 48 ? `${t.text.slice(0, 46)}…` : t.text} »`;
  // Les morceaux d'un même texte découpé qui s'empilent (lettres ou mots superposés) : le mot ne se lit plus.
  const byGroup = new Map<string, TextBox[]>();
  for (const t of texts) if (t.group) byGroup.set(t.group, [...(byGroup.get(t.group) || []), t]);
  for (const parts of byGroup.values()) {
    let stacked = 0;
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) if (inter(parts[i], parts[j]) > 0.5 * Math.min(area(parts[i]), area(parts[j]))) stacked++;
    if (stacked > 0) out.push(`les lettres ou mots de « ${parts.map((p) => p.text).join(parts[0].text.length > 1 ? ' ' : '').slice(0, 48)} » se superposent à ${at.toFixed(1)} s`);
  }
  // Ce qui est dessiné PAR-DESSUS un texte (forme pleine, image, trait qui le barre) le rend illisible.
  for (const t of texts) {
    if (t.order === undefined) continue;
    const ta = area(t);
    if (!ta) continue;
    const band = { x0: t.x0, x1: t.x1, y0: t.y0 + (t.y1 - t.y0) * 0.3, y1: t.y1 - (t.y1 - t.y0) * 0.3 };
    /** Un aplat dessiné entre la forme et le texte, qui couvre le texte : la forme est masquée sous lui. */
    const plated = (s: ShapeBox) => shapes.some((f) => f.kind === 'fill' && f.order > s.order && f.order < t.order! && inter(t, f) > 0.8 * ta);
    const over = shapes.filter((s) => s.order > t.order!);
    const hit = over.find((s) => {
      const i = inter(t, s);
      if (s.kind === 'line') return false;
      return i > 0.12 * ta || (i > 0.6 * area(s) && area(s) > 0.004 * ta);
    });
    if (hit) out.push(`${label(t)} est ${hit.kind === 'image' ? 'caché par une image' : 'caché par une forme'} dessinée par-dessus à ${at.toFixed(1)} s`);
    // Un trait qui traverse le milieu d'un texte le barre, qu'il passe devant ou derrière.
    const strike = shapes.find((s) => s.kind === 'line' && !plated(s) && Math.min(t.x1, s.x1) - Math.max(t.x0, s.x0) > 0.3 * (t.x1 - t.x0) && s.y1 - s.y0 < (t.y1 - t.y0) * 0.5 && inter(band, { ...s, y0: s.y0 - 1, y1: s.y1 + 1 }) > 0);
    // Un trait qui le traverse dans l'autre sens (tige, filet vertical) le coupe aussi.
    const cross = !strike && shapes.find((s) => s.kind === 'line' && !plated(s) && s.x1 - s.x0 < (t.x1 - t.x0) * 0.25 && s.x0 > t.x0 + (t.x1 - t.x0) * 0.08 && s.x1 < t.x1 - (t.x1 - t.x0) * 0.08 && Math.min(t.y1, s.y1) - Math.max(t.y0, s.y0) > 0.6 * (t.y1 - t.y0));
    if ((strike || cross) && !t.group) out.push(`${label(t)} est ${strike ? 'barré' : 'traversé'} par un trait à ${at.toFixed(1)} s`);
    // À cheval sur un contour (cadre, anneau) : ni dedans ni dehors.
    const straddle = shapes.find((s) => s.kind === 'outline' && !plated(s) && inter(t, s) > 0.08 * ta && !(t.x0 >= s.x0 && t.x1 <= s.x1 && t.y0 >= s.y0 && t.y1 <= s.y1));
    if (straddle && !t.group) out.push(`${label(t)} est à cheval sur le contour d'une forme à ${at.toFixed(1)} s`);
    // Posé sur une image sans aplat entre les deux : le texte se perd dans la photo.
    const photo = shapes.find((s) => s.kind === 'image' && s.order < t.order! && inter(t, s) > 0.25 * ta && !plated(s));
    if (photo && !t.group) out.push(`${label(t)} est posé sur une image (aucun aplat entre les deux) à ${at.toFixed(1)} s`);
    if (t.contrast !== undefined && t.contrast < 2.2) out.push(`${label(t)} ne se lit pas sur son fond (contraste ${t.contrast.toFixed(1)} : couleur trop proche de ce qu'il recouvre) à ${at.toFixed(1)} s`);
  }
  const tx = width * 0.015;
  const ty = height * 0.015;
  const q = (t: TextBox) => `« ${t.text.length > 48 ? `${t.text.slice(0, 46)}…` : t.text} »`;
  // Les morceaux d'un même texte découpé (mots, lettres) sont regroupés : ils comptent comme un texte.
  const groups = new Map<string, TextBox>();
  for (const t of texts) {
    const g = groups.get(t.group);
    if (t.group) groups.set(t.group, g ? { text: `${g.text} ${t.text}`, x0: Math.min(g.x0, t.x0), y0: Math.min(g.y0, t.y0), x1: Math.max(g.x1, t.x1), y1: Math.max(g.y1, t.y1), group: t.group } : { ...t });
    else groups.set(`${t.group}|${t.text}|${t.x0}`, t);
  }
  const boxes = [...groups.values()];
  for (const t of boxes) {
    const sides = [t.x0 < -width / 2 - tx ? 'à gauche' : '', t.x1 > width / 2 + tx ? 'à droite' : '', t.y0 < -height / 2 - ty ? 'en haut' : '', t.y1 > height / 2 + ty ? 'en bas' : ''].filter(Boolean);
    if (sides.length) out.push(`${q(t)} est coupé par le cadre ${sides.join(' et ')} à ${at.toFixed(1)} s`);
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (w <= 0 || h <= 0) continue;
      const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
      if (small > 0 && (w * h) / small > 0.18) out.push(`${q(a)} et ${q(b)} se chevauchent à ${at.toFixed(1)} s`);
    }
  }
  return out;
}

/**
 * Exécute le film une fois : chaque scène est calculée (Motion Canvas exécute tout son code), puis
 * une image par scène est dessinée. Rien n'est jugé : seules les erreurs d'exécution sont relevées.
 */
export async function probeFilm(input: FilmPageInput & { files?: Map<string, ServedFile> }, opts: { thumbnails?: boolean; layout?: boolean; timeoutMs?: number } = {}): Promise<ProbeResult> {
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
      // Le contrôle d'affichage : deux instants par scène, quand tout est installé (la piste du langage finit à 70 %).
      const layout: Record<string, string[]> = {};
      const contrast: Record<string, ContrastFix[]> = {};
      if (opts.layout !== false) {
        for (const scene of input.data.scenes) {
          if (errors.has(scene.key) || scene.compileError) continue;
          const found = new Set<string>();
          for (const r of [0.78, 0.95]) {
            const t = scene.start + scene.duration * r;
            const res = (await p.evaluate((f: number) => (window as any).__IDEM_RENDER__.layout(f), Math.round(t * input.data.fps))) as { texts: TextBox[]; shapes?: ShapeBox[] };
            // Une scène installée qui n'affiche aucun de ses textes (tout est sorti avant la fin, ou rien n'est entré).
            if (r === 0.78 && !res.texts.length && Object.values(scene.texts || {}).some((v) => String(v || '').trim())) found.add(`la scène n'affiche aucun de ses textes à ${(scene.duration * r).toFixed(1)} s`);
            for (const issue of layoutIssues(res.texts, input.data.width, input.data.height, scene.duration * r, res.shapes || [])) found.add(issue);
            const issues = layoutIssues(res.texts, input.data.width, input.data.height, scene.duration * r, res.shapes || []);
            for (const t of res.texts) {
              const list = (contrast[scene.key] ||= []);
              const label = `« ${t.text.length > 48 ? `${t.text.slice(0, 46)}…` : t.text} »`;
              const plate = issues.some((m) => m.startsWith(label) && /posé sur une image|traversé par un trait|barré par un trait|à cheval sur le contour/.test(m));
              if (plate && !list.some((c) => c.text === t.text && c.kind === 'plate')) list.push({ text: t.text, kind: 'plate' });
              else if (t.contrast !== undefined && t.contrast < 2.2 && t.bg && !list.some((c) => c.text === t.text)) {
                // Une encre suffit si elle se lit sur tout le pourtour ; sinon (fond mixte) un aplat.
                if ((t.bestContrast ?? 0) >= 3) list.push({ text: t.text, kind: 'ink', bg: t.bg, ...(t.best ? { ink: t.best } : {}) });
                else list.push({ text: t.text, kind: 'plate' });
              }
            }
            if (!contrast[scene.key]?.length) delete contrast[scene.key];
          }
          if (found.size) layout[scene.key] = [...found].slice(0, 6);
        }
      }
      return { errors: [...errors.values()], cues: init.cues, thumbnails, layout, contrast };
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
  // Si une image échoue, on sort sans attendre ffmpeg : son erreur ne doit jamais devenir un rejet orphelin (il fait
  // tomber le processus entier, donc l'API).
  done.catch(() => undefined);
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
    // Tous les tronçons vont jusqu'au bout (réussite ou échec) avant que le dossier de travail soit nettoyé.
    const settled = await Promise.allSettled(
      chunks.map(async (chunk) => {
        const page = await openFilmPage(browser, input, input.files || new Map());
        pages.push(page);
        return renderChunk(page, input, chunk.from, chunk.to, chunk.file, tick);
      })
    );
    const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed) throw failed.reason;
    const inits = settled.map((r) => (r as PromiseFulfilledResult<InitResult>).value);
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
