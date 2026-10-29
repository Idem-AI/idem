/**
 * L'ALIGNEMENT MOT À MOT DE LA VOIX — l'instant de chaque mot dit (sous-titres mot par mot, textes qui apparaissent
 * avec la voix).
 *
 *   1. le fournisseur de voix, s'il donne ses horodatages (`words` dans la réponse de l'hôte) ;
 *   2. un service d'alignement SÉPARÉ et non modifié (aeneas, AGPL-3.0, sans réseau de neurones) : `IDEM_ALIGN_URL`
 *      (POST multipart `audio` + `text`, réponse au format « sync map » JSON d'aeneas) — il reste hors du code d'IDEM ;
 *   3. sinon une estimation : les pauses réelles de la prise (ffmpeg `silencedetect`) découpent la ligne en segments de
 *      parole, les mots s'y répartissent au prorata de leurs syllabes.
 */
import axios from 'axios';
import fs from 'fs';
import { spawn } from 'child_process';
import logger from '../../runtime/logger';

export interface WordTime {
  text: string;
  /** Secondes depuis le début de la ligne. */
  start: number;
  end: number;
}

const syllables = (w: string) => Math.max(1, (w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[aeiouy]+/g) || []).length);

function speechSegments(file: string, duration: number): Promise<{ start: number; end: number }[]> {
  return new Promise((resolve) => {
    const ff = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-38dB:d=0.08', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let log = '';
    ff.stderr.on('data', (c) => (log += c.toString()));
    ff.on('error', () => resolve([{ start: 0, end: duration }]));
    ff.on('close', () => {
      const silences: { start: number; end: number }[] = [];
      let s: number | null = null;
      for (const m of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
        if (m[1] === 'start') s = Math.max(0, Number(m[2]));
        else if (s !== null) {
          silences.push({ start: s, end: Number(m[2]) });
          s = null;
        }
      }
      const speech: { start: number; end: number }[] = [];
      let t = 0;
      for (const sil of silences) {
        if (sil.start - t > 0.05) speech.push({ start: t, end: sil.start });
        t = sil.end;
      }
      if (duration - t > 0.05) speech.push({ start: t, end: duration });
      resolve(speech.length ? speech : [{ start: 0, end: duration }]);
    });
  });
}

/** L'estimation : les mots répartis dans les segments de parole, au prorata des syllabes. */
export async function estimateWords(text: string, file: string, duration: number): Promise<WordTime[]> {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const segments = await speechSegments(file, duration);
  const speech = segments.reduce((a, s) => a + (s.end - s.start), 0) || duration;
  const total = words.reduce((a, w) => a + syllables(w), 0);
  // On parcourt la parole comme une seule bande continue, puis on la replace dans ses segments.
  const place = (x: number) => {
    let left = x;
    for (const s of segments) {
      const len = s.end - s.start;
      if (left <= len) return s.start + left;
      left -= len;
    }
    return duration;
  };
  let acc = 0;
  return words.map((w) => {
    const a = (acc / total) * speech;
    acc += syllables(w);
    const b = (acc / total) * speech;
    return { text: w, start: Math.round(place(a) * 1000) / 1000, end: Math.round(place(b) * 1000) / 1000 };
  });
}

/** Le service d'alignement (aeneas), s'il est configuré ; sinon null. */
async function alignService(text: string, file: string): Promise<WordTime[] | null> {
  const url = process.env.IDEM_ALIGN_URL?.trim();
  if (!url) return null;
  try {
    const form = new FormData();
    form.append('text', String(text).split(/\s+/).filter(Boolean).join('\n'));
    form.append('audio', new Blob([fs.readFileSync(file)]), 'line.mp3');
    const res = await axios.post(url, form, { timeout: 30000 });
    const fragments = (res.data?.fragments || []) as { begin: string; end: string; lines: string[] }[];
    const out = fragments.map((f) => ({ text: (f.lines || []).join(' '), start: Number(f.begin), end: Number(f.end) })).filter((w) => w.text && Number.isFinite(w.start));
    return out.length ? out : null;
  } catch (error) {
    logger.warn('video.align_failed', { error: (error as Error)?.message });
    return null;
  }
}

/** L'instant de chaque mot d'une ligne dite. */
export async function alignWords(text: string, file: string, duration: number, provided?: WordTime[]): Promise<WordTime[]> {
  if (provided?.length) return provided;
  return (await alignService(text, file)) || (await estimateWords(text, file, duration));
}
