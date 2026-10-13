/**
 * RETOUCHER UNE VIDÉO EN ÉCRIVANT — « change le titre de la scène 2 », « remplis les scènes vides »,
 * « plus sobre », « sans musique », « ajoute une voix off », « le logo plus grand dans la scène 4 ».
 *
 * Le modèle lit chaque scène telle qu'elle est (clé, rôle, durée, média, ses CASES de texte — y
 * compris vides, avec leur longueur —, sa ligne de voix off, si son rendu est du code écrit par
 * l'IA), le style, la musique, et le retour du client ; il rend SEULEMENT ce qui change. Le code ne
 * lui fait pas confiance : une scène inconnue, une case qui n'existe pas dans la scène, un style
 * hors liste sont écartés. Une demande VISUELLE sur une scène est appliquée à son code
 * (video.recode.ts). Il peut aussi dire que le message est une NOUVELLE demande : la conversation
 * crée alors une autre vidéo.
 */
import { SCENES } from './video.scenes';
import { MOTION_STYLES, MotionStyle, MotionVideo, MUSIC_MOODS, MusicMood } from './video.model';

export interface VideoRevisionPatch {
  slots?: Record<string, Record<string, string>>;
  style?: MotionStyle;
  musicMood?: MusicMood;
  sfx?: boolean;
  voice?: boolean;
  /** Ligne de voix off d'une scène (clé → ce que dit la voix), dite telle quelle. */
  voiceLines?: Record<string, string>;
  /** Changement visuel d'une scène (clé → la demande du client), appliqué à son code. */
  visual?: Record<string, string>;
}

export interface VideoRevision {
  /** Le message demande une autre vidéo (pas un changement de celle-ci). */
  newRequest: boolean;
  patch: VideoRevisionPatch;
  reply?: string;
  /** Textes proposés par le modèle mais écartés (scène ou case inconnue) : la réponse ne doit pas les annoncer. */
  rejected?: number;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Les réglages dits en clair, lus sans modèle (et en repli si le modèle échoue). */
export function videoSettingsFromText(text: string): VideoRevisionPatch {
  const t = fold(text);
  const out: VideoRevisionPatch = {};
  if (/(sans|enleve|retire|coupe|supprime|pas de)\s+(la\s+|de\s+)?musique|no music|without music/.test(t)) out.musicMood = 'none';
  else if (/musique (plus )?(calme|douce|zen)|calmer music/.test(t)) out.musicMood = 'calm';
  else if (/musique (plus )?(entrainante|joyeuse|dynamique|rythmee)|upbeat music/.test(t)) out.musicMood = 'upbeat';
  else if (/musique (africaine|afro)|afrobeat/.test(t)) out.musicMood = 'afro';
  if (/(sans|enleve|retire|coupe|supprime|pas d')\s*(les\s+)?(effets|bruitages|sons)|no (sound )?effects/.test(t)) out.sfx = false;
  if (/(sans|enleve|retire|coupe|supprime|pas de)\s+(la\s+)?voix|no voice/.test(t)) out.voice = false;
  else if (/(ajoute|mets|avec)\s+(une\s+)?voix|add (a )?voice/.test(t)) out.voice = true;
  if (/plus (sobre|elegant|premium|luxe|chic)|more (elegant|premium)/.test(t)) out.style = 'premium';
  else if (/plus (dynamique|energique|punchy|rapide)|more (dynamic|energetic)/.test(t)) out.style = 'energetic';
  else if (/plus (fun|ludique|joyeux|amusant)|more (fun|playful)/.test(t)) out.style = 'playful';
  else if (/plus (serieux|pro|professionnel|corporate)|more (serious|professional)/.test(t)) out.style = 'corporate';
  return out;
}

/** Longueur permise d'une case : un texte du scénario de l'utilisateur peut dépasser la case standard. */
export const slotLimit = (max: number, scripted: boolean) => (scripted ? Math.max(max, 160) : max);

export function buildVideoRevisionPrompt(video: MotionVideo, feedback: string, language: string): { system: string; user: string } {
  const lines = new Map((video.voice?.enabled ? video.voice.lines : []).map((l) => [l.sceneKey, l.text]));
  const system = [
    'You are the video editor who made this short motion-design video. The client now asks for changes, in their own words.',
    'Apply the request — and only it: keep everything they did not question. Texts stay in the video language, natural, within the max length of their field.',
    'You may change:',
    '- the texts of a scene: ONLY the fields listed for that scene (an empty field "" can be filled — e.g. when the client asks to fill empty scenes, write every empty field of those scenes, from what the brief and the other scenes say; never invent prices, dates or numbers);',
    '- the voice-over line of a scene ("voiceLines"), when VOICE is on or the client asks for one;',
    '- how a scene LOOKS or MOVES ("visual": the precise change, in a sentence) — layout, sizes, animation, what is drawn;',
    '- the style ("energetic" | "premium" | "playful" | "corporate"), the music mood ("auto" | "upbeat" | "calm" | "epic" | "corporate" | "afro" | "none"), sound effects (true/false), voice-over (true/false).',
    'If the message is NOT a change of this video but a request for ANOTHER video, answer {"newRequest":true}.',
    'Answer with ONE JSON object only: {"newRequest":false,"texts":{"<scene key>":{"<field>":"<new text>"}},"voiceLines":{"<scene key>":"<spoken line>"}?,"visual":{"<scene key>":"<change>"}?,"style":…?,"music":…?,"sfx":…?,"voice":…?,"reply":"one short friendly sentence in the client’s language saying exactly what you changed"}',
  ].join('\n');
  const user = [
    `LANGUAGE: ${language}`,
    `STYLE: ${video.storyboard.style} · MUSIC: ${video.brief.musicMood} · SFX: ${video.sfx?.enabled ? 'on' : 'off'} · VOICE: ${video.voice?.enabled ? 'on' : 'off'}`,
    `BRIEF: ${(video.brief.request || `${video.brief.message} ${video.brief.details || ''}`).replace(/\s+/g, ' ').trim().slice(0, 900)}`,
    'SCENES (in order):',
    ...video.storyboard.scenes.map((sc, i) => {
      const defs = SCENES[sc.sceneId as keyof typeof SCENES]?.slots || [];
      const fields = defs.map((d) => `${d.key}(max ${slotLimit(d.max, !!sc.script)})=${JSON.stringify(sc.slots?.[d.key] || '')}`).join(' ');
      const media = sc.video ? 'clip' : sc.image ? 'photo' : 'none';
      const voice = lines.get(sc.key);
      return `${i + 1}. key=${sc.key} role=${sc.sceneId} ${sc.duration.toFixed(1)}s media=${media}${sc.code?.tsx ? ' coded' : ''} fields: ${fields || '(no text field)'}${voice ? ` voice=${JSON.stringify(voice)}` : ''}`;
    }),
    `CLIENT REQUEST: ${feedback.slice(0, 800)}`,
  ].join('\n');
  return { system, user };
}

function extractJson(raw: string): any {
  const s = raw.replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}

/** La réponse du modèle, validée contre la vidéo (scènes, cases, longueurs, listes). */
export function parseVideoRevision(raw: string, video: MotionVideo): VideoRevision | null {
  const json = extractJson(raw);
  if (!json || typeof json !== 'object') return null;
  if (json.newRequest === true) return { newRequest: true, patch: {} };
  const patch: VideoRevisionPatch = {};
  let rejected = 0;
  const texts = json.texts && typeof json.texts === 'object' ? json.texts : {};
  for (const [key, fields] of Object.entries(texts)) {
    // Une scène désignée par son numéro (« 3 ») plutôt que par sa clé est retrouvée.
    const scene = video.storyboard.scenes.find((sc) => sc.key === key) || (/^\d{1,2}$/.test(key) ? video.storyboard.scenes[Number(key) - 1] : undefined);
    if (!scene || !fields || typeof fields !== 'object') {
      rejected++;
      continue;
    }
    const defs = SCENES[scene.sceneId as keyof typeof SCENES]?.slots || [];
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      const def = defs.find((d) => d.key === field);
      if (!def || typeof value !== 'string') {
        rejected++;
        continue;
      }
      const text = value.replace(/\s+/g, ' ').trim().slice(0, slotLimit(def.max, !!scene.script));
      if (!text || text === scene.slots?.[field]) continue;
      (patch.slots ??= {})[scene.key] = { ...(patch.slots[scene.key] || {}), [field]: text };
    }
  }
  if (MOTION_STYLES.includes(json.style) && json.style !== video.storyboard.style) patch.style = json.style;
  if (MUSIC_MOODS.includes(json.music) && json.music !== video.brief.musicMood) patch.musicMood = json.music;
  if (typeof json.sfx === 'boolean') patch.sfx = json.sfx;
  if (typeof json.voice === 'boolean' && json.voice !== !!video.voice?.enabled) patch.voice = json.voice;
  const keyed = (raw: unknown, max: number): Record<string, string> | undefined => {
    if (!raw || typeof raw !== 'object') return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value !== 'string' || !video.storyboard.scenes.some((sc) => sc.key === key)) continue;
      const text = value.replace(/\s+/g, ' ').trim().slice(0, max);
      if (text) out[key] = text;
    }
    return Object.keys(out).length ? out : undefined;
  };
  const voiceLines = keyed(json.voiceLines, 400);
  if (voiceLines) patch.voiceLines = voiceLines;
  const visual = keyed(json.visual, 600);
  if (visual) patch.visual = visual;
  const reply = typeof json.reply === 'string' ? json.reply.replace(/\s+/g, ' ').trim().slice(0, 300) : undefined;
  return { newRequest: false, patch, ...(reply ? { reply } : {}), ...(rejected ? { rejected } : {}) };
}
