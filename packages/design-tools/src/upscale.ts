/**
 * RENDRE UNE IMAGE NETTE À SA PLACE — sans IA payante, sur le processeur.
 *
 * Deux paliers, choisis par la mesure (`image-quality.ts`) :
 *
 *   sharp          défaut léger (il manque moins de la moitié des pixels, compression) : agrandissement Lanczos 3,
 *                  adoucissement des blocs JPEG si besoin, accentuation douce. Quelques dizaines de millisecondes.
 *   modèle local   défaut fort sur une PHOTO sans visage (détecteur UltraFace, `faces.ts`) : Real-ESRGAN General x4v3 (architecture compacte, 1,2 M de
 *                  paramètres, licence BSD-3, export ONNX officiel de Qualcomm AI Hub) exécuté par `onnxruntime-web`
 *                  en WebAssembly — comme CLIP dans `embed.ts`, sans GPU ni binaire natif. L'image est découpée en
 *                  tuiles de 128 px qui se recouvrent, fondues à la couture. Mesuré le 21/11/2026 sur un i9 de
 *                  portable : 0,43 s par tuile avec 4 fils, 0,27 s avec 8 (≈ 6 s pour une image de 480 × 320).
 *
 * Le calcul du modèle tourne dans un `worker_thread` : l'API reste disponible pendant ce temps. Un seul calcul de
 * modèle à la fois par processus. En cas d'échec, de dépassement du budget ou de résultat moins net, on se replie sur
 * sharp. Les couleurs ne changent jamais (règle « photos jamais filtrées ») : un écart de teinte moyenne rejette le
 * résultat.
 *
 * Réglages : `IDEM_UPSCALE_MODEL=off` (sharp seul), `IDEM_UPSCALE_MODEL_URL` (archive du modèle, servie par notre
 * stockage en production), `IDEM_UPSCALE_THREADS` (fils du calcul, défaut 4), `IDEM_DESIGN_TOOLS_OFFLINE=1`.
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Worker } from 'worker_threads';
import sharp, { type Sharp } from 'sharp';
import { modelsDir } from './embed';
import { hasFace } from './faces';
import { gridBlockiness, ImageQuality, measureImageQuality, needsEnhancement, THRESHOLDS } from './image-quality';

const MODEL_ZIP_URL = 'https://qaihub-public-assets.s3.us-west-2.amazonaws.com/qai-hub-models/models/real_esrgan_general_x4v3/releases/v0.67.0/real_esrgan_general_x4v3-onnx-float.zip';
/** Empreinte de l'archive officielle (v0.67.0) : une archive modifiée n'est jamais chargée. */
const MODEL_ZIP_SHA256 = '4f3619c89eb0727ff9170b977578d160fa4d696680a0cac4c7f870b52973033b';
const MODEL_DIR = 'real-esrgan-general-x4v3';
const MODEL_FILE = 'real_esrgan_general_x4v3.onnx';
const MODEL_DATA = 'real_esrgan_general_x4v3.data';

/** Le modèle prend des tuiles de 128 px et rend 512 px. */
const TILE = 128;
const SCALE = 4;
const OVERLAP = 12;
/** Le plus grand côté donné au modèle : au-delà, le temps explose pour un gain invisible. */
const MODEL_MAX_SIDE = 720;
/** Le plus grand côté rendu : aucun écran de site n'en demande plus. */
const MAX_OUTPUT_SIDE = 2400;
const DEFAULT_BUDGET_MS = 25_000;
/** Temps d'une tuile retenu pour le budget, avant la première mesure sur la machine. */
let msPerTile = 450;

export type EnhanceMethod = 'model' | 'sharp';

export interface EnhanceOptions {
  /** La largeur visée en pixels (voir `targetWidthFor`) ; à défaut, ×2 bornée. */
  targetWidth?: number;
  /** `false` : sharp seulement. */
  allowModel?: boolean;
  /** Temps maximal accordé au modèle pour cette image. */
  budgetMs?: number;
}

export interface EnhanceResult {
  buffer: Buffer;
  mimeType: 'image/webp';
  width: number;
  height: number;
  method: EnhanceMethod;
  before: ImageQuality;
  /** La netteté à la taille visée : l'image simplement agrandie, puis l'image améliorée. */
  sharpness: { plain: number; enhanced: number };
  ms: number;
}

/* -------------------------------------------------------------------------- */
/*  Le modèle : téléchargé une fois, vérifié, chargé dans un worker            */
/* -------------------------------------------------------------------------- */

const modelOff = () => (process.env.IDEM_UPSCALE_MODEL ?? '').toLowerCase() === 'off';

let modelFiles: Promise<{ onnx: string; data: string } | null> | null = null;

/** Les fichiers du modèle sur le disque (téléchargés et vérifiés au premier usage) ; `null` s'ils sont indisponibles. */
export function upscaleModelFiles(): Promise<{ onnx: string; data: string } | null> {
  if (!modelFiles) {
    modelFiles = (async () => {
      const dir = path.join(modelsDir(), MODEL_DIR);
      const onnx = path.join(dir, MODEL_FILE);
      const data = path.join(dir, MODEL_DATA);
      if (fs.existsSync(onnx) && fs.existsSync(data)) return { onnx, data };
      if (process.env.IDEM_DESIGN_TOOLS_OFFLINE === '1') return null;
      const res = await fetch(process.env.IDEM_UPSCALE_MODEL_URL || MODEL_ZIP_URL, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`téléchargement du modèle refusé (${res.status})`);
      const zip = Buffer.from(await res.arrayBuffer());
      const sha = crypto.createHash('sha256').update(zip).digest('hex');
      // Même servie par notre stockage, l'archive doit être exactement celle de Qualcomm (v0.67.0).
      if (sha !== MODEL_ZIP_SHA256) throw new Error('empreinte du modèle inattendue');
      const JSZip = (await import('jszip')).default;
      const archive = await JSZip.loadAsync(zip);
      const pick = (name: string) => Object.values(archive.files).find((f) => !f.dir && (f.name === name || f.name.endsWith(`/${name}`)));
      const onnxEntry = pick(MODEL_FILE);
      const dataEntry = pick(MODEL_DATA);
      if (!onnxEntry || !dataEntry) throw new Error('archive du modèle incomplète');
      fs.mkdirSync(dir, { recursive: true });
      for (const [entry, file] of [
        [onnxEntry, onnx],
        [dataEntry, data],
      ] as const) {
        fs.writeFileSync(`${file}.part`, await entry.async('nodebuffer'));
        fs.renameSync(`${file}.part`, file);
      }
      return { onnx, data };
    })().catch(() => {
      modelFiles = null;
      return null;
    });
  }
  return modelFiles;
}

/**
 * Le code du worker (évalué tel quel : pas de fichier à compiler ni à retrouver après le build). Il reçoit l'image
 * en RVB (octets), la découpe en tuiles, fond les tuiles agrandies et rend l'image ×4 en RVB.
 */
const WORKER_CODE = `
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const ort = require(workerData.ortPath);
ort.env.wasm.numThreads = workerData.threads;
let session = null;
async function load() {
  if (!session) {
    session = await ort.InferenceSession.create(fs.readFileSync(workerData.onnx), {
      executionProviders: ['wasm'],
      externalData: [{ path: workerData.dataName, data: fs.readFileSync(workerData.data) }],
    });
  }
  return session;
}
function starts(size, tile, stride) {
  const out = [];
  if (size <= tile) return [0];
  for (let p = 0; p + tile < size; p += stride) out.push(p);
  out.push(size - tile);
  return out;
}
parentPort.on('message', async (job) => {
  try {
    const s = await load();
    const { rgb, width: w, height: h, tile, scale, overlap, deadline } = job;
    const W = w * scale, H = h * scale, T = tile * scale;
    const acc = new Float32Array(W * H * 3);
    const weight = new Float32Array(W * H);
    const xs = starts(w, tile, tile - 2 * overlap), ys = starts(h, tile, tile - 2 * overlap);
    const input = new Float32Array(3 * tile * tile);
    const ramp = overlap * scale * 2;
    let done = 0;
    const t0 = Date.now();
    for (const y0 of ys) for (const x0 of xs) {
      if (Date.now() > deadline) throw new Error('budget');
      for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
        const src = ((y0 + y) * w + (x0 + x)) * 3, dst = y * tile + x;
        input[dst] = rgb[src] / 255; input[tile * tile + dst] = rgb[src + 1] / 255; input[2 * tile * tile + dst] = rgb[src + 2] / 255;
      }
      const out = (await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, tile, tile]) }))[s.outputNames[0]].data;
      for (let y = 0; y < T; y++) {
        const wy = Math.min(1, (y + 0.5) / ramp, (T - y - 0.5) / ramp);
        for (let x = 0; x < T; x++) {
          const wx = Math.min(1, (x + 0.5) / ramp, (T - x - 0.5) / ramp);
          const k = wx * wy, p = (y0 * scale + y) * W + (x0 * scale + x), q = y * T + x;
          acc[p * 3] += out[q] * k; acc[p * 3 + 1] += out[T * T + q] * k; acc[p * 3 + 2] += out[2 * T * T + q] * k;
          weight[p] += k;
        }
      }
      done++;
    }
    const result = new Uint8Array(W * H * 3);
    for (let p = 0; p < W * H; p++) {
      const k = weight[p] || 1;
      for (let c = 0; c < 3; c++) result[p * 3 + c] = Math.max(0, Math.min(255, Math.round((acc[p * 3 + c] / k) * 255)));
    }
    parentPort.postMessage({ ok: true, rgb: result, width: W, height: H, tiles: done, ms: Date.now() - t0 }, [result.buffer]);
  } catch (error) {
    parentPort.postMessage({ ok: false, error: String((error && error.message) || error) });
  }
});
`;

let worker: Promise<Worker | null> | null = null;
/** Un calcul de modèle à la fois : la file. */
let queue: Promise<unknown> = Promise.resolve();

function modelWorker(): Promise<Worker | null> {
  if (!worker) {
    worker = (async () => {
      const files = await upscaleModelFiles();
      if (!files) return null;
      const threads = Math.max(1, Math.min(Number(process.env.IDEM_UPSCALE_THREADS) || 4, os.cpus().length));
      const w = new Worker(WORKER_CODE, {
        eval: true,
        workerData: { ortPath: require.resolve('onnxruntime-web'), onnx: files.onnx, data: files.data, dataName: MODEL_DATA, threads },
      });
      w.unref();
      // Un worker mort est recréé au prochain appel.
      w.once('error', () => (worker = null));
      w.once('exit', () => (worker = null));
      return w;
    })().catch(() => {
      worker = null;
      return null;
    });
  }
  return worker;
}

/** L'image (RVB, ≥ 128 px de côté) agrandie ×4 par le modèle ; `null` si le modèle est indisponible ou trop lent. */
async function runModel(rgb: Buffer, width: number, height: number, budgetMs: number): Promise<{ rgb: Buffer; width: number; height: number } | null> {
  const run = async () => {
    const w = await modelWorker();
    if (!w) return null;
    return new Promise<{ rgb: Buffer; width: number; height: number } | null>((resolve) => {
      const timer = setTimeout(() => {
        w.off('message', onMessage);
        resolve(null);
      }, budgetMs + 5_000);
      const onMessage = (m: { ok: boolean; rgb?: Uint8Array; width?: number; height?: number; tiles?: number; ms?: number }) => {
        clearTimeout(timer);
        w.off('message', onMessage);
        if (!m.ok || !m.rgb) return resolve(null);
        if (m.tiles && m.ms) msPerTile = Math.round(msPerTile * 0.5 + (m.ms / m.tiles) * 0.5);
        resolve({ rgb: Buffer.from(m.rgb.buffer, m.rgb.byteOffset, m.rgb.byteLength), width: m.width!, height: m.height! });
      };
      w.on('message', onMessage);
      const copy = new Uint8Array(rgb);
      w.postMessage({ rgb: copy, width, height, tile: TILE, scale: SCALE, overlap: OVERLAP, deadline: Date.now() + budgetMs }, [copy.buffer]);
    });
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** Le nombre de tuiles d'une image : le budget se vérifie AVANT de lancer le calcul. */
function tilesFor(width: number, height: number): number {
  const count = (size: number) => (size <= TILE ? 1 : Math.ceil((size - TILE) / (TILE - 2 * OVERLAP)) + 1);
  return count(width) * count(height);
}

/* -------------------------------------------------------------------------- */
/*  Les deux paliers                                                           */
/* -------------------------------------------------------------------------- */

async function rgbOf(image: Sharp): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await image.flatten({ background: '#ffffff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Teinte moyenne (vignette 16 × 16) : l'amélioration ne doit jamais changer les couleurs. */
async function meanColour(buffer: Buffer): Promise<[number, number, number]> {
  const { data } = await sharp(buffer, { failOn: 'none' }).flatten({ background: '#ffffff' }).resize(16, 16, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 3) for (let c = 0; c < 3; c++) sum[c] += data[i + c];
  const n = data.length / 3;
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/** Netteté d'une image (même mesure que `image-quality.ts`) à une largeur donnée. */
async function sharpnessAt(buffer: Buffer, width: number): Promise<number> {
  const q = await measureImageQuality(await sharp(buffer, { failOn: 'none' }).resize({ width }).png().toBuffer());
  return q?.sharpness ?? 0;
}

/** Palier sharp : Lanczos 3, blocs JPEG adoucis, accentuation réglée sur l'agrandissement. */
async function sharpTier(buffer: Buffer, quality: ImageQuality, width: number): Promise<Buffer> {
  const factor = width / quality.width;
  let image = sharp(buffer, { failOn: 'none' }).rotate();
  // Les marches des blocs, adoucies avant l'agrandissement (sinon il les grossit) ; plus fort sur une compression lourde.
  const blocky = quality.issues.includes('blocky');
  if (blocky) image = sharp(await image.blur(quality.blockiness > 1.8 ? 0.75 : 0.6).png().toBuffer());
  image = image.resize({ width, kernel: 'lanczos3', withoutEnlargement: false });
  const sigma = Math.min(1.6, 0.6 + 0.4 * Math.log2(Math.max(1, factor)));
  // Une accentuation forte redessinerait les blocs qu'on vient d'adoucir (mesuré : 1,19 → 1,57).
  return image.sharpen({ sigma, m1: 0.6, m2: blocky ? 1 : 2.2, x1: 2, y2: 12, y3: 18 }).webp({ quality: 86 }).toBuffer();
}

/** Palier modèle : ×4 sur une entrée bornée (à la vraie résolution si l'image avait été agrandie), puis à la largeur visée. */
async function modelTier(buffer: Buffer, quality: ImageQuality, width: number, budgetMs: number): Promise<Buffer | null> {
  // Une image floue (souvent déjà agrandie) ne contient qu'environ la moitié de ses pixels : le modèle travaille à sa
  // vraie résolution.
  let inputWidth = quality.issues.includes('blurry') ? Math.round(quality.width / 2) : quality.width;
  inputWidth = Math.min(inputWidth, Math.round((MODEL_MAX_SIDE * quality.width) / Math.max(quality.width, quality.height)));
  // Inutile de nourrir le modèle au-delà de ce que ×4 doit produire.
  inputWidth = Math.max(Math.min(inputWidth, Math.ceil(width / 2)), Math.ceil(width / SCALE));
  let inputHeight = Math.max(1, Math.round((inputWidth * quality.height) / quality.width));
  // Le budget : moins de pixels donnés au modèle plutôt qu'un dépassement.
  while (tilesFor(inputWidth, inputHeight) * msPerTile > budgetMs && inputWidth > Math.ceil(width / SCALE)) {
    inputWidth = Math.max(Math.ceil(width / SCALE), Math.round(inputWidth * 0.85));
    inputHeight = Math.max(1, Math.round((inputWidth * quality.height) / quality.width));
  }
  if (tilesFor(inputWidth, inputHeight) * msPerTile > budgetMs) return null;
  // Une image plus petite qu'une tuile est prolongée par ses bords, puis le surplus retiré.
  const padRight = Math.max(0, TILE - inputWidth);
  const padBottom = Math.max(0, TILE - inputHeight);
  let source = sharp(buffer, { failOn: 'none' }).rotate().resize({ width: inputWidth, height: inputHeight, fit: 'fill', kernel: 'lanczos3' });
  if (padRight || padBottom) source = sharp(await source.png().toBuffer()).extend({ right: padRight, bottom: padBottom, extendWith: 'copy' });
  const rgb = await rgbOf(source);
  const out = await runModel(rgb.data, rgb.width, rgb.height, budgetMs);
  if (!out) return null;
  let image = sharp(out.rgb, { raw: { width: out.width, height: out.height, channels: 3 } });
  if (padRight || padBottom) image = image.extract({ left: 0, top: 0, width: inputWidth * SCALE, height: inputHeight * SCALE });
  return sharp(await image.png().toBuffer())
    .resize({ width, kernel: 'lanczos3' })
    .webp({ quality: 86 })
    .toBuffer();
}

/**
 * L'image améliorée pour être nette à la largeur visée ; `null` si elle n'en a pas besoin, si ce n'est pas une
 * image matricielle lisible, ou si aucun palier ne fait mieux qu'un simple agrandissement.
 */
export async function enhanceImage(buffer: Buffer, options: EnhanceOptions = {}): Promise<EnhanceResult | null> {
  const started = Date.now();
  const before = await measureImageQuality(buffer);
  if (!before) return null;
  const target = Math.min(MAX_OUTPUT_SIDE, Math.round(options.targetWidth ?? before.width * 2));
  const width = Math.max(before.width, Math.min(target, Math.round((MAX_OUTPUT_SIDE * before.width) / Math.max(before.width, before.height))));
  const issues = needsEnhancement(before, { displayWidth: width / 2, displayHeight: 0 });
  if (!issues.length) return null;

  const plain = await sharp(buffer, { failOn: 'none' }).rotate().resize({ width, kernel: 'lanczos3' }).png().toBuffer();
  const plainSharpness = await sharpnessAt(plain, width);
  const colour = await meanColour(buffer);

  // Défaut fort : il manque plus de la moitié des pixels, l'image est floue, ou la compression est lourde — sharp
  // seul ne recrée rien (le modèle est entraîné sur ces dégradations).
  const strong = before.width / width < 0.5 || issues.includes('blurry') || before.blockiness > 1.8;
  // Le modèle : photos seulement (un aplat, un texte se déformeraient), jamais un visage (il le lisserait).
  const modelAllowed = options.allowModel !== false && !modelOff() && before.photo && strong && !(await hasFace(buffer));
  const attempts: EnhanceMethod[] = modelAllowed ? ['model', 'sharp'] : ['sharp'];

  for (const method of attempts) {
    const output = method === 'model' ? await modelTier(buffer, before, width, options.budgetMs ?? DEFAULT_BUDGET_MS).catch(() => null) : await sharpTier(buffer, before, width).catch(() => null);
    if (!output) continue;
    // Les couleurs restent celles de la photo.
    const after = await meanColour(output);
    if (Math.max(...after.map((v, i) => Math.abs(v - colour[i]))) > 6) continue;
    const enhancedSharpness = await sharpnessAt(output, width);
    // Gardée seulement si elle est vraiment meilleure qu'un simple agrandissement : plus nette, ou — pour une image
    // compressée — débarrassée de ses blocs. Les arêtes des blocs gonflent la netteté mesurée de l'original : on
    // accepte d'en perdre jusqu'à la moitié (mesuré sur JPEG qualité 10 : 0,289 → 0,206, blocs 2,08 → 1,19).
    const sharper = enhancedSharpness >= plainSharpness * 1.05;
    const deblocked =
      issues.includes('blocky') &&
      enhancedSharpness >= plainSharpness * 0.5 &&
      (await gridBlockiness(await sharp(output).resize({ width: before.width }).png().toBuffer())) < THRESHOLDS.blocky;
    if (!sharper && !deblocked) continue;
    const meta = await sharp(output).metadata();
    return {
      buffer: output,
      mimeType: 'image/webp',
      width: meta.width ?? width,
      height: meta.height ?? Math.round((width * before.height) / before.width),
      method,
      before,
      sharpness: { plain: Math.round(plainSharpness * 1000) / 1000, enhanced: Math.round(enhancedSharpness * 1000) / 1000 },
      ms: Date.now() - started,
    };
  }
  return null;
}

/** Pour les journaux : le modèle est-il prêt sur cette machine (sans le télécharger) ? */
export function upscaleModelCached(): boolean {
  const dir = path.join(modelsDir(), MODEL_DIR);
  return fs.existsSync(path.join(dir, MODEL_FILE)) && fs.existsSync(path.join(dir, MODEL_DATA));
}

