/**
 * LES EMBEDDINGS — pour mesurer qu'un rendu ou une idée NE ressemble PAS à ce qui a déjà été fait.
 *
 * Images : CLIP ViT-B/32 quantifié (`Xenova/clip-vit-base-patch32`, MIT), exécuté par `onnxruntime-web` en
 * WebAssembly dans Node — sans GPU et sans binaire natif (`onnxruntime-node` et Transformers.js ne fonctionnent pas
 * sur Mac Intel). Mesuré sur la machine de test : 0,6 s de chargement, 43 à 130 ms par image, ~600 Mo de mémoire.
 * Le modèle (89 Mo) est téléchargé une fois dans `IDEM_DESIGN_MODELS_DIR` (défaut : `~/.cache/idem-design-tools`).
 *
 * Textes (idées, concepts) : un vecteur de trigrammes de caractères haché (512 dimensions), sans réseau ni modèle —
 * assez pour reconnaître une idée qui revient sous d'autres mots proches. Le juge reste le directeur ; la mesure
 * écarte seulement les répétitions.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { hashString } from './tool';

const MODEL_URL = 'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model_quantized.onnx';
const MODEL_FILE = 'clip-vit-base-patch32-vision-q8.onnx';
const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];

let chosenDir: string | undefined;

/**
 * Le dossier des modèles : `IDEM_DESIGN_MODELS_DIR`, sinon le premier dossier où l'on peut écrire parmi
 * `~/.cache`, `~/Library/Caches` (macOS) et le dossier temporaire (sur la machine de test, `~/.cache` appartient à
 * root : on ne peut pas y écrire).
 */
export function modelsDir(): string {
  if (process.env.IDEM_DESIGN_MODELS_DIR) return process.env.IDEM_DESIGN_MODELS_DIR;
  if (chosenDir) return chosenDir;
  const candidates = [path.join(os.homedir(), '.cache', 'idem-design-tools'), path.join(os.homedir(), 'Library', 'Caches', 'idem-design-tools'), path.join(os.tmpdir(), 'idem-design-tools')];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, MODEL_FILE))) return (chosenDir = dir);
  }
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return (chosenDir = dir);
    } catch {
      // dossier non inscriptible : le suivant
    }
  }
  return (chosenDir = candidates[candidates.length - 1]);
}

type Ort = typeof import('onnxruntime-web');
let session: Promise<{ ort: Ort; s: import('onnxruntime-web').InferenceSession } | null> | null = null;

async function download(url: string, file: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`téléchargement du modèle refusé (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.part`, buf);
  fs.renameSync(`${file}.part`, file);
}

/** La session CLIP (paresseuse, une par processus) ; `null` si le modèle est indisponible (hors ligne). */
export function clipSession(): Promise<{ ort: Ort; s: import('onnxruntime-web').InferenceSession } | null> {
  if (!session) {
    session = (async () => {
      const file = path.join(modelsDir(), MODEL_FILE);
      if (!fs.existsSync(file)) {
        if (process.env.IDEM_DESIGN_TOOLS_OFFLINE === '1') return null;
        await download(MODEL_URL, file);
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ort = require('onnxruntime-web') as Ort;
      ort.env.wasm.numThreads = Math.max(1, Math.min(4, os.cpus().length));
      const s = await ort.InferenceSession.create(fs.readFileSync(file), { executionProviders: ['wasm'] });
      return { ort, s };
    })().catch(() => {
      session = null;
      return null;
    });
  }
  return session;
}

/** L'embedding d'une image (512 dimensions, normalisé) ; `null` si CLIP est indisponible. */
export async function imageEmbedding(image: Buffer): Promise<Float32Array | null> {
  const loaded = await clipSession();
  if (!loaded) return null;
  const { data } = await sharp(image).flatten({ background: '#ffffff' }).resize(224, 224, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Float32Array(3 * 224 * 224);
  for (let i = 0; i < 224 * 224; i++) for (let c = 0; c < 3; c++) px[c * 224 * 224 + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  const input = new loaded.ort.Tensor('float32', px, [1, 3, 224, 224]);
  const out = await loaded.s.run({ [loaded.s.inputNames[0]]: input });
  const tensor = out.image_embeds ?? out[loaded.s.outputNames[0]];
  return normalize(Float32Array.from(tensor.data as Float32Array));
}

/** L'embedding d'un texte : trigrammes de caractères hachés (aucun modèle, aucun réseau). */
export function textEmbedding(text: string, dims = 512): Float32Array {
  const v = new Float32Array(dims);
  const clean = ` ${text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
  for (let i = 0; i + 3 <= clean.length; i++) v[hashString(clean.slice(i, i + 3)) % dims] += 1;
  // Les mots entiers comptent aussi (une idée tient dans ses mots-clés).
  for (const w of clean.trim().split(' ')) if (w.length > 3) v[hashString(`w:${w}`) % dims] += 2;
  return normalize(v);
}

export function normalize(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}

/**
 * La NOUVEAUTÉ d'un vecteur face à l'historique : 1 − la plus forte ressemblance (0 = déjà fait, 1 = inédit).
 * Sans historique : 1.
 */
export function novelty(vector: ArrayLike<number>, history: ArrayLike<number>[]): number {
  if (!history.length) return 1;
  let max = 0;
  for (const h of history) max = Math.max(max, cosine(vector, h));
  return Math.round((1 - max) * 1000) / 1000;
}

/** Vecteur ↔ texte (pour garder une empreinte dans une mémoire clé → texte). */
export const encodeVector = (v: Float32Array): string => Buffer.from(new Float32Array(Array.from(v, (x) => Math.round(x * 1e4) / 1e4)).buffer).toString('base64');
export const decodeVector = (s: string): Float32Array => {
  const buf = Buffer.from(s, 'base64');
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
