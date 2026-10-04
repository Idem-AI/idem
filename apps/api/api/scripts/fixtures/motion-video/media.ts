/**
 * Médias de test, FABRIQUÉS sur place (aucun téléchargement, aucun droit à
 * vérifier) :
 *  - des « photos » de produit dessinées en SVG puis rendues en JPEG ;
 *  - des pistes musicales synthétiques à tempo CONNU (accords, grosse caisse,
 *    charleston), avec une introduction calme : l'analyse doit retrouver le
 *    tempo et l'extrait doit sauter l'introduction.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { MusicTrack } from '../../../models/motionVideo.model';

const PHOTOS: Record<string, string> = {
  'pagne-1': `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500"><rect width="1200" height="1500" fill="#f4e7d3"/>${Array.from({ length: 6 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<g transform="translate(${c * 240 + 120} ${r * 250 + 125})"><circle r="95" fill="#c2410c"/><circle r="62" fill="#facc15"/><path d="M-40 0 L0 -40 L40 0 L0 40Z" fill="#1e3a5f"/></g>`).join('')).join('')}</svg>`,
  'pagne-2': `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1200"><rect width="1500" height="1200" fill="#1e3a5f"/>${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${i * 110} Q375 ${i * 110 - 80} 750 ${i * 110} T1500 ${i * 110}" stroke="${i % 2 ? '#facc15' : '#fb7185'}" stroke-width="34" fill="none"/>`).join('')}</svg>`,
  'pagne-3': `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="#facc15"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 150}" y="0" width="70" height="1200" fill="#c2410c" opacity="${0.4 + (i % 3) * 0.2}"/>`).join('')}<circle cx="600" cy="600" r="300" fill="#1e3a5f"/><circle cx="600" cy="600" r="180" fill="#fffaf3"/></svg>`,
  'bottle-1': `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde2e7"/><stop offset="1" stop-color="#fbcfe8"/></linearGradient></defs><rect width="1200" height="1200" fill="url(#g)"/><ellipse cx="600" cy="1050" rx="260" ry="40" fill="#e9a8b8"/><path d="M530 220 h140 v120 q90 60 90 180 v480 q0 50 -50 50 h-220 q-50 0 -50 -50 v-480 q0 -120 90 -180z" fill="#9f1239"/><rect x="545" y="170" width="110" height="70" rx="12" fill="#065f46"/><rect x="480" y="600" width="240" height="200" rx="20" fill="#fff7f9"/><circle cx="600" cy="700" r="60" fill="#fb923c"/></svg>`,
  'bottle-2': `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="#065f46"/>${Array.from({ length: 3 }, (_, i) => `<g transform="translate(${260 + i * 340} 0)"><path d="M-55 300 h110 v90 q70 50 70 140 v380 q0 40 -40 40 h-170 q-40 0 -40 -40 v-380 q0 -90 70 -140z" fill="${['#9f1239', '#fb923c', '#be123c'][i]}"/></g>`).join('')}</svg>`,
  'dish-1': `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200"><rect width="1200" height="1200" fill="#78350f"/><circle cx="600" cy="600" r="420" fill="#fefce8"/><circle cx="600" cy="600" r="330" fill="#f59e0b"/>${Array.from({ length: 14 }, (_, i) => `<circle cx="${600 + Math.cos(i) * 200}" cy="${600 + Math.sin(i * 1.7) * 200}" r="${40 + (i % 3) * 12}" fill="${i % 2 ? '#15803d' : '#b45309'}"/>`).join('')}</svg>`,
};

/** Écrit les photos en JPEG dans `dir` ; renvoie { nom → chemin }. */
export async function makePhotos(dir: string): Promise<Record<string, string>> {
  fs.mkdirSync(dir, { recursive: true });
  const out: Record<string, string> = {};
  for (const [name, svg] of Object.entries(PHOTOS)) {
    const file = path.join(dir, `${name}.jpg`);
    if (!fs.existsSync(file)) await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(file);
    out[name] = file;
  }
  return out;
}

interface SynthSpec {
  id: string;
  bpm: number;
  moods: string[];
  /** Fréquences de la progression d'accords (Hz, fondamentales). */
  roots: number[];
  seconds: number;
  title: string;
}

export const SYNTH_TRACKS: SynthSpec[] = [
  { id: 'synth-afro-104', bpm: 104, moods: ['afro', 'afrobeat', 'upbeat'], roots: [220, 196, 174.6, 196], seconds: 75, title: 'Lagune' },
  { id: 'synth-upbeat-122', bpm: 122, moods: ['upbeat', 'happy', 'energetic'], roots: [261.6, 220, 174.6, 196], seconds: 80, title: 'Marché du matin' },
  { id: 'synth-calm-84', bpm: 84, moods: ['calm', 'chill', 'acoustic'], roots: [196, 164.8, 174.6, 130.8], seconds: 70, title: 'Harmattan' },
  { id: 'synth-corporate-112', bpm: 112, moods: ['corporate', 'motivational', 'positive'], roots: [246.9, 196, 220, 185], seconds: 75, title: 'Plateau' },
  { id: 'synth-epic-96', bpm: 96, moods: ['epic', 'cinematic', 'inspiring'], roots: [146.8, 116.5, 130.8, 110], seconds: 80, title: 'Savane' },
];

/**
 * Piste synthétique : 8 s d'introduction calme (nappe seule), puis le groove.
 * Expression évaluée par ffmpeg (`aevalsrc`) — aucun échantillon externe.
 */
function synthExpression(spec: SynthSpec): string {
  const beat = 60 / spec.bpm;
  const bar = beat * 4;
  const chord = spec.roots
    .map((f, i) => {
      const on = `between(mod(t,${(bar * spec.roots.length).toFixed(4)}),${(i * bar).toFixed(4)},${((i + 1) * bar).toFixed(4)})`;
      return `${on}*(sin(2*PI*${f}*t)+0.6*sin(2*PI*${(f * 1.26).toFixed(2)}*t)+0.5*sin(2*PI*${(f * 1.5).toFixed(2)}*t))`;
    })
    .join('+');
  const groove = `gte(t,8)`;
  const kick = `${groove}*0.9*sin(2*PI*(50+90*exp(-25*mod(t,${beat.toFixed(5)})))*t)*exp(-14*mod(t,${beat.toFixed(5)}))`;
  const hat = `${groove}*0.18*(random(0)*2-1)*exp(-70*mod(t+${(beat / 2).toFixed(5)},${beat.toFixed(5)}))`;
  return `0.07*(${chord})+${kick}+${hat}`;
}

/** Fabrique les pistes en MP3 et renvoie leurs fiches de catalogue (`local`). */
export function makeMusic(dir: string): MusicTrack[] {
  fs.mkdirSync(dir, { recursive: true });
  return SYNTH_TRACKS.map((spec) => {
    const file = path.join(dir, `${spec.id}.mp3`);
    if (!fs.existsSync(file)) {
      const res = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-v', 'error', '-y', '-f', 'lavfi',
        '-i', `aevalsrc='${synthExpression(spec)}':s=44100:d=${spec.seconds}`,
        '-af', 'volume=0.6',
        '-c:a', 'libmp3lame', '-q:a', '4', file,
      ]);
      if (res.status !== 0) throw new Error(`ffmpeg synth failed: ${res.stderr?.toString().slice(0, 400)}`);
    }
    return {
      id: `local:${spec.id}`,
      provider: 'local',
      title: spec.title,
      artist: 'IDEM (piste de test)',
      url: file,
      durationSec: spec.seconds,
      license: 'cc0',
      attribution: `« ${spec.title} » — piste de test IDEM, CC0`,
      moods: spec.moods,
      bpm: spec.bpm,
    } as MusicTrack;
  });
}
