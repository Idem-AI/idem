/**
 * LA TRANSCRIPTION — Whisper en local (whisper.cpp), au mot près, sans service tiers.
 *
 *   WHISPER_BIN       binaire de whisper.cpp (défaut : `whisper-cli`) ;
 *   WHISPER_MODEL     modèle ggml (défaut : ~/Library/Caches/idem-whisper/ (macOS) ou ~/.cache/idem-whisper/,
 *                     fichier ggml-large-v3-turbo-q5_0.bin) ;
 *   WHISPER_THREADS   fils de calcul (défaut : cœurs − 1, 8 au plus).
 *
 * L'audio est d'abord extrait en WAV 16 kHz mono (le format de Whisper). La sortie JSON complète
 * donne les jetons et leurs instants : un jeton qui commence par une espace ouvre un mot, la
 * ponctuation se colle au mot d'avant. Avec `-dtw`, les instants viennent de l'alignement
 * (bien plus justes que ceux du décodage, qui débordent sur les silences).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../runtime/logger';
import type { MontageWord } from './montage.model';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

export const whisperBin = () => process.env.WHISPER_BIN || 'whisper-cli';
const MODEL_FILE = 'ggml-large-v3-turbo-q5_0.bin';
export const whisperModel = () =>
  process.env.WHISPER_MODEL || path.join(os.homedir(), ...(process.platform === 'darwin' ? ['Library', 'Caches'] : ['.cache']), 'idem-whisper', MODEL_FILE);

/** Le préréglage d'alignement (DTW) du modèle, déduit de son nom de fichier. */
function dtwPreset(model: string): string | null {
  const name = path.basename(model).toLowerCase();
  if (name.includes('large-v3-turbo')) return 'large.v3.turbo';
  if (name.includes('large-v3')) return 'large.v3';
  if (name.includes('large-v2')) return 'large.v2';
  for (const size of ['medium', 'small', 'base', 'tiny']) if (name.includes(`${size}.en`)) return `${size}.en`;
  for (const size of ['medium', 'small', 'base', 'tiny']) if (name.includes(size)) return size;
  return null;
}

/** Vrai quand le binaire et le modèle sont là : sinon la création est refusée avant tout débit. */
export function transcriptionAvailable(): boolean {
  if (!fs.existsSync(whisperModel())) return false;
  const bin = whisperBin();
  if (bin.includes('/')) return fs.existsSync(bin);
  return (process.env.PATH || '').split(path.delimiter).some((dir) => dir && fs.existsSync(path.join(dir, bin)));
}

function run(cmd: string, args: string[], onStderr?: (chunk: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => {
      const s = c.toString();
      err = (err + s).slice(-4000);
      onStderr?.(s);
    });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} ${code}: ${err.slice(-600)}`))));
  });
}

/** Les jetons spéciaux de Whisper (`[_BEG_]`, `[_TT_150]`, `[_SOT_]`…) ne sont pas du texte. */
const SPECIAL = /^\s*\[_[A-Z]+_?\d*\]\s*$|^\s*<\|.*\|>\s*$/;
/** Les annotations entre crochets ou parenthèses (« [Musique] », « (rires) ») ne sont pas des mots dits. */
const ANNOTATION = /^[[(].*[\])]$/;

interface WhisperToken {
  text: string;
  offsets?: { from: number; to: number };
  p?: number;
  t_dtw?: number;
}

/** Le DTW date un jeton un peu après son attaque (mesuré : 0,15 à 0,2 s). */
const DTW_LEAD = 0.15;
/** Durée plausible d'un mot dit : borne la fin quand un blanc suit (les fins de Whisper débordent). */
const spokenLength = (text: string) => Math.min(1.2, 0.15 + text.replace(/[^\p{L}\p{N}]/gu, '').length * 0.075);

/**
 * Les mots d'une sortie JSON complète de whisper.cpp (exporté pour les contrôles).
 *
 * Les instants du décodage (`offsets`) s'écrasent souvent en début de segment (quatre mots au même
 * centième) : quand l'alignement DTW est là, il fait foi ; sinon les mots écrasés sont répartis
 * selon leur longueur jusqu'au mot suivant. Dans tous les cas : début croissant, fin avant le mot
 * suivant et jamais plus longue qu'un mot dit (un blanc reste un blanc, et les coupes le voient).
 */
export function wordsFromWhisperJson(json: any): { words: MontageWord[]; language?: string } {
  const out: MontageWord[] = [];
  for (const segment of json?.transcription || []) {
    const segStart = (segment.offsets?.from ?? 0) / 1000;
    const segEnd = (segment.offsets?.to ?? 0) / 1000;
    const tokens: WhisperToken[] = (segment.tokens || []).filter((t: WhisperToken) => typeof t.text === 'string' && !SPECIAL.test(t.text));
    const words: { text: string; from: number; to: number; dtw: number | null; ps: number[] }[] = [];
    for (const token of tokens) {
      const text = token.text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const from = (token.offsets?.from ?? 0) / 1000;
      const to = (token.offsets?.to ?? 0) / 1000;
      const dtw = typeof token.t_dtw === 'number' && token.t_dtw >= 0 ? token.t_dtw / 100 : null;
      const last = words[words.length - 1];
      if (/^\s/.test(token.text) || !last) words.push({ text, from, to, dtw, ps: typeof token.p === 'number' ? [token.p] : [] });
      else {
        last.text += text;
        last.to = Math.max(last.to, to);
        if (typeof token.p === 'number') last.ps.push(token.p);
      }
    }
    const kept = words.filter((w) => !ANNOTATION.test(w.text) && /[\p{L}\p{N}]/u.test(w.text));
    if (!kept.length) continue;
    const aligned = kept.every((w) => w.dtw !== null);
    const lo = Math.max(segStart, out.length ? out[out.length - 1].start + 0.03 : 0);
    const hi = Math.max(lo + 0.05, segEnd);
    let starts = kept.map((w) => Math.min(hi, Math.max(lo, aligned ? w.dtw! - DTW_LEAD : w.from)));
    if (!aligned) {
      // Les mots écrasés au même instant : répartis selon leur longueur jusqu'au mot suivant.
      for (let i = 0; i < starts.length; ) {
        let j = i;
        while (j + 1 < starts.length && starts[j + 1] - starts[i] < 0.03) j++;
        if (j > i) {
          const anchor = j + 1 < starts.length ? starts[j + 1] : Math.max(hi, starts[i] + (j - i + 1) * 0.3);
          const weights = kept.slice(i, j + 1).map((w) => spokenLength(w.text));
          const total = weights.reduce((a, b) => a + b, 0);
          let at = starts[i];
          for (let k = i; k <= j; k++) {
            starts[k] = at;
            at += ((anchor - starts[i]) * weights[k - i]) / total;
          }
        }
        i = j + 1;
      }
    }
    starts = starts.reduce<number[]>((acc, t) => [...acc, acc.length ? Math.max(t, acc[acc.length - 1] + 0.03) : t], []);
    kept.forEach((w, i) => {
      const next = i + 1 < kept.length ? starts[i + 1] : hi;
      const end = Math.min(next, starts[i] + spokenLength(w.text), aligned ? hi : Math.max(w.to, starts[i] + 0.05));
      out.push({ text: w.text, start: round(starts[i]), end: round(Math.max(starts[i] + 0.04, end)), ...(w.ps.length ? { p: round(w.ps.reduce((a, b) => a + b, 0) / w.ps.length) } : {}) });
    });
  }
  return { words: out, language: json?.result?.language };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Transcrit un fichier audio ou vidéo. `onProgress` reçoit l'avancement (0–1) que Whisper annonce.
 * `language` : code ISO (`fr`, `en`…) ou `auto`.
 */
export async function transcribe(input: string, opts: { language?: string; onProgress?: (ratio: number) => void } = {}): Promise<{ words: MontageWord[]; language?: string }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-whisper-'));
  try {
    const wav = path.join(dir, 'audio.wav');
    await run(FFMPEG, ['-y', '-v', 'error', '-i', input, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
    const model = whisperModel();
    const threads = Number(process.env.WHISPER_THREADS) || Math.max(1, Math.min(8, os.cpus().length - 1));
    const base = path.join(dir, 'out');
    const dtw = dtwPreset(model);
    const args = ['-m', model, '-f', wav, '-l', opts.language || 'auto', '-t', String(threads), '-ojf', '-of', base, '-pp'];
    // L'alignement DTW n'est calculé que sans « flash attention » (sinon whisper.cpp l'ignore en silence).
    if (dtw) args.push('-nfa', '-dtw', dtw);
    const started = Date.now();
    await run(whisperBin(), args, (chunk) => {
      const m = /progress\s*=\s*(\d+)%/.exec(chunk);
      if (m) opts.onProgress?.(Math.min(1, Number(m[1]) / 100));
    });
    const json = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8'));
    const result = wordsFromWhisperJson(json);
    logger.info('montage.transcribed', { event: 'montage.transcribed', words: result.words.length, language: result.language, ms: Date.now() - started, dtw: !!dtw });
    return result;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
