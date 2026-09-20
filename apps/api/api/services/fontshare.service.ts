import axios from 'axios';
import logger from '../config/logger';
import { cacheService } from './cache.service';

/**
 * Catalogue Fontshare (Indian Type Foundry).
 *
 * Pourquoi cette source : Google Fonts est un immense catalogue, mais c'est
 * AUSSI celui que tout le monde utilise — c'est de là que vient l'impression
 * « déjà vu » sur une charte. Fontshare publie une centaine de familles
 * dessinées récemment, libres d'usage commercial, et absentes de Google : une
 * marque qui y pioche ne ressemble plus à la moyenne du web.
 *
 * Le catalogue est paginé par 100. Les fichiers de police restent servis par
 * `api.fontshare.com`, exactement comme Google sert les siens : on ne récupère
 * ici que les métadonnées.
 */

const FONTSHARE_API = 'https://api.fontshare.com/v2/fonts';
const FONTSHARE_CSS = 'https://api.fontshare.com/v2/css';

const CACHE_TTL_SECONDS = 24 * 60 * 60;
const CACHE_KEY = 'catalog:v1';
const CACHE_PREFIX = 'fontshare';

const PAGE_SIZE = 100;
/** Garde-fou : le catalogue fait ~150 familles, 10 pages couvrent large. */
const MAX_PAGES = 10;

export interface FontshareFont {
  family: string;
  slug: string;
  category: string;
  weights: number[];
  popularity: number;
}

interface FontshareStyle {
  weight?: { number?: number; weight?: number };
  is_italic?: boolean;
}

interface FontshareApiFont {
  name?: string;
  slug?: string;
  category?: string;
  styles?: FontshareStyle[];
  views?: number;
}

/**
 * Feuille de style chargeant une famille Fontshare.
 *
 * Les graisses doivent être énumérées : sans `@…`, l'API ne renvoie que la
 * graisse par défaut, et tout le contraste typographique disparaît.
 */
export function fontshareCssUrl(slug: string, weights: number[] = []): string {
  const usable = usableWeights(weights);
  const spec = usable.length ? `${slug}@${usable.join(',')}` : slug;
  return `${FONTSHARE_CSS}?f%5B%5D=${encodeURIComponent(spec)}&display=swap`;
}

/**
 * Fontshare mélange dans `weight.number` des valeurs qui ne sont pas des
 * graisses CSS (1, 2, 201… : des marqueurs de variable et d'italique). On ne
 * garde que les centaines, sinon l'URL générée est rejetée.
 */
function usableWeights(weights: number[]): number[] {
  return [...new Set(weights.filter((w) => w >= 100 && w <= 900 && w % 100 === 0))].sort(
    (a, b) => a - b
  );
}

/** Fontshare nomme ses catégories « Sans », « Serif »… : on les ramène aux nôtres. */
function normalizeCategory(raw?: string): string {
  const value = (raw ?? '').toLowerCase().trim();
  if (value.startsWith('sans')) return 'sans-serif';
  if (value.startsWith('serif') || value.includes('slab')) return 'serif';
  if (value.startsWith('mono')) return 'monospace';
  if (value.includes('script') || value.includes('hand')) return 'handwriting';
  if (value.startsWith('display')) return 'display';
  return value || 'sans-serif';
}

export class FontshareService {
  private memoryCache: { fonts: FontshareFont[]; expiresAt: number } | null = null;
  private inFlight: Promise<FontshareFont[]> | null = null;

  async getCatalog(): Promise<FontshareFont[]> {
    const now = Date.now();
    if (this.memoryCache && this.memoryCache.expiresAt > now) {
      return this.memoryCache.fonts;
    }

    this.inFlight ??= this.loadCatalog().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async loadCatalog(): Promise<FontshareFont[]> {
    const cached = await cacheService.get<FontshareFont[]>(CACHE_KEY, { prefix: CACHE_PREFIX });
    if (cached && cached.length > 0) {
      this.remember(cached);
      return cached;
    }

    try {
      const fonts = await this.fetchAll();
      this.remember(fonts);
      await cacheService.set(CACHE_KEY, fonts, { prefix: CACHE_PREFIX, ttl: CACHE_TTL_SECONDS });
      return fonts;
    } catch (error: any) {
      // Une source indisponible ne doit jamais casser la recherche : le
      // catalogue agrégé se contente alors des autres sources.
      logger.warn('Fontshare catalog unavailable', { error: error.message });
      this.remember([]);
      return [];
    }
  }

  private async fetchAll(): Promise<FontshareFont[]> {
    logger.info('Fetching Fontshare catalog');
    const collected: FontshareApiFont[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const response = await axios.get<{ fonts?: FontshareApiFont[]; has_more?: boolean }>(
        FONTSHARE_API,
        { params: { limit: PAGE_SIZE, offset: page * PAGE_SIZE }, timeout: 15000 }
      );
      const batch = response.data?.fonts ?? [];
      collected.push(...batch);
      if (!response.data?.has_more || batch.length === 0) break;
    }

    // `views` est le seul signal de popularité publié : il tient lieu de
    // classement, comme l'ordre de la réponse le fait chez Google.
    const fonts = collected
      .filter((item) => item.slug && item.name)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .map((item, index) => toFontshareFont(item, index));

    logger.info(`Fontshare catalog loaded (${fonts.length} families)`);
    return fonts;
  }

  private remember(fonts: FontshareFont[]): void {
    this.memoryCache = { fonts, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
  }
}

function toFontshareFont(item: FontshareApiFont, popularity: number): FontshareFont {
  const weights = usableWeights(
    (item.styles ?? []).map((style) => style.weight?.number ?? style.weight?.weight ?? 0)
  );

  return {
    family: item.name!,
    slug: item.slug!,
    category: normalizeCategory(item.category),
    weights: weights.length ? weights : [400],
    popularity,
  };
}

export const fontshareService = new FontshareService();
