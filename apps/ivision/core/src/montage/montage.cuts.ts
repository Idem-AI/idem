/**
 * LES COUPES — ce qu'on garde de l'enregistrement, et la vidéo montée qui en sort.
 *
 * Les passages gardés viennent des mots : chacun garde un peu d'air autour de lui, deux mots
 * proches restent ensemble, un long blanc (ou une hésitation que Whisper n'a pas écrite : elle
 * apparaît comme un trou entre deux mots) disparaît. En mode `tight`, un FAUX DÉPART (« Alors
 * aujourd'hui je… Alors aujourd'hui je vais vous montrer ») perd sa première prise.
 *
 * Toutes les bornes sont posées sur la grille des images (1/30 s) et l'audio est découpé en
 * paquets d'une image (1 600 échantillons à 48 kHz) : le son et l'image gardent exactement la
 * même durée à chaque coupe, sans dérive même après cent coupes.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { CutMode, MontageRange, MontageWord } from './montage.model';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
export const MONTAGE_FPS = 30;

/** Les hésitations écrites (Whisper en laisse parfois) : jamais gardées. */
const FILLERS = /^(euh+|heu+|euhm+|hum+|hm+|mmh*|mh+|um+|uh+|uhm+|erm+|ehm+)[.,!?…]*$/i;

const norm = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');

/** Réglages par mode : air autour des mots, plus long blanc gardé. */
const SETTINGS: Record<Exclude<CutMode, 'none'>, { pad: number; join: number }> = {
  tight: { pad: 0.09, join: 0.22 },
  natural: { pad: 0.16, join: 0.7 },
};

/** Les mots à retirer : hésitations, et (mode `tight`) premières prises d'un faux départ. */
export function droppedWords(words: MontageWord[], mode: CutMode): Set<number> {
  const out = new Set<number>();
  if (mode === 'none') return out;
  words.forEach((w, i) => FILLERS.test(w.text.trim()) && out.add(i));
  if (mode !== 'tight') return out;
  // Les phrases dites d'un trait : coupées aux pauses de plus de 0,35 s.
  const runs: number[][] = [];
  let run: number[] = [];
  words.forEach((w, i) => {
    if (out.has(i)) return;
    const prev = run.length ? words[run[run.length - 1]] : null;
    if (prev && w.start - prev.end > 0.35) {
      runs.push(run);
      run = [];
    }
    run.push(i);
  });
  if (run.length) runs.push(run);
  for (let r = 0; r < runs.length - 1; r++) {
    const a = runs[r];
    const b = runs[r + 1];
    // Une reprise : la phrase suivante recommence par les mêmes mots (3, ou 2 quand la prise est courte).
    const k = Math.min(3, a.length, b.length);
    if (k < 2 || a.length > 14) continue;
    const same = Array.from({ length: k }, (_, j) => norm(words[a[j]].text) === norm(words[b[j]].text)).every(Boolean);
    const soon = words[b[0]].start - words[a[a.length - 1]].end < 3;
    if (same && soon && a.length <= b.length + 2) a.forEach((i) => out.add(i));
  }
  return out;
}

const grid = (t: number) => Math.round(t * MONTAGE_FPS) / MONTAGE_FPS;

/** Les passages gardés, sur la grille des images, et leur place dans la vidéo montée. */
export function keepRanges(words: MontageWord[], durationSec: number, mode: CutMode): { ranges: MontageRange[]; dropped: Set<number> } {
  const dropped = droppedWords(words, mode);
  if (mode === 'none' || !words.length) return { ranges: [{ start: 0, end: grid(durationSec), at: 0 }], dropped };
  const { pad, join } = SETTINGS[mode];
  const spans: { start: number; end: number }[] = [];
  words.forEach((w, i) => {
    if (dropped.has(i)) return;
    const start = Math.max(0, w.start - pad);
    const end = Math.min(durationSec, w.end + pad);
    const last = spans[spans.length - 1];
    if (last && start - last.end <= join) last.end = Math.max(last.end, end);
    else spans.push({ start, end });
  });
  const ranges: MontageRange[] = [];
  let at = 0;
  for (const s of spans) {
    const start = grid(s.start);
    const end = grid(s.end);
    if (end - start < 1 / MONTAGE_FPS) continue;
    ranges.push({ start, end, at: grid(at) });
    at += end - start;
  }
  return { ranges: ranges.length ? ranges : [{ start: 0, end: grid(durationSec), at: 0 }], dropped };
}

export const editedDuration = (ranges: MontageRange[]) => (ranges.length ? ranges[ranges.length - 1].at + ranges[ranges.length - 1].end - ranges[ranges.length - 1].start : 0);

/** Un instant de l'original dans la vidéo montée (null s'il a été coupé). */
export function mapTime(ranges: MontageRange[], t: number): number | null {
  for (const r of ranges) if (t >= r.start - 1e-6 && t <= r.end + 1e-6) return r.at + Math.min(r.end, Math.max(r.start, t)) - r.start;
  return null;
}

/** Les mots replacés dans le temps de la vidéo montée ; un mot coupé reçoit null. */
export function retimeWords(words: MontageWord[], ranges: MontageRange[], dropped: Set<number> = new Set()): ({ start: number; end: number } | null)[] {
  return words.map((w, i) => {
    if (dropped.has(i)) return null;
    // Un mot à cheval sur une coupe garde la partie gardée la plus longue.
    const start = mapTime(ranges, w.start) ?? mapTime(ranges, (w.start + w.end) / 2);
    if (start === null) return null;
    const end = mapTime(ranges, w.end) ?? start + Math.min(0.6, w.end - w.start);
    return { start, end: Math.max(start + 0.04, end) };
  });
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => (err = (err + c.toString()).slice(-4000)));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(-600)}`))));
  });
}

/**
 * La vidéo montée : passages gardés, recadrée au format (le visage est le plus souvent dans le
 * haut du cadre : le recadrage vertical garde le tiers supérieur), 30 i/s. WebM VP9 + Opus, une
 * image clé toutes les 15 images : l'aperçu la lit, le rendu s'y positionne image par image.
 */
export async function cutVideo(opts: { input: string; ranges: MontageRange[]; width: number; height: number; hasAudio: boolean; outDir: string }): Promise<{ file: string; poster: string }> {
  const { input, ranges, width, height, outDir } = opts;
  const half = 0.5 / MONTAGE_FPS;
  const keep = ranges.map((r) => `gte(t,${(r.start - half).toFixed(4)})*lt(t,${(r.end - half).toFixed(4)})`).join('+') || '1';
  const filters = [
    `[0:v]setpts=PTS-STARTPTS,fps=${MONTAGE_FPS},select='${keep}',setpts=N/${MONTAGE_FPS}/TB,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}:(iw-ow)/2:(ih-oh)*0.35,setsar=1,format=yuv420p[v]`,
  ];
  if (opts.hasAudio) filters.push(`[0:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,asetnsamples=n=${48000 / MONTAGE_FPS}:p=1,aselect='${keep}',asetpts=N/SR/TB[a]`);
  fs.mkdirSync(outDir, { recursive: true });
  const script = path.join(outDir, 'cuts.filter');
  fs.writeFileSync(script, filters.join(';\n'));
  const file = path.join(outDir, 'edit.webm');
  await run([
    '-y', '-v', 'error', '-i', input, '-filter_complex_script', script,
    '-map', '[v]', ...(opts.hasAudio ? ['-map', '[a]', '-c:a', 'libopus', '-b:a', '128k'] : ['-an']),
    '-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '6', '-row-mt', '1', '-crf', '30', '-b:v', '0', '-g', process.env.MONTAGE_KEYINT || '15', file,
  ]);
  const poster = path.join(outDir, 'poster.jpg');
  await run(['-y', '-v', 'error', '-ss', '0.8', '-i', file, '-frames:v', '1', '-q:v', '3', poster]).catch(() => run(['-y', '-v', 'error', '-i', file, '-frames:v', '1', '-q:v', '3', poster]));
  return { file, poster };
}
