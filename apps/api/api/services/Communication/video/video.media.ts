/**
 * MÉDIAS DES VIDÉOS — importés, trouvés sur Pexels, ou générés.
 *
 * Ordre de priorité, pour chaque besoin de la vidéo :
 *   1. ce que l'utilisateur a importé (photos, clips, modèles 3D, Lottie) ;
 *   2. les photos déjà utilisées dans ses visuels (payées, à la charte) ;
 *   3. Pexels — photos ET vidéos (`PEXELS_API_KEY`), si l'utilisateur l'autorise ;
 *   4. génération : image (Gemini) ou clip vidéo (Gemini Veo, un seul par vidéo).
 *
 * Tout clip, d'où qu'il vienne, est réencodé en WebM VP9 (720p, 15 s max, sans
 * son) : lisible par tous les Chromium (y compris ceux sans H.264) et rapide à
 * positionner image par image pendant le rendu.
 */
import axios from 'axios';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import logger from '../../../config/logger';
import { VideoMediaAsset, VideoMediaKind } from '../../../models/motionVideo.model';
import { generateVeoClip } from './video.veo';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export interface MediaStorage {
  uploadFile(content: Buffer, fileName: string, folder: string, contentType: string): Promise<{ downloadURL: string }>;
}

export class MediaInputError extends Error {}

export const MEDIA_LIMITS = {
  image: 12 * 1024 * 1024,
  video: 80 * 1024 * 1024,
  model3d: 20 * 1024 * 1024,
  lottie: 3 * 1024 * 1024,
  rive: 6 * 1024 * 1024,
};

/** Taille maximale d'une animation décompressée depuis un .lottie (anti « bombe zip »). */
const MAX_LOTTIE_JSON = 8 * 1024 * 1024;

export type Orientation = 'portrait' | 'landscape' | 'square';

const id = () => `media-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (c) => (out += c.toString()));
    p.stderr.on('data', (c) => (err += c.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${path.basename(cmd)} ${code}: ${err.slice(-400)}`))));
  });
}

async function probeVideo(file: string): Promise<{ duration: number; width: number; height: number }> {
  const out = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file]);
  const data = JSON.parse(out);
  return {
    duration: Number(data.format?.duration) || 0,
    width: data.streams?.[0]?.width || 0,
    height: data.streams?.[0]?.height || 0,
  };
}

/** Détecte le type d'un fichier importé (contenu d'abord, extension ensuite). */
export function detectKind(buffer: Buffer, mimetype: string, name: string): VideoMediaKind | null {
  const ext = path.extname(name || '').toLowerCase();
  if (buffer.slice(0, 4).toString('ascii') === 'glTF') return 'model3d';
  if (buffer.slice(0, 4).toString('ascii') === 'RIVE') return 'rive';
  // .lottie : archive zip qui contient l'animation JSON.
  if (ext === '.lottie' && buffer.slice(0, 2).toString('ascii') === 'PK') return 'lottie';
  if (/^image\//.test(mimetype) || ['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(ext)) return 'image';
  if (/^video\//.test(mimetype) || ['.mp4', '.mov', '.webm', '.m4v'].includes(ext)) return 'video';
  if (ext === '.json' || mimetype === 'application/json') return 'lottie';
  return null;
}

/**
 * Animation d'un fichier .lottie (dotLottie) : l'archive est ouverte ici, et
 * l'animation JSON est jouée par lottie-web comme un import .json.
 */
export async function lottieFromArchive(buffer: Buffer): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buffer);
  let target: string | undefined;
  const manifest = zip.file('manifest.json');
  if (manifest) {
    const m = JSON.parse(await manifest.async('string'));
    const first = m?.animations?.[0]?.id;
    if (first) target = Object.keys(zip.files).find((f) => f === `animations/${first}.json` || f === `a/${first}.json`);
  }
  target ??= Object.keys(zip.files).find((f) => /^(animations|a)\/[^/]+\.json$/.test(f));
  if (!target) throw new Error('no animation');
  const entry = zip.file(target);
  if ((entry?._data?.uncompressedSize || 0) > MAX_LOTTIE_JSON) throw new Error('animation too large');
  const text: string = await entry.async('string');
  if (text.length > MAX_LOTTIE_JSON) throw new Error('animation too large');
  return JSON.parse(text);
}

/** Une animation Lottie valide : version, cadence, durée, taille et calques. */
export function validateLottie(data: any): boolean {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof data.v === 'string' &&
    Number(data.fr) > 0 &&
    Number(data.op) > Number(data.ip ?? 0) &&
    Number(data.w) > 0 &&
    Number(data.h) > 0 &&
    Array.isArray(data.layers) &&
    data.layers.length > 0
  );
}

/** Réencode un clip : WebM VP9, grand côté ≤ 1280 px, 15 s max, sans son, affiche JPEG. */
export async function transcodeClip(input: string, outDir: string, maxSec = 15): Promise<{ webm: string; poster: string; duration: number; width: number; height: number }> {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, crypto.randomBytes(5).toString('hex'));
  const webm = `${base}.webm`;
  const poster = `${base}.jpg`;
  await run(FFMPEG, [
    '-y', '-v', 'error', '-i', input, '-t', String(maxSec),
    '-vf', "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))',fps=30",
    '-an', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1',
    '-crf', '34', '-b:v', '0', '-g', '15', '-pix_fmt', 'yuv420p', webm,
  ]);
  await run(FFMPEG, ['-y', '-v', 'error', '-ss', '0.5', '-i', webm, '-frames:v', '1', '-q:v', '4', poster]).catch(() =>
    run(FFMPEG, ['-y', '-v', 'error', '-i', webm, '-frames:v', '1', '-q:v', '4', poster])
  );
  const info = await probeVideo(webm);
  return { webm, poster, ...info };
}

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'idem-media-'));

/** Dépose un clip réencodé et renvoie sa fiche. */
async function storeClip(
  input: string,
  storage: MediaStorage,
  folder: string,
  meta: Pick<VideoMediaAsset, 'origin' | 'name' | 'credit' | 'sourceUrl'>
): Promise<VideoMediaAsset> {
  const dir = tmpDir();
  try {
    const clip = await transcodeClip(input, dir);
    const key = id();
    const [video, poster] = await Promise.all([
      storage.uploadFile(fs.readFileSync(clip.webm), `${key}.webm`, folder, 'video/webm'),
      storage.uploadFile(fs.readFileSync(clip.poster), `${key}.jpg`, folder, 'image/jpeg'),
    ]);
    return {
      id: key,
      kind: 'video',
      url: video.downloadURL,
      posterUrl: poster.downloadURL,
      durationSec: Math.round(clip.duration * 100) / 100,
      width: clip.width,
      height: clip.height,
      ...meta,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Traite un fichier importé par l'utilisateur. */
export async function processUpload(
  file: { buffer: Buffer; mimetype: string; originalname: string },
  storage: MediaStorage,
  folder: string
): Promise<VideoMediaAsset> {
  const kind = detectKind(file.buffer, file.mimetype, file.originalname);
  if (!kind) throw new MediaInputError('unsupported_media');
  if (file.buffer.length > MEDIA_LIMITS[kind]) throw new MediaInputError(`too_large_${kind}`);
  const name = (file.originalname || kind).slice(0, 80);

  if (kind === 'image') {
    const jpeg = await sharp(file.buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    const meta = await sharp(jpeg).metadata();
    const key = id();
    const up = await storage.uploadFile(jpeg, `${key}.jpg`, folder, 'image/jpeg');
    return { id: key, kind, url: up.downloadURL, origin: 'upload', name, width: meta.width, height: meta.height };
  }

  if (kind === 'video') {
    const dir = tmpDir();
    try {
      const input = path.join(dir, `in${path.extname(name) || '.mp4'}`);
      fs.writeFileSync(input, file.buffer);
      return await storeClip(input, storage, folder, { origin: 'upload', name });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  if (kind === 'model3d') {
    const key = id();
    const up = await storage.uploadFile(file.buffer, `${key}.glb`, folder, 'model/gltf-binary');
    return { id: key, kind, url: up.downloadURL, origin: 'upload', name };
  }

  if (kind === 'rive') {
    const key = id();
    const up = await storage.uploadFile(file.buffer, `${key}.riv`, folder, 'application/octet-stream');
    return { id: key, kind, url: up.downloadURL, origin: 'upload', name };
  }

  let data: any;
  try {
    data = file.buffer.slice(0, 2).toString('ascii') === 'PK' ? await lottieFromArchive(file.buffer) : JSON.parse(file.buffer.toString('utf8'));
  } catch {
    throw new MediaInputError('invalid_lottie');
  }
  if (!validateLottie(data)) throw new MediaInputError('invalid_lottie');
  const key = id();
  const up = await storage.uploadFile(Buffer.from(JSON.stringify(data)), `${key}.json`, folder, 'application/json');
  return {
    id: key,
    kind: 'lottie',
    url: up.downloadURL,
    origin: 'upload',
    name,
    durationSec: Math.round(((Number(data.op) - Number(data.ip || 0)) / Number(data.fr)) * 100) / 100,
    width: Number(data.w),
    height: Number(data.h),
  };
}

// ─── Pexels ─────────────────────────────────────────────────────────────────

export async function searchPexelsPhotos(query: string, orientation: Orientation, count: number, locale = 'fr-FR'): Promise<VideoMediaAsset[]> {
  if (!process.env.PEXELS_API_KEY || !query.trim()) return [];
  const res = await axios.get('https://api.pexels.com/v1/search', {
    headers: { Authorization: process.env.PEXELS_API_KEY },
    params: { query, per_page: Math.max(count, 3), orientation, locale },
    timeout: 8000,
  });
  return (res.data?.photos || []).slice(0, count).map((p: any) => ({
    id: `pexels-photo-${p.id}`,
    kind: 'image' as const,
    url: p.src?.large2x || p.src?.large,
    origin: 'pexels' as const,
    credit: p.photographer ? `Photo : ${p.photographer} (Pexels)` : 'Pexels',
    sourceUrl: p.url,
    width: p.width,
    height: p.height,
  }));
}

/** Fichier Pexels le plus adapté : au moins 720p, au plus proche de 1280 px de grand côté. */
function bestPexelsFile(files: any[]): any | null {
  const usable = (files || []).filter((f) => /mp4/.test(f.file_type || f.link || '') && Math.max(f.width, f.height) >= 720);
  usable.sort((a, b) => Math.abs(Math.max(a.width, a.height) - 1280) - Math.abs(Math.max(b.width, b.height) - 1280));
  return usable[0] || null;
}

export async function searchPexelsVideos(
  query: string,
  orientation: Orientation,
  count: number,
  storage: MediaStorage,
  folder: string,
  opts: { minDuration?: number; locale?: string } = {}
): Promise<VideoMediaAsset[]> {
  if (!process.env.PEXELS_API_KEY || !query.trim() || count <= 0) return [];
  const res = await axios.get('https://api.pexels.com/videos/search', {
    headers: { Authorization: process.env.PEXELS_API_KEY },
    params: { query, per_page: 10, orientation, locale: opts.locale || 'en-US', size: 'medium' },
    timeout: 8000,
  });
  const picked = (res.data?.videos || [])
    .filter((v: any) => v.duration >= (opts.minDuration ?? 3) && v.duration <= 60)
    .slice(0, count);
  const out: VideoMediaAsset[] = [];
  for (const v of picked) {
    const file = bestPexelsFile(v.video_files);
    if (!file) continue;
    const dir = tmpDir();
    try {
      const input = path.join(dir, 'pexels.mp4');
      const dl = await axios.get(file.link, { responseType: 'arraybuffer', timeout: 60000, maxContentLength: MEDIA_LIMITS.video });
      fs.writeFileSync(input, Buffer.from(dl.data));
      out.push(
        await storeClip(input, storage, folder, {
          origin: 'pexels',
          name: query,
          credit: v.user?.name ? `Vidéo : ${v.user.name} (Pexels)` : 'Pexels',
          sourceUrl: v.url,
        })
      );
    } catch (error: any) {
      logger.warn('video.pexels_video_failed', { id: v.id, error: error.message });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  return out;
}

// ─── Génération ─────────────────────────────────────────────────────────────

/** Clip généré par Gemini Veo (dernier recours, un seul par vidéo). */
export async function generateClip(prompt: string, orientation: Orientation, storage: MediaStorage, folder: string, model?: string): Promise<VideoMediaAsset> {
  const dir = tmpDir();
  try {
    const raw = path.join(dir, 'veo.mp4');
    const result = await generateVeoClip({ prompt, aspectRatio: orientation === 'landscape' ? '16:9' : '9:16', model }, raw);
    return await storeClip(raw, storage, folder, { origin: 'generated', name: prompt.slice(0, 80), credit: `Généré (${result.model})` });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Image générée (Gemini) quand ni l'utilisateur ni Pexels n'en ont. */
export async function generateStill(prompt: string, orientation: Orientation, storage: MediaStorage, folder: string): Promise<VideoMediaAsset> {
  const { generateImage } = await import('../../glm-media.service');
  const size = orientation === 'landscape' ? '1344x768' : orientation === 'square' ? '1024x1024' : '768x1344';
  const image = await generateImage(`${prompt}. Photographic, natural light, no text, no logo.`, { provider: 'gemini', size, tag: 'motion-video' });
  const jpeg = await sharp(image.buffer).jpeg({ quality: 88 }).toBuffer();
  const key = id();
  const up = await storage.uploadFile(jpeg, `${key}.jpg`, folder, 'image/jpeg');
  return { id: key, kind: 'image', url: up.downloadURL, origin: 'generated', credit: `Généré (${image.model})` };
}
