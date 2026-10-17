export type BlogKind = 'article' | 'release';

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
}

export interface BlogPostResponse {
  post: BlogPost;
  related: BlogPostSummary[];
}
