import { IDEM, Localized, SeoLocale } from './ecosystem';
import { landingUrl } from './landing';

/**
 * Le blog vu par le référencement : les types de billets, leurs noms dans chaque langue, ce que
 * le lecteur (humain, moteur ou IA) doit en attendre, et le type schema.org qui le dit aux robots.
 *
 * Lu par l'API (pages servies aux robots, plan du site, `llms.txt`) et par le landing (filtres,
 * étiquettes, JSON-LD) : un type ajouté ici apparaît partout sous le même nom. La liste est la
 * même que `BLOG_KINDS` du schéma de l'API, dans le même ordre.
 */

export const BLOG_KIND_IDS = ['article', 'release', 'announcement', 'event', 'guide', 'story', 'press'] as const;
export type BlogKindId = (typeof BLOG_KIND_IDS)[number];

export interface BlogKindInfo {
  id: BlogKindId;
  label: Localized;
  plural: Localized;
  /** Ce que contient ce type de billet, en une phrase (filtres, `llms.txt`). */
  description: Localized;
  /** Le type schema.org du billet. Un événement est AUSSI décrit par un nœud `Event`. */
  schemaType: 'BlogPosting' | 'NewsArticle' | 'TechArticle';
}

export const BLOG_KINDS_INFO: Record<BlogKindId, BlogKindInfo> = {
  article: {
    id: 'article',
    label: { fr: 'Article', en: 'Article' },
    plural: { fr: 'Articles', en: 'Articles' },
    description: {
      fr: 'Analyses et conseils pour créer et faire grandir un business en Afrique.',
      en: 'Analysis and advice on building and growing a business in Africa.',
    },
    schemaType: 'BlogPosting',
  },
  release: {
    id: 'release',
    label: { fr: 'Nouveauté', en: 'Release' },
    plural: { fr: 'Nouveautés', en: 'Releases' },
    description: {
      fr: 'Ce qui change dans IDEM, version par version.',
      en: 'What changes in IDEM, release by release.',
    },
    schemaType: 'NewsArticle',
  },
  announcement: {
    id: 'announcement',
    label: { fr: 'Annonce', en: 'Announcement' },
    plural: { fr: 'Annonces', en: 'Announcements' },
    description: {
      fr: 'Les nouvelles officielles d’IDEM : lancements, pays, partenariats, offres.',
      en: 'Official IDEM news: launches, countries, partnerships, offers.',
    },
    schemaType: 'NewsArticle',
  },
  event: {
    id: 'event',
    label: { fr: 'Événement', en: 'Event' },
    plural: { fr: 'Événements', en: 'Events' },
    description: {
      fr: 'Ateliers, webinaires et rencontres organisés par IDEM ou auxquels IDEM participe.',
      en: 'Workshops, webinars and meetups run by IDEM or where IDEM takes part.',
    },
    schemaType: 'BlogPosting',
  },
  guide: {
    id: 'guide',
    label: { fr: 'Guide', en: 'Guide' },
    plural: { fr: 'Guides', en: 'Guides' },
    description: {
      fr: 'Des pas-à-pas pour se servir d’IDEM, du business plan à la mise en ligne.',
      en: 'Step-by-step guides to using IDEM, from business plan to go-live.',
    },
    schemaType: 'TechArticle',
  },
  story: {
    id: 'story',
    label: { fr: 'Témoignage', en: 'Customer story' },
    plural: { fr: 'Témoignages', en: 'Customer stories' },
    description: {
      fr: 'Des entrepreneurs racontent comment ils ont lancé leur business avec IDEM.',
      en: 'Entrepreneurs tell how they launched their business with IDEM.',
    },
    schemaType: 'BlogPosting',
  },
  press: {
    id: 'press',
    label: { fr: 'Presse', en: 'Press' },
    plural: { fr: 'Presse', en: 'Press' },
    description: {
      fr: 'Communiqués de presse et articles parus sur IDEM.',
      en: 'Press releases and media coverage of IDEM.',
    },
    schemaType: 'NewsArticle',
  },
};

export function isBlogKind(value: unknown): value is BlogKindId {
  return (BLOG_KIND_IDS as readonly unknown[]).includes(value);
}

/** L'adresse publique d'un billet. */
export function blogPostUrl(slug: string, locale: SeoLocale): string {
  return landingUrl(`/blog/${encodeURIComponent(slug)}`, locale);
}

/** La version Markdown d'un billet, pour les agents IA (servie par l'API derrière le landing). */
export function blogMarkdownUrl(slug: string, locale: SeoLocale): string {
  return `${blogPostUrl(slug, locale)}.md`;
}

/** Le plan du site du blog d'une langue (servi par l'API derrière le landing). */
export function blogSitemapUrl(locale: SeoLocale): string {
  return `${IDEM.url}/sitemap-blog-${locale}.xml`;
}

/** Le résumé d'IDEM pour les IA, et la version complète (billets en entier). */
export const LLMS_TXT_URL = `${IDEM.url}/llms.txt`;
export const LLMS_FULL_TXT_URL = `${IDEM.url}/llms-full.txt`;

/**
 * Les robots des moteurs et des assistants IA, nommés dans `robots.txt` pour dire clairement
 * qu'ils sont les bienvenus. La même liste (en minuscules) reconnaît les robots dans
 * `apps/landing/nginx.conf`, qui leur sert les billets en HTML complet : `npm run seo:check`
 * (et `seo:sync`) écrit la reconnaissance nginx depuis cette liste.
 */
export const CRAWLERS = [
  // Moteurs de recherche
  'Googlebot',
  'Bingbot',
  'Applebot',
  'DuckDuckBot',
  'YandexBot',
  'Baiduspider',
  // Assistants et moteurs IA
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Amazonbot',
  'Meta-ExternalAgent',
  'MistralAI-User',
  'cohere-ai',
  'CCBot',
  'DuckAssistBot',
  // Aperçus de partage
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'TelegramBot',
  'Slackbot',
  'Discordbot',
] as const;

/**
 * L'expression nginx qui reconnaît ces robots dans l'en-tête User-Agent (insensible à la casse).
 * `npm run seo:sync` l'écrit dans `apps/landing/nginx.conf`, sous le repère `idem-seo:crawlers`.
 */
export function crawlerUserAgentPattern(): string {
  const names = CRAWLERS.map((c) => c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `"~*(${names.join('|')})" 1;`;
}
