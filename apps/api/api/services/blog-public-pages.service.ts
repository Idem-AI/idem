import { FilterQuery } from 'mongoose';
import {
  BLOG_KINDS_INFO,
  BLOG_KIND_IDS,
  DEFINITION,
  IDEM,
  LLMS_FULL_TXT_URL,
  LLMS_TXT_URL,
  OG_LOCALE,
  PROMISE_LONG,
  SERVICES,
  WORKFLOW,
  blogMarkdownUrl,
  blogPostUrl,
  brandedTitle,
  buildPageGraph,
  jsonLdString,
  landingUrl,
  ogImageUrl,
  type BlogKindId,
  type JsonLdNode,
  type SeoLocale,
} from '../../../../packages/shared-seo/src';
import { BlogPost, BlogPostDocument } from '../schemas/blogPost.schema';
import { BlogError, blogService, toLocale } from './blog.service';

/**
 * Le blog tel que le lisent les robots et les assistants IA.
 *
 * Le landing est un site statique : les billets, publiés depuis le panel sans nouvelle version du
 * site, n'y existent qu'une fois le JavaScript exécuté — ce que la plupart des robots et des IA ne
 * font pas. nginx (`apps/landing/nginx.conf`) leur sert donc, sur les MÊMES adresses, les pages
 * produites ici : même contenu que pour un visiteur, mais en HTML complet, avec les balises de
 * partage et le JSON-LD (`@idem/shared-seo`).
 *
 * S'y ajoutent ce que les IA lisent volontiers : `llms.txt` (ce qu'est IDEM, ses services, les
 * derniers billets), `llms-full.txt` (les billets en entier) et une version Markdown de chaque
 * billet. Et le plan du site du blog, toujours à jour.
 */

type PostSummary = Pick<
  BlogPostDocument,
  'slug' | 'locale' | 'kind' | 'title' | 'excerpt' | 'coverUrl' | 'coverAlt' | 'tags' | 'version' | 'event' | 'authorName' | 'readingMinutes' | 'publishedAt'
> & { updatedAt?: Date };

const T = {
  fr: {
    blogTitle: 'Le blog d’IDEM',
    blogLede: 'Actualité, nouveautés, événements, guides et témoignages de l’équipe qui construit IDEM.',
    home: 'Accueil',
    blog: 'Blog',
    all: 'Tout',
    upcoming: 'Événements à venir',
    past: 'Événement passé',
    online: 'En ligne',
    register: 'S’inscrire',
    readMinutes: (n: number) => `${n} min de lecture`,
    by: 'Par',
    published: 'Publié le',
    updated: 'Mis à jour le',
    related: 'À lire aussi',
    markdown: 'Version Markdown de ce billet',
    aboutTitle: 'À propos d’IDEM',
    services: 'Les services d’IDEM',
    page: (n: number, p: number) => `Page ${n} sur ${p}`,
    previous: 'Page précédente',
    next: 'Page suivante',
    tags: 'Sujets',
    version: 'Version',
    empty: 'Aucun billet publié pour l’instant.',
  },
  en: {
    blogTitle: 'The IDEM blog',
    blogLede: 'News, releases, events, guides and stories from the team building IDEM.',
    home: 'Home',
    blog: 'Blog',
    all: 'All',
    upcoming: 'Upcoming events',
    past: 'Past event',
    online: 'Online',
    register: 'Register',
    readMinutes: (n: number) => `${n} min read`,
    by: 'By',
    published: 'Published on',
    updated: 'Updated on',
    related: 'Keep reading',
    markdown: 'Markdown version of this post',
    aboutTitle: 'About IDEM',
    services: 'IDEM services',
    page: (n: number, p: number) => `Page ${n} of ${p}`,
    previous: 'Previous page',
    next: 'Next page',
    tags: 'Topics',
    version: 'Version',
    empty: 'Nothing published yet.',
  },
} as const;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BLOG_PATH = '/blog';

function visible(locale: SeoLocale): FilterQuery<BlogPostDocument> {
  return { status: 'published', locale, publishedAt: { $lte: new Date() } };
}

function day(date: Date | string | undefined, locale: SeoLocale): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date));
}

/** La date d'un événement, à l'heure du lieu (« jeudi 4 décembre 2026, 10:00 – 12:00 (Africa/Douala) »). */
export function eventWhen(event: NonNullable<BlogPostDocument['event']>, locale: SeoLocale): string {
  const lang = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const zone = event.timezone || 'Africa/Douala';
  const full = new Intl.DateTimeFormat(lang, { dateStyle: 'full', timeStyle: 'short', timeZone: zone });
  const time = new Intl.DateTimeFormat(lang, { timeStyle: 'short', timeZone: zone });
  const dayKey = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: zone });
  const start = new Date(event.startsAt);
  if (!event.endsAt) return `${full.format(start)} (${zone})`;
  const end = new Date(event.endsAt);
  const sameDay = dayKey.format(start) === dayKey.format(end);
  return `${full.format(start)} – ${sameDay ? time.format(end) : full.format(end)} (${zone})`;
}

function isPast(event: BlogPostDocument['event']): boolean {
  if (!event) return false;
  const end = event.endsAt ? new Date(event.endsAt).getTime() : new Date(event.startsAt).getTime() + 6 * 3600_000;
  return end < Date.now();
}

function kindLabel(kind: BlogKindId, locale: SeoLocale): string {
  return BLOG_KINDS_INFO[kind]?.label[locale] ?? kind;
}

/** Le bloc « À propos d'IDEM » en bas de chaque page : ce qui relie chaque billet au projet. */
function aboutBlock(locale: SeoLocale): string {
  const t = T[locale];
  const services = WORKFLOW.map((s) => {
    const href = s.landingPath === null ? s.url : landingUrl(s.landingPath, locale);
    return `<li><a href="${esc(href)}">${esc(s.name)}</a> — ${esc(s.description[locale])}</li>`;
  }).join('');
  return `<aside class="about" aria-labelledby="about-idem">
  <h2 id="about-idem">${esc(t.aboutTitle)}</h2>
  <p><strong>${esc(IDEM.name)}</strong> — ${esc(DEFINITION[locale])}. ${esc(PROMISE_LONG[locale])}</p>
  <h3>${esc(t.services)}</h3>
  <ul>${services}</ul>
  <p><a href="${esc(landingUrl('', locale))}">${esc(IDEM.url.replace('https://', ''))}</a> · <a href="${esc(LLMS_TXT_URL)}">llms.txt</a></p>
</aside>`;
}

interface DocumentInput {
  locale: SeoLocale;
  title: string;
  description: string;
  url: string;
  ogType: 'article' | 'website';
  image: string;
  imageAlt: string;
  graph: JsonLdNode;
  body: string;
  alternates?: { locale: SeoLocale; url: string }[];
  markdownUrl?: string;
  prev?: string;
  next?: string;
  published?: string;
  modified?: string;
}

function document(d: DocumentInput): string {
  const t = T[d.locale];
  const alt = (d.alternates ?? []).map(
    (a) => `<link rel="alternate" hreflang="${a.locale}" href="${esc(a.url)}">`
  );
  return `<!doctype html>
<html lang="${d.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)}</title>
<meta name="description" content="${esc(d.description)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${esc(d.url)}">
${alt.join('\n')}
${d.markdownUrl ? `<link rel="alternate" type="text/markdown" href="${esc(d.markdownUrl)}">` : ''}
${d.prev ? `<link rel="prev" href="${esc(d.prev)}">` : ''}
${d.next ? `<link rel="next" href="${esc(d.next)}">` : ''}
<meta property="og:type" content="${d.ogType}">
<meta property="og:site_name" content="${IDEM.name}">
<meta property="og:url" content="${esc(d.url)}">
<meta property="og:title" content="${esc(d.title)}">
<meta property="og:description" content="${esc(d.description)}">
<meta property="og:image" content="${esc(d.image)}">
<meta property="og:image:alt" content="${esc(d.imageAlt)}">
<meta property="og:locale" content="${OG_LOCALE[d.locale]}">
${d.published ? `<meta property="article:published_time" content="${esc(d.published)}">` : ''}
${d.modified ? `<meta property="article:modified_time" content="${esc(d.modified)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${IDEM.twitter}">
<meta name="twitter:title" content="${esc(d.title)}">
<meta name="twitter:description" content="${esc(d.description)}">
<meta name="twitter:image" content="${esc(d.image)}">
<script type="application/ld+json">${jsonLdString(d.graph)}</script>
<style>
  body{font-family:system-ui,sans-serif;line-height:1.65;color:#1b1d23;background:#fff;max-width:46rem;margin:0 auto;padding:1.5rem 1rem 4rem}
  a{color:${IDEM.themeColor}} img{max-width:100%;height:auto} nav ul,.kinds{display:flex;flex-wrap:wrap;gap:.75rem;list-style:none;padding:0}
  .meta{color:#5b6070;font-size:.9rem} .event{border:1px solid #dfe2ea;border-radius:.75rem;padding:1rem;margin:1.5rem 0}
  .about{border-top:1px solid #dfe2ea;margin-top:3rem;padding-top:1.5rem;font-size:.95rem}
  table{border-collapse:collapse} th,td{border:1px solid #dfe2ea;padding:.3rem .6rem} pre{overflow:auto;background:#f5f6f8;padding:1rem}
</style>
</head>
<body>
<header>
  <nav aria-label="IDEM">
    <ul>
      <li><a href="${esc(landingUrl('', d.locale))}">${esc(IDEM.name)} — ${esc(t.home)}</a></li>
      <li><a href="${esc(landingUrl(BLOG_PATH, d.locale))}">${esc(t.blog)}</a></li>
      ${WORKFLOW.map((s) => `<li><a href="${esc(s.landingPath === null ? s.url : landingUrl(s.landingPath, d.locale))}">${esc(s.name)}</a></li>`).join('')}
    </ul>
  </nav>
</header>
<main>
${d.body}
</main>
${aboutBlock(d.locale)}
</body>
</html>`;
}

/** Les informations d'un événement, lisibles (page et Markdown). */
function eventBox(post: PostSummary, locale: SeoLocale): string {
  const e = post.event;
  if (!e) return '';
  const t = T[locale];
  const where = [e.location, e.online ? t.online : ''].filter(Boolean).join(' · ');
  return `<section class="event" aria-label="${esc(kindLabel('event', locale))}">
  <p><strong>${esc(eventWhen(e, locale))}</strong></p>
  ${where ? `<p>${esc(where)}</p>` : ''}
  ${isPast(e) ? `<p>${esc(t.past)}</p>` : e.registrationUrl ? `<p><a href="${esc(e.registrationUrl)}">${esc(t.register)}</a></p>` : ''}
</section>`;
}

function postItem(p: PostSummary, locale: SeoLocale): string {
  const t = T[locale];
  const kind = kindLabel(p.kind as BlogKindId, locale);
  const extra = p.kind === 'release' && p.version ? ` · ${t.version} ${esc(p.version)}` : '';
  const when = p.kind === 'event' && p.event ? eventWhen(p.event, locale) : day(p.publishedAt, locale);
  return `<li><article>
  <p class="meta">${esc(kind)}${extra} · <time datetime="${esc(new Date(p.publishedAt ?? Date.now()).toISOString())}">${esc(when)}</time></p>
  <h2><a href="${esc(blogPostUrl(p.slug, locale))}">${esc(p.title)}</a></h2>
  <p>${esc(p.excerpt)}</p>
</article></li>`;
}

export const blogPublicPagesService = {
  /** La page d'un billet, en HTML complet. */
  async postHtml(localeValue: unknown, slug: string): Promise<string> {
    const locale = toLocale(localeValue);
    const t = T[locale];
    const { post, related } = await blogService.getPublic(locale, slug);
    const p = post as unknown as PostSummary & { contentHtml: string; updatedAt: Date };
    const url = blogPostUrl(p.slug, locale);
    const kind = (p.kind as BlogKindId) ?? 'article';
    const info = BLOG_KINDS_INFO[kind] ?? BLOG_KINDS_INFO.article;
    const image = p.coverUrl?.startsWith('http') ? p.coverUrl : ogImageUrl('blog', locale);
    const translation = await this.translation(p.slug, locale);
    const alternates = [{ locale, url }, ...(translation ? [{ locale: translation, url: blogPostUrl(p.slug, translation) }] : [])];

    const graph = buildPageGraph({
      locale,
      url,
      title: brandedTitle(p.title),
      description: p.excerpt,
      image,
      imageAlt: p.coverAlt || p.title,
      about: 'platform',
      site: 'idem',
      pageType: 'WebPage',
      breadcrumbs: [
        { name: IDEM.name, url: landingUrl('', locale) },
        { name: t.blog, url: landingUrl(BLOG_PATH, locale) },
        { name: p.title, url },
      ],
      article: {
        headline: p.title,
        datePublished: new Date(p.publishedAt!).toISOString(),
        dateModified: new Date(p.updatedAt ?? p.publishedAt!).toISOString(),
        authorName: p.authorName,
        tags: p.tags,
        type: info.schemaType,
        section: info.label[locale],
        markdownUrl: blogMarkdownUrl(p.slug, locale),
      },
      ...(p.kind === 'event' && p.event
        ? {
            event: {
              name: p.title,
              startDate: new Date(p.event.startsAt).toISOString(),
              ...(p.event.endsAt ? { endDate: new Date(p.event.endsAt).toISOString() } : {}),
              online: !!p.event.online,
              location: p.event.location,
              registrationUrl: p.event.registrationUrl,
            },
          }
        : {}),
    });

    const relatedList = (related as unknown as PostSummary[])
      .map((r) => `<li><a href="${esc(blogPostUrl(r.slug, locale))}">${esc(r.title)}</a></li>`)
      .join('');

    const body = `<nav aria-label="breadcrumb"><a href="${esc(landingUrl('', locale))}">${esc(IDEM.name)}</a> › <a href="${esc(landingUrl(BLOG_PATH, locale))}">${esc(t.blog)}</a> › <a href="${esc(landingUrl(`${BLOG_PATH}?kind=${kind}`, locale))}">${esc(info.plural[locale])}</a></nav>
<article>
  <header>
    <p class="meta">${esc(info.label[locale])}${p.kind === 'release' && p.version ? ` · ${t.version} ${esc(p.version)}` : ''}</p>
    <h1>${esc(p.title)}</h1>
    <p><strong>${esc(p.excerpt)}</strong></p>
    <p class="meta">${esc(t.published)} <time datetime="${esc(new Date(p.publishedAt!).toISOString())}">${esc(day(p.publishedAt, locale))}</time> · ${esc(t.by)} ${esc(p.authorName)} · ${esc(t.readMinutes(p.readingMinutes))}</p>
  </header>
  ${eventBox(p, locale)}
  ${p.coverUrl ? `<img src="${esc(p.coverUrl)}" alt="${esc(p.coverAlt ?? '')}" width="1200" height="630">` : ''}
  ${p.contentHtml}
  ${p.tags.length ? `<p class="meta">${esc(t.tags)} : ${p.tags.map((tag) => `<a href="${esc(landingUrl(`${BLOG_PATH}?tag=${encodeURIComponent(tag)}`, locale))}">${esc(tag)}</a>`).join(', ')}</p>` : ''}
  <p class="meta"><a href="${esc(blogMarkdownUrl(p.slug, locale))}">${esc(t.markdown)}</a></p>
</article>
${relatedList ? `<section><h2>${esc(t.related)}</h2><ul>${relatedList}</ul></section>` : ''}`;

    return document({
      locale,
      title: brandedTitle(p.title),
      description: p.excerpt,
      url,
      ogType: 'article',
      image,
      imageAlt: p.coverAlt || p.title,
      graph,
      body,
      alternates,
      markdownUrl: blogMarkdownUrl(p.slug, locale),
      published: new Date(p.publishedAt!).toISOString(),
      modified: new Date(p.updatedAt ?? p.publishedAt!).toISOString(),
    });
  },

  /** La page du blog (avec filtres et pagination), en HTML complet. */
  async listHtml(query: { locale?: unknown; kind?: unknown; tag?: unknown; page?: unknown }): Promise<string> {
    const locale = toLocale(query.locale);
    const t = T[locale];
    const list = await blogService.listPublic({ ...query, locale, limit: 24 });
    const kind = BLOG_KIND_IDS.includes(query.kind as BlogKindId) ? (query.kind as BlogKindId) : null;
    const tag = typeof query.tag === 'string' && query.tag ? query.tag : null;

    const params = (extra: Record<string, string | number | null>) => {
      const q = new URLSearchParams();
      const all: Record<string, string | number | null> = { kind, tag, ...extra };
      for (const [k, v] of Object.entries(all)) {
        if (v === null || v === '' || (k === 'page' && Number(v) === 1)) continue;
        q.set(k, String(v));
      }
      const s = q.toString();
      return landingUrl(`${BLOG_PATH}${s ? `?${s}` : ''}`, locale);
    };
    const url = params({ page: list.page });
    const heading = kind ? `${BLOG_KINDS_INFO[kind].plural[locale]} — ${t.blogTitle}` : t.blogTitle;
    const description = kind ? BLOG_KINDS_INFO[kind].description[locale] : t.blogLede;
    const posts = list.posts as unknown as PostSummary[];
    const upcoming = list.upcoming as unknown as PostSummary[];

    const kinds = list.kinds
      .filter((k) => k.count > 0)
      .map((k) => `<li><a href="${esc(params({ kind: k.kind, page: null }))}"${k.kind === kind ? ' aria-current="page"' : ''}>${esc(BLOG_KINDS_INFO[k.kind as BlogKindId].plural[locale])} (${k.count})</a></li>`)
      .join('');

    const prev = list.page > 1 ? params({ page: list.page - 1 }) : undefined;
    const next = list.page < list.pages ? params({ page: list.page + 1 }) : undefined;

    const body = `<h1>${esc(heading)}</h1>
<p>${esc(description)}</p>
<nav aria-label="${esc(t.blog)}"><ul class="kinds"><li><a href="${esc(landingUrl(BLOG_PATH, locale))}"${!kind ? ' aria-current="page"' : ''}>${esc(t.all)}</a></li>${kinds}</ul></nav>
${upcoming.length ? `<section><h2>${esc(t.upcoming)}</h2><ul>${upcoming.map((p) => postItem(p, locale)).join('')}</ul></section>` : ''}
${posts.length ? `<ul>${posts.map((p) => postItem(p, locale)).join('')}</ul>` : upcoming.length ? '' : `<p>${esc(t.empty)}</p>`}
${list.pages > 1 ? `<nav aria-label="pagination"><p>${prev ? `<a href="${esc(prev)}">${esc(t.previous)}</a> · ` : ''}${esc(t.page(list.page, list.pages))}${next ? ` · <a href="${esc(next)}">${esc(t.next)}</a>` : ''}</p></nav>` : ''}`;

    const graph = buildPageGraph({
      locale,
      url,
      title: brandedTitle(heading),
      description,
      image: ogImageUrl('blog', locale),
      about: 'platform',
      site: 'idem',
      pageType: 'CollectionPage',
      breadcrumbs: [
        { name: IDEM.name, url: landingUrl('', locale) },
        { name: t.blog, url: landingUrl(BLOG_PATH, locale) },
      ],
      itemList: [...upcoming, ...posts].map((p) => ({ url: blogPostUrl(p.slug, locale), name: p.title })),
    });

    return document({
      locale,
      title: brandedTitle(heading),
      description,
      url,
      ogType: 'website',
      image: ogImageUrl('blog', locale),
      imageAlt: t.blogTitle,
      graph,
      body,
      alternates: tag || kind || list.page > 1
        ? []
        : (['fr', 'en'] as SeoLocale[]).map((l) => ({ locale: l, url: landingUrl(BLOG_PATH, l) })),
      prev,
      next,
    });
  },

  /** Un billet en Markdown, avec ses métadonnées en tête : ce que les agents IA lisent le mieux. */
  async postMarkdown(localeValue: unknown, slug: string): Promise<string> {
    const locale = toLocale(localeValue);
    const post = await BlogPost.findOne({ ...visible(locale), slug })
      .select('slug locale kind title excerpt contentMd coverUrl coverAlt tags version event authorName publishedAt updatedAt')
      .lean();
    if (!post) throw new BlogError(404, 'NOT_FOUND', 'Ce billet n’existe pas ou n’est pas encore publié.');
    return this.markdownOf(post as unknown as PostSummary & { contentMd: string; updatedAt: Date }, locale);
  },

  markdownOf(p: PostSummary & { contentMd: string; updatedAt?: Date }, locale: SeoLocale): string {
    const kind = (p.kind as BlogKindId) ?? 'article';
    const yaml = (v: string) => JSON.stringify(v);
    const front = [
      '---',
      `title: ${yaml(p.title)}`,
      `description: ${yaml(p.excerpt)}`,
      `type: ${yaml(BLOG_KINDS_INFO[kind].label[locale])}`,
      `language: ${locale}`,
      `url: ${blogPostUrl(p.slug, locale)}`,
      `published: ${new Date(p.publishedAt!).toISOString()}`,
      ...(p.updatedAt ? [`updated: ${new Date(p.updatedAt).toISOString()}`] : []),
      `author: ${yaml(p.authorName)}`,
      ...(p.tags.length ? [`tags: [${p.tags.map(yaml).join(', ')}]`] : []),
      ...(p.version ? [`version: ${yaml(p.version)}`] : []),
      ...(p.coverUrl ? [`image: ${p.coverUrl}`] : []),
      ...(p.event
        ? [
            'event:',
            `  starts: ${new Date(p.event.startsAt).toISOString()}`,
            ...(p.event.endsAt ? [`  ends: ${new Date(p.event.endsAt).toISOString()}`] : []),
            `  timezone: ${p.event.timezone}`,
            `  when: ${yaml(eventWhen(p.event, locale))}`,
            `  online: ${p.event.online ? 'true' : 'false'}`,
            ...(p.event.location ? [`  location: ${yaml(p.event.location)}`] : []),
            ...(p.event.registrationUrl ? [`  registration: ${p.event.registrationUrl}`] : []),
            `  status: ${isPast(p.event) ? 'past' : 'upcoming'}`,
          ]
        : []),
      `publisher: ${yaml(`${IDEM.name} — ${DEFINITION[locale]} (${IDEM.url})`)}`,
      '---',
    ];
    return [
      ...front,
      '',
      `# ${p.title}`,
      '',
      `> ${p.excerpt}`,
      '',
      p.contentMd.trim(),
      '',
      '---',
      '',
      `${IDEM.name} — ${DEFINITION[locale]}. ${PROMISE_LONG[locale]} ${IDEM.url}`,
      '',
    ].join('\n');
  },

  /** Le plan du site du blog d'une langue, avec la traduction de chaque billet quand elle existe. */
  async sitemap(localeValue: unknown): Promise<string> {
    const locale = toLocale(localeValue);
    const other: SeoLocale = locale === 'fr' ? 'en' : 'fr';
    const [posts, translated] = await Promise.all([
      BlogPost.find(visible(locale)).select('slug coverUrl coverAlt title updatedAt publishedAt').sort({ publishedAt: -1 }).limit(5000).lean(),
      BlogPost.distinct('slug', visible(other)),
    ]);
    const has = new Set(translated as string[]);
    const urls = posts.map((p) => {
      const lines = [
        '  <url>',
        `    <loc>${esc(blogPostUrl(p.slug, locale))}</loc>`,
        `    <lastmod>${new Date(p.updatedAt ?? p.publishedAt!).toISOString()}</lastmod>`,
      ];
      if (has.has(p.slug)) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${locale}" href="${esc(blogPostUrl(p.slug, locale))}" />`,
          `    <xhtml:link rel="alternate" hreflang="${other}" href="${esc(blogPostUrl(p.slug, other))}" />`
        );
      }
      if (p.coverUrl?.startsWith('http')) {
        lines.push(`    <image:image><image:loc>${esc(p.coverUrl)}</image:loc></image:image>`);
      }
      lines.push('  </url>');
      return lines.join('\n');
    });
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      '        xmlns:xhtml="http://www.w3.org/1999/xhtml"',
      '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ...urls,
      '</urlset>',
      '',
    ].join('\n');
  },

  /**
   * `llms.txt` (https://llmstxt.org) : ce qu'est IDEM, ses services, et les derniers billets de
   * chaque type, en lien vers leur version Markdown. `full` : les billets en entier.
   */
  async llmsTxt(full = false): Promise<string> {
    const lines: string[] = [
      `# ${IDEM.name}`,
      '',
      `> ${DEFINITION.en}. ${PROMISE_LONG.en}`,
      '',
      `${DEFINITION.fr}. ${PROMISE_LONG.fr}`,
      '',
      `IDEM was founded in ${IDEM.foundingDate} in Douala, Cameroon (${IDEM.foundingCountry}). Website: ${IDEM.url} (French: ${landingUrl('', 'fr')}, English: ${landingUrl('', 'en')}). Contact: ${IDEM.email}.`,
      '',
      '## Services',
      '',
      ...WORKFLOW.map((s) => {
        const page = s.landingPath === null ? s.url : landingUrl(s.landingPath, 'en');
        return `- [${s.name}](${page}): ${s.description.en} (${s.role.en}; app: ${s.url})`;
      }),
      '',
    ];

    const posts = await BlogPost.find({ status: 'published', publishedAt: { $lte: new Date() } })
      .select(full ? 'slug locale kind title excerpt contentMd coverUrl tags version event authorName publishedAt updatedAt' : 'slug locale kind title excerpt event publishedAt')
      .sort({ publishedAt: -1 })
      .limit(full ? 200 : 500)
      .lean();
    const all = posts as unknown as (PostSummary & { contentMd?: string })[];

    if (!full) {
      lines.push('## Blog', '', `News and articles about IDEM, in French and English. Each link is the Markdown version of the post. Blog: ${landingUrl(BLOG_PATH, 'fr')} · ${landingUrl(BLOG_PATH, 'en')}`, '');
      for (const kind of BLOG_KIND_IDS) {
        const ofKind = all.filter((p) => p.kind === kind).slice(0, 15);
        if (!ofKind.length) continue;
        lines.push(`### ${BLOG_KINDS_INFO[kind].plural.en} — ${BLOG_KINDS_INFO[kind].description.en}`, '');
        for (const p of ofKind) {
          const locale = p.locale as SeoLocale;
          const when = p.kind === 'event' && p.event ? eventWhen(p.event, 'en') : day(p.publishedAt, 'en');
          lines.push(`- [${p.title}](${blogMarkdownUrl(p.slug, locale)}): ${p.excerpt} (${when}, ${locale})`);
        }
        lines.push('');
      }
      lines.push(
        '## Optional',
        '',
        `- [Full text of every post](${LLMS_FULL_TXT_URL}): the posts above, in full`,
        `- [Business plan, brand and legal papers — IDEM Business](${SERVICES.business.url})`,
        `- [Sitemap](${IDEM.url}/sitemap.xml)`,
        ''
      );
      return lines.join('\n');
    }

    lines.push('## Blog posts (full text)', '');
    for (const p of all) {
      lines.push(this.markdownOf(p as PostSummary & { contentMd: string }, p.locale as SeoLocale), '');
    }
    return lines.join('\n');
  },

  /** La langue dans laquelle ce billet est traduit (même adresse), s'il l'est. */
  async translation(slug: string, locale: SeoLocale): Promise<SeoLocale | null> {
    const other: SeoLocale = locale === 'fr' ? 'en' : 'fr';
    const exists = await BlogPost.exists({ ...visible(other), slug });
    return exists ? other : null;
  },
};
