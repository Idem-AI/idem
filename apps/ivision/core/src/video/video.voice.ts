/**
 * LA VOIX OFF — choisie par l'utilisateur, dans la langue de la vidéo, calée sur les scènes.
 *
 *   1. narrateur (agent)  une ligne PARLÉE par scène, dans la langue de la vidéo, bornée au
 *                         temps de la scène (mots par seconde de la langue) ; chiffres et prix
 *                         copiés du brief ou retirés ; repli : les textes à l'écran ;
 *   2. synthèse           une ligne = un appel au modèle de voix de l'hôte. GLM-TTS quand il
 *                         parle la langue (chinois, anglais), sinon le repli de l'hôte (Gemini
 *                         TTS) ; le son est nettoyé (silences, passe-haut), accéléré au plus de
 *                         18 % s'il déborde, normalisé à −16 LUFS, déposé dans le stockage ;
 *   3. calage             chaque scène dure AU MOINS le temps de sa ligne (+ entrée et sortie) ;
 *                         la durée achetée ne change pas : les scènes muettes rendent du temps,
 *                         et une ligne qui ne tient vraiment pas est retirée (jamais coupée).
 *
 * La voix ne dépend que de la clé de sa scène : une retouche (texte, direction, musique) garde
 * la synchronisation, re-calée par `fitScenesToVoice` après chaque recalcul du minutage.
 */
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../runtime/logger';
import { coreHost, SpeechRequest } from '../runtime/host';
import { agentLines, LETTERS, pickOption } from '../creativity/agent-io';
import { BriefFacts, CopyWriter, estimateTokens, fitLength, isGrounded } from './video.copy';
import { MotionStyle, VideoStoryboard, VideoVoice, VoiceLine } from './video.model';
import { callAgent, AgentRun } from './video.agents';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

// ─── Langues et voix ────────────────────────────────────────────────────────

/** Les langues que GLM-TTS parle (zai-org/GLM-TTS : chinois, anglais, et leur mélange). */
export const GLM_TTS_LANGUAGES = ['zh', 'en'];

/** Le fournisseur de voix d'une langue : GLM-TTS dès qu'il la parle, sinon le repli de l'hôte. */
export function speechProviderFor(language: string): 'glm' | 'gemini' {
  return GLM_TTS_LANGUAGES.includes(langOf(language)) ? 'glm' : 'gemini';
}

const langOf = (language: string) => (language || 'fr').toLowerCase().slice(0, 2);

const LANG_NAMES: Record<string, string> = { fr: 'French', en: 'English', pt: 'Portuguese', ar: 'Arabic', es: 'Spanish', sw: 'Swahili', zh: 'Chinese', de: 'German', it: 'Italian' };

/** Débit d'une voix off publicitaire, en mots par seconde (caractères pour le chinois). */
const WORDS_PER_SEC: Record<string, number> = { fr: 2.7, en: 2.6, es: 2.8, pt: 2.6, it: 2.7, de: 2.3, ar: 2.2, sw: 2.4, zh: 4.5 };
export const wordsPerSecond = (language: string) => WORDS_PER_SEC[langOf(language)] ?? 2.5;

/** Compte des « mots » parlés (caractères CJK un par un). */
export function spokenUnits(text: string, language: string): number {
  const t = (text || '').trim();
  if (!t) return 0;
  return langOf(language) === 'zh' ? t.replace(/\s+/g, '').length : t.split(/\s+/).filter(Boolean).length;
}

/**
 * Les personnages de voix : un caractère (que l'agent choisit) traduit en voix de chaque
 * fournisseur. GLM-TTS n'a que quelques voix système (tongtong, xiaochen, chuichui…) ; Gemini
 * TTS en a trente, décrites par leur caractère dans sa documentation.
 */
export interface VoicePersona {
  id: string;
  gender: 'female' | 'male';
  character: string;
  glm: string;
  gemini: string;
  /** Langages de mouvement auxquels ce personnage va bien (menu de l'agent). */
  fits: MotionStyle[];
}

export const VOICE_PERSONAS: VoicePersona[] = [
  { id: 'warm', gender: 'female', character: 'warm, reassuring', glm: 'tongtong', gemini: 'Sulafat', fits: ['premium', 'corporate'] },
  { id: 'bright', gender: 'female', character: 'bright, upbeat', glm: 'tongtong', gemini: 'Laomedeia', fits: ['energetic', 'playful'] },
  { id: 'smooth', gender: 'female', character: 'smooth, elegant', glm: 'tongtong', gemini: 'Despina', fits: ['premium'] },
  { id: 'confident', gender: 'male', character: 'firm, confident', glm: 'xiaochen', gemini: 'Alnilam', fits: ['corporate', 'energetic'] },
  { id: 'friendly', gender: 'male', character: 'friendly, casual', glm: 'xiaochen', gemini: 'Achird', fits: ['playful', 'corporate'] },
  { id: 'deep', gender: 'male', character: 'deep, cinematic', glm: 'chuichui', gemini: 'Charon', fits: ['premium'] },
  { id: 'energetic', gender: 'male', character: 'energetic, punchy', glm: 'chuichui', gemini: 'Puck', fits: ['energetic'] },
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

// ─── Le narrateur (agent) ───────────────────────────────────────────────────

export interface NarratorScene {
  sceneId: string;
  /** Durée prévue de la scène (s) : fixe le nombre de mots. */
  duration: number;
  /** Les textes à l'écran (titre d'abord). */
  texts: string[];
}

export interface NarratorInput {
  sheet: string;
  brandName: string;
  language: string;
  brief: string;
  facts: BriefFacts;
  style: MotionStyle;
  scenes: NarratorScene[];
  personas: VoicePersona[];
  /** Le film d'auteur (Ultra) : le concept guide le ton. */
  concept?: string;
}

export interface Narration {
  /** Index de scène → ligne parlée. */
  lines: Record<number, string>;
  persona: string;
  style?: string;
  source: 'llm' | 'heuristic';
}

export function buildNarratorPrompt(input: NarratorInput): { system: string; user: string } {
  const lang = LANG_NAMES[langOf(input.language)] || 'French';
  const system = [
    `You write the VOICE-OVER of a short brand video, in ${lang}. The narrator speaks over the scenes, in sync with what is on screen.`,
    'Output ONLY these lines:',
    'N: what the narrator says over scene N (or N: - to keep the scene silent)',
    'voice: the letter of one voice from VOICES',
    'style: how to say it, 2 to 5 English words (e.g. warm and confident)',
    'Rules:',
    '- Never exceed the max words of a scene. Spoken, natural sentences; one idea per scene.',
    '- Say the same idea as the screen at the same moment, in other words: never read the on-screen text word for word.',
    '- Prices, dates, figures, phone numbers: copy them EXACTLY from the brief, or leave them out.',
    `- The last scene (logo) says the brand name "${input.brandName}", optionally with a very short promise.`,
    '- No emoji, hashtag, URL, quotation marks, stage directions or sound effects.',
  ].join('\n');
  const user = [
    input.sheet,
    `BRIEF: ${input.brief.replace(/\s+/g, ' ').trim().slice(0, 500)}`,
    input.concept ? `CONCEPT: ${input.concept.slice(0, 160)}` : '',
    'SCENES:',
    ...input.scenes.map((sc, i) => {
      const max = wordBudget(sc.duration, input.language, i === 0);
      const shown = sc.texts.filter(Boolean).map((t) => `"${t.slice(0, 70)}"`).join(' / ');
      return `${i + 1}. ${sc.sceneId}, ${sc.duration.toFixed(1)} s, max ${max} words${shown ? ` — on screen: ${shown}` : ''}`;
    }),
    'VOICES:',
    ...input.personas.map((p, i) => `${LETTERS[i]}) ${p.id} — ${p.gender}, ${p.character}`),
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

/** Une ligne parlée propre : sans balises ni indications de jeu, bornée en mots, chiffres vérifiés. */
export function cleanSpoken(value: string, maxWords: number, language: string, briefText: string): string {
  let t = (value || '')
    .replace(/\[[^\]]*\]|\([^)]*\)|\*[^*]*\*/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/#[\p{L}\d_]+/gu, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/["«»“”]/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || /^[-–—.…]+$/.test(t)) return '';
  if (!isGrounded(t, briefText)) return '';
  if (langOf(language) === 'zh') return t.replace(/\s+/g, '').slice(0, Math.max(2, maxWords));
  const words = t.split(' ');
  // Un dépassement léger est rendu par le calage ; au-delà, la ligne est coupée proprement.
  if (words.length > Math.ceil(maxWords * 1.25)) t = fitLength(t, Math.max(8, words.slice(0, maxWords).join(' ').length));
  return t;
}

/** Ce qu'un chiffre dit à voix haute doit retrouver : le brief, la marque et les textes à l'écran. */
const groundingOf = (input: NarratorInput) => [input.brief, input.brandName, ...input.scenes.flatMap((sc) => sc.texts)].join(' ');

export function parseNarration(raw: string, input: NarratorInput): Narration | null {
  const text = (raw || '').replace(/```[a-z]*\n?/gi, '');
  const lines: Record<number, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^[\s*_#>-]*(?:scene\s*)?(\d{1,2})\s*[.):=-]*\s*[:=]?\s*(.+)$/i);
    if (!m) continue;
    const i = Number(m[1]) - 1;
    const sc = input.scenes[i];
    if (!sc) continue;
    // Une étiquette parasite (« 2. voice: … », « 2.title: … ») n'est pas dite.
    const said = m[2].replace(/^(?:voice|vo|text|line|narration|narrator|says?|title|l1|sub)\s*[:=]\s*/i, '');
    const spoken = cleanSpoken(said, wordBudget(sc.duration, input.language, i === 0), input.language, groundingOf(input));
    if (spoken) lines[i] = spoken;
  }
  if (!Object.keys(lines).length) return null;
  const kv = agentLines(text);
  const persona = pickOption(kv.voice || kv.voix, input.personas.map((p) => p.id)) || input.personas[0].id;
  const style = (kv.style || '').replace(/[^\p{L} ,'-]/gu, '').trim().slice(0, 48) || undefined;
  return { lines, persona, style, source: 'llm' };
}

/** Repli sans modèle : la voix reprend l'idée de chaque scène (son titre), et signe avec la marque. */
export function heuristicNarration(input: NarratorInput): Narration {
  const lines: Record<number, string> = {};
  input.scenes.forEach((sc, i) => {
    const max = wordBudget(sc.duration, input.language, i === 0);
    const text = sc.sceneId === 'logo' ? input.brandName : sc.texts.find((t) => t && t.trim().split(/\s+/).length >= 2) || sc.texts.find(Boolean) || '';
    const spoken = cleanSpoken(text, max, input.language, groundingOf(input));
    if (spoken) lines[i] = spoken;
  });
  return { lines, persona: input.personas[0].id, source: 'heuristic' };
}

export async function runNarrator(writer: CopyWriter | undefined, input: NarratorInput): Promise<{ narration: Narration; run: AgentRun }> {
  const prompt = buildNarratorPrompt(input);
  const res = await callAgent(writer, prompt.system, prompt.user);
  const parsed = parseNarration(res.raw, input);
  const narration = parsed || heuristicNarration(input);
  return {
    narration,
    run: { agent: 'narrator', source: parsed ? 'llm' : 'graph', tokens: { input: estimateTokens(prompt.system + prompt.user), output: estimateTokens(res.raw) }, ms: res.ms, kept: parsed ? Object.keys(parsed.lines).length : 0 },
  };
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
}): Promise<{ lines: (Omit<VoiceLine, 'sceneKey' | 'offset'> & { index: number })[]; provider: 'glm' | 'gemini'; model: string; voice: string }> {
  const synth = coreHost().synthesizeSpeech;
  if (!synth) throw new VoiceUnavailableError('no_speech_model');
  const provider = speechProviderFor(opts.language);
  const request = (text: string): SpeechRequest => ({
    text,
    language: langOf(opts.language),
    provider,
    voice: provider === 'glm' ? opts.persona.glm : opts.persona.gemini,
    style: opts.style || opts.persona.character,
    tag: 'video-voice',
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idem-voice-'));
  const out: (Omit<VoiceLine, 'sceneKey' | 'offset'> & { index: number })[] = [];
  let used = { provider, model: '', voice: '' };
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
            // Une langue refusée par l'hôte (repli coupé) ne se rejoue pas.
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

/** Les scènes dont on retire d'abord la voix si le film est trop court pour tout dire. */
const SILENT_FIRST = ['wordswap', 'kinetic', 'gallery', 'statement', 'stat', 'benefits', 'quote', 'lottie', 'showcase3d', 'footage', 'product'];

const floorOf = (sceneId: string, total: number) => (sceneId === 'logo' ? (total >= 15 ? 2.2 : 1.5) : 1.2);

/**
 * Chaque scène dure au moins le temps de sa ligne ; la durée totale ne change pas. Les scènes
 * gardent leurs proportions dans ce qui reste ; une ligne qui ne tient pas est retirée (les
 * scènes les moins essentielles d'abord, jamais l'ouverture ni la signature).
 */
export function fitScenesToVoice(storyboard: VideoStoryboard, voice: VideoVoice): { storyboard: VideoStoryboard; voice: VideoVoice; dropped: string[] } {
  const total = storyboard.durationSec;
  const scenes = storyboard.scenes.map((sc) => ({ ...sc }));
  const keys = new Set(scenes.map((sc) => sc.key));
  // Une ligne dont la scène a disparu (règles, retouche) disparaît avec elle.
  let lines = voice.lines.filter((l) => keys.has(l.sceneKey));
  const dropped = voice.lines.filter((l) => !keys.has(l.sceneKey)).map((l) => l.sceneKey);
  const lineOf = (key: string) => lines.find((l) => l.sceneKey === key);
  const leadOf = (i: number) => (i === 0 ? 0.15 : VOICE_LEAD);
  const need = () => scenes.map((sc, i) => Math.max(floorOf(sc.sceneId, total), lineOf(sc.key) ? leadOf(i) + lineOf(sc.key)!.durationSec + VOICE_TAIL : 0));

  for (let guard = 0; guard < scenes.length && need().reduce((a, x) => a + x, 0) > total + 0.01; guard++) {
    const candidates = scenes.map((sc, i) => ({ sc, i })).filter(({ sc, i }) => i > 0 && i < scenes.length - 1 && lineOf(sc.key));
    candidates.sort((a, b) => {
      const ra = SILENT_FIRST.indexOf(a.sc.sceneId);
      const rb = SILENT_FIRST.indexOf(b.sc.sceneId);
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb) || lineOf(b.sc.key)!.durationSec - lineOf(a.sc.key)!.durationSec;
    });
    const victim = candidates[0] || scenes.map((sc, i) => ({ sc, i })).filter(({ sc }) => lineOf(sc.key)).sort((a, b) => lineOf(b.sc.key)!.durationSec - lineOf(a.sc.key)!.durationSec)[0];
    if (!victim) break;
    dropped.push(victim.sc.key);
    lines = lines.filter((l) => l.sceneKey !== victim.sc.key);
  }

  const lo = need();
  let dur = scenes.map((sc, i) => Math.max(lo[i], sc.duration));
  // Le surplus est repris sur la marge des scènes (au-dessus de leur minimum), en proportion.
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
  scenes.forEach((sc, i) => {
    sc.start = Math.round(start * 1000) / 1000;
    sc.duration = Math.round(dur[i] * 1000) / 1000;
    start += dur[i];
  });
  const last = scenes[scenes.length - 1];
  if (last) last.duration = Math.round((total - last.start) * 1000) / 1000;

  const placed = lines.map((l) => {
    const i = scenes.findIndex((sc) => sc.key === l.sceneKey);
    // La ligne est centrée dans ce que la scène laisse, sans jamais partir avant son entrée.
    const room = scenes[i].duration - l.durationSec - VOICE_TAIL;
    const offset = Math.max(leadOf(i), Math.min(room, leadOf(i) + Math.max(0, room - leadOf(i)) * 0.25));
    return { ...l, offset: Math.round(offset * 1000) / 1000 };
  });
  return { storyboard: { ...storyboard, scenes }, voice: { ...voice, lines: placed }, dropped };
}

/** Les lignes à mixer : fichier (ou URL) et instant absolu dans la vidéo. */
export function voiceTimeline(storyboard: VideoStoryboard, voice?: VideoVoice): { url: string; at: number; durationSec: number }[] {
  if (!voice?.enabled) return [];
  return voice.lines
    .map((l) => {
      const sc = storyboard.scenes.find((s) => s.key === l.sceneKey);
      return sc ? { url: l.url, at: Math.round((sc.start + l.offset) * 1000) / 1000, durationSec: l.durationSec } : null;
    })
    .filter((x): x is { url: string; at: number; durationSec: number } => !!x && x.at < storyboard.durationSec - 0.2);
}

/** Les textes d'une scène pour le narrateur (titre d'abord). */
export function sceneTexts(slots: Record<string, string> = {}): string[] {
  const order = ['title', 'l1', 'quote', 'name', 'value', 'price', 'action', 'sub', 'l2', 'b1', 'b2', 'b3', 'label', 'tagline', 'note'];
  const known = order.map((k) => slots[k]).filter(Boolean);
  const rest = Object.entries(slots)
    .filter(([k, v]) => v && !order.includes(k) && !['visual', 'icons', 'kicker'].includes(k))
    .map(([, v]) => v);
  return [...known, ...rest].slice(0, 4);
}
