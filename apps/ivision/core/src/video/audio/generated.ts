/**
 * LES SONS GÉNÉRÉS SUR UN SERVEUR GPU D'IDEM (chantier 12, 23/11/2026) — FACULTATIFS, ÉTEINTS PAR DÉFAUT.
 *
 * Deux adaptateurs, chacun allumé seulement si son adresse est posée (aucune adresse = aucun appel, le moteur garde
 * ses banques libres de droits et sa synthèse) :
 *
 *   • MUSIQUE — `VIDEO_MUSIC_GEN_URL` : un serveur ACE-Step 1.5 (Apache-2.0) hébergé par IDEM. Contrat :
 *       POST {prompt, duration, bpm?, seed, instrumental: true}  →  le fichier audio (audio/wav, audio/mpeg ou audio/ogg).
 *     La piste générée passe AVANT les banques (mêmes analyses : tempo, temps, phrases) ; un échec rend la main aux
 *     banques, jamais une vidéo muette.
 *   • BRUITAGE — `VIDEO_FOLEY_GEN_URL` : un serveur MMAudio (MIT) hébergé par IDEM, qui écoute un clip MUET (les clips
 *     générés n'ont pas de son) et en rend l'ambiance. Contrat :
 *       POST {video_url, prompt, duration, seed}  →  le fichier audio.
 *     Le bruitage est mixé bas, sous la musique et la voix, sur la durée du clip dans sa scène.
 *
 * `VIDEO_GEN_AUDIO_KEY` (facultatif) part en `Authorization: Bearer`. Les fichiers sont mis en cache sur le disque
 * (même demande = même fichier, aucun second appel). Rien ne part vers un service tiers : ces serveurs sont ceux d'IDEM.
 */
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../../runtime/logger';
import type { MusicTrack } from '../contracts/model';
import type { ConcreteMood } from './music';

const CACHE = path.join(os.tmpdir(), 'idem-video-generated-audio');
const MAX_BYTES = 40 * 1024 * 1024;
const AUDIO_TYPE = /^audio\/(wav|x-wav|wave|mpeg|mp3|ogg|flac|x-flac)\b/i;

export const musicGenUrl = (): string => (process.env.VIDEO_MUSIC_GEN_URL || '').trim();
export const foleyGenUrl = (): string => (process.env.VIDEO_FOLEY_GEN_URL || '').trim();

/** Les mots d'une ambiance musicale, pour le serveur de musique (des mots de métier, jamais la demande du client). */
const MOOD_PROMPT: Record<ConcreteMood, string> = {
  upbeat: 'upbeat modern afro-pop instrumental, bright guitars, light percussion, positive',
  calm: 'calm warm acoustic instrumental, soft piano and guitar, gentle, unhurried',
  epic: 'epic cinematic instrumental, rising strings and deep drums, hopeful and grand',
  corporate: 'clean corporate instrumental, light synth pads, steady soft beat, optimistic',
  afro: 'afrobeats instrumental, warm log drums, shakers and guitar, confident groove',
};

async function fetchAudio(url: string, body: Record<string, unknown>, timeoutMs: number): Promise<Buffer> {
  const key = (process.env.VIDEO_GEN_AUDIO_KEY || '').trim();
  const res = await axios.post(url, body, {
    responseType: 'arraybuffer',
    timeout: timeoutMs,
    maxContentLength: MAX_BYTES,
    maxRedirects: 0,
    headers: { 'Content-Type': 'application/json', Accept: 'audio/*', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
  });
  const type = String(res.headers['content-type'] || '');
  if (!AUDIO_TYPE.test(type)) throw new Error(`generated_audio_not_audio: ${type.slice(0, 60)}`);
  const data = Buffer.from(res.data);
  if (data.length < 2048) throw new Error('generated_audio_too_short');
  return data;
}

function cacheFile(kind: string, parts: unknown[]): string {
  fs.mkdirSync(CACHE, { recursive: true });
  return path.join(CACHE, `${kind}-${crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex')}.audio`);
}

/**
 * Une piste de musique générée pour le film, ou `null` (adaptateur éteint, serveur absent ou réponse inutilisable).
 * La piste est un fichier local : elle suit le chemin des pistes du catalogue maison.
 */
export async function generatedMusic(o: { mood: ConcreteMood; durationSec: number; seed: number; bpm?: number }): Promise<MusicTrack | null> {
  const url = musicGenUrl();
  if (!url) return null;
  const prompt = MOOD_PROMPT[o.mood];
  // Quelques secondes de plus que le film : l'extrait choisi par le code commence et finit sur une phrase.
  const duration = Math.min(240, Math.max(10, Math.ceil(o.durationSec + 8)));
  const file = cacheFile('music', [prompt, duration, o.bpm ?? 0, o.seed]);
  try {
    if (!(fs.existsSync(file) && fs.statSync(file).size > 2048)) {
      const data = await fetchAudio(url, { prompt, duration, ...(o.bpm ? { bpm: Math.round(o.bpm) } : {}), seed: o.seed >>> 0, instrumental: true }, 240_000);
      fs.writeFileSync(file, data);
    }
    return {
      id: `generated:${path.basename(file, '.audio')}`,
      provider: 'local',
      title: `Musique originale (${o.mood})`,
      artist: 'IDEM',
      url: file,
      durationSec: duration,
      license: 'generated',
      attribution: `Musique originale générée pour ce film (ACE-Step)`,
      moods: [o.mood],
      ...(o.bpm ? { bpm: o.bpm } : {}),
    };
  } catch (error: any) {
    logger.warn('video.music_generation_failed', { error: error?.message || String(error) });
    return null;
  }
}

/** Le bruitage d'un clip muet (fichier local), ou `null`. `prompt` : ce que montre le plan (fiche du storyboard). */
export async function generatedFoley(o: { videoUrl: string; prompt: string; durationSec: number; seed: number }): Promise<string | null> {
  const url = foleyGenUrl();
  if (!url || !/^https:\/\//.test(o.videoUrl)) return null;
  const prompt = String(o.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 200) || 'natural ambient sound of the scene';
  const duration = Math.min(30, Math.max(1, Math.round(o.durationSec * 10) / 10));
  const file = cacheFile('foley', [o.videoUrl, prompt, duration, o.seed]);
  try {
    if (!(fs.existsSync(file) && fs.statSync(file).size > 2048)) {
      const data = await fetchAudio(url, { video_url: o.videoUrl, prompt, duration, seed: o.seed >>> 0 }, 180_000);
      fs.writeFileSync(file, data);
    }
    return file;
  } catch (error: any) {
    logger.warn('video.foley_generation_failed', { error: error?.message || String(error) });
    return null;
  }
}
