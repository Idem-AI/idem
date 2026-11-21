/**
 * Y A-T-IL UN VISAGE ? — pour qu'aucun visage ne passe par le modèle d'agrandissement (il les lisse).
 *
 * UltraFace « version-RFB-320 » (Linzaer, licence MIT, distribué par le dépôt officiel `onnx/models`) : un
 * détecteur de visages de 1,2 Mo, pas un modèle génératif. Il est exécuté par `onnxruntime-web` comme CLIP, et met
 * environ 10 ms par image sur le processeur.
 *
 * Vérifié le 21/11/2026 sur 14 photos Kodak, deux portraits de l'équipe, des captures et des illustrations : les six
 * photos avec visages sont trouvées, y compris de petits visages à 0,3 % de l'image. Aucune fausse alerte (perroquets,
 * façades, paysages, captures).
 *
 * Le fichier est téléchargé une fois et vérifié par son empreinte. `null` si le détecteur est indisponible : on
 * suppose alors qu'il peut y avoir un visage (prudence : sharp seulement).
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { modelsDir } from './embed';

const MODEL_URL = 'https://github.com/onnx/models/raw/main/validated/vision/body_analysis/ultraface/models/version-RFB-320.onnx';
const MODEL_SHA256 = '34cd7e60aeff28744c657de7a3dc64e872d506741de66987f3426f2b79f88017';
const MODEL_FILE = 'ultraface-rfb-320.onnx';
const W = 320;
const H = 240;
/** Score à partir duquel un visage est retenu (les fausses alertes observées restent sous 0,45). */
const FACE_SCORE = 0.9;

type Ort = typeof import('onnxruntime-web');
let session: Promise<{ ort: Ort; s: import('onnxruntime-web').InferenceSession } | null> | null = null;

function faceSession(): Promise<{ ort: Ort; s: import('onnxruntime-web').InferenceSession } | null> {
  if (!session) {
    session = (async () => {
      const file = path.join(modelsDir(), MODEL_FILE);
      if (!fs.existsSync(file)) {
        if (process.env.IDEM_DESIGN_TOOLS_OFFLINE === '1') return null;
        const res = await fetch(process.env.IDEM_FACE_MODEL_URL || MODEL_URL, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`téléchargement du détecteur refusé (${res.status})`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (crypto.createHash('sha256').update(buf).digest('hex') !== MODEL_SHA256) throw new Error('empreinte du détecteur inattendue');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(`${file}.part`, buf);
        fs.renameSync(`${file}.part`, file);
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ort = require('onnxruntime-web') as Ort;
      ort.env.wasm.numThreads = Math.max(1, Math.min(4, os.cpus().length));
      // Ce vieil export déclare ses poids comme entrées : l'avertissement, répété par poids, est sans objet.
      const s = await ort.InferenceSession.create(fs.readFileSync(file), { executionProviders: ['wasm'], logSeverityLevel: 3 });
      return { ort, s };
    })().catch(() => {
      session = null;
      return null;
    });
  }
  return session;
}

/** Le meilleur score de visage de l'image (0 à 1) ; `null` si le détecteur est indisponible. */
export async function faceScore(image: Buffer): Promise<number | null> {
  const loaded = await faceSession();
  if (!loaded) return null;
  const { data } = await sharp(image, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' }).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const input = new Float32Array(3 * W * H);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) input[c * W * H + i] = (data[i * 3 + c] - 127) / 128;
  const out = await loaded.s.run({ input: new loaded.ort.Tensor('float32', input, [1, 3, H, W]) });
  const scores = out.scores.data as Float32Array;
  let best = 0;
  for (let i = 1; i < scores.length; i += 2) if (scores[i] > best) best = scores[i];
  return Math.round(best * 1000) / 1000;
}

/** Un visage dans l'image ? Sans détecteur, on répond « peut-être » (`true`) : la prudence protège les portraits. */
export async function hasFace(image: Buffer): Promise<boolean> {
  const score = await faceScore(image).catch(() => null);
  return score === null ? true : score >= FACE_SCORE;
}
