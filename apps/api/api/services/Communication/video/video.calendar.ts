/**
 * VIDÉOS DU CALENDRIER ÉDITORIAL.
 *
 * Le calendrier propose SOUVENT des vidéos (un contenu sur trois au moins, sur
 * les réseaux qui les mettent en avant), et chaque contenu vidéo porte son TYPE :
 * « Générer » crée exactement ce type. Le planificateur propose un type ; le code
 * le valide, le complète quand il manque, et garantit la part de vidéos — une
 * contrainte de proportion n'a rien à faire dans un prompt.
 */
import { ContentChannel, ContentFormat, ContentIdea, ContentVideoPlan, VIDEO_PLAN_MUSIC, VIDEO_PLAN_VOICES, VideoPlanBeat, VideoPlanMusic, VideoPlanVoice, VisualIntent } from '../../../models/communication.model';
import { VIDEO_TYPES, VideoObjective, VideoType } from '../../../models/motionVideo.model';
import { formatCreativeBrief } from '../../../../../ivision/core/src/video/request/enhance';

/** Formats qui sont des vidéos. */
export const VIDEO_FORMATS: ContentFormat[] = ['reel', 'short-video'];

/** Réseaux où la vidéo est mise en avant, et le format vidéo qu'on y publie. */
const VIDEO_CHANNELS: Partial<Record<ContentChannel, ContentFormat>> = {
  tiktok: 'reel',
  instagram: 'reel',
  facebook: 'reel',
  youtube: 'short-video',
  linkedin: 'short-video',
  x: 'short-video',
};

/** Durées des vidéos du calendrier : de 1 à 3 minutes, jamais un format court de 15 s. */
export const CALENDAR_VIDEO_DURATIONS = [60, 90, 120, 180] as const;
export type CalendarVideoDuration = (typeof CALENDAR_VIDEO_DURATIONS)[number];

/** Ordre de repli : alterne court et long pour que la période ne soit jamais uniforme. */
const DURATION_CYCLE: CalendarVideoDuration[] = [60, 120, 90, 180];

/** La durée proposée par le modèle, ramenée à la plus proche des durées admises (minimum 1 minute). */
export function normaliseVideoDuration(proposed: unknown): CalendarVideoDuration | undefined {
  const n = Number(proposed);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return CALENDAR_VIDEO_DURATIONS.reduce((best, d) => (Math.abs(d - n) < Math.abs(best - n) ? d : best));
}

/**
 * Donne à chaque vidéo sa durée : celle du modèle si valide, sinon le cycle. Si toutes les vidéos de la
 * période tombent sur la même durée, le cycle reprend la main — la variété est une règle, pas un souhait.
 */
function assignVideoDurations(items: ContentIdea[]): ContentIdea[] {
  const videos = items.filter((i) => isVideoFormat(i.format));
  const proposed = videos.map((i) => normaliseVideoDuration(i.videoDurationSec));
  const distinct = new Set(proposed.filter(Boolean)).size;
  const forceCycle = videos.length > 1 && distinct < Math.min(2, videos.length);
  let rank = 0;
  return items.map((item) => {
    if (!isVideoFormat(item.format)) return { ...item, videoDurationSec: undefined, videoPlan: undefined };
    const own = forceCycle ? undefined : normaliseVideoDuration(item.videoDurationSec);
    const videoDurationSec = own ?? DURATION_CYCLE[rank % DURATION_CYCLE.length];
    rank++;
    return { ...item, videoDurationSec };
  });
}

/** Part minimale de vidéos dans une période. */
const VIDEO_SHARE = 1 / 3;

export const isVideoFormat = (format: ContentFormat | undefined): boolean => !!format && VIDEO_FORMATS.includes(format);

/**
 * Le type de vidéo d'un contenu, d'après son intention et ce qu'il raconte.
 * `hasPhotos` : le projet a déjà des photos (visuels, produits) à mettre en scène.
 */
export function suggestVideoType(item: Pick<ContentIdea, 'title' | 'hook' | 'description' | 'intent' | 'channel'>, hasPhotos: boolean): VideoType {
  const text = `${item.title} ${item.hook} ${item.description}`.toLowerCase();
  if (/\blogo\b|identit[ée] visuelle|nouvelle image de marque|rebranding/.test(text)) return 'logo';
  if (/\b3d\b|packaging|emballage|bouteille|flacon|objet/.test(text)) return 'showcase3d';
  if (/coulisses|behind|atelier|terrain|reportage|journ[ée]e type|making-of|en action/.test(text)) return 'footage';
  if (/collection|galerie|album|avant.?apr[eè]s|lookbook|r[ée]alisations/.test(text)) return hasPhotos ? 'slideshow' : 'mix';
  if (/produit|nouveaut[ée]|gamme|lancement|d[ée]couvrez notre/.test(text)) return hasPhotos ? 'product' : 'showcase3d';
  switch (item.intent as VisualIntent | undefined) {
    case 'promotion':
      return 'promo';
    case 'celebration':
      return 'illustrated';
    case 'recruitment':
    case 'announcement':
      return 'kinetic';
    default:
      // Notoriété : une vidéo combinée raconte mieux qu'un seul procédé.
      return item.channel === 'youtube' || item.channel === 'linkedin' ? 'mix' : hasPhotos ? 'slideshow' : 'mix';
  }
}

/** L'objectif de la vidéo, depuis l'intention du contenu. */
export function objectiveForContent(item: Pick<ContentIdea, 'intent' | 'title' | 'description'>): VideoObjective {
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (/ouverture|inaugur/.test(text)) return 'opening';
  if (/avis|t[ée]moign|clients? (disent|racontent)/.test(text)) return 'testimonial';
  switch (item.intent) {
    case 'promotion':
      return 'promotion';
    case 'recruitment':
      return 'recruitment';
    case 'celebration':
      return 'event';
    case 'announcement':
      return 'announce';
    default:
      return /produit|gamme|collection/.test(text) ? 'product' : 'announce';
  }
}

/** Le type proposé par le modèle s'il est valide, sinon celui déduit du contenu. */
export function normaliseVideoType(proposed: unknown, item: ContentIdea, hasPhotos: boolean): VideoType {
  return VIDEO_TYPES.includes(proposed as VideoType) ? (proposed as VideoType) : suggestVideoType(item, hasPhotos);
}

/**
 * Garantit la part de vidéos d'une période : si le modèle en a proposé trop peu,
 * des publications sur des réseaux vidéo deviennent des vidéos, réparties sur la
 * période (jamais deux conversions de suite). Chaque vidéo reçoit son type.
 */
export function ensureVideoShare(items: ContentIdea[], hasPhotos: boolean): ContentIdea[] {
  const out = items.map((item) => (isVideoFormat(item.format) ? { ...item, videoType: normaliseVideoType(item.videoType, item, hasPhotos), videoPlan: normaliseVideoPlan(item.videoPlan) } : { ...item, videoType: undefined, videoPlan: undefined }));
  const target = Math.ceil(out.length * VIDEO_SHARE);
  let count = out.filter((i) => isVideoFormat(i.format)).length;
  if (count >= target) return assignVideoDurations(out);
  const order = out
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !isVideoFormat(item.format) && VIDEO_CHANNELS[item.channel] && !['article', 'newsletter'].includes(item.format))
    .sort((a, b) => a.item.scheduledFor.localeCompare(b.item.scheduledFor));
  // Une sur deux d'abord (étalement), puis le reste si besoin.
  const picks = [...order.filter((_, i) => i % 2 === 0), ...order.filter((_, i) => i % 2 === 1)];
  for (const { index } of picks) {
    if (count >= target) break;
    const item = out[index];
    const format = VIDEO_CHANNELS[item.channel]!;
    out[index] = { ...item, format, videoType: suggestVideoType(item, hasPhotos) };
    count++;
  }
  return assignVideoDurations(out);
}

// ─── Le plan d'une vidéo du calendrier ────────────────────────────────────────

const clip = (value: unknown, max: number): string =>
  typeof value === 'string'
    ? value
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
        .replace(/[«»“”"]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

/**
 * Le plan proposé par le planificateur, ramené à sa forme : textes bornés, sans émoji ni guillemets (un texte entre
 * guillemets serait exigé à la lettre par le lecteur de demande), personnage et musique pris dans leurs listes, 2 à 9
 * temps. Rend `undefined` quand il n'y a rien d'exploitable : le directeur de création écrira le déroulé à la génération.
 */
export function normaliseVideoPlan(raw: unknown): ContentVideoPlan | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const beats: VideoPlanBeat[] = (Array.isArray(r.beats) ? r.beats : [])
    .map((b: any) => ({ name: clip(b?.name, 60), see: clip(b?.see, 320), text: clip(b?.text, 200) || undefined, voice: clip(b?.voice, 300) || undefined }))
    .filter((b) => b.see)
    .slice(0, 9);
  const show = (Array.isArray(r.show) ? r.show : []).map((x) => clip(x, 140)).filter(Boolean).slice(0, 8);
  const voiceover = r.voiceover !== false;
  if (!beats.length && !show.length && typeof r.voiceover !== 'boolean') return undefined;
  return {
    voiceover,
    ...(voiceover && clip(r.voiceTone, 160) ? { voiceTone: clip(r.voiceTone, 160) } : {}),
    ...(voiceover && VIDEO_PLAN_VOICES.includes(r.voicePersona as VideoPlanVoice) ? { voicePersona: r.voicePersona as VideoPlanVoice } : {}),
    ...(VIDEO_PLAN_MUSIC.includes(r.music as VideoPlanMusic) ? { music: r.music as VideoPlanMusic } : {}),
    ...(clip(r.pacing, 240) ? { pacing: clip(r.pacing, 240) } : {}),
    show,
    beats: beats.map((b) => (voiceover ? b : { ...b, voice: undefined })),
    ...(clip(r.ending, 240) ? { ending: clip(r.ending, 240) } : {}),
  };
}

/**
 * Le contenu et son plan → la DEMANDE de la vidéo, mise en forme comme un brief de production (même mise en forme que
 * le directeur de création du moteur : jamais lue comme un scénario mot pour mot). Sans plan : l'angle du contenu.
 */
export function videoRequestOf(item: Pick<ContentIdea, 'title' | 'hook' | 'description' | 'callToAction' | 'videoPlan'>, language = 'fr'): string {
  const angle = [item.hook || item.title, item.title !== item.hook ? item.title : '', item.description].filter(Boolean).join('. ').replace(/\.\s*\./g, '.');
  const plan = item.videoPlan;
  if (!plan || !plan.beats.length) return [angle, item.callToAction].filter(Boolean).join('\n');
  return formatCreativeBrief(
    {
      keyMessage: item.hook || item.title,
      story: item.description,
      voiceover: plan.voiceover,
      ...(plan.voiceTone ? { voiceTone: plan.voiceTone } : {}),
      ...(plan.pacing ? { pacing: plan.pacing } : {}),
      show: plan.show,
      beats: plan.beats,
      ...(plan.ending || item.callToAction ? { ending: [plan.ending, item.callToAction].filter(Boolean).join(', ') } : {}),
      ...(plan.music ? { music: plan.music } : {}),
    },
    language,
    item.title
  );
}
