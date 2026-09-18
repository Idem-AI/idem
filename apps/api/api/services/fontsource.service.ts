import axios from 'axios';
import logger from '../config/logger';
import { cacheService } from './cache.service';

/**
 * Catalogue Fontsource, restreint aux familles qui ne viennent PAS de Google.
 *
 * Fontsource republie ~2000 familles, dont l'écrasante majorité est déjà le
 * catalogue Google : les reprendre toutes ne ferait que doubler chaque entrée
 * de la liste. Son champ `type` sépare `google`, `icons` et `other` ; seul
 * `other` nous intéresse — ce sont des familles libres publiées ailleurs
 * (Adwaita, Apfel Grotezk, Geist, Bluu Next…), introuvables chez Google.
 *
 * Les fichiers sont servis par jsDelivr, sans clé ni quota.
 */

const FONTSOURCE_API = 'https://api.fontsource.org/v1/fonts';
const FONTSOURCE_CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';

const CACHE_TTL_SECONDS = 24 * 60 * 60;
// v2 : écarte les jeux techniques (cf. `isBrandUsable`). Le numéro fait
// expirer le catalogue déjà en cache au lieu d'attendre 24 h.
const CACHE_KEY = 'catalog:other:v2';
const CACHE_PREFIX = 'fontsource';

export interface FontsourceFont {
  family: string;
  /** Identifiant npm de la famille (`apfel-grotezk`). */
  id: string;
  category: string;
  weights: number[];
  subsets: string[];
  license?: string;
  popularity: number;
}

interface FontsourceApiFont {
  id?: string;
  family?: string;
  subsets?: string[];
  weights?: number[];
  styles?: string[];
  category?: string;
  license?: string;
  type?: string;
}

/**
 * Feuille de style chargeant une famille Fontsource.
 *
 * `index.css` déclare toutes les graisses publiées et pointe ses fichiers en
 * relatif — jsDelivr les résout depuis l'URL de la feuille, donc un simple
 * `<link>` suffit, côté navigateur comme dans Puppeteer.
 */
export function fontsourceCssUrl(id: string): string {
  return `${FONTSOURCE_CDN}/${id}@latest/index.css`;
}

/** Fontsource utilise déjà notre vocabulaire. */
function normalizeCategory(raw?: string): string {
  const value = (raw ?? '').toLowerCase().replace(/\s+/g, '-');
  return value || 'sans-serif';
}

/**
 * Familles à écarter : ce ne sont pas des typographies de marque.
 *
 * La liste `other` de Fontsource mêle de vrais caractères et des jeux
 * TECHNIQUES — afficheurs sept segments (DSEG), rustines de ponctuation
 * japonaise (YakuHan), polices pixel CJK déclinées en 36 variantes (Fusion).
 * À elles seules elles occupaient la moitié du panneau « Personnaliser », en
 * repoussant hors de vue les familles pour lesquelles cette source a été
 * ajoutée. Elles restent parfaitement légitimes — simplement pas ici.
 */
function isBrandUsable(item: FontsourceApiFont): boolean {
  // `category: other` ne désigne chez Fontsource que ces jeux techniques.
  if ((item.category ?? '').toLowerCase() === 'other') return false;
  return !/^(Fusion (Pixel|Kai)|YakuHan|DSEG|UnifontEX|Genjyuu)/i.test(item.family ?? '');
}

export class FontsourceService {
  private memoryCache: { fonts: FontsourceFont[]; expiresAt: number } | null = null;
  private inFlight: Promise<FontsourceFont[]> | null = null;

  async getCatalog(): Promise<FontsourceFont[]> {
    const now = Date.now();
    if (this.memoryCache && this.memoryCache.expiresAt > now) {
      return this.memoryCache.fonts;
    }

    this.inFlight ??= this.loadCatalog().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async loadCatalog(): Promise<FontsourceFont[]> {
    const cached = await cacheService.get<FontsourceFont[]>(CACHE_KEY, { prefix: CACHE_PREFIX });
    if (cached && cached.length > 0) {
      this.remember(cached);
      return cached;
    }

    try {
      const fonts = await this.fetchFromFontsource();
      this.remember(fonts);
      await cacheService.set(CACHE_KEY, fonts, { prefix: CACHE_PREFIX, ttl: CACHE_TTL_SECONDS });
      return fonts;
    } catch (error: any) {
      logger.warn('Fontsource catalog unavailable', { error: error.message });
      this.remember([]);
      return [];
    }
  }

  private async fetchFromFontsource(): Promise<FontsourceFont[]> {
    logger.info('Fetching Fontsource catalog (non-Google families)');

    const response = await axios.get<FontsourceApiFont[]>(FONTSOURCE_API, {
      params: { type: 'other' },
      timeout: 15000,
    });

    const items = Array.isArray(response.data) ? response.data : [];
    const fonts = items
      .filter((item) => item.id && item.family && item.type === 'other')
      .filter(isBrandUsable)
      // Le catalogue n'expose aucun signal de popularité : l'ordre
      // alphabétique vaut mieux qu'un classement inventé.
      .sort((a, b) => a.family!.localeCompare(b.family!))
      .map((item, index) => toFontsourceFont(item, index));

    logger.info(`Fontsource catalog loaded (${fonts.length} families)`);
    return fonts;
  }

  private remember(fonts: FontsourceFont[]): void {
    this.memoryCache = { fonts, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
  }
}

function toFontsourceFont(item: FontsourceApiFont, popularity: number): FontsourceFont {
  const weights = [...new Set(item.weights ?? [])].sort((a, b) => a - b);
  return {
    family: item.family!,
    id: item.id!,
    category: normalizeCategory(item.category),
    weights: weights.length ? weights : [400],
    subsets: item.subsets ?? [],
    license: item.license,
    popularity,
  };
}

export const fontsourceService = new FontsourceService();
