/**
 * VIDÉOS DU CALENDRIER ÉDITORIAL.
 *
 * Le calendrier propose SOUVENT des vidéos (un contenu sur trois au moins, sur
 * les réseaux qui les mettent en avant), et chaque contenu vidéo porte son TYPE :
 * « Générer » crée exactement ce type. Le planificateur propose un type ; le code
 * le valide, le complète quand il manque, et garantit la part de vidéos — une
 * contrainte de proportion n'a rien à faire dans un prompt.
 */
import { ContentChannel, ContentFormat, ContentIdea, VisualIntent } from '../../../models/communication.model';
import { VIDEO_TYPES, VideoObjective, VideoType } from '../../../models/motionVideo.model';

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
  const out = items.map((item) => (isVideoFormat(item.format) ? { ...item, videoType: normaliseVideoType(item.videoType, item, hasPhotos) } : { ...item, videoType: undefined }));
  const target = Math.ceil(out.length * VIDEO_SHARE);
  let count = out.filter((i) => isVideoFormat(i.format)).length;
  if (count >= target) return out;
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
  return out;
}
