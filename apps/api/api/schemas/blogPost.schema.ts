import mongoose, { Schema, Document } from 'mongoose';

/**
 * Le blog d'IDEM : articles et notes de version.
 *
 * Écrit depuis le panel admin (qui passe par `/internal/blog`), lu par le
 * landing (`/blog`). Un billet est écrit dans UNE langue : le landing existe en
 * français et en anglais, et chaque version ne montre que les billets de sa
 * langue — traduire un article, c'est en écrire un second.
 *
 * Le Markdown est la source ; le HTML est calculé à l'enregistrement (rendu et
 * assaini une seule fois, voir `blog.service.ts`) pour que le landing n'ait ni
 * à parser ni à faire confiance.
 */

export const BLOG_LOCALES = ['fr', 'en'] as const;
export type BlogLocale = (typeof BLOG_LOCALES)[number];

/** `release` : une note de version (« Quoi de neuf »), `article` : tout le reste. */
export const BLOG_KINDS = ['article', 'release'] as const;
export type BlogKind = (typeof BLOG_KINDS)[number];

export const BLOG_STATUSES = ['draft', 'published'] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export interface BlogTocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface BlogPostDocument extends Document {
  slug: string;
  locale: BlogLocale;
  kind: BlogKind;
  status: BlogStatus;
  title: string;
  excerpt: string;
  contentMd: string;
  contentHtml: string;
  toc: BlogTocEntry[];
  coverUrl?: string;
  coverAlt?: string;
  tags: string[];
  /** Numéro de version d'une note de version (« 2.4 »). */
  version?: string;
  authorName: string;
  readingMinutes: number;
  /** Date de parution. Dans le futur, le billet est programmé : invisible jusque-là. */
  publishedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<BlogPostDocument>(
  {
    slug: { type: String, required: true, trim: true },
    locale: { type: String, enum: BLOG_LOCALES, required: true },
    kind: { type: String, enum: BLOG_KINDS, required: true, default: 'article' },
    status: { type: String, enum: BLOG_STATUSES, required: true, default: 'draft' },
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, default: '', trim: true },
    contentMd: { type: String, default: '' },
    contentHtml: { type: String, default: '' },
    toc: {
      type: [{ _id: false, id: String, text: String, level: Number }],
      default: [],
    },
    coverUrl: { type: String },
    coverAlt: { type: String },
    tags: { type: [String], default: [] },
    version: { type: String },
    authorName: { type: String, required: true, default: 'IDEM' },
    readingMinutes: { type: Number, default: 1 },
    publishedAt: { type: Date },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, collection: 'blog_posts' }
);

// L'adresse d'un billet : unique dans sa langue (deux langues, même slug, c'est
// la traduction d'un même sujet — c'est voulu).
BlogPostSchema.index({ locale: 1, slug: 1 }, { unique: true });

// La page publique : les billets visibles d'une langue, du plus récent au plus ancien.
BlogPostSchema.index({ status: 1, locale: 1, publishedAt: -1 });

// Le filtre par étiquette de la page publique.
BlogPostSchema.index({ tags: 1 });

export const BlogPost = mongoose.model<BlogPostDocument>('BlogPost', BlogPostSchema);
