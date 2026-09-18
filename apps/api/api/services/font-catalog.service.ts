import logger from '../config/logger';
import { BrandFontModel, FontSourceId } from '../models/brand-identity.model';
import { customFontService } from './customFont.service';
import { fontshareService, fontshareCssUrl } from './fontshare.service';
import { fontsourceService, fontsourceCssUrl } from './fontsource.service';
import { GoogleFontsNotConfiguredError, googleFontsService } from './google-fonts.service';

/**
 * Le catalogue unique servi au front, toutes sources confondues.
 *
 * Google Fonts reste la source la plus large, mais c'est aussi celle dont tout
 * le web se sert : une marque qui n'y pioche que là hérite de l'air de famille
 * du reste d'internet. On agrège donc trois catalogues libres et les polices
 * que l'utilisateur a lui-même importées, sous une seule forme — `family`,
 * `source`, `cssUrl` — pour que le front comme les moteurs de rendu n'aient
 * qu'un seul type à manipuler.
 *
 * Une source injoignable ne fait jamais échouer la recherche : elle disparaît
 * simplement des résultats. C'est déjà le contrat de Google Fonts sans clé API.
 */

/** Rang de la source en cas de doublon de famille : la première gagne. */
const SOURCE_PRIORITY: FontSourceId[] = ['custom', 'fontshare', 'fontsource', 'google'];

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 48;

export interface CatalogFont {
  family: string;
  source: FontSourceId;
  /** Identifiant de la famille DANS sa source (slug npm, slug Fontshare, id interne). */
  sourceId: string;
  category: string;
  weights: number[];
  subsets: string[];
  /** Feuille de style qui charge réellement la famille. */
  cssUrl: string;
  /** Rang au sein de la source (0 = la plus populaire). */
  popularity: number;
  license?: string;
}

export interface CatalogSearchResult {
  fonts: CatalogFont[];
  total: number;
  /** Les sources effectivement interrogées — celles qui ont répondu. */
  sources: FontSourceId[];
}

export interface CatalogSearchOptions {
  query?: string;
  category?: string;
  /** Restreint à une ou plusieurs sources ; vide = toutes. */
  sources?: FontSourceId[];
  limit?: number;
  /** Nécessaire pour faire remonter les polices importées de l'utilisateur. */
  userId?: string;
}

/**
 * Feuille de style Google d'une famille, graisses réelles comprises.
 *
 * L'API `css2` répond 400 si on lui demande une graisse que la famille ne
 * publie pas — d'où l'énumération explicite, tirée du catalogue, plutôt qu'une
 * plage 100→900 posée au hasard.
 */
export function googleCssUrl(family: string, weights: number[] = []): string {
  const param = encodeURIComponent(family).replace(/%20/g, '+');
  const usable = [...new Set(weights.filter((w) => w >= 100 && w <= 900))].sort((a, b) => a - b);
  const spec = usable.length ? `${param}:wght@${usable.join(';')}` : param;
  return `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
}

export class FontCatalogService {
  /**
   * Recherche dans toutes les sources à la fois.
   *
   * Une requête vide renvoie les familles les plus en vue de chaque source :
   * le panneau est parcourable avant même qu'on ait tapé quoi que ce soit.
   */
  async search(options: CatalogSearchOptions = {}): Promise<CatalogSearchResult> {
    const { query = '', category, sources, limit = DEFAULT_LIMIT, userId } = options;
    const wanted = new Set<FontSourceId>(sources?.length ? sources : SOURCE_PRIORITY);
    const safeLimit = Math.min(Math.max(1, limit || DEFAULT_LIMIT), MAX_LIMIT);
    const needle = query.trim().toLowerCase();
    const normalizedCategory = category ? normalizeCategory(category) : null;

    const [google, fontshare, fontsource, custom] = await Promise.all([
      wanted.has('google') ? this.googleFonts() : Promise.resolve([]),
      wanted.has('fontshare') ? this.fontshareFonts() : Promise.resolve([]),
      wanted.has('fontsource') ? this.fontsourceFonts() : Promise.resolve([]),
      wanted.has('custom') && userId ? this.customFonts(userId) : Promise.resolve([]),
    ]);

    const answered: FontSourceId[] = [];
    if (custom.length) answered.push('custom');
    if (fontshare.length) answered.push('fontshare');
    if (fontsource.length) answered.push('fontsource');
    if (google.length) answered.push('google');

    // L'ordre de concaténation EST la priorité en cas de doublon : les polices
    // de l'utilisateur d'abord, Google en dernier.
    const merged = dedupe([...custom, ...fontshare, ...fontsource, ...google]);

    const scoped = normalizedCategory
      ? merged.filter((font) => font.category === normalizedCategory)
      : merged;

    if (!needle) {
      return { fonts: interleave(scoped, safeLimit), total: scoped.length, sources: answered };
    }

    const matched = scoped
      .map((font) => ({ font, score: matchScore(font.family, needle) }))
      .filter((entry) => entry.score >= 0)
      .sort(
        (a, b) =>
          a.score - b.score ||
          sourceRank(a.font.source) - sourceRank(b.font.source) ||
          a.font.popularity - b.font.popularity
      );

    return {
      fonts: matched.slice(0, safeLimit).map((entry) => entry.font),
      total: matched.length,
      sources: answered,
    };
  }

  /**
   * Retrouve une famille par son nom, quelle que soit sa source.
   *
   * C'est ce qui permet de transformer une recommandation de l'IA — qui ne
   * connaît qu'un NOM de famille — en une police réellement chargeable.
   */
  async resolve(
    family: string,
    preferredSource?: FontSourceId,
    userId?: string
  ): Promise<CatalogFont | null> {
    const needle = family.trim().toLowerCase();
    if (!needle) return null;

    const { fonts } = await this.search({ query: family, limit: MAX_LIMIT, userId });
    const exact = fonts.filter((font) => font.family.toLowerCase() === needle);
    if (!exact.length) return null;

    if (preferredSource) {
      const preferred = exact.find((font) => font.source === preferredSource);
      if (preferred) return preferred;
    }
    return exact[0];
  }

  /**
   * La forme stockée dans la typographie du projet.
   *
   * Une famille introuvable n'est pas une erreur : elle est renvoyée comme
   * police Google, ce qui reste le comportement historique et laisse le rendu
   * tenter sa chance plutôt que de perdre le choix de l'utilisateur.
   */
  async toBrandFont(
    family: string,
    preferredSource?: FontSourceId,
    userId?: string
  ): Promise<BrandFontModel> {
    const found = await this.resolve(family, preferredSource, userId);
    if (!found) {
      return { family: family.trim(), source: 'google', cssUrl: googleCssUrl(family.trim()) };
    }
    return {
      family: found.family,
      source: found.source,
      cssUrl: found.cssUrl,
      category: found.category,
      weights: found.weights,
      ...(found.source === 'custom' ? { customFontId: found.sourceId } : {}),
    };
  }

  /** Les sources disponibles, pour les filtres du front. */
  availableSources(): { id: FontSourceId; label: string; url: string }[] {
    return [
      { id: 'google', label: 'Google Fonts', url: 'https://fonts.google.com' },
      { id: 'fontshare', label: 'Fontshare', url: 'https://www.fontshare.com' },
      { id: 'fontsource', label: 'Fontsource', url: 'https://fontsource.org' },
      { id: 'custom', label: 'Mes polices', url: '' },
    ];
  }

  private async googleFonts(): Promise<CatalogFont[]> {
    try {
      // Le catalogue complet, déjà classé par popularité et mis en cache 24 h
      // par le service Google : le tri et le filtrage se font ici, sur
      // l'ensemble agrégé.
      const catalog = await googleFontsService.getCatalogFonts();
      return catalog.map((font) => ({
        family: font.family,
        source: 'google' as const,
        sourceId: font.family,
        category: normalizeCategory(font.category),
        weights: font.weights,
        subsets: font.subsets,
        cssUrl: googleCssUrl(font.family, font.weights),
        popularity: font.popularity,
      }));
    } catch (error: any) {
      if (!(error instanceof GoogleFontsNotConfiguredError)) {
        logger.warn('Google Fonts catalog unavailable', { error: error.message });
      }
      return [];
    }
  }

  private async fontshareFonts(): Promise<CatalogFont[]> {
    const catalog = await fontshareService.getCatalog();
    return catalog.map((font) => ({
      family: font.family,
      source: 'fontshare' as const,
      sourceId: font.slug,
      category: font.category,
      weights: font.weights,
      subsets: ['latin'],
      cssUrl: fontshareCssUrl(font.slug, font.weights),
      popularity: font.popularity,
      license: 'Fontshare — free for commercial use',
    }));
  }

  private async fontsourceFonts(): Promise<CatalogFont[]> {
    const catalog = await fontsourceService.getCatalog();
    return catalog.map((font) => ({
      family: font.family,
      source: 'fontsource' as const,
      sourceId: font.id,
      category: font.category,
      weights: font.weights,
      subsets: font.subsets,
      cssUrl: fontsourceCssUrl(font.id),
      popularity: font.popularity,
      license: font.license,
    }));
  }

  private async customFonts(userId: string): Promise<CatalogFont[]> {
    try {
      const fonts = await customFontService.listFonts(userId);
      return fonts.map((font, index) => ({
        family: font.family,
        source: 'custom' as const,
        sourceId: font.id,
        category: normalizeCategory(font.category),
        weights: font.weights,
        subsets: ['latin'],
        cssUrl: font.cssUrl,
        popularity: index,
      }));
    } catch (error: any) {
      logger.warn('Could not list imported fonts', { error: error.message });
      return [];
    }
  }
}

/**
 * Une même famille peut exister dans deux catalogues (Fontsource republie du
 * libre que Google distribue aussi). On garde la première rencontrée, donc la
 * mieux classée par `SOURCE_PRIORITY`.
 */
function dedupe(fonts: CatalogFont[]): CatalogFont[] {
  const seen = new Set<string>();
  const result: CatalogFont[] = [];
  for (const font of fonts) {
    const key = font.family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(font);
  }
  return result;
}

/**
 * Sans recherche, Google écraserait la liste par le nombre : ses ~1900 familles
 * rempliraient la page avant la première police d'une autre source. On sert
 * donc un tour de table — une famille par source, en boucle — pour que les
 * autres catalogues soient VISIBLES, ce qui est tout l'objet de leur ajout.
 */
function interleave(fonts: CatalogFont[], limit: number): CatalogFont[] {
  const buckets = new Map<FontSourceId, CatalogFont[]>();
  for (const font of fonts) {
    buckets.set(font.source, [...(buckets.get(font.source) ?? []), font]);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.popularity - b.popularity);
  }

  const order = SOURCE_PRIORITY.filter((source) => buckets.has(source));
  const result: CatalogFont[] = [];
  let index = 0;
  while (result.length < limit && order.some((source) => (buckets.get(source)?.length ?? 0) > index)) {
    for (const source of order) {
      const font = buckets.get(source)?.[index];
      if (font) result.push(font);
      if (result.length >= limit) break;
    }
    index++;
  }
  return result;
}

function sourceRank(source: FontSourceId): number {
  const rank = SOURCE_PRIORITY.indexOf(source);
  return rank === -1 ? SOURCE_PRIORITY.length : rank;
}

function normalizeCategory(category?: string): string {
  const value = (category ?? '').toLowerCase().replace(/\s+/g, '-');
  return value === 'sans' ? 'sans-serif' : value;
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

export const fontCatalogService = new FontCatalogService();
