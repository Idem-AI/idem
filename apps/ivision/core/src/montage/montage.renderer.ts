/**
 * LE RENDU DU MONTAGE — sa page HTML d'habillage, capturée image par image (Puppeteer) + ffmpeg.
 *
 * Réservé au montage d'une prise de parole (sous-titres, mots-clés, pictos sur la vidéo filmée).
 * Les vidéos motion design passent par Motion Canvas (`video/rendering/runner.ts`).
 *
 * Image par image : `seek(t)` puis capture JPEG envoyée directement dans
 * l'entrée standard d'ffmpeg (aucune image écrite sur disque). La vidéo est
 * découpée en tronçons rendus en parallèle dans plusieurs onglets, puis
 * recollés sans réencodage. Le moteur étant déterministe, l'ordre de capture
 * n'a aucune influence sur le résultat.
 *
 * Mesuré sur un poste de développement : ~60 ms par image 1080×1920, soit
 * ~10 s pour 15 s de vidéo HD avec 3 onglets.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import logger from '../runtime/logger';
import type { MotionStyle, SfxKind, VideoQuality } from '../video/contracts/model';
import { refineCues, SfxCue } from '../video/audio/sfx';
import { installRenderNetworkGuard, isStrictRenderRequest } from '../render/network-guard';
import { encoding, FFMPEG, mixAudio, probe, run } from '../video/rendering/ffmpeg';

export { mixAudio, probe };


/**
 * Deux navigateurs possibles : avec WebGL logiciel (SwiftShader, pour les scènes 3D) ou sans
 * (le montage d'une prise de parole : sans 3D, la capture d'une image y coûte deux fois moins).
 */
const browsers: Record<'webgl' | 'plain', Promise<Browser> | null> = { webgl: null, plain: null };
let idleTimer: NodeJS.Timeout | null = null;
let activeRenders = 0;

async function getBrowser(webgl = true): Promise<Browser> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const kind = webgl ? 'webgl' : 'plain';
  const current = browsers[kind];
  if (current) {
    const b = await current.catch(() => null);
    if (b && b.isConnected()) return b;
  }
  browsers[kind] = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--hide-scrollbars',
      '--mute-audio',
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      // WebGL logiciel (SwiftShader) : les scènes 3D se rendent sans carte graphique.
      ...(webgl ? ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : []),
      '--autoplay-policy=no-user-gesture-required',
      // Les onglets de rendu tournent en parallèle : aucun ne doit être traité
      // comme « en arrière-plan », sinon Chromium suspend le décodage de ses clips.
      '--disable-background-media-suspend',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=MediaSessionService,BackForwardCache,CalculateNativeWinOcclusion',
    ],
    timeout: 30000,
  });
  return browsers[kind]!;
}

/** Les navigateurs sont fermés après 2 minutes sans rendu : ils pèsent plusieurs centaines de Mo. */
function releaseBrowser(): void {
  if (activeRenders > 0) return;
  idleTimer = setTimeout(() => void closeBrowsers(), 120000);
  idleTimer.unref?.();
}

async function closeBrowsers(): Promise<void> {
  for (const kind of ['webgl', 'plain'] as const) {
    const b = await browsers[kind]?.catch(() => null);
    browsers[kind] = null;
    await b?.close().catch(() => undefined);
  }
}

/**
 * Une page de contrôle sur le navigateur de rendu partagé : même préparation qu'un rendu
 * (garde réseau, focus, polices, médias prêts), un délai borné, la page toujours refermée.
 * Sert au contrôle des scènes écrites par l'IA (video.coder.ts).
 */
export async function withRenderPage<T>(input: { html: string; width: number; height: number; strict?: boolean }, fn: (page: Page) => Promise<T>, timeoutMs = 90000): Promise<T> {
  activeRenders++;
  let page: Page | null = null;
  try {
    const browser = await getBrowser();
    page = await preparePage(browser, { ...input, fps: 30, durationSec: 0, quality: 'standard' } as RenderInput);
    const p = page;
    return await Promise.race([fn(p), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('render_check_timeout')), timeoutMs))]);
  } finally {
    await page?.close().catch(() => undefined);
    activeRenders--;
    releaseBrowser();
  }
}

export async function closeRenderBrowser(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  await closeBrowsers();
}

export interface RenderInput {
  html: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  quality: VideoQuality;
  /** Piste locale et début de l'extrait. */
  music?: { file: string; startAt: number };
  /** Instant de l'affiche (vignette), en secondes. */
  posterAt?: number;
  /** Effets sonores : un fichier par moment sonore, et le style (densité). */
  sfx?: { files: Partial<Record<SfxKind, string>>; style: MotionStyle; intensity?: 'subtle' | 'normal' | 'punchy' };
  /** Voix off : un fichier par ligne, posé à son instant (calé sur sa scène). */
  voice?: { file: string; at: number }[];
  onProgress?: (ratio: number) => void;
  concurrency?: number;
  /** La page exécute du code écrit par l'IA (cran Ultra) : garde réseau strict. */
  strict?: boolean;
  /** Faux : la page n'a pas de 3D (navigateur sans WebGL logiciel, capture plus rapide). */
  webgl?: boolean;
}

export interface RenderOutput {
  file: string;
  poster: string;
  workDir: string;
  width: number;
  height: number;
  fps: number;
  sizeBytes: number;
  /** Moments sonores réellement mixés. */
  cues: (SfxCue & { db: number })[];
}

async function preparePage(browser: Browser, input: RenderInput): Promise<Page> {
  // Les clips et modèles embarqués peuvent dépasser le délai par défaut.

  const page = await browser.newPage();
  await page.setViewport({ width: input.width, height: input.height, deviceScaleFactor: 1 });
  // Une page qui exécute du code écrit par l'IA (cran Ultra) n'a droit qu'aux données embarquées et au stockage.
  await installRenderNetworkGuard(page, input.strict ? (req) => isStrictRenderRequest(req.url()) : undefined);
  // Chaque onglet se croit au premier plan : les clips vidéo y restent décodés.
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => undefined);
  await cdp.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => undefined);
  await page.setContent(input.html, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => (window as any).__IDEM_VIDEO__.ready);
  return page;
}

/** Rend les images [from, to) dans un fichier MP4 (sans son). */
async function renderChunk(
  page: Page,
  input: RenderInput,
  from: number,
  to: number,
  out: string,
  tick: () => void
): Promise<void> {
  const ff = spawn(
    FFMPEG,
    ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(input.fps), '-c:v', 'mjpeg', '-i', '-', ...encoding(input.quality, input.fps), '-r', String(input.fps), out],
    { stdio: ['pipe', 'ignore', 'pipe'] }
  );
  let err = '';
  ff.stderr.on('data', (c) => (err += c.toString()));
  const done = new Promise<void>((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg chunk ${code}: ${err.slice(-600)}`))));
  });
  const cdp = await page.createCDPSession();
  try {
    for (let f = from; f < to; f++) {
      // `seek` renvoie une promesse quand un clip vidéo doit se positionner.
      await page.evaluate((t: number) => (window as any).__IDEM_VIDEO__.seek(t), f / input.fps);
      const shot = (await cdp.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 92,
        optimizeForSpeed: true,
        captureBeyondViewport: false,
      })) as { data: string };
      const ok = ff.stdin.write(Buffer.from(shot.data, 'base64'));
      if (!ok) await new Promise((r) => ff.stdin.once('drain', r));
      tick();
    }
  } finally {
    ff.stdin.end();
    await cdp.detach().catch(() => undefined);
  }
  await done;
}

export async function renderVideo(input: RenderInput): Promise<RenderOutput> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-video-'));
  const total = Math.round(input.durationSec * input.fps);
  const concurrency = Math.max(
    1,
    // Un onglet par tronçon de 30 images au moins ; par défaut les trois quarts des cœurs (6 au plus).
    Math.min(input.concurrency ?? (Number(process.env.VIDEO_RENDER_CONCURRENCY) || Math.min(6, Math.max(1, Math.floor(os.cpus().length * 0.75)))), 8, Math.ceil(total / 30))
  );
  activeRenders++;
  const browser = await getBrowser(input.webgl !== false);
  const pages: Page[] = [];
  let done = 0;
  let lastReport = 0;
  const tick = () => {
    done++;
    const ratio = done / total;
    if (input.onProgress && (ratio - lastReport >= 0.02 || done === total)) {
      lastReport = ratio;
      input.onProgress(Math.min(0.97, ratio * 0.97));
    }
  };

  let rawCues: SfxCue[] = [];
  try {
    const per = Math.ceil(total / concurrency);
    const chunks = Array.from({ length: concurrency }, (_, i) => ({
      from: i * per,
      to: Math.min(total, (i + 1) * per),
      file: path.join(workDir, `part-${String(i).padStart(2, '0')}.mp4`),
    })).filter((c) => c.to > c.from);

    await Promise.all(
      chunks.map(async (chunk) => {
        const page = await preparePage(browser, input);
        pages.push(page);
        if (chunk.from === 0) rawCues = await page.evaluate(() => (window as any).__IDEM_VIDEO__.cues?.() || []);
        await renderChunk(page, input, chunk.from, chunk.to, chunk.file, tick);
      })
    );

    const list = path.join(workDir, 'parts.txt');
    fs.writeFileSync(list, chunks.map((c) => `file '${c.file.replace(/'/g, "'\\''")}'`).join('\n'));
    const silent = path.join(workDir, 'silent.mp4');
    await run(['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

    const file = path.join(workDir, 'video.mp4');
    const d = input.durationSec;
    const cues = input.sfx ? refineCues(rawCues, input.sfx.style, d, input.sfx.intensity).filter((c) => input.sfx!.files[c.kind]) : [];
    await mixAudio({ silent, file, d, music: input.music, cues, files: input.sfx?.files || {}, voice: input.voice || [] });
    const poster = path.join(workDir, 'poster.jpg');
    const posterAt = Math.max(0, Math.min(input.durationSec - 0.1, input.posterAt ?? input.durationSec * 0.2));
    await run(['-y', '-v', 'error', '-ss', posterAt.toFixed(3), '-i', file, '-frames:v', '1', '-q:v', '3', poster]);

    input.onProgress?.(1);
    return {
      file,
      poster,
      workDir,
      width: input.width,
      height: input.height,
      fps: input.fps,
      sizeBytes: fs.statSync(file).size,
      cues,
    };
  } catch (error) {
    fs.rmSync(workDir, { recursive: true, force: true });
    throw error;
  } finally {
    await Promise.all(pages.map((p) => p.close().catch(() => undefined)));
    activeRenders--;
    releaseBrowser();
  }
}

export function cleanupRender(output: Pick<RenderOutput, 'workDir'>): void {
  try {
    fs.rmSync(output.workDir, { recursive: true, force: true });
  } catch (error: any) {
    logger.warn('video.cleanup_failed', { error: error.message });
  }
}
