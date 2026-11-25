import { Marked, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { FilterQuery } from 'mongoose';
import {
  BLOG_KINDS,
  BLOG_LOCALES,
  BlogKind,
  BlogLocale,
  BlogPost,
  BlogEvent,
  BlogPostDocument,
  BlogStatus,
  BlogTocEntry,
} from '../schemas/blogPost.schema';

/**
 * Le blog : rendu du Markdown, écriture (panel admin) et lecture (landing).
 *
 * **Le Markdown est rendu ici, une fois, à l'enregistrement.** Le panel admin,
 * qui prévisualise, appelle `render()` par l'API : l'aperçu est donc le rendu
 * exact que le lecteur verra, et il n'existe aucun second moteur à tenir
 * aligné côté landing. Le HTML publié est assaini avec une liste blanche — un
 * billet est écrit par un administrateur, mais le jour où l'un d'eux colle un
 * extrait copié d'ailleurs, ce qui part chez le lecteur ne doit pas dépendre de
 * la vigilance de la personne qui colle.
 */

export class BlogError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'BlogError';
  }
}

// ── Rendu ────────────────────────────────────────────────────────────────

export interface RenderedMarkdown {
  html: string;
  toc: BlogTocEntry[];
  /** Le texte sans balises : sert au temps de lecture. */
  text: string;
  /** Les premiers paragraphes seuls (sans titres ni listes) : l'extrait par défaut. */
  lead: string;
}

/** Un identifiant d'ancre stable : sans accent, en minuscules, unique dans la page. */
export function slugify(input: string, max = 80): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'br', 'hr', 'blockquote', 'pre', 'code', 'em', 'strong', 'del',
    'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'kbd', 'sup', 'sub',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    // `language-xxx` : la classe que pose Markdown sur un bloc de code.
    code: ['class'],
    th: ['align'],
    td: ['align'],
  },
  allowedClasses: { code: [/^language-[a-z0-9+#-]+$/i] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    // Le titre du billet est le seul <h1> de la page.
    h1: 'h2',
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? '');
      return {
        tagName,
        attribs: external
          ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' }
          : attribs,
      };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy', decoding: 'async' },
    }),
  },
};

function renderMarkdown(markdown: string): RenderedMarkdown {
  const toc: BlogTocEntry[] = [];
  const used = new Set<string>();

  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading(this, { tokens, depth, text }: Tokens.Heading) {
        const level = depth <= 2 ? 2 : depth === 3 ? 3 : 4;
        const plain = text.replace(/[*_`~]/g, '').trim();
        let id = slugify(plain) || 'section';
        for (let n = 2; used.has(id); n++) id = `${slugify(plain) || 'section'}-${n}`;
        used.add(id);
        if (level <= 3) toc.push({ id, text: plain, level: level as 2 | 3 });
        return `<h${level} id="${id}">${this.parser.parseInline(tokens)}</h${level}>\n`;
      },
    },
  });

  const raw = marked.parse(markdown, { async: false }) as string;
  const html = sanitizeHtml(raw, SANITIZE);
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  const strip = (fragment: string) =>
    sanitizeHtml(fragment, { allowedTags: [], allowedAttributes: {} })
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  const lead = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) => strip(m[1]))
    .filter(Boolean)
    .join(' ');

  return { html, toc, text, lead };
}

function readingMinutes(text: string): number {
  const words = text ? text.split(' ').length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

// ── Validation ───────────────────────────────────────────────────────────

const LIMITS = {
  title: 140,
  excerpt: 320,
  content: 200_000,
  tag: 30,
  tags: 8,
  version: 30,
  author: 80,
  alt: 200,
  location: 120,
  url: 600,
} as const;

/** Les fuseaux proposés par le panel ; tout fuseau IANA valide est accepté. */
const DEFAULT_TIMEZONE = 'Africa/Douala';

export interface BlogInput {
  slug?: string;
  locale?: BlogLocale;
  kind?: BlogKind;
  title?: string;
  excerpt?: string;
  contentMd?: string;
  coverUrl?: string | null;
  coverAlt?: string | null;
  tags?: string[];
  version?: string | null;
  authorName?: string;
  publishedAt?: string | null;
  event?: BlogEventInput | null;
}

export interface BlogEventInput {
  startsAt?: string | null;
  endsAt?: string | null;
  timezone?: string;
  online?: boolean;
  location?: string | null;
  registrationUrl?: string | null;
}

function fail(message: string): never {
  throw new BlogError(400, 'VALIDATION', message);
}

function text(value: unknown, field: string, max: number, required = false): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail(`« ${field} » doit être un texte.`);
  const trimmed = value.trim();
  if (required && !trimmed) fail(`« ${field} » est obligatoire.`);
  if (trimmed.length > max) fail(`« ${field} » dépasse ${max} caractères.`);
  return trimmed;
}

/** Une image de couverture : une adresse https, ou un chemin du site. */
function imageUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') fail('« coverUrl » doit être une adresse.');
  const url = value.trim();
  if (!/^https:\/\/\S+$/i.test(url) && !/^\/[^\s/]\S*$/.test(url)) {
    fail('L’image de couverture doit être une adresse https:// (ou un chemin commençant par /).');
  }
  if (url.length > 600) fail('L’adresse de l’image de couverture est trop longue.');
  return url;
}

function tagList(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail('« tags » doit être une liste.');
  const tags = [
    ...new Set(
      value
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  if (tags.length > LIMITS.tags) fail(`Pas plus de ${LIMITS.tags} étiquettes.`);
  if (tags.some((t) => t.length > LIMITS.tag)) fail(`Une étiquette dépasse ${LIMITS.tag} caractères.`);
  return tags;
}

function dateValue(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) fail('« publishedAt » n’est pas une date valide.');
  return date;
}

function timezoneValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return DEFAULT_TIMEZONE;
  if (typeof value !== 'string') fail('Fuseau horaire invalide.');
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
  } catch {
    fail(`Fuseau horaire inconnu : « ${value} ».`);
  }
  return value;
}

/** Les informations d'un événement ; `null` les retire. */
function eventValue(value: unknown): BlogEvent | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) fail('« event » doit être un objet.');
  const input = value as BlogEventInput;

  const startsAt = dateValue(input.startsAt);
  if (!startsAt) fail('Un événement a besoin d’une date de début.');
  const endsAt = dateValue(input.endsAt) ?? undefined;
  if (endsAt && endsAt < startsAt) fail('La fin de l’événement est avant son début.');

  const location = text(input.location ?? undefined, 'lieu', LIMITS.location) || undefined;
  const online = input.online === true;
  const registration = text(input.registrationUrl ?? undefined, 'lien d’inscription', LIMITS.url) || undefined;
  if (registration && !/^https:\/\/\S+$/i.test(registration)) fail('Le lien d’inscription doit commencer par https://.');

  return {
    startsAt,
    ...(endsAt ? { endsAt } : {}),
    timezone: timezoneValue(input.timezone),
    online,
    ...(location ? { location } : {}),
    ...(registration ? { registrationUrl: registration } : {}),
  };
}

// ── Lecture publique ─────────────────────────────────────────────────────

/**
 * Un événement sans fin est considéré en cours pendant six heures après son début : un atelier
 * commencé ce matin est encore « à venir » à midi, pas « passé ».
 */
const EVENT_GRACE_MS = 6 * 60 * 60 * 1000;

/** Les événements qui ne sont pas encore terminés. */
function upcomingEvents(now = new Date()): FilterQuery<BlogPostDocument> {
  return {
    kind: 'event',
    $or: [
      { 'event.endsAt': { $gte: now } },
      { 'event.endsAt': null, 'event.startsAt': { $gte: new Date(now.getTime() - EVENT_GRACE_MS) } },
    ],
  };
}

/** Ce qu'un visiteur peut voir : publié, et dont la date de parution est passée. */
function visible(locale: BlogLocale): FilterQuery<BlogPostDocument> {
  return { status: 'published', locale, publishedAt: { $lte: new Date() } };
}

const SUMMARY_FIELDS =
  'slug locale kind title excerpt coverUrl coverAlt tags version event authorName readingMinutes publishedAt';

export function toLocale(value: unknown): BlogLocale {
  return (BLOG_LOCALES as readonly string[]).includes(value as string) ? (value as BlogLocale) : 'en';
}

export function toKind(value: unknown): BlogKind | undefined {
  return (BLOG_KINDS as readonly string[]).includes(value as string) ? (value as BlogKind) : undefined;
}

function page(value: unknown, fallback: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

// ── Service ──────────────────────────────────────────────────────────────

export const blogService = {
  render(markdown: unknown): RenderedMarkdown {
    if (typeof markdown !== 'string') fail('« markdown » doit être un texte.');
    if (markdown.length > LIMITS.content) fail(`Le contenu dépasse ${LIMITS.content} caractères.`);
    return renderMarkdown(markdown);
  },

  // — Public —

  /**
   * La page publique du blog.
   *
   * - `kinds` : le nombre de billets visibles par type — la page ne propose que les filtres qui
   *   mènent quelque part.
   * - `upcoming` : les événements à venir, du plus proche au plus lointain (première page
   *   seulement). Ils sont alors retirés du fil, pour qu'un billet n'apparaisse jamais deux fois.
   * - Filtre « Événements » : le fil ne contient que les événements passés, du plus récent au plus
   *   ancien ; les événements à venir sont tous dans `upcoming`.
   */
  async listPublic(query: { locale?: unknown; kind?: unknown; tag?: unknown; page?: unknown; limit?: unknown }) {
    const locale = toLocale(query.locale);
    const kind = toKind(query.kind);
    const tag = typeof query.tag === 'string' ? query.tag.trim().toLowerCase() : '';
    const current = page(query.page, 1, 1000);
    const limit = page(query.limit, 12, 24);
    const now = new Date();

    const base: FilterQuery<BlogPostDocument> = { ...visible(locale), ...(tag && { tags: tag }) };
    const withUpcoming = !kind || kind === 'event';
    const upcomingFilter = { ...base, ...upcomingEvents(now) };
    const filter: FilterQuery<BlogPostDocument> = {
      ...base,
      ...(kind && { kind }),
      ...(withUpcoming && { $nor: [upcomingEvents(now)] }),
    };
    const sort: Record<string, 1 | -1> = kind === 'event' ? { 'event.startsAt': -1 } : { publishedAt: -1 };

    const [posts, total, tags, kinds, upcoming] = await Promise.all([
      BlogPost.find(filter)
        .select(SUMMARY_FIELDS)
        .sort(sort)
        .skip((current - 1) * limit)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(filter),
      BlogPost.distinct('tags', visible(locale)),
      BlogPost.aggregate<{ _id: BlogKind; count: number }>([
        { $match: visible(locale) },
        { $group: { _id: '$kind', count: { $sum: 1 } } },
      ]),
      withUpcoming && current === 1
        ? BlogPost.find(upcomingFilter)
            .select(SUMMARY_FIELDS)
            .sort({ 'event.startsAt': 1 })
            .limit(kind === 'event' ? 24 : 3)
            .lean()
        : Promise.resolve([]),
    ]);

    return {
      posts,
      total,
      page: current,
      pages: Math.max(1, Math.ceil(total / limit)),
      tags: (tags as string[]).sort(),
      kinds: BLOG_KINDS.map((k) => ({ kind: k, count: kinds.find((c) => c._id === k)?.count ?? 0 })),
      upcoming,
    };
  },

  async getPublic(locale: unknown, slug: string) {
    const lang = toLocale(locale);
    const post = await BlogPost.findOne({ ...visible(lang), slug })
      .select(`${SUMMARY_FIELDS} contentHtml toc updatedAt`)
      .lean();
    if (!post) throw new BlogError(404, 'NOT_FOUND', 'Ce billet n’existe pas ou n’est pas encore publié.');

    const related = await BlogPost.find({ ...visible(lang), slug: { $ne: slug }, kind: post.kind })
      .select(SUMMARY_FIELDS)
      .sort({ publishedAt: -1 })
      .limit(3)
      .lean();

    return { post, related };
  },

  async rss(localeValue: unknown, siteUrl: string): Promise<string> {
    const locale = toLocale(localeValue);
    const posts = await BlogPost.find(visible(locale))
      .select('slug title excerpt tags publishedAt')
      .sort({ publishedAt: -1 })
      .limit(30)
      .lean();

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const base = `${siteUrl}/${locale}/blog`;
    const items = posts.map((p) =>
      [
        '    <item>',
        `      <title>${esc(p.title)}</title>`,
        `      <link>${base}/${encodeURIComponent(p.slug)}</link>`,
        `      <guid isPermaLink="true">${base}/${encodeURIComponent(p.slug)}</guid>`,
        `      <pubDate>${new Date(p.publishedAt as Date).toUTCString()}</pubDate>`,
        `      <description>${esc(p.excerpt)}</description>`,
        ...p.tags.map((t) => `      <category>${esc(t)}</category>`),
        '    </item>',
      ].join('\n')
    );

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0">',
      '  <channel>',
      `    <title>${locale === 'fr' ? 'Le blog d’IDEM' : 'The IDEM blog'}</title>`,
      `    <link>${base}</link>`,
      `    <description>${
        locale === 'fr'
          ? 'Articles et notes de version d’IDEM.'
          : 'Articles and release notes from IDEM.'
      }</description>`,
      `    <language>${locale}</language>`,
      ...items,
      '  </channel>',
      '</rss>',
      '',
    ].join('\n');
  },

  // — Panel admin —

  async listAdmin(query: {
    status?: unknown;
    kind?: unknown;
    locale?: unknown;
    search?: unknown;
    page?: unknown;
    limit?: unknown;
  }) {
    const current = page(query.page, 1, 1000);
    const limit = page(query.limit, 20, 100);
    const filter: FilterQuery<BlogPostDocument> = {};

    if (query.status === 'draft' || query.status === 'published') filter.status = query.status;
    const kind = toKind(query.kind);
    if (kind) filter.kind = kind;
    if ((BLOG_LOCALES as readonly string[]).includes(query.locale as string)) filter.locale = query.locale;
    if (typeof query.search === 'string' && query.search.trim()) {
      const escaped = query.search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = { $regex: escaped, $options: 'i' };
    }

    const [posts, total, counts, kindCounts] = await Promise.all([
      BlogPost.find(filter)
        .select(`${SUMMARY_FIELDS} status createdAt updatedAt createdBy updatedBy`)
        .sort({ updatedAt: -1 })
        .skip((current - 1) * limit)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(filter),
      BlogPost.aggregate<{ _id: BlogStatus; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      BlogPost.aggregate<{ _id: BlogKind; count: number }>([
        { $group: { _id: '$kind', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      posts,
      total,
      page: current,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: {
        draft: counts.find((c) => c._id === 'draft')?.count ?? 0,
        published: counts.find((c) => c._id === 'published')?.count ?? 0,
      },
      kinds: BLOG_KINDS.map((k) => ({ kind: k, count: kindCounts.find((c) => c._id === k)?.count ?? 0 })),
    };
  },

  async getAdmin(id: string) {
    const post = await BlogPost.findById(id).lean().catch(() => null);
    if (!post) throw new BlogError(404, 'NOT_FOUND', 'Billet introuvable.');
    return post;
  },

  async create(input: BlogInput, adminEmail: string) {
    const locale = input.locale;
    if (!locale || !(BLOG_LOCALES as readonly string[]).includes(locale)) {
      fail('Choisissez la langue du billet (fr ou en).');
    }
    const title = text(input.title, 'titre', LIMITS.title, true)!;
    const slug = slugify(text(input.slug, 'adresse', 80) || title);
    if (!slug) fail('Impossible de tirer une adresse de ce titre : saisissez-en une.');

    const data = this.buildFields(input);
    if (data.kind !== 'event') delete data.event;
    const post = new BlogPost({
      ...data,
      slug,
      locale,
      title,
      kind: data.kind ?? 'article',
      status: 'draft',
      authorName: data.authorName ?? 'IDEM',
      createdBy: adminEmail,
      updatedBy: adminEmail,
    });

    try {
      await post.save();
    } catch (error) {
      throw this.duplicate(error, slug, locale);
    }
    return post.toObject();
  },

  async update(id: string, input: BlogInput, adminEmail: string) {
    const post = await BlogPost.findById(id).catch(() => null);
    if (!post) throw new BlogError(404, 'NOT_FOUND', 'Billet introuvable.');

    const data = this.buildFields(input);
    const title = text(input.title, 'titre', LIMITS.title, true);
    if (title) post.title = title;

    if (input.slug !== undefined) {
      const slug = slugify(text(input.slug, 'adresse', 80) || post.title);
      if (!slug) fail('L’adresse ne peut pas être vide.');
      // Un billet déjà paru est lié, partagé, indexé : son adresse ne bouge plus.
      if (slug !== post.slug && post.publishedAt) {
        throw new BlogError(409, 'SLUG_LOCKED', 'L’adresse d’un billet déjà publié ne peut plus changer.');
      }
      post.slug = slug;
    }

    if (input.locale !== undefined) {
      if (!(BLOG_LOCALES as readonly string[]).includes(input.locale)) fail('Langue inconnue.');
      if (input.locale !== post.locale && post.publishedAt) {
        throw new BlogError(409, 'LOCALE_LOCKED', 'La langue d’un billet déjà publié ne peut plus changer.');
      }
      post.locale = input.locale;
    }

    Object.assign(post, data);
    // Les informations d'événement ne survivent pas à un changement de type.
    if (post.kind !== 'event' && post.event) post.event = undefined;
    // Un billet publié sans date de parution serait invisible partout.
    if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
    post.updatedBy = adminEmail;

    try {
      await post.save();
    } catch (error) {
      throw this.duplicate(error, post.slug, post.locale);
    }
    return post.toObject();
  },

  /** Publie (à `publishedAt`, ou maintenant) ou repasse en brouillon. */
  async setStatus(id: string, status: BlogStatus, adminEmail: string, publishedAt?: unknown) {
    const post = await BlogPost.findById(id).catch(() => null);
    if (!post) throw new BlogError(404, 'NOT_FOUND', 'Billet introuvable.');

    if (status === 'published') {
      if (!post.title.trim()) fail('Un billet publié a besoin d’un titre.');
      if (!post.contentMd.trim()) fail('Un billet publié ne peut pas être vide.');
      if (!post.excerpt.trim()) fail('Écrivez l’extrait : c’est lui qui s’affiche dans la liste et au partage.');
      if (post.kind === 'event') {
        if (!post.event?.startsAt) fail('Un événement publié a besoin de sa date de début.');
        if (!post.event.online && !post.event.location) fail('Indiquez le lieu de l’événement, ou cochez « En ligne ».');
      }
      const date = dateValue(publishedAt);
      post.publishedAt = date ?? post.publishedAt ?? new Date();
    }

    post.status = status;
    post.updatedBy = adminEmail;
    await post.save();
    return post.toObject();
  },

  async remove(id: string) {
    const post = await BlogPost.findByIdAndDelete(id).catch(() => null);
    if (!post) throw new BlogError(404, 'NOT_FOUND', 'Billet introuvable.');
  },

  // — Interne —

  /** Valide les champs communs et recalcule tout ce qui dérive du Markdown. */
  buildFields(input: BlogInput) {
    const out: Partial<BlogPostDocument> = {};

    if (input.kind !== undefined) {
      if (!(BLOG_KINDS as readonly string[]).includes(input.kind)) fail('Type de billet inconnu.');
      out.kind = input.kind;
    }

    const excerpt = text(input.excerpt, 'extrait', LIMITS.excerpt);
    if (excerpt !== undefined) out.excerpt = excerpt;

    const author = text(input.authorName, 'auteur', LIMITS.author, true);
    if (author !== undefined) out.authorName = author;

    const version = input.version === null ? '' : text(input.version, 'version', LIMITS.version);
    if (version !== undefined) out.version = version || undefined;

    const coverUrl = imageUrl(input.coverUrl);
    if (coverUrl !== undefined) out.coverUrl = coverUrl ?? undefined;

    const coverAlt = input.coverAlt === null ? '' : text(input.coverAlt, 'texte alternatif', LIMITS.alt);
    if (coverAlt !== undefined) out.coverAlt = coverAlt || undefined;

    const tags = tagList(input.tags);
    if (tags) out.tags = tags;

    const event = eventValue(input.event);
    if (event !== undefined) out.event = event ?? undefined;

    const publishedAt = dateValue(input.publishedAt);
    if (publishedAt !== undefined) out.publishedAt = publishedAt ?? undefined;

    if (input.contentMd !== undefined) {
      const rendered = this.render(input.contentMd);
      out.contentMd = input.contentMd;
      out.contentHtml = rendered.html;
      out.toc = rendered.toc;
      out.readingMinutes = readingMinutes(rendered.text);
      // Pas d'extrait saisi : les premiers mots du billet font l'affaire.
      if (out.excerpt === undefined && !input.excerpt) {
        const source = rendered.lead || rendered.text;
        out.excerpt =
          source.length <= LIMITS.excerpt
            ? source
            : `${source.slice(0, LIMITS.excerpt - 1).replace(/\s+\S*$/, '')}…`;
      }
    }

    return out;
  },

  duplicate(error: unknown, slug: string, locale: string): Error {
    if ((error as { code?: number }).code === 11000) {
      return new BlogError(
        409,
        'SLUG_TAKEN',
        `Un billet « ${slug} » existe déjà en ${locale === 'fr' ? 'français' : 'anglais'}.`
      );
    }
    return error as Error;
  },
};
