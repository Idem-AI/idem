/// <reference path="./vendor.d.ts" />
/**
 * LE DÉTOURAGE — le sujet d'une photo, sans son fond (PNG transparent), pour le poser sur un aplat de la marque.
 *
 * Modèles (licences vérifiées le 05/11/2026) : ISNet « general use » (projet DIS, Apache 2.0, 179 Mo, 1 024 px — la
 * qualité, par défaut) et U²-Net-p (Apache 2.0, 4,6 Mo, 320 px — la vitesse, `IDEM_CUTOUT_MODEL=u2netp`), au format
 * ONNX distribué par rembg (MIT). Exécutés par `onnxruntime-web` en WebAssembly : processeur seul, aucun binaire
 * natif. Le modèle est téléchargé une fois dans le dossier des modèles (`modelsDir`).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { modelsDir } from './embed';

type Ort = typeof import('onnxruntime-web');

const MODELS = {
  isnet: { file: 'isnet-general-use.onnx', url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx', size: 1024, mean: [0.5, 0.5, 0.5], std: [1, 1, 1] },
  u2netp: { file: 'u2netp.onnx', url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx', size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
} as const;

export type CutoutModel = keyof typeof MODELS;

export const cutoutModel = (): CutoutModel => (process.env.IDEM_CUTOUT_MODEL === 'u2netp' ? 'u2netp' : 'isnet');

const sessions = new Map<CutoutModel, Promise<{ ort: Ort; s: import('onnxruntime-web').InferenceSession } | null>>();

function session(model: CutoutModel) {
  let job = sessions.get(model);
  if (!job) {
    job = (async () => {
      const spec = MODELS[model];
      const file = path.join(modelsDir(), spec.file);
      if (!fs.existsSync(file)) {
        if (process.env.IDEM_DESIGN_TOOLS_OFFLINE === '1') return null;
        const res = await fetch(spec.url);
        if (!res.ok) throw new Error(`téléchargement du modèle de détourage refusé (${res.status})`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.part`, Buffer.from(await res.arrayBuffer()));
        fs.renameSync(`${file}.part`, file);
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ort = require('onnxruntime-web') as Ort;
      ort.env.wasm.numThreads = Math.max(1, Math.min(4, os.cpus().length));
      const s = await ort.InferenceSession.create(fs.readFileSync(file), { executionProviders: ['wasm'] });
      return { ort, s };
    })().catch(() => {
      sessions.delete(model);
      return null;
    });
    sessions.set(model, job);
  }
  return job;
}

export interface CutoutResult {
  /** Le sujet sur fond transparent (PNG, taille d'origine). */
  png: Buffer;
  /** La part de l'image occupée par le sujet (0–1) : trop petite ou presque tout, le détourage n'a pas de sens. */
  coverage: number;
  /** Le cadre du sujet (part de l'image). */
  box: { x: number; y: number; w: number; h: number };
  model: CutoutModel;
  ms: number;
}

/** Détoure le sujet ; `null` si le modèle est indisponible (hors ligne) — l'appelant garde la photo entière. */
export async function cutout(image: Buffer, model: CutoutModel = cutoutModel()): Promise<CutoutResult | null> {
  const started = Date.now();
  const loaded = await session(model);
  if (!loaded) return null;
  const spec = MODELS[model];
  const meta = await sharp(image).metadata();
  const width = meta.width ?? spec.size;
  const height = meta.height ?? spec.size;
  const { data } = await sharp(image).flatten({ background: '#ffffff' }).resize(spec.size, spec.size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = spec.size * spec.size;
  const px = new Float32Array(3 * n);
  let max = 1;
  for (let i = 0; i < data.length; i++) max = Math.max(max, data[i]);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) px[c * n + i] = (data[i * 3 + c] / max - spec.mean[c]) / spec.std[c];
  const out = await loaded.s.run({ [loaded.s.inputNames[0]]: new loaded.ort.Tensor('float32', px, [1, 3, spec.size, spec.size]) });
  const pred = out[loaded.s.outputNames[0]].data as Float32Array;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, pred[i]);
    hi = Math.max(hi, pred[i]);
  }
  const mask = Buffer.alloc(n);
  for (let i = 0; i < n; i++) mask[i] = Math.round(((pred[i] - lo) / Math.max(1e-6, hi - lo)) * 255);
  // Une seule couche : sans `extractChannel`, sharp repasse le masque en sRGB (3 canaux) et l'alpha est mal relu.
  const alpha = await sharp(mask, { raw: { width: spec.size, height: spec.size, channels: 1 } }).resize(width, height, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  // La part et le cadre du sujet (alpha > 50 %).
  let count = 0;
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 127) {
        count++;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  const rgb = await sharp(image).removeAlpha().resize(width, height, { fit: 'fill' }).raw().toBuffer();
  const png = await sharp(rgb, { raw: { width, height, channels: 3 } }).joinChannel(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    png,
    coverage: r3(count / (width * height)),
    box: count ? { x: r3(x0 / width), y: r3(y0 / height), w: r3((x1 - x0) / width), h: r3((y1 - y0) / height) } : { x: 0, y: 0, w: 0, h: 0 },
    model,
    ms: Date.now() - started,
  };
}
