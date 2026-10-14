/**
 * RETOUCHER UNE VIDÉO EN ÉCRIVANT — « le titre de la scène 2 en … », « la scène 3 plus dynamique »,
 * « sans musique », « ajoute une voix off ».
 *
 * Le modèle lit chaque scène telle qu'elle est (clé, intention, textes, ligne de voix, état) et le
 * retour du client ; il rend SEULEMENT ce qui change. Un changement de TEXTE change une donnée ; un
 * changement VISUEL (mise en page, mouvement, couleur, rythme) est une consigne passée à l'auteur
 * de la scène, qui réécrit son code. Le code ne fait pas confiance au modèle : une scène ou une clé
 * de texte inconnue est écartée. Le message peut aussi être une NOUVELLE demande.
 */
import { MotionVideo, MUSIC_MOODS, MusicMood } from './contracts/model';
import type { VideoPatch } from './motionVideo.service';

export type VideoRevisionPatch = Pick<VideoPatch, 'texts' | 'musicMood' | 'sfx' | 'voice' | 'voiceLines' | 'visual' | 'captions'>;

export interface VideoRevision {
  newRequest: boolean;
  patch: VideoRevisionPatch;
  reply?: string;
  /** Changements proposés mais écartés (scène ou clé inconnue). */
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
  if (/(sans|enleve|retire|pas de)\s+(les\s+)?sous[- ]?titres|no subtitles/.test(t)) out.captions = false;
  else if (/(ajoute|mets|avec)\s+(des\s+)?sous[- ]?titres|add subtitles/.test(t)) out.captions = true;
  return out;
}

export function buildVideoRevisionPrompt(video: MotionVideo, feedback: string, language: string): { system: string; user: string } {
  const film = video.film!;
  const system = [
    'You edit an existing short motion-design video for a client. Read the scenes and the client message, then write ONLY what changes.',
    'Answer with lines, nothing else:',
    'NEW: yes — only if the client asks for a different, new video (not a change of this one)',
    'TEXT s2.headline: <new exact text>   (only existing keys of that scene)',
    'VOICE s3: <new spoken line>',
    'VISUAL s2: <what to change in how scene s2 looks or moves, as a clear instruction for the animator>',
    'VISUAL all: <instruction for every scene>',
    `MUSIC: one of ${MUSIC_MOODS.join(', ')}`,
    'SFX: on | off',
    'VOICEOVER: on | off',
    'SUBTITLES: on | off',
    `REPLY: one short sentence to the client, in ${language}, saying what you changed`,
    'Texts and voice lines are written in the language of the video. Never invent prices, numbers or claims.',
  ].join('\n');
  const user = [
    `VIDEO: ${film.title} — ${film.concept}`,
    ...film.scenes.map((s, i) => `${s.key} (scene ${i + 1}, ${s.duration.toFixed(1)} s${s.status === 'error' ? ', currently broken' : ''}): ${s.purpose} | visual: ${s.visual.slice(0, 200)} | texts: ${Object.entries(s.texts).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ') || 'none'}${s.voiceText ? ` | voice: ${JSON.stringify(s.voiceText)}` : ''}`),
    `MUSIC: ${video.brief.musicMood} · SFX: ${video.sfx?.enabled ? 'on' : 'off'} · VOICEOVER: ${video.voice?.enabled ? 'on' : 'off'} · SUBTITLES: ${film.captions ? 'on' : 'off'}`,
    `CLIENT: ${feedback.slice(0, 2000)}`,
  ].join('\n');
  return { system, user };
}

export function parseVideoRevision(raw: string, video: MotionVideo): VideoRevision | null {
  const film = video.film;
  if (!film || !raw.trim()) return null;
  const keys = new Map(film.scenes.map((s) => [s.key, s] as const));
  // « scène 2 » ou « 2 » valent « s2 ».
  const sceneKey = (v: string) => {
    const m = v.trim().toLowerCase().match(/^(?:s|sc[eè]ne\s*)?(\d{1,2})$/);
    return m ? `s${m[1]}` : v.trim().toLowerCase();
  };
  const patch: VideoRevisionPatch = {};
  let reply: string | undefined;
  let newRequest = false;
  let rejected = 0;
  for (const line of raw.replace(/```[a-z]*\n?/gi, '').split(/\r?\n/)) {
    const m = line.match(/^[\s*_>-]*([A-Za-z]+)\s*([^:]*?)\s*:\s*(.+)$/);
    if (!m) continue;
    const field = m[1].toUpperCase();
    const target = m[2].trim();
    const value = m[3].trim().replace(/^["“«]\s*|\s*["”»]$/g, '');
    if (field === 'NEW') newRequest = /^(yes|oui|true)/i.test(value);
    else if (field === 'REPLY') reply = value.slice(0, 300);
    else if (field === 'TEXT') {
      const [scene, key] = target.split('.');
      const sc = keys.get(sceneKey(scene || ''));
      if (!sc || !key || !(key in sc.texts)) {
        rejected++;
        continue;
      }
      patch.texts = { ...(patch.texts || {}), [sc.key]: { ...(patch.texts?.[sc.key] || {}), [key]: value.slice(0, 220) } };
    } else if (field === 'VOICE') {
      const sc = keys.get(sceneKey(target));
      if (!sc) {
        rejected++;
        continue;
      }
      patch.voiceLines = { ...(patch.voiceLines || {}), [sc.key]: value.slice(0, 400) };
    } else if (field === 'VISUAL') {
      const key = /^all|tout/i.test(target) ? 'all' : sceneKey(target);
      if (key !== 'all' && !keys.has(key)) {
        rejected++;
        continue;
      }
      patch.visual = { ...(patch.visual || {}), [key]: value.slice(0, 800) };
    } else if (field === 'MUSIC') {
      const mood = value.toLowerCase() as MusicMood;
      if (MUSIC_MOODS.includes(mood)) patch.musicMood = mood;
    } else if (field === 'SFX') patch.sfx = /^(on|oui|yes)/i.test(value);
    else if (field === 'VOICEOVER') patch.voice = /^(on|oui|yes)/i.test(value);
    else if (field === 'SUBTITLES') patch.captions = /^(on|oui|yes)/i.test(value);
  }
  return { newRequest, patch, ...(reply ? { reply } : {}), ...(rejected ? { rejected } : {}) };
}
