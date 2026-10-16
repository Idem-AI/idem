/**
 * LA VOIX OFF — choisie par l'utilisateur, dans la langue de la vidéo, calée sur les scènes.
 *
 * Les lignes sont écrites par le planificateur du film (une par scène, champ `voiceText`) ou par
 * l'utilisateur dans son scénario (mot pour mot). Ce module les dit, les nettoie et cale les scènes :
 *
 *   1. synthèse           une ligne = un appel au modèle de voix de l'hôte (Kokoro par
 *                         OpenRouter, ou le serveur Qwen3-TTS / Chatterbox de l'exploitant) ; le son est nettoyé (silences, passe-haut), accéléré au plus de
 *                         18 % s'il déborde, normalisé à −16 LUFS, déposé dans le stockage ;
 *   2. calage             chaque scène dure AU MOINS le temps de sa ligne (+ entrée et sortie) ;
 *                         la durée achetée ne change pas : les scènes muettes rendent du temps,
 *                         et une ligne qui ne tient vraiment pas est retirée (jamais coupée).
 *                         Minutage fixe (scénario écrit) : une ligne déborde sur les
 *                         plans muets qui la suivent au lieu d'être retirée.
 *
 * La voix ne dépend que de la clé de sa scène : une retouche (texte, code, musique) garde la
 * synchronisation.
 */
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../../runtime/logger';
import { coreHost, SpeechProvider, SpeechRequest } from '../../runtime/host';
import { isGrounded } from '../request/facts';
import type { MotionStyle, VideoVoice, VoiceLine } from '../contracts/model';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

// ─── Langues et voix ────────────────────────────────────────────────────────

const langOf = (language: string) => (language || 'fr').toLowerCase().slice(0, 2);


/** Débit d'une voix off publicitaire, en mots par seconde (caractères pour le chinois). */
const WORDS_PER_SEC: Record<string, number> = { fr: 2.7, en: 2.6, es: 2.8, pt: 2.6, it: 2.7, de: 2.3, ar: 2.2, sw: 2.4, zh: 4.5 };
export const wordsPerSecond = (language: string) => WORDS_PER_SEC[langOf(language)] ?? 2.5;

/** Compte des « mots » parlés (caractères CJK un par un). */
export function spokenUnits(text: string, language: string): number {
  const t = plainSpoken(text || '');
  if (!t) return 0;
  return langOf(language) === 'zh' ? t.replace(/\s+/g, '').length : t.split(/\s+/).filter(Boolean).length;
}

/**
 * Les personnages de voix : un caractère (que l'agent choisit), transmis à l'hôte comme
 * consigne de jeu. La voix elle-même est choisie par l'hôte selon la langue : Kokoro n'a
 * qu'une voix par langue, un serveur Qwen3-TTS / Chatterbox en offre davantage.
 */
export interface VoicePersona {
  id: string;
  gender: 'female' | 'male';
  character: string;
  /** Langages de mouvement auxquels ce personnage va bien (menu de l'agent). */
  fits: MotionStyle[];
}

export const VOICE_PERSONAS: VoicePersona[] = [
  { id: 'warm', gender: 'female', character: 'warm, reassuring', fits: ['premium', 'corporate'] },
  { id: 'bright', gender: 'female', character: 'bright, upbeat', fits: ['energetic', 'playful'] },
  { id: 'smooth', gender: 'female', character: 'smooth, elegant', fits: ['premium'] },
  { id: 'confident', gender: 'male', character: 'firm, confident', fits: ['corporate', 'energetic'] },
  { id: 'friendly', gender: 'male', character: 'friendly, casual', fits: ['playful', 'corporate'] },
  { id: 'deep', gender: 'male', character: 'deep, cinematic', fits: ['premium'] },
  { id: 'energetic', gender: 'male', character: 'energetic, punchy', fits: ['energetic'] },
];

export const personaById = (id?: string): VoicePersona => VOICE_PERSONAS.find((p) => p.id === id) || VOICE_PERSONAS[0];

/** Le menu de l'agent : trois personnages qui vont au langage de mouvement, une femme et un homme au moins. */
export function personaMenu(style: MotionStyle, seed: number): VoicePersona[] {
  const fit = VOICE_PERSONAS.filter((p) => p.fits.includes(style));
  const rest = VOICE_PERSONAS.filter((p) => !p.fits.includes(style));
  const ordered = [...fit, ...rest];
  const rot = seed % Math.max(1, fit.length);
  const menu = [...fit.slice(rot), ...fit.slice(0, rot), ...rest].slice(0, 3);
  if (!menu.some((p) => p.gender === 'female')) menu[2] = ordered.find((p) => p.gender === 'female')!;
  if (!menu.some((p) => p.gender === 'male')) menu[2] = ordered.find((p) => p.gender === 'male')!;
  return menu;
}

// ─── Minutage ───────────────────────────────────────────────────────────────

/** La ligne commence après l'entrée de la scène (la transition passe d'abord). */
export const VOICE_LEAD = 0.28;
/** Un souffle après la ligne, avant la coupe suivante. */
export const VOICE_TAIL = 0.32;
/** Au-delà, la ligne est accélérée (au plus de 18 %, inaudible au-dessous de 1,2). */
const MAX_TEMPO = 1.18;

/** Le temps disponible pour parler dans une scène de `duration` secondes. */
export const speakable = (duration: number, first = false) => Math.max(0.6, duration - (first ? 0.15 : VOICE_LEAD) - VOICE_TAIL);

/** Nombre de mots qu'on peut dire dans une scène. */
export const wordBudget = (duration: number, language: string, first = false) => Math.max(2, Math.floor(speakable(duration, first) * wordsPerSecond(language) * 0.92));

/**
 * Une ligne écrite en CAPITALES (titre d'écran) se dit en casse de phrase : un moteur de voix lit
 * « L'IDÉE NAÎT SEULE » lettre par lettre ou sur un ton de cri.
 */
export function speakableCase(text: string): string {
  const letters = (text.match(/\p{L}/gu) || []).length;
  const upper = (text.match(/\p{Lu}/gu) || []).length;
  if (letters < 4 || upper / letters < 0.7) return text;
  const lower = text.toLocaleLowerCase();
  return lower.replace(/(^|[.!?…]\s+)(\p{Ll})/gu, (_, a: string, b: string) => a + b.toLocaleUpperCase());
}

/**
 * Les balises de jeu d'ElevenLabs v3 (« [warmly] », « [short pause] ») : quelques mots anglais en minuscules entre
 * crochets. Elles restent dans le texte DIT ; le texte LU (sous-titres, comptage des mots, vérification des faits)
 * les retire. Un hôte dont la voix ne les comprend pas les retire avant de parler.
 */
export const VOICE_TAG = /\[[a-z][a-z ,'-]{1,30}\]/g;

/** Le texte d'une ligne sans ses balises de jeu (sous-titres, minutage, vérification). */
export function plainSpoken(text: string): string {
  return String(text || '').replace(VOICE_TAG, ' ').replace(/\s+([,.!?…])/g, '$1').replace(/\s+/g, ' ').trim();
}

export function cleanSpoken(value: string, maxWords: number, language: string, briefText: string): string {
  // Les balises de jeu sont mises à l'abri pendant le nettoyage (les autres crochets sont retirés), puis rendues.
  const tags: string[] = [];
  const shielded = String(value || '').replace(VOICE_TAG, (tag) => ` \u0000${tags.push(tag) - 1}\u0000 `);
  let t = speakableCase(shielded)
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/#[\p{L}\d_]+/gu, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/["«»“”]/g, '')
    // Un tiret long garde sa pause (une respiration pour la voix), sans espaces parasites.
    .replace(/\s*[—–]\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
  // Au plus deux balises par ligne ; une ligne faite de balises seules ne se dit pas.
  let kept = 0;
  t = t.replace(/\u0000(\d+)\u0000/g, (_, k: string) => (kept++ < 2 ? tags[Number(k)] : '')).replace(/\s+/g, ' ').trim();
  const plain = plainSpoken(t);
  if (!plain || /^[-–—.…]+$/.test(plain)) return '';
  if (!isGrounded(plain, briefText)) return '';
  if (langOf(language) === 'zh') return plain.replace(/\s+/g, '').slice(0, Math.max(2, maxWords));
  // Une ligne trop longue n'est jamais coupée : le calage l'accélère un peu, ou la retire en le disant.
  void maxWords;
  return t;
}

// ─── Synthèse ───────────────────────────────────────────────────────────────

function ffmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => (err += c.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg ${code}: ${err.slice(-400)}`))));
  });
}

async function durationOf(file: string): Promise<number> {
  const log = await ffmpeg(['-hide_banner', '-i', file, '-f', 'null', '-']);
  const all = [...log.matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
  const m = all[all.length - 1] || log.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** Entrée ffmpeg d'un son rendu par le modèle (WAV/MP3 lus tels quels, PCM brut décrit). */
function inputArgs(file: string, mimeType: string): string[] {
  const raw = /l16|pcm/i.test(mimeType) && !/wav/i.test(mimeType);
  if (!raw) return ['-i', file];
  const rate = Number(mimeType.match(/rate=(\d+)/)?.[1]) || 24000;
  return ['-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', file];
}

/**
 * Nettoie une ligne : silences retirés aux deux bouts, passe-haut, accélération (si elle
 * déborde de sa scène), loudness −16 LUFS, MP3 48 kHz stéréo. Rend la durée finale.
 */
export async function processSpeech(input: string, mimeType: string, output: string, maxSec?: number): Promise<number> {
  const clean = `${output}.clean.wav`;
  await ffmpeg([
    '-y', '-v', 'error', ...inputArgs(input, mimeType),
    '-af', ['highpass=f=70', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02', 'areverse', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05', 'areverse'].join(','),
    '-ar', '48000', '-ac', '1', clean,
  ]);
  const natural = await durationOf(clean);
  const tempo = maxSec && natural > maxSec * 1.02 ? Math.min(MAX_TEMPO, natural / maxSec) : 1;
  await ffmpeg([
    '-y', '-v', 'error', '-i', clean,
    '-af', [...(tempo > 1.001 ? [`atempo=${tempo.toFixed(3)}`] : []), 'loudnorm=I=-16:TP=-1.5:LRA=7', 'aresample=48000', 'afade=t=in:d=0.01'].join(','),
    '-ar', '48000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '160k', output,
  ]);
  fs.rmSync(clean, { force: true });
  return durationOf(output);
}

export interface VoiceStorage {
  uploadFile(content: Buffer, fileName: string, folder: string, contentType: string): Promise<{ downloadURL: string }>;
}

export class VoiceUnavailableError extends Error {}

/** Le service de voix de l'hôte sait-il parler ? (port branché) */
export const speechAvailable = () => typeof coreHost().synthesizeSpeech === 'function';

/**
 * Dit chaque ligne (trois à la fois), la nettoie et la dépose. Une ligne qui échoue deux fois
 * est retirée (la scène reste muette) ; si AUCUNE ne passe, la voix est indisponible.
 */
export async function synthesizeVoice(opts: {
  lines: { index: number; text: string; maxSec: number }[];
  language: string;
  persona: VoicePersona;
  style?: string;
  storage: VoiceStorage;
  folder: string;
  concurrency?: number;
}): Promise<{ lines: (Omit<VoiceLine, 'sceneKey' | 'offset'> & { index: number })[]; provider: SpeechProvider; model: string; voice: string }> {
  const synth = coreHost().synthesizeSpeech;
  if (!synth) throw new VoiceUnavailableError('no_speech_model');
  const request = (text: string): SpeechRequest => ({
    text,
    language: langOf(opts.language),
    style: opts.style || opts.persona.character,
    persona: opts.persona.id,
    gender: opts.persona.gender,
    tag: 'video-voice',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-voice-'));
  const out: (Omit<VoiceLine, 'sceneKey' | 'offset'> & { index: number })[] = [];
  let used: { provider: SpeechProvider; model: string; voice: string } = { provider: 'openrouter', model: '', voice: '' };
  let lastError: unknown;
  try {
    const queue = [...opts.lines];
    const worker = async () => {
      for (let line = queue.shift(); line; line = queue.shift()) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const speech = await synth(request(line.text));
            used = { provider: speech.provider, model: speech.model, voice: speech.voice };
            const key = crypto.createHash('sha1').update(`${line.index}:${line.text}:${speech.voice}`).digest('hex').slice(0, 12);
            const src = path.join(dir, `${key}.src`);
            const mp3 = path.join(dir, `${key}.mp3`);
            fs.writeFileSync(src, speech.buffer);
            const durationSec = await processSpeech(src, speech.mimeType, mp3, line.maxSec);
            if (durationSec < 0.25) throw new Error('voice_empty');
            const up = await opts.storage.uploadFile(fs.readFileSync(mp3), `voice-${line.index + 1}-${key}.mp3`, opts.folder, 'audio/mpeg');
            out.push({ index: line.index, text: line.text, url: up.downloadURL, durationSec: Math.round(durationSec * 1000) / 1000 });
            break;
          } catch (error: any) {
            lastError = error;
            // Une langue sans voix chez l'hôte ne se rejoue pas.
            if (/voice_language_unsupported|voice_unavailable/.test(String(error?.message))) {
              queue.length = 0;
              break;
            }
            logger.warn('video.voice.line_failed', { index: line.index, attempt, error: error?.message });
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 3, opts.lines.length)) }, worker));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (!out.length) throw new VoiceUnavailableError(String((lastError as Error)?.message || 'voice_failed'));
  out.sort((a, b) => a.index - b.index);
  return { lines: out, ...used };
}

// ─── Calage des scènes sur la voix ──────────────────────────────────────────

export interface TimedScene {
  key: string;
  start: number;
  duration: number;
}

/**
 * Chaque scène dure au moins le temps de sa ligne (+ entrée et souffle) ; la durée totale ne change
 * pas : les scènes muettes rendent du temps. Une ligne qui ne tient vraiment pas est RETIRÉE (jamais
 * coupée) et rendue dans `dropped`. Minutage fixe (scénario écrit) : les scènes ne bougent pas, une
 * ligne déborde sur les scènes muettes qui la suivent.
 */
export function fitScenesToVoice<S extends TimedScene>(scenes: S[], lines: Omit<VoiceLine, 'offset'>[], total: number, opts: { keepTiming?: boolean } = {}): { scenes: S[]; lines: VoiceLine[]; dropped: string[] } {
  const out = scenes.map((sc) => ({ ...sc }));
  const keys = new Set(out.map((sc) => sc.key));
  let kept = lines.filter((l) => keys.has(l.sceneKey));
  const dropped = lines.filter((l) => !keys.has(l.sceneKey)).map((l) => l.sceneKey);
  const lineOf = (key: string) => kept.find((l) => l.sceneKey === key);
  const leadOf = (i: number) => (i === 0 ? 0.15 : VOICE_LEAD);
  if (opts.keepTiming) {
    const placed: VoiceLine[] = [];
    let free = 0;
    for (const [i, sc] of out.entries()) {
      const l = lineOf(sc.key);
      if (!l) continue;
      const at = Math.max(sc.start + leadOf(i), free + 0.12);
      if (at + l.durationSec > total + 0.05) {
        dropped.push(l.sceneKey);
        continue;
      }
      free = at + l.durationSec;
      placed.push({ ...l, offset: Math.round((at - sc.start) * 1000) / 1000 });
    }
    return { scenes: out, lines: placed, dropped };
  }
  const floor = 1.2;
  const need = () => out.map((sc, i) => Math.max(floor, lineOf(sc.key) ? leadOf(i) + lineOf(sc.key)!.durationSec + VOICE_TAIL : 0));
  // Trop de paroles pour le film : la plus longue ligne d'une scène du milieu est retirée d'abord.
  for (let guard = 0; guard < out.length && need().reduce((a, x) => a + x, 0) > total + 0.01; guard++) {
    const candidates = out.map((sc, i) => ({ sc, i })).filter(({ sc, i }) => lineOf(sc.key) && (out.length < 3 || (i > 0 && i < out.length - 1)));
    const victim = (candidates.length ? candidates : out.map((sc, i) => ({ sc, i })).filter(({ sc }) => lineOf(sc.key))).sort((a, b) => lineOf(b.sc.key)!.durationSec - lineOf(a.sc.key)!.durationSec)[0];
    if (!victim) break;
    dropped.push(victim.sc.key);
    kept = kept.filter((l) => l.sceneKey !== victim.sc.key);
  }
  const lo = need();
  let dur = out.map((sc, i) => Math.max(lo[i], sc.duration));
  for (let pass = 0; pass < 8; pass++) {
    const diff = total - dur.reduce((a, x) => a + x, 0);
    if (Math.abs(diff) < 0.002) break;
    if (diff < 0) {
      const slack = dur.map((x, i) => Math.max(0, x - lo[i]));
      const sum = slack.reduce((a, x) => a + x, 0);
      if (sum <= 0) break;
      dur = dur.map((x, i) => x + (diff * slack[i]) / sum);
    } else {
      const weight = dur.reduce((a, x) => a + x, 0);
      dur = dur.map((x) => x + (diff * x) / weight);
    }
  }
  let start = 0;
  out.forEach((sc, i) => {
    sc.start = Math.round(start * 1000) / 1000;
    sc.duration = Math.round(dur[i] * 1000) / 1000;
    start += dur[i];
  });
  const last = out[out.length - 1];
  if (last) last.duration = Math.round((total - last.start) * 1000) / 1000;
  const placed = kept.map((l) => {
    const i = out.findIndex((sc) => sc.key === l.sceneKey);
    const room = out[i].duration - l.durationSec - VOICE_TAIL;
    const offset = Math.max(leadOf(i), Math.min(room, leadOf(i) + Math.max(0, room - leadOf(i)) * 0.25));
    return { ...l, offset: Math.round(offset * 1000) / 1000 };
  });
  return { scenes: out, lines: placed, dropped };
}

/** Les lignes à mixer : URL et instant absolu dans la vidéo. */
export function voiceTimeline(scenes: TimedScene[], voice: VideoVoice | undefined, total: number): { url: string; at: number; durationSec: number; text: string }[] {
  if (!voice?.enabled) return [];
  return voice.lines
    .map((l) => {
      const sc = scenes.find((s) => s.key === l.sceneKey);
      return sc ? { url: l.url, text: l.text, at: Math.round((sc.start + l.offset) * 1000) / 1000, durationSec: l.durationSec } : null;
    })
    .filter((x): x is { url: string; at: number; durationSec: number; text: string } => !!x && x.at < total - 0.2);
}
