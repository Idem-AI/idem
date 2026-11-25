import type { BlogKindId } from '@idem/shared-seo';

/** Les types de billets : la liste et leurs noms sont dans `@idem/shared-seo` (`BLOG_KINDS_INFO`). */
export type BlogKind = BlogKindId;

/** Ce qui fait d'un billet un événement. « À venir » ou « passé » se calcule, voir `blog-kinds.ts`. */
export interface BlogEvent {
  startsAt: string;
  endsAt?: string;
  /** Fuseau IANA du lieu : les heures s'affichent à l'heure de l'événement. */
  timezone: string;
  online: boolean;
  location?: string;
  registrationUrl?: string;
}

export interface BlogTocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Un billet tel que la liste le montre : tout sauf le texte. */
export interface BlogPostSummary {
  slug: string;
  locale: 'fr' | 'en';
  kind: BlogKind;
  title: string;
  excerpt: string;
  coverUrl?: string;
  coverAlt?: string;
  tags: string[];
  version?: string;
  event?: BlogEvent;
  authorName: string;
  readingMinutes: number;
  publishedAt: string;
}

export interface BlogPost extends BlogPostSummary {
  /** HTML déjà rendu et assaini par l'API (jamais du Markdown). */
  contentHtml: string;
  toc: BlogTocEntry[];
  updatedAt: string;
}

export interface BlogList {
  posts: BlogPostSummary[];
  total: number;
  page: number;
  pages: number;
  /** Les étiquettes en usage dans la langue, pour le filtre. */
  tags: string[];
  /** Le nombre de billets visibles par type : seuls les types non vides sont proposés. */
  kinds: { kind: BlogKind; count: number }[];
  /** Les événements à venir (première page, sans filtre ou filtre Événements), absents de `posts`. */
  upcoming: BlogPostSummary[];
}

export interface BlogPostResponse {
  post: BlogPost;
  related: BlogPostSummary[];
}
