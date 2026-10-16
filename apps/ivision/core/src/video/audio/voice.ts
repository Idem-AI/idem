/**
 * LA VOIX OFF — choisie par l'utilisateur, dans la langue de la vidéo, calée sur les scènes.
 *
 * Les lignes sont écrites par le planificateur du film (une par scène, champ `voiceText`) ou par
 * l'utilisateur dans son scénario (mot pour mot). Ce module les dit, les nettoie et cale les scènes :
 *
 *   1. synthèse           UNE PRISE CONTINUE : toute la narration dite d'un seul souffle (un appel au
 *                         modèle de voix de l'hôte — ElevenLabs par OpenRouter), puis découpée aux pauses
 *                         entre les phrases. Une ligne par appel donnait une « récitation » : chaque phrase
 *                         repartait sur la même intonation. Une ligne seule par appel ne sert plus qu'au repli
 *                         (pauses introuvables) et aux retouches d'une scène. Chaque morceau est nettoyé
 *                         (silences, passe-haut), accéléré au plus de 18 % s'il déborde, normalisé à −16 LUFS ;
 *   2. calage             la narration s'enchaîne : chaque scène dure le temps de sa phrase et d'un souffle,
 *                         la phrase suivante part dès l'entrée de la scène suivante. Le temps qui reste va
 *                         d'abord aux plans muets (logo, final), puis à tout le film ; la durée achetée ne
 *                         change pas, et une ligne qui ne tient vraiment pas est retirée (jamais coupée).
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

/** La ligne commence juste après l'entrée de la scène (la transition passe d'abord). */
export const VOICE_LEAD = 0.18;
/** Un souffle après la ligne, avant la coupe suivante : avec l'entrée, ≈ 0,45 s entre deux phrases. */
export const VOICE_TAIL = 0.27;
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
type SaidLine = Omit<VoiceLine, 'sceneKey' | 'offset'> & { index: number };

/** Une ligne qui se termine par une ponctuation (une virgule suffit : l'idée continue dans la scène suivante). */
const sentence = (text: string) => (/[.!?…:;,—]\s*(\[[^\]]*\]\s*)*$/.test(text.trim()) ? text.trim() : `${text.trim()},`);

/** Les silences d'un son (secondes) : là où la prise continue se découpe. */
async function silences(file: string): Promise<{ start: number; end: number }[]> {
  const log = await ffmpeg(['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-36dB:d=0.12', '-f', 'null', '-']);
  const out: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (const m of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    if (m[1] === 'start') start = Math.max(0, Number(m[2]));
    else if (start !== null) {
      out.push({ start, end: Number(m[2]) });
      start = null;
    }
  }
  return out;
}

/**
 * Les points de coupe d'une prise continue : pour chaque fin de ligne, la pause la plus proche de
 * l'instant attendu (au prorata des signes dits), dans l'ordre. Null si une coupe n'a pas de pause
 * plausible : mieux vaut alors une ligne par appel qu'une phrase tranchée au milieu d'un mot.
 */
export function cutPoints(texts: string[], gaps: { start: number; end: number }[], duration: number): number[] | null {
  const weights = texts.map((t) => Math.max(1, plainSpoken(t).length));
  const total = weights.reduce((a, x) => a + x, 0);
  const lead = gaps[0] && gaps[0].start <= 0.02 ? gaps[0].end : 0;
  const lastGap = gaps[gaps.length - 1];
  const tail = lastGap && lastGap.end >= duration - 0.05 ? lastGap.start : duration;
  const span = Math.max(0.1, tail - lead);
  const inner = gaps.filter((g) => g.start > lead + 0.05 && g.end < tail - 0.05);
  const cuts: number[] = [];
  let acc = 0;
  let floor = lead;
  for (let k = 0; k < texts.length - 1; k++) {
    acc += weights[k];
    const expected = lead + (span * acc) / total;
    const tolerance = Math.max(0.6, (span * weights[k]) / total * 0.45);
    const best = inner
      .filter((g) => (g.start + g.end) / 2 > floor + 0.25)
      .map((g) => ({ g, miss: Math.abs((g.start + g.end) / 2 - expected) - 1.5 * Math.min(0.5, g.end - g.start) }))
      .sort((a, b) => a.miss - b.miss)[0];
    if (!best || Math.abs((best.g.start + best.g.end) / 2 - expected) > tolerance) return null;
    const cut = (best.g.start + best.g.end) / 2;
    cuts.push(cut);
    floor = cut;
  }
  return cuts;
}

/**
 * La prise continue : toute la narration en un appel, découpée aux pauses entre les lignes. Chaque morceau
 * garde l'intonation d'un récit suivi (la voix sait qu'une phrase en annonce une autre). Lève une erreur si
 * le découpage n'est pas sûr : l'appelant repasse alors ligne par ligne.
 */
async function continuousTake(
  opts: { lines: { index: number; text: string; maxSec: number }[]; storage: VoiceStorage; folder: string },
  speak: (text: string) => ReturnType<NonNullable<ReturnType<typeof coreHost>['synthesizeSpeech']>>,
  dir: string
): Promise<{ lines: SaidLine[]; used: { provider: SpeechProvider; model: string; voice: string } }> {
  const texts = opts.lines.map((l, k) => (k === opts.lines.length - 1 ? sentence(l.text).replace(/,$/, '.') : sentence(l.text)));
  const speech = await speak(texts.join(' '));
  const src = path.join(dir, 'take.src');
  const wav = path.join(dir, 'take.wav');
  fs.writeFileSync(src, speech.buffer);
  await ffmpeg(['-y', '-v', 'error', ...inputArgs(src, speech.mimeType), '-af', 'highpass=f=70', '-ar', '48000', '-ac', '1', wav]);
  const duration = await durationOf(wav);
  const cuts = cutPoints(texts, await silences(wav), duration);
  if (!cuts) throw new Error('voice_take_unsplittable');
  const bounds = [0, ...cuts, duration];
  const key = crypto.createHash('sha1').update(`${texts.join('|')}:${speech.voice}`).digest('hex').slice(0, 12);
  const lines: SaidLine[] = [];
  for (const [k, line] of opts.lines.entries()) {
    const part = path.join(dir, `part-${k}.wav`);
    const mp3 = path.join(dir, `part-${k}.mp3`);
    await ffmpeg(['-y', '-v', 'error', '-i', wav, '-ss', bounds[k].toFixed(3), '-to', bounds[k + 1].toFixed(3), part]);
    const durationSec = await processSpeech(part, 'audio/wav', mp3, line.maxSec);
    if (durationSec < 0.25) throw new Error('voice_take_empty_part');
    const up = await opts.storage.uploadFile(fs.readFileSync(mp3), `voice-${line.index + 1}-${key}.mp3`, opts.folder, 'audio/mpeg');
    lines.push({ index: line.index, text: line.text, url: up.downloadURL, durationSec: Math.round(durationSec * 1000) / 1000 });
  }
  return { lines, used: { provider: speech.provider, model: speech.model, voice: speech.voice } };
}

export async function synthesizeVoice(opts: {
  lines: { index: number; text: string; maxSec: number }[];
  language: string;
  persona: VoicePersona;
  style?: string;
  storage: VoiceStorage;
  folder: string;
  concurrency?: number;
  /** Toute la narration en une prise (création, voix refaite) ; faux pour la retouche d'une seule scène. */
  continuous?: boolean;
}): Promise<{ lines: SaidLine[]; provider: SpeechProvider; model: string; voice: string }> {
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
  if (opts.continuous && opts.lines.length > 1) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-voice-take-'));
    try {
      const take = await continuousTake(opts, (text) => synth(request(text)), dir);
      return { lines: take.lines, ...take.used };
    } catch (error: any) {
      if (/voice_language_unsupported|voice_unavailable/.test(String(error?.message))) throw new VoiceUnavailableError(error.message);
      logger.warn('video.voice.take_fallback', { lines: opts.lines.length, error: error?.message });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-voice-'));
  const out: SaidLine[] = [];
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
  // La narration s'enchaîne : une scène parlée dure sa phrase et un souffle (+ 0,5 s au plus) ; le temps
  // restant va d'abord aux plans muets (jusqu'à leur durée prévue), puis à tout le film au prorata. Avant,
  // chaque scène gardait sa durée prévue : la voix attendait la scène suivante, et l'on entendait des trous.
  let dur = lo.slice();
  const voicedAt = out.map((sc) => !!lineOf(sc.key));
  if (kept.length) {
    let spare = total - dur.reduce((a, x) => a + x, 0);
    const give = (want: number[]) => {
      const sum = want.reduce((a, x) => a + x, 0);
      if (sum <= 0 || spare <= 0) return;
      const k = Math.min(1, spare / sum);
      dur = dur.map((x, i) => x + want[i] * k);
      spare -= sum * k;
    };
    give(out.map((sc, i) => (voicedAt[i] ? 0 : Math.max(0, sc.duration - dur[i]))));
    give(out.map((sc, i) => (voicedAt[i] ? Math.min(0.5, Math.max(0, sc.duration - dur[i])) : 0)));
    // Encore du temps (narration plus courte que le film) : un souffle de plus entre les phrases (0,7 s au
    // plus), puis le reste au final et aux plans muets — jamais de longs blancs au milieu du récit.
    give(out.map((_, i) => (voicedAt[i] ? 0.7 : 0)));
    const holders = out.map((sc, i) => (!voicedAt[i] || i === out.length - 1 ? sc.duration : 0));
    give(holders.map((x) => x * 100));
  } else dur = out.map((sc, i) => Math.max(lo[i], sc.duration));
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
    // La phrase part dès l'entrée de la scène : le temps en plus tombe après elle, jamais avant.
    return { ...l, offset: leadOf(i) };
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
