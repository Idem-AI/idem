/**
 * LES ANIMATIONS LOTTIE — rendues IMAGE PAR IMAGE par dotLottie-web (MIT, moteur ThorVG, `setFrame`) en un clip WebM
 * TRANSPARENT (VP9 avec alpha), à la préparation des médias. Elles deviennent des clips comme les autres : ni l'aperçu
 * ni le rendu n'embarquent de moteur Lottie, la politique de sécurité de la page reste fermée.
 *
 *   uploads      un fichier .json / .lottie importé par le client devient un clip transparent ;
 *   bibliothèque une PETITE sélection interne (`motion/lottie-library/`, dessinée en code pour IDEM :
 *                `scripts/build-lottie-library.ts`), recolorée à la marque, proposée au planificateur comme
 *                n'importe quel média (« m7 — animation : une coche qui se trace »). Des fichiers LottieFiles ne
 *                pourraient y entrer que sous leur licence (Lottie Simple License : usage commercial libre, jamais
 *                revendus seuls ni compilés en catalogue concurrent) et après relecture.
 *
 * Le rendu se fait dans le Chromium du moteur, page servie depuis une origine fictive, tout autre réseau refusé.
 */
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import logger from '../../runtime/logger';
import { filmBrowser, releaseFilmBrowser } from '../rendering/runner';
import { FFMPEG } from '../rendering/ffmpeg';
import { MOTION_ROOT } from '../rendering/compiler';
import type { VideoMediaAsset } from '../contracts/model';
import type { MediaStorage } from './media';

const ORIGIN = 'https://lottie.idem.local';
let bundleJob: Promise<string> | null = null;

/** `dist/` du paquet (la carte `exports` n'expose ni `package.json` ni les sources : on part du fichier wasm). */
function playerDir(): string {
  return path.dirname(require.resolve('@lottiefiles/dotlottie-web/dotlottie-player.wasm'));
}

/** Le lecteur dotLottie pour la page (construit une fois). */
function playerBundle(): Promise<string> {
  bundleJob ??= build({
    stdin: { contents: `import { DotLottie } from '@lottiefiles/dotlottie-web'; window.DotLottie = DotLottie;`, resolveDir: playerDir(), loader: 'js' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    logLevel: 'silent',
  }).then((r) => r.outputFiles[0].text);
  return bundleJob;
}

export interface LottieClip {
  webm: Buffer;
  width: number;
  height: number;
  durationSec: number;
}

/** Rend une animation Lottie (JSON) en clip WebM transparent. */
export async function renderLottieClip(data: unknown, opts: { size?: number; fps?: number; maxSec?: number } = {}): Promise<LottieClip> {
  const fps = opts.fps ?? 30;
  const size = opts.size ?? 720;
  const json = typeof data === 'string' ? data : JSON.stringify(data);
  const meta = JSON.parse(json) as { w?: number; h?: number; ip?: number; op?: number; fr?: number };
  const aspect = meta.w && meta.h ? meta.w / meta.h : 1;
  const width = Math.round((aspect >= 1 ? size : size * aspect) / 2) * 2;
  const height = Math.round((aspect >= 1 ? size / aspect : size) / 2) * 2;
  const native = meta.op && meta.fr ? (meta.op - (meta.ip || 0)) / meta.fr : 2;
  const durationSec = Math.min(opts.maxSec ?? 6, Math.max(0.5, native));
  const frames = Math.round(durationSec * fps);
  const [bundle, wasm] = await Promise.all([playerBundle(), fs.promises.readFile(path.join(playerDir(), 'dotlottie-player.wasm'))]);
  const browser = await filmBrowser();
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url === `${ORIGIN}/`) return void req.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;background:transparent"></body></html>' });
      if (url === `${ORIGIN}/dl.js`) return void req.respond({ status: 200, contentType: 'text/javascript', body: bundle });
      if (url === `${ORIGIN}/dl.wasm`) return void req.respond({ status: 200, contentType: 'application/wasm', body: wasm });
      if (url.startsWith('data:') || url.startsWith('blob:')) return void req.continue();
      void req.abort('blockedbyclient');
    });
    await page.goto(`${ORIGIN}/`);
    await page.addScriptTag({ url: `${ORIGIN}/dl.js` });
    // Le code de la page est passé en TEXTE : la compilation du moteur réécrit les fonctions `async` avec des
    // utilitaires (`__awaiter`) qui n'existent pas dans la page.
    const info = (await page.evaluate(`(async () => {
      DotLottie.setWasmUrl('${ORIGIN}/dl.wasm');
      const canvas = document.createElement('canvas');
      canvas.width = ${width};
      canvas.height = ${height};
      document.body.appendChild(canvas);
      const dl = new DotLottie({ canvas, data: ${JSON.stringify(json)}, autoplay: false, loop: false, renderConfig: { devicePixelRatio: 1 } });
      await new Promise((resolve, reject) => {
        dl.addEventListener('load', () => resolve());
        dl.addEventListener('loadError', (e) => reject(new Error(String((e && e.error && e.error.message) || 'lottie_load'))));
        setTimeout(() => reject(new Error('lottie_timeout')), 15000);
      });
      window.__dl = dl;
      window.__c = canvas;
      return { total: dl.totalFrames };
    })()`)) as { total: number };
    const out: Buffer[] = [];
    for (let f = 0; f < frames; f++) {
      const target = Math.min(info.total - 1, (f / Math.max(1, frames - 1)) * (info.total - 1));
      const png = (await page.evaluate(`(async () => {
        window.__dl.setFrame(${target});
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        return window.__c.toDataURL('image/png').split(',')[1];
      })()`)) as string;
      out.push(Buffer.from(png, 'base64'));
    }
    const webm = await new Promise<Buffer>((resolve, reject) => {
      const ff = spawn(FFMPEG, ['-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0', '-crf', '30', '-deadline', 'realtime', '-cpu-used', '8', '-f', 'webm', 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'] });
      const chunks: Buffer[] = [];
      let err = '';
      ff.stdout.on('data', (c: Buffer) => chunks.push(c));
      ff.stderr.on('data', (c: Buffer) => (err += c.toString()));
      ff.on('error', reject);
      ff.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg lottie ${code}: ${err.slice(-200)}`))));
      for (const png of out) ff.stdin.write(png);
      ff.stdin.end();
    });
    return { webm, width, height, durationSec: frames / fps };
  } finally {
    await page.close().catch(() => undefined);
    releaseFilmBrowser();
  }
}

/** Un Lottie importé → un média clip (transparent) de la vidéo. */
export async function lottieToClipAsset(data: unknown, storage: MediaStorage, folder: string, meta: Pick<VideoMediaAsset, 'origin' | 'name'>): Promise<VideoMediaAsset> {
  const clip = await renderLottieClip(data);
  const key = crypto.createHash('sha1').update(clip.webm).digest('hex').slice(0, 16);
  const up = await storage.uploadFile(clip.webm, `lottie-${key}.webm`, folder, 'video/webm');
  return { id: `lottie-${key.slice(0, 8)}`, kind: 'video', url: up.downloadURL, width: clip.width, height: clip.height, durationSec: clip.durationSec, transparent: true, ...meta };
}

// ─── La petite sélection interne ─────────────────────────────────────────────

export interface LibraryAnimation {
  id: string;
  /** Ce que montre l'animation (lu par le planificateur, en anglais). */
  note: string;
  file: string;
}

export function lottieLibrary(): LibraryAnimation[] {
  const dir = path.join(MOTION_ROOT, 'lottie-library');
  try {
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) as { id: string; note: string; file: string }[];
    return index.map((a) => ({ ...a, file: path.join(dir, a.file) }));
  } catch {
    return [];
  }
}

/** Toutes les couleurs FIXES de traits et d'aplats (`st`, `fl`) passées à une seule couleur. */
export function recolorLottie(data: unknown, hex: string): unknown {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return data;
  const rgb = [0, 2, 4].map((i) => Math.round((parseInt(m[1].slice(i, i + 2), 16) / 255) * 1000) / 1000);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const o = node as Record<string, unknown>;
    const out: Record<string, unknown> = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]));
    const c = o.c as { a?: number; k?: number[] } | undefined;
    if ((o.ty === 'st' || o.ty === 'fl') && c && !c.a && Array.isArray(c.k)) out.c = { a: 0, k: [...rgb, c.k[3] ?? 1] };
    return out;
  };
  return walk(data);
}

const libraryCache = new Map<string, Promise<VideoMediaAsset | null>>();

/**
 * Les animations de la sélection, à la couleur de la marque, rendues une fois par couleur (stockage partagé) et
 * proposées comme médias de bibliothèque.
 */
export async function libraryAnimationAssets(storage: MediaStorage, color = '#1f6f4a'): Promise<VideoMediaAsset[]> {
  if ((process.env.VIDEO_LOTTIE_LIBRARY ?? 'on') === 'off') return [];
  const out = await Promise.all(
    lottieLibrary().map((a) => {
      const key = `${a.id}|${color.toLowerCase()}`;
      let job = libraryCache.get(key);
      if (!job) {
        const data = recolorLottie(JSON.parse(fs.readFileSync(a.file, 'utf8')), color);
        job = lottieToClipAsset(data, storage, 'shared/lottie', { origin: 'library', name: `animation (transparent background): ${a.note}` }).catch((error) => {
          logger.warn('video.lottie_library_failed', { id: a.id, error: (error as Error).message });
          libraryCache.delete(key);
          return null;
        });
        libraryCache.set(key, job);
      }
      return job;
    })
  );
  return out.filter((x): x is VideoMediaAsset => !!x);
}
