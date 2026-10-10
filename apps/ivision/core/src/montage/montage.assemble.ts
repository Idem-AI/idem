/**
 * L'ASSEMBLAGE — plusieurs vidéos importées deviennent une seule prise, et des plans de coupe.
 *
 *   avec parole   (son présent et audible) : mises bout à bout dans l'ordre d'import, au cadre de
 *                 la première (les autres sont recadrées pour le remplir), 30 i/s, son 48 kHz ;
 *                 une seule vidéo est gardée telle quelle (aucune perte) ;
 *   sans parole   (pas de son, ou un son presque nul) : plans de coupe, réencodés pour la page
 *                 (WebM, sans son, 30 s au plus) ; le monteur les montre pendant que la personne parle.
 */
import { spawn } from 'child_process';
import path from 'path';
import { probe } from '../video/video.renderer';
import { transcodeClip } from '../video/video.media';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
/** En dessous, le son est un silence (ou un bruit de fond) : pas de parole à monter. */
const SPEECH_MEAN_DB = -50;

function ffmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => (err = (err + c.toString()).slice(-8000)));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg ${code}: ${err.slice(-600)}`))));
  });
}

/** Le niveau moyen du son (dB), ou null sans piste audio. */
export async function meanVolume(file: string): Promise<number | null> {
  const info = await probe(file);
  if (!info.hasAudio) return null;
  const log = await ffmpeg(['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).catch(() => '');
  const m = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(log);
  return m ? (m[1] === '-inf' ? -91 : Number(m[1])) : null;
}

export interface AssembledInputs {
  /** La prise de parole unique (null si aucune vidéo ne parle). */
  source: { file: string; durationSec: number; width: number; height: number } | null;
  clips: { file: string; poster: string; durationSec: number; width: number; height: number; index: number }[];
  /** Pour chaque vidéo importée : parle-t-elle ? */
  speech: boolean[];
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function assembleInputs(files: string[], outDir: string): Promise<AssembledInputs> {
  const infos = await Promise.all(files.map((f) => probe(f)));
  const volumes = await Promise.all(files.map((f) => meanVolume(f)));
  const speech = volumes.map((v) => v !== null && v > SPEECH_MEAN_DB);
  const talking = files.map((file, i) => ({ file, info: infos[i] })).filter((_, i) => speech[i]);
  let source: AssembledInputs['source'] = null;
  if (talking.length === 1) {
    const { file, info } = talking[0];
    source = { file, durationSec: info.duration, width: info.width, height: info.height };
  } else if (talking.length > 1) {
    // Le cadre de la première vidéo, borné à 1920 px de grand côté.
    const first = talking[0].info;
    const k = Math.min(1, 1920 / Math.max(first.width, first.height));
    const w = even(first.width * k);
    const h = even(first.height * k);
    const inputs = talking.flatMap((t) => ['-i', t.file]);
    const chains = talking.map(
      (_, i) =>
        `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v${i}];[${i}:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`
    );
    const concat = `${talking.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${talking.length}:v=1:a=1[v][a]`;
    const file = path.join(outDir, 'assembled.mp4');
    await ffmpeg(['-y', '-v', 'error', ...inputs, '-filter_complex', `${chains.join(';')};${concat}`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', file]);
    const info = await probe(file);
    source = { file, durationSec: info.duration, width: info.width, height: info.height };
  }
  const clips: AssembledInputs['clips'] = [];
  for (let i = 0; i < files.length; i++) {
    if (speech[i]) continue;
    const clip = await transcodeClip(files[i], path.join(outDir, `clip-${i}`), 30);
    clips.push({ file: clip.webm, poster: clip.poster, durationSec: clip.duration, width: clip.width, height: clip.height, index: i });
  }
  return { source, clips, speech };
}
