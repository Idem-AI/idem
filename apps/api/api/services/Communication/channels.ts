/**
 * Normalisation des canaux de publication.
 *
 * ── Le problème ───────────────────────────────────────────────────────────────
 * `ContentChannel` est une énumération en minuscules (`instagram`, `linkedin`…),
 * mais la valeur arrivait d'un modèle de langage à qui on demandait « primary
 * channels » en texte libre. Il répondait donc « Instagram », « LinkedIn »,
 * parfois « Instagram & Facebook » ou « Réseaux sociaux ».
 *
 * Ces valeurs traversaient tout le module sans contrôle, et l'interface en
 * héritait de deux défauts visibles :
 *  - la clé de traduction `…channels.Instagram` n'existait pas, si bien que la
 *    CLÉ BRUTE s'affichait à la place du nom du réseau ;
 *  - la table d'icônes ne reconnaissait pas la valeur et retombait sur son icône
 *    par défaut — tous les réseaux affichaient donc le même globe.
 *
 * ── Le principe ───────────────────────────────────────────────────────────────
 * Ce qu'un algorithme peut décider ne doit pas être demandé au modèle. Le prompt
 * énumère désormais les valeurs admises, ET cette fonction les impose de toute
 * façon : une valeur inconnue est ramenée, jamais recopiée telle quelle.
 *
 * Elle sert aussi de rattrapage pour les projets déjà en base, produits avant ce
 * contrôle : aucune migration de données n'est nécessaire.
 */
import { ContentChannel } from '../../models/communication.model';

/** Les seules valeurs qu'un canal peut prendre. */
export const CONTENT_CHANNELS: ContentChannel[] = [
  'instagram',
  'linkedin',
  'facebook',
  'tiktok',
  'x',
  'youtube',
  'blog',
  'email',
  'other',
];

/**
 * Ce qu'on rencontre réellement en sortie de modèle, ou saisi à la main.
 *
 * Les clés sont comparées sur une forme réduite (minuscules, sans accent ni
 * séparateur) : `LinkedIn`, `linked-in` et `LINKED IN` tombent tous sur `linkedin`.
 */
const ALIASES: Record<string, ContentChannel> = {
  // Instagram
  instagram: 'instagram',
  insta: 'instagram',
  ig: 'instagram',
  instagramreels: 'instagram',
  instagramstories: 'instagram',
  reels: 'instagram',
  // LinkedIn
  linkedin: 'linkedin',
  li: 'linkedin',
  // Facebook
  facebook: 'facebook',
  fb: 'facebook',
  meta: 'facebook',
  facebookpage: 'facebook',
  messenger: 'facebook',
  // TikTok
  tiktok: 'tiktok',
  tikok: 'tiktok',
  // X / Twitter
  x: 'x',
  twitter: 'x',
  xtwitter: 'x',
  tweet: 'x',
  // YouTube
  youtube: 'youtube',
  yt: 'youtube',
  youtubeshorts: 'youtube',
  shorts: 'youtube',
  // Blog / site
  blog: 'blog',
  website: 'blog',
  site: 'blog',
  siteweb: 'blog',
  webblog: 'blog',
  article: 'blog',
  articles: 'blog',
  seo: 'blog',
  // E-mail
  email: 'email',
  mail: 'email',
  emailing: 'email',
  newsletter: 'email',
  emailmarketing: 'email',
  // Explicitement « autre »
  other: 'other',
  autre: 'other',
  // Termes génériques : le modèle les propose souvent, ils ne désignent aucun
  // réseau. Les ramener sur `other` vaut mieux que de les laisser passer.
  socialmedia: 'other',
  social: 'other',
  reseauxsociaux: 'other',
  whatsapp: 'other',
  telegram: 'other',
  pinterest: 'other',
  snapchat: 'other',
};

/** Forme réduite d'une valeur : minuscules, sans accent ni séparateur. */
function reduce(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Ramène une valeur quelconque vers un canal valide.
 *
 * Renvoie `null` quand rien ne correspond, pour que l'appelant décide : écarter
 * la valeur (dans une liste de canaux, où un `other` de plus n'apporte rien) ou
 * la remplacer par un défaut (sur un contenu, qui doit bien avoir un canal).
 */
export function toContentChannel(value: unknown): ContentChannel | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const key = reduce(value);
  if (!key) return null;
  if (ALIASES[key]) return ALIASES[key];

  // Valeur composée (« Instagram et Facebook », « LinkedIn / X ») : on retient le
  // premier réseau reconnu plutôt que de tout perdre.
  for (const part of value.split(/[,/&+]|\bet\b|\band\b/i)) {
    const alias = ALIASES[reduce(part)];
    if (alias) return alias;
  }
  return null;
}

/**
 * Nettoie une liste de canaux : valeurs valides, sans doublon, ordre conservé.
 *
 * Les valeurs non reconnues sont ÉCARTÉES et non converties en `other` : dans une
 * liste, « Réseaux sociaux » n'ajoute aucune information exploitable, alors qu'un
 * `other` demanderait ensuite de composer un visuel pour un réseau inconnu.
 */
export function toContentChannels(values: unknown): ContentChannel[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<ContentChannel>();
  for (const value of values) {
    const channel = toContentChannel(value);
    if (channel) seen.add(channel);
  }
  return [...seen];
}
