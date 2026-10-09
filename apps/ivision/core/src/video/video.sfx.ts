/**
 * EFFETS SONORES — la sonothèque des vidéos motion design.
 *
 * Un motion design professionnel se reconnaît aussi à l'oreille : un « whoosh »
 * sur chaque transition, un « pop » quand un prix apparaît, un clic discret quand
 * un titre se pose, un scintillement sur le logo. Ces moments (« cues ») sont
 * posés par le moteur d'animation lui-même (moteur React, `video-engine/src`), à l'image près :
 * le son ne peut pas tomber à côté du mouvement.
 *
 * SOURCES (licence CC0 uniquement : aucun crédit à afficher dans la vidéo)
 *   1. catalogue maison        `VIDEO_SFX_CATALOG` (JSON) — sons choisis à la main
 *   2. Freesound via Openverse sans clé — des milliers de bruitages CC0
 *   3. Freesound (API directe) `FREESOUND_API_KEY` — tri par note des utilisateurs
 *   4. synthèse ffmpeg          toujours disponible : le repli hors ligne
 *
 * TRAITEMENT (ce qui rend un son de banque « propre ») : silence retiré au début
 * et à la fin, coupe à la durée utile, fondu de sortie, crête normalisée à
 * −3 dBFS, passe-haut à 40 Hz, 48 kHz stéréo. Les candidats hors gabarit
 * (trop longs, trop faibles) sont écartés.
 *
 * La sonothèque est construite une fois puis gardée sur disque
 * (`VIDEO_SFX_DIR`, sinon le dossier temporaire) : `npm run video:sfx` la
 * pré-construit en production.
 */
import axios from 'axios';
import { spawn, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../runtime/logger';
import { MotionStyle, SFX_KINDS, SfxKind, SfxSound } from './video.model';
import { rng } from './video.music';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

interface KindSpec {
  queries: string[];
  /** Durée utile après nettoyage, en secondes. */
  min: number;
  max: number;
  ideal: number;
  /** Mots qui disqualifient un résultat (voix, musique, bruitage hors sujet). */
  exclude: RegExp;
  /** Le titre doit contenir l'un de ces mots : le résultat dit bien ce qu'il est. */
  keywords: RegExp;
}

const COMMON_EXCLUDE = /\b(voice|vocal|speech|talk|scream|music loop|song|ambience|ambient|field recording|nature|rain|birds|crowd|horror|scary|creepy|fart|burp|cough|mouth|lips|spit)\b/i;

export const SFX_SPECS: Record<SfxKind, KindSpec> = {
  whoosh: { queries: ['whoosh', 'swoosh transition', 'swish'], min: 0.25, max: 1.6, ideal: 0.7, exclude: /\b(sword|punch|kick|wind loop)\b/i, keywords: /whoosh|swoosh|swish|swipe|woosh/i },
  softwhoosh: { queries: ['soft whoosh', 'air whoosh', 'gentle swoosh'], min: 0.3, max: 1.8, ideal: 0.9, exclude: /\b(sword|punch|heavy)\b/i, keywords: /whoosh|swoosh|swish|woosh|air/i },
  pop: { queries: ['pop', 'bubble pop', 'ui pop'], min: 0.05, max: 0.6, ideal: 0.2, exclude: /\b(popcorn|balloon burst|gun|cork)\b/i, keywords: /\bpop|bubble|blip/i },
  click: { queries: ['ui click', 'soft click', 'interface tap'], min: 0.02, max: 0.35, ideal: 0.08, exclude: /\b(mouse wheel|keyboard typing|camera|pen)\b/i, keywords: /click|tap|button|select|ui/i },
  tick: { queries: ['tick', 'ui tick', 'clock tick'], min: 0.02, max: 0.25, ideal: 0.06, exclude: /\b(loop|ticking loop|metronome)\b/i, keywords: /tick|click/i },
  impact: { queries: ['cinematic impact', 'impact hit', 'deep hit'], min: 0.3, max: 2.4, ideal: 1.2, exclude: /\b(glass|car crash|explosion|gun|metal|door|wood|kick)\b/i, keywords: /impact|hit|boom|thud|thump/i },
  shimmer: { queries: ['shimmer', 'sparkle chime', 'magic chime'], min: 0.6, max: 3.2, ideal: 1.6, exclude: /\b(loop|jump|game over|vox|voice)\b/i, keywords: /shimmer|sparkl|twinkl|chime|glimmer|gleam|glitter|magic|shine/i },
  riser: { queries: ['riser', 'swell transition', 'reverse cymbal'], min: 0.9, max: 3.5, ideal: 2, exclude: /\b(loop|siren|alarm)\b/i, keywords: /riser|rise|rising|swell|reverse|build ?up|uplifter/i },
};

/** Niveau de chaque moment sonore dans le mixage (dB) : discret, jamais criard. */
export const SFX_GAIN_DB: Record<SfxKind, number> = {
  whoosh: -9,
  softwhoosh: -13,
  pop: -11,
  click: -17,
  tick: -19,
  impact: -8,
  shimmer: -11,
  riser: -12,
};

/** Densité par langage de mouvement : un style élégant ne cliquette pas. */
export const SFX_DENSITY: Record<MotionStyle, Partial<Record<SfxKind, number>>> = {
  energetic: {},
  playful: {},
  corporate: { click: -4, tick: -4 },
  // Premium : plus bas, jamais muet (un film élégant a quand même son design sonore).
  premium: { click: -8, tick: -8, pop: -6, whoosh: -3 },
};

export interface LibrarySound extends SfxSound {
  /** Fichier traité, sur disque. */
  file: string;
  /** Score de sélection (plus haut = meilleur). */
  score: number;
}

export interface SfxLibrary {
  builtAt: string;
  sounds: Record<SfxKind, LibrarySound[]>;
}

export const sfxDir = (): string => process.env.VIDEO_SFX_DIR || path.join(os.tmpdir(), 'idem-video-sfx');

// ─── Traitement ─────────────────────────────────────────────────────────────

function ffmpegRun(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ff = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (c) => (err += c.toString()));
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg ${code}: ${err.slice(-400)}`))));
  });
}

/** Durée et crête d'un fichier (après traitement). */
async function measure(file: string): Promise<{ duration: number; peakDb: number; meanDb: number }> {
  const log = await ffmpegRun(['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const duration = (() => {
    const m = log.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
  })();
  const peak = Number(log.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? -99);
  const mean = Number(log.match(/mean_volume: (-?[\d.]+) dB/)?.[1] ?? -99);
  return { duration, peakDb: peak, meanDb: mean };
}

/**
 * Nettoie un son de banque : silences retirés, coupé à la durée utile, fondu
 * de sortie, passe-haut, crête normalisée à −3 dBFS, MP3 48 kHz stéréo.
 */
export async function processSound(input: string, output: string, spec: KindSpec): Promise<{ duration: number; meanDb: number }> {
  const trimmed = `${output}.trim.wav`;
  await ffmpegRun([
    '-y', '-v', 'error', '-i', input,
    '-af',
    [
      'highpass=f=40',
      'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.01',
      'areverse',
      'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02',
      'areverse',
      `atrim=0:${spec.max}`,
    ].join(','),
    '-ar', '48000', '-ac', '2', trimmed,
  ]);
  const m = await measure(trimmed);
  const gain = Math.min(24, -3 - m.peakDb);
  const fade = Math.min(0.25, m.duration * 0.3);
  await ffmpegRun([
    '-y', '-v', 'error', '-i', trimmed,
    '-af', `volume=${gain.toFixed(2)}dB,afade=t=in:d=0.004,afade=t=out:st=${Math.max(0, m.duration - fade).toFixed(3)}:d=${fade.toFixed(3)}`,
    '-ar', '48000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', output,
  ]);
  fs.rmSync(trimmed, { force: true });
  const out = await measure(output);
  return { duration: out.duration, meanDb: out.meanDb };
}

// ─── Synthèse (repli toujours disponible) ───────────────────────────────────

/** Expressions ffmpeg des sons de synthèse — sobres, sans clic, crête maîtrisée. */
const SYNTH: Record<SfxKind, { d: number; expr: string; af?: string }> = {
  whoosh: { d: 0.8, expr: '(random(0)*2-1)*sin(PI*t/0.8)^2', af: 'bandpass=f=1400:width_type=o:w=2.2,volume=6dB' },
  softwhoosh: { d: 1.0, expr: '(random(0)*2-1)*sin(PI*t/1.0)^3', af: 'lowpass=f=1800,highpass=f=300,volume=4dB' },
  pop: { d: 0.18, expr: 'sin(2*PI*(900-3200*t)*t)*exp(-26*t)' },
  click: { d: 0.06, expr: '(sin(2*PI*2400*t)+0.5*(random(0)*2-1))*exp(-90*t)' },
  tick: { d: 0.05, expr: 'sin(2*PI*3200*t)*exp(-120*t)' },
  impact: { d: 1.3, expr: 'sin(2*PI*(55+70*exp(-9*t))*t)*exp(-3.2*t)+0.35*(random(0)*2-1)*exp(-18*t)', af: 'lowpass=f=2600' },
  shimmer: {
    d: 1.8,
    expr: '(sin(2*PI*1568*t)+0.7*sin(2*PI*2093*t)+0.5*sin(2*PI*2637*t)+0.35*sin(2*PI*3136*t))*(1-exp(-30*t))*exp(-1.9*t)*(0.75+0.25*sin(2*PI*9*t))',
  },
  riser: { d: 2.0, expr: '(random(0)*2-1)*(t/2.0)^2', af: 'highpass=f=500,lowpass=f=6000,volume=5dB' },
};

export async function synthSound(kind: SfxKind, dir: string): Promise<LibrarySound> {
  const s = SYNTH[kind];
  fs.mkdirSync(dir, { recursive: true });
  const raw = path.join(dir, `synth-${kind}.raw.wav`);
  const file = path.join(dir, `synth-${kind}.mp3`);
  if (!fs.existsSync(file)) {
    await ffmpegRun(['-y', '-v', 'error', '-f', 'lavfi', '-i', `aevalsrc='${s.expr}':s=48000:d=${s.d}`, ...(s.af ? ['-af', s.af] : []), '-ac', '2', raw]);
    await processSound(raw, file, { ...SFX_SPECS[kind], max: s.d + 0.05 });
    fs.rmSync(raw, { force: true });
  }
  return {
    id: `synth:${kind}`,
    kind,
    title: `${kind} (synthèse IDEM)`,
    author: 'IDEM',
    license: 'generated',
    durationSec: s.d,
    file,
    score: 0,
  };
}

// ─── Banques ────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  title: string;
  author: string;
  url: string;
  sourceUrl?: string;
  durationSec: number;
  rating?: number;
}

async function searchOpenverse(query: string): Promise<Candidate[]> {
  const res = await axios.get('https://api.openverse.org/v1/audio/', {
    params: { q: query, license: 'cc0', source: 'freesound', page_size: 20, mature: false },
    headers: process.env.OPENVERSE_TOKEN ? { Authorization: `Bearer ${process.env.OPENVERSE_TOKEN}` } : {},
    timeout: 8000,
  });
  return (res.data?.results || [])
    .filter((r: any) => r.url && r.license === 'cc0')
    .map((r: any) => ({
      id: `openverse:${r.id}`,
      title: r.title || 'sans titre',
      author: r.creator || 'inconnu',
      url: r.url,
      sourceUrl: r.foreign_landing_url,
      durationSec: (r.duration || 0) / 1000,
    }));
}

async function searchFreesound(query: string, spec: KindSpec): Promise<Candidate[]> {
  if (!process.env.FREESOUND_API_KEY) return [];
  const res = await axios.get('https://freesound.org/apiv2/search/text/', {
    params: {
      query,
      filter: `license:"Creative Commons 0" duration:[${spec.min} TO ${spec.max * 3}]`,
      fields: 'id,name,username,duration,previews,url,avg_rating,num_ratings',
      sort: 'rating_desc',
      page_size: 15,
      token: process.env.FREESOUND_API_KEY,
    },
    timeout: 8000,
  });
  return (res.data?.results || []).map((r: any) => ({
    id: `freesound:${r.id}`,
    title: r.name,
    author: r.username,
    url: r.previews?.['preview-hq-mp3'],
    sourceUrl: r.url,
    durationSec: Number(r.duration) || 0,
    rating: Number(r.avg_rating) || undefined,
  }));
}

function loadCatalog(): Partial<Record<SfxKind, Candidate[]>> {
  const source = process.env.VIDEO_SFX_CATALOG;
  if (!source || !fs.existsSync(source)) return {};
  try {
    return JSON.parse(fs.readFileSync(source, 'utf8'));
  } catch (error: any) {
    logger.warn('video.sfx.catalog_failed', { error: error.message });
    return {};
  }
}

function scoreCandidate(c: Candidate, spec: KindSpec, kind: SfxKind, processed: { duration: number; meanDb: number }): number {
  const fit = 1 - Math.min(1, Math.abs(processed.duration - spec.ideal) / spec.ideal);
  const title = c.title.toLowerCase();
  const match = spec.queries.some((q) => title.includes(q.split(' ')[0])) ? 0.4 : 0;
  const level = processed.meanDb > -35 ? 0.2 : 0; // un son trop faible reste noyé après normalisation
  const rating = c.rating ? (c.rating - 3) * 0.15 : 0;
  const catalog = c.id.startsWith('catalog:') ? 1 : 0;
  return Math.round((fit + match + level + rating + catalog) * 100) / 100 + (kind === 'tick' && processed.duration < 0.12 ? 0.2 : 0);
}

const MAX_PER_KIND = 5;

/** Construit (ou relit) la sonothèque. Une banque en panne n'empêche rien. */
export async function ensureSfxLibrary(opts: { offline?: boolean; force?: boolean } = {}): Promise<SfxLibrary> {
  const dir = sfxDir();
  const manifest = path.join(dir, 'library.json');
  if (!opts.force && fs.existsSync(manifest)) {
    try {
      const lib = JSON.parse(fs.readFileSync(manifest, 'utf8')) as SfxLibrary;
      const ok = SFX_KINDS.every((k) => (lib.sounds[k] || []).every((s) => fs.existsSync(s.file)));
      if (ok) return lib;
    } catch {
      /* reconstruit */
    }
  }
  fs.mkdirSync(path.join(dir, 'raw'), { recursive: true });
  const catalog = loadCatalog();
  const sounds = {} as Record<SfxKind, LibrarySound[]>;

  for (const kind of SFX_KINDS) {
    const spec = SFX_SPECS[kind];
    const list: LibrarySound[] = [];
    if (!opts.offline) {
      const found: Candidate[] = [...(catalog[kind] || []).map((c) => ({ ...c, id: `catalog:${c.id}` }))];
      for (const query of spec.queries) {
        const [ov, fsd] = await Promise.all([
          searchOpenverse(query).catch((e) => (logger.warn('video.sfx.openverse_failed', { query, error: e.message }), [])),
          searchFreesound(query, spec).catch(() => []),
        ]);
        found.push(...fsd, ...ov);
      }
      const seen = new Set<string>();
      const candidates = found.filter((c) => {
        const titleKey = c.title.toLowerCase().replace(/[^a-z]/g, '').replace(/\d+$/, '');
        if (!c.url || seen.has(c.id) || seen.has(titleKey)) return false;
        seen.add(c.id);
        seen.add(titleKey);
        if (COMMON_EXCLUDE.test(c.title) || spec.exclude.test(c.title)) return false;
        if (!c.id.startsWith('catalog:') && !spec.keywords.test(c.title)) return false;
        // Durée brute : un peu plus longue que la cible (les silences seront retirés).
        return c.durationSec === 0 || (c.durationSec >= spec.min && c.durationSec <= spec.max * 4);
      });
      // Téléchargements et traitements en parallèle (4 à la fois).
      const queue = candidates.slice(0, 12);
      const worker = async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          const key = crypto.createHash('sha1').update(c.id).digest('hex').slice(0, 12);
          const raw = path.join(dir, 'raw', `${key}.src`);
          const file = path.join(dir, `${kind}-${key}.mp3`);
          try {
            if (!fs.existsSync(raw)) {
              const res = await axios.get(c.url, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: 8 * 1024 * 1024 });
              fs.writeFileSync(raw, Buffer.from(res.data));
            }
            const processed = await processSound(raw, file, spec);
            if (processed.duration < spec.min || processed.duration > spec.max + 0.05) continue;
            list.push({
              id: c.id,
              kind,
              title: c.title,
              author: c.author,
              license: 'cc0',
              sourceUrl: c.sourceUrl,
              durationSec: Math.round(processed.duration * 1000) / 1000,
              file,
              score: scoreCandidate(c, spec, kind, processed),
            });
          } catch (error: any) {
            logger.warn('video.sfx.candidate_failed', { kind, id: c.id, error: error.message });
          }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }
    list.sort((a, b) => b.score - a.score);
    sounds[kind] = list.slice(0, MAX_PER_KIND);
    if (!sounds[kind].length) sounds[kind] = [await synthSound(kind, dir)];
  }

  const lib: SfxLibrary = { builtAt: new Date().toISOString(), sounds };
  fs.writeFileSync(manifest, JSON.stringify(lib, null, 1));
  return lib;
}

let libraryPromise: Promise<SfxLibrary> | null = null;

/** Sonothèque partagée par le processus (construite à la première vidéo). */
export function sfxLibrary(): Promise<SfxLibrary> {
  // VIDEO_SFX_OFFLINE=1 : sons de synthèse seulement (contrôles hors ligne, CI).
  if (process.env.VIDEO_SFX_OFFLINE === '1') {
    libraryPromise ??= ensureSfxLibrary({ offline: true });
    return libraryPromise;
  }
  libraryPromise ??= ensureSfxLibrary().catch(async (error) => {
    logger.warn('video.sfx.library_failed', { error: error.message });
    libraryPromise = null;
    return ensureSfxLibrary({ offline: true });
  });
  return libraryPromise;
}

/** Un son par moment sonore, tiré par la graine parmi les meilleurs. */
export function pickSounds(lib: SfxLibrary, seed: number): Record<SfxKind, LibrarySound> {
  const r = rng(seed ^ 0x51f15e);
  const out = {} as Record<SfxKind, LibrarySound>;
  for (const kind of SFX_KINDS) {
    const pool = (lib.sounds[kind] || []).slice(0, 3);
    if (pool.length) out[kind] = pool[Math.floor(r() * pool.length)];
  }
  return out;
}

/** Retrouve le fichier d'un son retenu (rendu, aperçu). */
export async function soundFile(sound: SfxSound): Promise<string | null> {
  const lib = await sfxLibrary();
  const found = (lib.sounds[sound.kind] || []).find((s) => s.id === sound.id);
  if (found && fs.existsSync(found.file)) return found.file;
  // La sonothèque a changé depuis : le meilleur son du même moment sonore.
  const fallback = lib.sounds[sound.kind]?.[0];
  return fallback && fs.existsSync(fallback.file) ? fallback.file : null;
}

/** Nom de fichier public d'un son (servi sans authentification : sons CC0). */
export function publicSoundName(file: string): string {
  return path.basename(file);
}

export function resolvePublicSound(name: string): string | null {
  if (!/^[a-z]+-[a-f0-9]{12}\.mp3$|^synth-[a-z]+\.mp3$/.test(name)) return null;
  const file = path.join(sfxDir(), name);
  return fs.existsSync(file) ? file : null;
}

/** Vérifie que ffmpeg sait synthétiser (contrôles). */
export function ffmpegAvailable(): boolean {
  return spawnSync(FFMPEG, ['-version']).status === 0;
}

export interface SfxCue {
  t: number;
  kind: SfxKind;
  /** Gain relatif (0..1) décidé par la scène. */
  gain?: number;
}

/**
 * Filtre les moments sonores : densité du style, espacement minimal par type
 * et plafond global (au-delà de 3 sons par seconde, l'oreille sature).
 */
export function refineCues(cues: SfxCue[], style: MotionStyle, duration: number, intensity: 'subtle' | 'normal' | 'punchy' = 'normal'): (SfxCue & { db: number })[] {
  const density = SFX_DENSITY[style] || {};
  // L'intensité choisie par le sound designer déplace tout le mixage des effets.
  const shift = intensity === 'subtle' ? -4 : intensity === 'punchy' ? 3 : 0;
  const minGap: Partial<Record<SfxKind, number>> = { click: 0.18, tick: 0.09, pop: 0.12, whoosh: 0.3, softwhoosh: 0.3, impact: 0.6, shimmer: 1, riser: 1.5 };
  const lastAt: Partial<Record<SfxKind, number>> = {};
  const out: (SfxCue & { db: number })[] = [];
  for (const cue of [...cues].sort((a, b) => a.t - b.t)) {
    if (cue.t < 0 || cue.t > duration - 0.05) continue;
    const db = SFX_GAIN_DB[cue.kind] + (density[cue.kind] ?? 0) + shift + 20 * Math.log10(Math.max(0.05, cue.gain ?? 1));
    if (db < -40) continue;
    if (lastAt[cue.kind] !== undefined && cue.t - (lastAt[cue.kind] as number) < (minGap[cue.kind] ?? 0.15)) continue;
    const window = out.filter((c) => cue.t - c.t < 1).length;
    if (window >= 3 && cue.kind !== 'whoosh' && cue.kind !== 'impact') continue;
    lastAt[cue.kind] = cue.t;
    out.push({ ...cue, db: Math.round(db * 10) / 10 });
  }
  return out;
}
