/**
 * RETOUCHER UNE VIDÉO EN ÉCRIVANT — « change le titre de la scène 2 », « plus sobre », « sans
 * musique », « ajoute une voix off ».
 *
 * Le modèle lit les scènes (clé, rôle, textes), le style, la musique, et le retour du client ; il
 * rend SEULEMENT ce qui change. Le code ne lui fait pas confiance : une scène inconnue, une case
 * qui n'existe pas dans la scène, un texte trop long, un style hors liste sont écartés. Il peut
 * aussi dire que le message est une NOUVELLE demande (et non un changement) : la conversation crée
 * alors une autre vidéo.
 */
import { SCENES } from './video.scenes';
import { MOTION_STYLES, MotionStyle, MotionVideo, MUSIC_MOODS, MusicMood } from './video.model';

export interface VideoRevisionPatch {
  slots?: Record<string, Record<string, string>>;
  style?: MotionStyle;
  musicMood?: MusicMood;
  sfx?: boolean;
  voice?: boolean;
}

export interface VideoRevision {
  /** Le message demande une autre vidéo (pas un changement de celle-ci). */
  newRequest: boolean;
  patch: VideoRevisionPatch;
  reply?: string;
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

export function buildVideoRevisionPrompt(video: MotionVideo, feedback: string, language: string): { system: string; user: string } {
  const scenes = video.storyboard.scenes.map((sc, i) => ({ n: i + 1, key: sc.key, role: sc.sceneId, texts: sc.slots || {} }));
  const system = [
    'You are the video editor who made this short motion-design video. The client now asks for changes, in their own words.',
    'Apply the request — and only it: keep everything they did not question. Texts stay in the video language, short, natural.',
    'You may change: the texts of scenes (only existing text fields of a scene), the style ("energetic" | "premium" | "playful" | "corporate"), the music mood ("auto" | "upbeat" | "calm" | "epic" | "corporate" | "afro" | "none"), sound effects (true/false), voice-over (true/false).',
    'If the message is NOT a change of this video but a request for ANOTHER video, answer {"newRequest":true}.',
    'Answer with ONE JSON object only: {"newRequest":false,"texts":{"<scene key>":{"<field>":"<new text>"}},"style":…?,"music":…?,"sfx":…?,"voice":…?,"reply":"one short friendly sentence in the client’s language saying what you changed"}',
  ].join('\n');
  const user = [
    `LANGUAGE: ${language}`,
    `STYLE: ${video.storyboard.style} · MUSIC: ${video.brief.musicMood} · SFX: ${video.sfx?.enabled ? 'on' : 'off'} · VOICE: ${video.voice?.enabled ? 'on' : 'off'}`,
    'SCENES (in order):',
    ...scenes.map((s) => `${s.n}. key=${s.key} role=${s.role} texts=${JSON.stringify(s.texts)}`),
    `CLIENT REQUEST: ${feedback.slice(0, 600)}`,
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
  const texts = json.texts && typeof json.texts === 'object' ? json.texts : {};
  for (const [key, fields] of Object.entries(texts)) {
    const scene = video.storyboard.scenes.find((sc) => sc.key === key);
    if (!scene || !fields || typeof fields !== 'object') continue;
    const defs = SCENES[scene.sceneId as keyof typeof SCENES]?.slots || [];
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      const def = defs.find((d) => d.key === field);
      if (!def || typeof value !== 'string') continue;
      const text = value.replace(/\s+/g, ' ').trim().slice(0, def.max);
      if (!text || text === scene.slots?.[field]) continue;
      (patch.slots ??= {})[key] = { ...(patch.slots[key] || {}), [field]: text };
    }
  }
  if (MOTION_STYLES.includes(json.style) && json.style !== video.storyboard.style) patch.style = json.style;
  if (MUSIC_MOODS.includes(json.music) && json.music !== video.brief.musicMood) patch.musicMood = json.music;
  if (typeof json.sfx === 'boolean') patch.sfx = json.sfx;
  if (typeof json.voice === 'boolean' && json.voice !== !!video.voice?.enabled) patch.voice = json.voice;
  const reply = typeof json.reply === 'string' ? json.reply.replace(/\s+/g, ' ').trim().slice(0, 300) : undefined;
  return { newRequest: false, patch, ...(reply ? { reply } : {}) };
}
