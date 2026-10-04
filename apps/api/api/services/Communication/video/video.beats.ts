/**
 * Analyse rythmique d'une piste : tempo, phase des temps forts, et l'extrait
 * le plus énergique.
 *
 * C'est ce qui fait « pro » : les changements de scène tombent SUR le temps.
 * Aucun modèle, aucune dépendance : ffmpeg décode en PCM mono, puis
 *  1. enveloppe d'énergie par fenêtres de ~23 ms ;
 *  2. force d'attaque = hausse de l'énergie logarithmique (redressée) ;
 *  3. tempo = autocorrélation de la force d'attaque entre 70 et 180 BPM,
 *     pondérée vers 120 BPM (préférence perceptive, évite les erreurs d'octave) ;
 *  4. phase = décalage qui aligne le mieux une grille régulière sur les attaques.
 */
import { spawn } from 'child_process';
import { VideoBeatGrid } from '../../../models/motionVideo.model';

const SAMPLE_RATE = 11025;
const HOP = 256; // ≈ 23 ms

export interface TrackAnalysis extends VideoBeatGrid {
  /** Énergie RMS par fenêtre (sert à choisir l'extrait). */
  energy: Float32Array;
  hopSec: number;
  durationSec: number;
}

/** Décode les `maxSec` premières secondes en PCM float mono. */
export function decodePcm(file: string, maxSec = 240): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-v', 'error', '-i', file, '-t', String(maxSec), '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', 'pipe:1',
    ]);
    const chunks: Buffer[] = [];
    let err = '';
    ff.stdout.on('data', (c: Buffer) => chunks.push(c));
    ff.stderr.on('data', (c: Buffer) => (err += c.toString()));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg decode failed (${code}): ${err.slice(0, 300)}`));
      const buf = Buffer.concat(chunks);
      const aligned = new Float32Array(buf.length / 4);
      for (let i = 0; i < aligned.length; i++) aligned[i] = buf.readFloatLE(i * 4);
      resolve(aligned);
    });
  });
}

export function analyzePcm(pcm: Float32Array, sampleRate = SAMPLE_RATE): TrackAnalysis {
  const hopSec = HOP / sampleRate;
  const frames = Math.max(1, Math.floor(pcm.length / HOP));
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const base = f * HOP;
    for (let i = 0; i < HOP; i++) {
      const v = pcm[base + i] || 0;
      sum += v * v;
    }
    energy[f] = Math.sqrt(sum / HOP);
  }

  // Force d'attaque : dérivée positive de l'énergie compressée.
  const onset = new Float32Array(frames);
  let prev = Math.log1p(1000 * energy[0]);
  for (let f = 1; f < frames; f++) {
    const cur = Math.log1p(1000 * energy[f]);
    onset[f] = Math.max(0, cur - prev);
    prev = cur;
  }
  // Retrait de la moyenne locale : on garde les attaques, pas le niveau.
  const win = 16;
  const detrended = new Float32Array(frames);
  let acc = 0;
  for (let f = 0; f < frames; f++) {
    acc += onset[f];
    if (f >= win) acc -= onset[f - win];
    const mean = acc / Math.min(f + 1, win);
    detrended[f] = Math.max(0, onset[f] - mean);
  }

  const minLag = Math.floor(60 / 180 / hopSec);
  const maxLag = Math.ceil(60 / 70 / hopSec);
  const acf = (lag: number): number => {
    let s = 0;
    for (let f = lag; f < frames; f++) s += detrended[f] * detrended[f - lag];
    return s / (frames - lag || 1);
  };
  const prior = (bpm: number) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 1.1, 2));

  // 1. Candidats grossiers : les pics de l'autocorrélation.
  const scores: number[] = [];
  let total = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    scores[lag] = acf(lag) + 0.5 * acf(lag * 2);
    total += scores[lag];
  }
  const peaks: number[] = [];
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (scores[lag] >= scores[lag - 1] && scores[lag] >= scores[lag + 1]) peaks.push(lag);
  }
  peaks.sort((a, b) => scores[b] - scores[a]);
  const candidates = new Set<number>();
  for (const lag of peaks.slice(0, 4)) {
    for (const k of [1, 2 / 3, 3 / 2, 1 / 2, 2]) {
      const c = lag * k;
      if (c >= minLag && c <= maxLag) candidates.add(c);
    }
  }
  if (!candidates.size) candidates.add((minLag + maxLag) / 2);

  // 2. Peigne : moyenne des attaques sur une grille régulière (période, phase).
  const comb = (period: number, phase: number): number => {
    let s = 0;
    let n = 0;
    for (let x = phase; x < frames - 1; x += period) {
      const i = Math.round(x);
      s += Math.max(detrended[i] || 0, 0.7 * (detrended[i - 1] || 0), 0.7 * (detrended[i + 1] || 0));
      n++;
    }
    return n ? s / n : 0;
  };
  const bestPhaseFor = (period: number): { phase: number; score: number } => {
    let phase = 0;
    let score = -Infinity;
    for (let ph = 0; ph < period; ph += 0.5) {
      const c = comb(period, ph);
      if (c > score) {
        score = c;
        phase = ph;
      }
    }
    return { phase, score };
  };

  // 3. Affinage fin (±2 %) : sur 30 s, 1 % d'erreur fait déjà 0,3 s de dérive.
  let bestPeriod = [...candidates][0];
  let bestPhase = 0;
  let bestScore = -Infinity;
  for (const c of candidates) {
    for (let k = -20; k <= 20; k++) {
      const period = c * (1 + k * 0.001);
      const { phase, score } = bestPhaseFor(period);
      const weighted = score * prior(60 / (period * hopSec));
      if (weighted > bestScore) {
        bestScore = weighted;
        bestPeriod = period;
        bestPhase = phase;
      }
    }
  }
  const period = bestPeriod * hopSec;
  const bpm = Math.round((60 / period) * 10) / 10;

  let meanOnset = 0;
  for (let f = 0; f < frames; f++) meanOnset += detrended[f];
  meanOnset /= frames;
  const confidence = Math.max(0, Math.min(1, meanOnset > 0 ? (bestScore / meanOnset - 1) / 4 : 0));
  void total;

  return {
    bpm,
    offset: Math.round(bestPhase * hopSec * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
    energy,
    hopSec,
    durationSec: pcm.length / sampleRate,
  };
}

export async function analyzeTrack(file: string): Promise<TrackAnalysis> {
  return analyzePcm(await decodePcm(file));
}

/**
 * Début d'extrait : la fenêtre de `durationSec` la plus énergique (on évite les
 * introductions calmes), recalée sur un temps fort.
 */
export function pickExcerptStart(analysis: TrackAnalysis, durationSec: number): number {
  const { energy, hopSec } = analysis;
  const win = Math.round(durationSec / hopSec);
  const usable = energy.length - win - Math.round(1.5 / hopSec);
  if (usable <= 0) return 0;
  // On ignore les 4 premières secondes (montée) quand la piste est assez longue.
  const startFrom = analysis.durationSec > durationSec + 12 ? Math.round(4 / hopSec) : 0;
  let sum = 0;
  for (let i = 0; i < win; i++) sum += energy[startFrom + i] || 0;
  let best = startFrom;
  let bestSum = sum;
  for (let s = startFrom + 1; s <= usable; s++) {
    sum += (energy[s + win - 1] || 0) - (energy[s - 1] || 0);
    if (sum > bestSum * 1.02) {
      bestSum = sum;
      best = s;
    }
  }
  const raw = best * hopSec;
  const period = 60 / analysis.bpm;
  // Recalage sur une mesure (4 temps) quand c'est possible.
  const bar = period * 4;
  const k = Math.max(0, Math.round((raw - analysis.offset) / bar));
  const snapped = analysis.offset + k * bar;
  return Math.max(0, Math.round(Math.min(snapped, analysis.durationSec - durationSec - 0.5) * 1000) / 1000);
}
