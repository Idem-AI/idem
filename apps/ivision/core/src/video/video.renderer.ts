/**
 * LE RENDU — Puppeteer (déjà dans l'API) + ffmpeg, sur nos serveurs.
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
import { MotionStyle, SfxKind, VideoQuality } from './video.model';
import { MUSIC_GAIN_DB, MUSIC_UNDER_VOICE_DB, refineCues, SfxCue } from './video.sfx';
import { installRenderNetworkGuard, isStrictRenderRequest } from '../render/network-guard';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

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

function run(args: string[], input?: NodeJS.ReadableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (c) => (err += c.toString()));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-600)}`))));
    if (input) input.pipe(ff.stdin);
    else ff.stdin.end();
  });
}

/** Réglages d'encodage : débit plafonné pour rester léger sur des connexions modestes. */
function encoding(quality: VideoQuality, fps: number): string[] {
  const common = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(fps * 2), '-preset', 'veryfast'];
  switch (quality) {
    case 'standard':
      return [...common, '-crf', '23', '-maxrate', '2500k', '-bufsize', '5000k'];
    case 'premium':
      return [...common, '-crf', '19', '-maxrate', '12000k', '-bufsize', '24000k'];
    default:
      return [...common, '-crf', '20', '-maxrate', '8000k', '-bufsize', '16000k'];
  }
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
    Math.min(input.concurrency ?? (Number(process.env.VIDEO_RENDER_CONCURRENCY) || Math.min(3, Math.max(1, os.cpus().length - 1))), 6, Math.ceil(total / 30))
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

/**
 * Le mixage : musique (extrait, fondus), effets sonores posés à la milliseconde, voix off.
 *
 *   effets   franchement au-dessus de la musique : la musique (−7 dB) s'efface sous chacun ;
 *   voix     au premier plan : musique abaissée (−10 dB) et compressée sous chaque ligne, effets
 *            légèrement retenus pendant qu'elle parle (un whoosh ne couvre pas un mot) ;
 *   master   limiteur puis normalisation à −14 LUFS (niveau des réseaux sociaux).
 *
 * Exporté pour les contrôles (`check:video` mesure le niveau des effets sur la musique).
 */
export async function mixAudio(opts: {
  silent: string;
  file: string;
  d: number;
  music?: { file: string; startAt: number };
  cues: (SfxCue & { db: number })[];
  files: Partial<Record<SfxKind, string>>;
  voice: { file: string; at: number }[];
}): Promise<void> {
  const { silent, file, d, music, cues, files, voice } = opts;
  if (!music && !cues.length && !voice.length) {
    await run(['-y', '-v', 'error', '-i', silent, '-c', 'copy', '-movflags', '+faststart', file]);
    return;
  }
  const args = ['-y', '-v', 'error', '-i', silent];
  const filters: string[] = [];
  let index = 1;
  let bed = '';
  if (music) {
    args.push('-ss', String(Math.max(0, music.startAt)), '-t', String(d + 0.5), '-i', music.file);
    const fadeOut = Math.min(1.5, d * 0.2);
    filters.push(
      `[${index}:a]atrim=0:${d},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:st=0:d=0.35,afade=t=out:st=${Math.max(0, d - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)},volume=${voice.length ? MUSIC_UNDER_VOICE_DB : MUSIC_GAIN_DB}dB[mus]`
    );
    bed = '[mus]';
    index++;
  }
  /** Un bus : les entrées posées à leur instant, sommées, étendues à toute la durée. */
  const bus = (label: string, inputs: string[]) => {
    filters.push(`${inputs.join('')}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0,apad=whole_dur=${d}[${label}]`);
  };
  const sfxLabels: string[] = [];
  for (const cue of cues) {
    args.push('-i', files[cue.kind]!);
    const ms = Math.round(cue.t * 1000);
    filters.push(`[${index}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${cue.db}dB,adelay=${ms}|${ms}[s${index}]`);
    sfxLabels.push(`[s${index}]`);
    index++;
  }
  const voiceLabels: string[] = [];
  for (const line of voice) {
    args.push('-i', line.file);
    const ms = Math.round(Math.max(0, line.at) * 1000);
    filters.push(`[${index}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${index}]`);
    voiceLabels.push(`[v${index}]`);
    index++;
  }
  const finals: string[] = [];
  let sfx = '';
  if (sfxLabels.length) {
    bus('sfx', sfxLabels);
    sfx = '[sfx]';
  }
  if (voiceLabels.length) {
    bus('vo', voiceLabels);
    // La voix pilote deux compresseurs : la musique, et (plus doucement) les effets.
    const keys = 1 + (bed ? 1 : 0) + (sfx ? 1 : 0);
    filters.push(`[vo]asplit=${keys}${['[vom]', '[vok]', '[vos]'].slice(0, keys).join('')}`);
    finals.push('[vom]');
    let k = 1;
    if (bed) {
      filters.push(`${bed}[${['vom', 'vok', 'vos'][k++]}]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=420:makeup=1[bedv]`);
      bed = '[bedv]';
    }
    if (sfx) {
      filters.push(`${sfx}[${['vom', 'vok', 'vos'][k++]}]sidechaincompress=threshold=0.05:ratio=2.5:attack=5:release=200:makeup=1[sfxv]`);
      sfx = '[sfxv]';
    }
  }
  if (sfx && bed) {
    // La musique s'efface sous chaque effet : c'est ce qui les fait entendre.
    filters.push(`${sfx}asplit=2[sfxa][sfxb]`);
    filters.push(`${bed}[sfxa]sidechaincompress=threshold=0.03:ratio=6:attack=5:release=240:makeup=1[duck]`);
    finals.push('[duck]', '[sfxb]');
  } else {
    if (bed) finals.push(bed);
    if (sfx) finals.push(sfx);
  }
  const master = 'alimiter=limit=0.94:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000';
  filters.push(finals.length > 1 ? `${finals.join('')}amix=inputs=${finals.length}:normalize=0:dropout_transition=0,${master}[a]` : `${finals[0]}${master}[a]`);
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-t', String(d), '-movflags', '+faststart', file
  );
  await run(args);
}

/** Durée et flux d'un fichier, via ffprobe (contrôles et tests). */
export function probe(file: string): Promise<{ duration: number; width: number; height: number; fps: number; hasAudio: boolean }> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.FFPROBE_PATH || 'ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
    let out = '';
    p.stdout.on('data', (c) => (out += c.toString()));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe ${code}`));
      try {
        const data = JSON.parse(out);
        const v = (data.streams || []).find((s: any) => s.codec_type === 'video') || {};
        const [n, d] = String(v.r_frame_rate || '0/1').split('/').map(Number);
        resolve({
          duration: Number(data.format?.duration) || 0,
          width: v.width || 0,
          height: v.height || 0,
          fps: d ? n / d : 0,
          hasAudio: (data.streams || []).some((s: any) => s.codec_type === 'audio'),
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

export function cleanupRender(output: Pick<RenderOutput, 'workDir'>): void {
  try {
    fs.rmSync(output.workDir, { recursive: true, force: true });
  } catch (error: any) {
    logger.warn('video.cleanup_failed', { error: error.message });
  }
}
