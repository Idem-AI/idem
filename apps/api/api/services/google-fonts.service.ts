import axios from 'axios';
import logger from '../config/logger';
import { cacheService } from './cache.service';

/**
 * Catalogue Google Fonts servi au front.
 *
 * Le front ne parle jamais directement à Google : la clé API vit uniquement
 * ici (Secret Manager), et le catalogue complet (~1900 familles, ~1,5 Mo brut)
 * est récupéré une fois puis mis en cache. Les fichiers de police, eux, restent
 * chargés depuis fonts.googleapis.com par le navigateur.
 */

const GOOGLE_FONTS_API = 'https://www.googleapis.com/webfonts/v1/webfonts';

/** Le catalogue bouge de quelques familles par semaine : 24 h suffit. */
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const CACHE_KEY = 'catalog:v1';
const CACHE_PREFIX = 'google-fonts';

/** Garde-fou : au-delà, la réponse devient inutilement lourde pour une liste. */
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 48;

export type FontCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'handwriting'
  | 'monospace';

/** DTO envoyé au front — sous-ensemble volontairement réduit de la réponse Google. */
export interface FontSummary {
  family: string;
  category: string;
  weights: number[];
  subsets: string[];
  /** Rang de popularité (0 = la plus populaire). */
  popularity: number;
}

export interface FontSearchResult {
  fonts: FontSummary[];
  /** Nombre de familles correspondant à la recherche, avant troncature. */
  total: number;
}

interface GoogleWebFont {
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
  kind: string;
}

export class GoogleFontsNotConfiguredError extends Error {
  constructor() {
    super('GOOGLE_FONTS_API_KEY is not configured');
    this.name = 'GoogleFontsNotConfiguredError';
  }
}

export class GoogleFontsService {
  /** Cache process : évite un aller-retour Redis à chaque frappe de l'utilisateur. */
  private memoryCache: { fonts: FontSummary[]; expiresAt: number } | null = null;
  /** Déduplique les requêtes concurrentes pendant un cache miss. */
  private inFlight: Promise<FontSummary[]> | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_FONTS_API_KEY);
  }

  /**
   * Recherche dans le catalogue. Une requête vide renvoie les familles les plus
   * populaires, ce qui donne une liste à parcourir avant même de taper.
   */
  async search(
    query = '',
    category?: string,
    limit: number = DEFAULT_LIMIT
  ): Promise<FontSearchResult> {
    const catalog = await this.getCatalog();
    const needle = query.trim().toLowerCase();
    const normalizedCategory = category ? normalizeCategory(category) : null;
    const safeLimit = Math.min(Math.max(1, limit || DEFAULT_LIMIT), MAX_LIMIT);

    const scoped = normalizedCategory
      ? catalog.filter((font) => font.category === normalizedCategory)
      : catalog;

    if (!needle) {
      return { fonts: scoped.slice(0, safeLimit), total: scoped.length };
    }

    const matched = scoped
      .map((font) => ({ font, score: matchScore(font.family, needle) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score || a.font.popularity - b.font.popularity);

    return {
      fonts: matched.slice(0, safeLimit).map((entry) => entry.font),
      total: matched.length,
    };
  }

  /**
   * Catalogue trié par popularité. Trois niveaux : mémoire → Redis → Google.
   */
  private async getCatalog(): Promise<FontSummary[]> {
    const now = Date.now();
    if (this.memoryCache && this.memoryCache.expiresAt > now) {
      return this.memoryCache.fonts;
    }

    // Un seul appel sortant même si plusieurs requêtes arrivent en même temps.
    this.inFlight ??= this.loadCatalog().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async loadCatalog(): Promise<FontSummary[]> {
    const cached = await cacheService.get<FontSummary[]>(CACHE_KEY, { prefix: CACHE_PREFIX });
    if (cached && cached.length > 0) {
      this.rememberInMemory(cached);
      return cached;
    }

    const fonts = await this.fetchFromGoogle();
    this.rememberInMemory(fonts);
    await cacheService.set(CACHE_KEY, fonts, { prefix: CACHE_PREFIX, ttl: CACHE_TTL_SECONDS });
    return fonts;
  }

  private async fetchFromGoogle(): Promise<FontSummary[]> {
    const apiKey = process.env.GOOGLE_FONTS_API_KEY;
    if (!apiKey) {
      throw new GoogleFontsNotConfiguredError();
    }

    logger.info('Fetching Google Fonts catalog');

    const response = await axios.get<{ items?: GoogleWebFont[] }>(GOOGLE_FONTS_API, {
      params: { key: apiKey, sort: 'popularity' },
      timeout: 15000,
    });

    const items = response.data?.items ?? [];
    const fonts = items
      // `icons` regroupe Material Symbols & co : des jeux de glyphes, pas des typographies.
      .filter((item) => normalizeCategory(item.category) !== 'icons')
      // `sort=popularity` : l'ordre de la réponse EST le classement.
      .map((item, index) => toSummary(item, index));

    logger.info(`Google Fonts catalog loaded (${fonts.length} families)`);
    return fonts;
  }

  private rememberInMemory(fonts: FontSummary[]): void {
    this.memoryCache = { fonts, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
  }
}

function toSummary(item: GoogleWebFont, popularity: number): FontSummary {
  const weights = Array.from(
    new Set(
      (item.variants ?? [])
        .map((variant) => Number.parseInt(variant, 10))
        // `italic` seul vaut 400 italique ; `regular` n'est pas numérique non plus.
        .map((weight) => (Number.isNaN(weight) ? 400 : weight))
    )
  ).sort((a, b) => a - b);

  return {
    family: item.family,
    category: normalizeCategory(item.category),
    weights,
    subsets: item.subsets ?? [],
    popularity,
  };
}

function normalizeCategory(category?: string): string {
  return (category ?? '').toLowerCase().replace(/\s+/g, '-');
}

/** -1 = pas de correspondance ; plus la valeur est basse, meilleure elle est. */
function matchScore(family: string, needle: string): number {
  const value = family.toLowerCase();
  if (value === needle) return 0;
  if (value.startsWith(needle)) return 1;
  if (value.split(/\s+/).some((word) => word.startsWith(needle))) return 2;
  if (value.includes(needle)) return 3;
  return -1;
}

export const googleFontsService = new GoogleFontsService();
