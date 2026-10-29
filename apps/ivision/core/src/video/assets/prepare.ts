/**
 * LA PRÉPARATION DES MÉDIAS — avant l'auteur, par le code, sans modèle :
 *
 *   recadrage   le meilleur cadre 9:16, 4:5, 1:1 et 16:9 de chaque image (smartcrop.js, MIT) : le point d'intérêt de
 *               chaque format, lu par le kit (`fitMedia`) — le sujet n'est jamais coupé en vertical ;
 *   zone calme  une carte de densité de contours (sharp) : la zone la plus calme de chaque cadre, et sa clarté ; le
 *               solveur y pose le texte, l'aplat devient l'exception ;
 *   harmonie    les teintes dominantes (quantification) ; l'étalonnage rapproche les médias de la marque ;
 *   clips       les images figées, les passages noirs et les coupes repérés par ffmpeg (`freezedetect`, `blackdetect`,
 *               `scdet`) : l'extrait le plus long sans défaut est gardé (`startAt`) ;
 *   étalonnage  une LUT par direction visuelle, du grain léger et un vignettage, sur TOUS les médias (photos pixel à
 *               pixel, clips par `lut3d`) — jamais sur une capture d'interface (ses couleurs sont celles du produit).
 *
 * Chaque étape échoue sans bloquer : le média reste tel quel, et la vidéo se fait.
 */
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import logger from '../../runtime/logger';
import type { VideoFormat, VideoMediaAsset } from '../contracts/model';
import type { MediaStorage } from './media';
import { fetchMedia } from '../rendering/runner';
import { FFMPEG } from '../rendering/ffmpeg';
import { buildCube, gradePixels, hexToRgb } from '../../../../../../packages/motion-compiler/src';
import type { GradeParams } from '../../../../../../packages/motion-compiler/src';

const ASPECT: Record<VideoFormat, [number, number]> = { story: [9, 16], portrait: [4, 5], square: [1, 1], landscape: [16, 9] };

export interface PrepareOptions {
  storage: MediaStorage;
  folder: string;
  formats: VideoFormat[];
  grade?: GradeParams;
  /** La couleur principale de la marque (harmonie). */
  brandHex?: string;
  /** Une capture d'interface : ni étalonnage, ni grain. */
  screen?: boolean;
}

type Crop = { x: number; y: number; width: number; height: number };

/** Le meilleur cadre d'un format (smartcrop) ; repli : le cadre centré. */
async function bestCrop(buffer: Buffer, w: number, h: number, format: VideoFormat): Promise<Crop> {
  const [aw, ah] = ASPECT[format];
  const scale = Math.min(w / aw, h / ah);
  const centred = { width: Math.round(aw * scale), height: Math.round(ah * scale), x: Math.round((w - aw * scale) / 2), y: Math.round((h - ah * scale) / 2) };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const smartcrop = require('smartcrop-sharp') as { crop: (img: Buffer, o: { width: number; height: number; minScale?: number }) => Promise<{ topCrop: Crop }> };
    const r = await smartcrop.crop(buffer, { width: aw * 100, height: ah * 100, minScale: 1 });
    return r?.topCrop?.width ? r.topCrop : centred;
  } catch {
    return centred;
  }
}

/**
 * La zone la plus calme d'un cadre (0..1 dans le cadre) : parmi des bandes et des moitiés candidates, celle dont la
 * densité de contours est la plus faible, assez grande pour porter un texte (≥ 22 % du cadre).
 */
async function calmZone(buffer: Buffer, crop: Crop, focus?: { x: number; y: number }): Promise<{ x: number; y: number; w: number; h: number; light: boolean } | undefined> {
  const G = 24;
  const { data } = await sharp(buffer).extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height }).resize(G, G, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => data[y * G + x];
  const edge = new Float32Array(G * G);
  for (let y = 1; y < G - 1; y++) for (let x = 1; x < G - 1; x++) edge[y * G + x] = Math.hypot(at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1)) / 255;
  const candidates = [
    { x: 0, y: 0.6, w: 1, h: 0.4 },
    { x: 0, y: 0, w: 1, h: 0.4 },
    { x: 0, y: 0.5, w: 1, h: 0.5 },
    { x: 0, y: 0, w: 1, h: 0.5 },
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
    { x: 0.08, y: 0.62, w: 0.84, h: 0.3 },
  ];
  let best: { x: number; y: number; w: number; h: number; d: number; lum: number } | null = null;
  for (const c of candidates) {
    let e = 0;
    let lum = 0;
    let n = 0;
    for (let y = Math.floor(c.y * G); y < Math.min(G, Math.ceil((c.y + c.h) * G)); y++) {
      for (let x = Math.floor(c.x * G); x < Math.min(G, Math.ceil((c.x + c.w) * G)); x++) {
        e += edge[y * G + x];
        lum += at(x, y) / 255;
        n++;
      }
    }
    // Une zone qui contient le SUJET n'est pas une place pour le texte, même uniforme (un visage, un produit sombre).
    const holdsSubject = focus && focus.x >= c.x && focus.x <= c.x + c.w && focus.y >= c.y && focus.y <= c.y + c.h;
    const d = (n ? e / n : 1) + (holdsSubject ? 0.2 : 0);
    if (!best || d < best.d) best = { ...c, d, lum: n ? lum / n : 0.5 };
  }
  // Une zone trop chargée n'est pas « calme » : le solveur posera un aplat.
  if (!best || best.d > 0.09) return undefined;
  return { x: best.x, y: best.y, w: best.w, h: best.h, light: best.lum > 0.6 };
}

/** Les teintes dominantes (k-moyennes sur une vignette 16 × 16). */
async function palette(buffer: Buffer): Promise<string[]> {
  const { data } = await sharp(buffer).resize(16, 16, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px: number[][] = [];
  for (let i = 0; i < data.length; i += 3) px.push([data[i], data[i + 1], data[i + 2]]);
  let centres = [px[0], px[85], px[170], px[255]].map((c) => [...(c || [128, 128, 128])]);
  for (let it = 0; it < 6; it++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let k = 0;
      let bd = Infinity;
      centres.forEach((c, j) => {
        const dd = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
        if (dd < bd) (bd = dd), (k = j);
      });
      sums[k][0] += p[0];
      sums[k][1] += p[1];
      sums[k][2] += p[2];
      sums[k][3]++;
    }
    centres = sums.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centres[j]));
  }
  return centres.map((c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`);
}

function ffmpegLog(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => (err += c.toString()));
    p.on('error', reject);
    p.on('close', () => resolve(err));
  });
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => (err += c.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-300)}`))));
  });
}

/**
 * L'extrait sans défaut d'un clip : les instants de coupe, d'image figée et de noir, puis le plus long intervalle propre.
 */
export async function cleanClipStart(file: string, duration: number): Promise<{ startAt: number; cleanSec: number; cuts: number }> {
  const log = await ffmpegLog(['-hide_banner', '-i', file, '-vf', 'freezedetect=n=-55dB:d=0.4,blackdetect=d=0.15:pix_th=0.12,scdet=threshold=14', '-an', '-f', 'null', '-']);
  const bad: [number, number][] = [];
  for (const m of log.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_end: ([\d.]+)/g)) bad.push([Number(m[1]), Number(m[2])]);
  for (const m of log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) bad.push([Number(m[1]), Number(m[2])]);
  const cuts = [...log.matchAll(/lavfi\.scd\.time:\s*([\d.]+)|scd\.time:\s*([\d.]+)|pts_time:([\d.]+)\s+.*scd/g)].map((m) => Number(m[1] || m[2] || m[3])).filter(Number.isFinite);
  for (const c of cuts) bad.push([Math.max(0, c - 0.05), c + 0.05]);
  bad.sort((a, b) => a[0] - b[0]);
  let start = 0;
  let best = { startAt: 0, len: 0 };
  for (const [a, b] of [...bad, [duration, duration] as [number, number]]) {
    if (a - start > best.len) best = { startAt: start, len: a - start };
    start = Math.max(start, b);
  }
  return { startAt: Math.round(best.startAt * 100) / 100, cleanSec: Math.round(best.len * 100) / 100, cuts: cuts.length };
}

/** Prépare un média : rend le média avec sa fiche `prep` (et l'URL de sa copie étalonnée). */
export async function prepareMedia(asset: VideoMediaAsset, opts: PrepareOptions): Promise<VideoMediaAsset> {
  if ((asset.kind !== 'image' && asset.kind !== 'video') || asset.transparent) return asset;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-prep-'));
  const prep: NonNullable<VideoMediaAsset['prep']> = { ...(asset.prep || {}), ...(opts.screen ? { screen: true } : {}) };
  const brand = opts.brandHex ? (hexToRgb(opts.brandHex)?.map((v) => v / 255) as [number, number, number] | undefined) : undefined;
  try {
    const source = await fetchMedia(asset.url);
    let still: Buffer = source.buffer;
    let clipFile: string | undefined;
    if (asset.kind === 'video') {
      clipFile = path.join(dir, 'clip.webm');
      fs.writeFileSync(clipFile, source.buffer);
      const clean = await cleanClipStart(clipFile, asset.durationSec || 15).catch(() => null);
      if (clean && clean.startAt > 0.05) prep.startAt = clean.startAt;
      const frame = path.join(dir, 'frame.jpg');
      await ffmpeg(['-y', '-v', 'error', '-ss', String((prep.startAt || 0) + 0.4), '-i', clipFile, '-frames:v', '1', '-q:v', '3', frame]).catch(() => undefined);
      if (fs.existsSync(frame)) still = fs.readFileSync(frame);
    }
    const meta = await sharp(still).metadata();
    const w = meta.width || asset.width || 0;
    const h = meta.height || asset.height || 0;
    if (w && h) {
      prep.focus = {};
      prep.calm = {};
      for (const format of opts.formats) {
        const crop = await bestCrop(still, w, h, format);
        // Une capture de démo garde l'endroit cliqué dans le cadre ; sinon le sujet trouvé par smartcrop.
        prep.focus[format] = prep.point || { x: Math.round(((crop.x + crop.width / 2) / w) * 1000) / 1000, y: Math.round(((crop.y + crop.height / 2) / h) * 1000) / 1000 };
        // Le sujet dans le cadre recadré : smartcrop le place au centre de son cadre ; la zone calme l'évite.
        const calm = await calmZone(still, crop, { x: 0.5, y: 0.5 }).catch(() => undefined);
        if (calm) prep.calm[format] = calm;
      }
      prep.palette = await palette(still).catch(() => undefined);
    }
    // L'étalonnage commun du film (jamais une capture d'interface).
    if (opts.grade && !prep.screen && (process.env.VIDEO_GRADE ?? 'on') !== 'off') {
      const key = crypto.createHash('sha1').update(`${asset.url}|${JSON.stringify(opts.grade)}|${opts.brandHex || ''}`).digest('hex').slice(0, 16);
      if (asset.kind === 'image') {
        const { data, info } = await sharp(source.buffer).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
        gradePixels(data, info.width, info.height, info.channels, opts.grade, brand);
        const jpeg = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).jpeg({ quality: 88 }).toBuffer();
        const up = await opts.storage.uploadFile(jpeg, `graded-${key}.jpg`, opts.folder, 'image/jpeg');
        prep.originalUrl = asset.url;
        prep.graded = up.downloadURL;
        return { ...asset, url: up.downloadURL, width: info.width, height: info.height, prep };
      }
      if (clipFile) {
        const cube = path.join(dir, 'grade.cube');
        fs.writeFileSync(cube, buildCube(opts.grade, brand, 25));
        const out = path.join(dir, 'graded.webm');
        const grain = Math.round(Math.min(0.12, opts.grade.grain || 0) * 120);
        const vignette = Math.min(0.4, opts.grade.vignette || 0);
        const filters = [`lut3d=file='${cube.replace(/'/g, "\\'")}'`, ...(grain ? [`noise=alls=${grain}:allf=t`] : []), ...(vignette ? [`vignette=angle=${((Math.PI / 5) * (0.6 + vignette)).toFixed(3)}`] : [])].join(',');
        await ffmpeg(['-y', '-v', 'error', '-i', clipFile, '-vf', filters, '-an', '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', '-crf', '32', '-b:v', '0', '-pix_fmt', 'yuv420p', out]);
        const up = await opts.storage.uploadFile(fs.readFileSync(out), `graded-${key}.webm`, opts.folder, 'video/webm');
        prep.originalUrl = asset.url;
        prep.graded = up.downloadURL;
        return { ...asset, url: up.downloadURL, prep };
      }
    }
    return { ...asset, ...(w && h && !asset.width ? { width: w, height: h } : {}), prep };
  } catch (error) {
    logger.warn('video.media_prepare_failed', { id: asset.id, error: (error as Error)?.message });
    return { ...asset, ...(Object.keys(prep).length ? { prep } : {}) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
