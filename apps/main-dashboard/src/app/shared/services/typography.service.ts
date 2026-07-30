import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { skipAuth } from '../interceptors/http-context';

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

export interface GoogleFont {
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
  kind: string;
  menu?: string;
  /** Numeric weights actually published for this family. */
  weights?: number[];
  /** Lower is more popular. Used to rank search results. */
  popularity?: number;
  variable?: boolean;
}

export interface GoogleFontsResponse {
  kind: string;
  items: GoogleFont[];
}

export interface TypographyPreview {
  id: string;
  name: string;
  primaryFont: string;
  secondaryFont: string;
  category: string;
  isLoaded: boolean;
}

interface FontsourceFont {
  id: string;
  family: string;
  subsets: string[];
  weights: number[];
  styles: string[];
  variable: boolean;
  category: string;
  type: string;
}

/** Official catalog — needs a Google Cloud key with the Web Fonts API enabled. */
const GOOGLE_FONTS_API = 'https://www.googleapis.com/webfonts/v1/webfonts';

/**
 * Key-less mirror of the very same Google Fonts catalog. `fonts.google.com/metadata/fonts`
 * sends no CORS header, so it is unreachable from the browser; Fontsource republishes
 * the catalog with `Access-Control-Allow-Origin: *`, which lets the search run
 * without provisioning an API key. Font files themselves always come from Google.
 */
const FONTSOURCE_API = 'https://api.fontsource.org/v1/fonts';

/** Generic family appended to every font stack so text stays readable while loading. */
const GENERIC_FALLBACK: Record<string, string> = {
  serif: 'serif',
  'sans-serif': 'sans-serif',
  display: 'cursive',
  handwriting: 'cursive',
  monospace: 'monospace',
};

/**
 * Ranking hint: the catalog mirror carries no popularity metric, so these
 * well-known families are surfaced first. Anything not listed is ranked after,
 * alphabetically.
 */
const POPULAR_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Lato',
  'Raleway',
  'Nunito',
  'Nunito Sans',
  'Playfair Display',
  'Merriweather',
  'Oswald',
  'Source Sans 3',
  'Work Sans',
  'DM Sans',
  'Rubik',
  'Manrope',
  'Outfit',
  'Plus Jakarta Sans',
  'Figtree',
  'Space Grotesk',
  'Sora',
  'Lora',
  'Libre Baskerville',
  'PT Serif',
  'Cormorant Garamond',
  'EB Garamond',
  'Crimson Text',
  'Bitter',
  'Karla',
  'Quicksand',
  'Barlow',
  'Mulish',
  'Josefin Sans',
  'Cabin',
  'Fira Sans',
  'Heebo',
  'Archivo',
  'Public Sans',
  'Bebas Neue',
  'Anton',
  'Dancing Script',
  'Pacifico',
  'Caveat',
  'Lobster',
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'IBM Plex Sans',
  'IBM Plex Mono',
  'Space Mono',
  'Inconsolata',
];

/** Offline safety net if both catalog sources fail. */
const FALLBACK_FAMILIES: ReadonlyArray<[string, FontCategory]> = [
  ['Inter', 'sans-serif'],
  ['Roboto', 'sans-serif'],
  ['Open Sans', 'sans-serif'],
  ['Lato', 'sans-serif'],
  ['Montserrat', 'sans-serif'],
  ['Poppins', 'sans-serif'],
  ['Raleway', 'sans-serif'],
  ['Nunito Sans', 'sans-serif'],
  ['Work Sans', 'sans-serif'],
  ['DM Sans', 'sans-serif'],
  ['Manrope', 'sans-serif'],
  ['Playfair Display', 'serif'],
  ['Merriweather', 'serif'],
  ['Lora', 'serif'],
  ['PT Serif', 'serif'],
  ['Libre Baskerville', 'serif'],
  ['Crimson Text', 'serif'],
  ['EB Garamond', 'serif'],
  ['Oswald', 'display'],
  ['Bebas Neue', 'display'],
  ['Anton', 'display'],
  ['Dancing Script', 'handwriting'],
  ['Pacifico', 'handwriting'],
  ['Caveat', 'handwriting'],
  ['JetBrains Mono', 'monospace'],
  ['Fira Code', 'monospace'],
  ['Source Code Pro', 'monospace'],
  ['Space Mono', 'monospace'],
];

/** Weights requested when injecting a stylesheet; Google serves the closest available. */
const REQUESTED_WEIGHTS = [400, 500, 600, 700];

/** Google rejects over-long URLs, so stylesheet requests are batched. */
const FAMILIES_PER_REQUEST = 10;

/**
 * Builds a CSS `font-family` value for a font preview.
 *
 * Two non-obvious requirements:
 * - The family name is always quoted: a bare identifier is invalid when a word
 *   starts with a digit (`Exo 2`, `Source Sans 3` — both produced by our own
 *   typography prompt), and the browser then drops the whole declaration.
 * - The value is `!important`, because `styles.css` forces `* { font-family:
 *   'Jura' !important }` app-wide. An important declaration from a stylesheet
 *   beats a plain inline style, so a preview could never show its own font.
 *   Angular strips the suffix from a style binding and sets the priority flag,
 *   and an important *inline* style outranks an important stylesheet rule.
 */
export function fontStack(family: string | null | undefined, category?: string): string {
  if (!family) return 'inherit';
  const generic = GENERIC_FALLBACK[normalizeCategory(category)] ?? 'sans-serif';
  return `"${family.replace(/"/g, '')}", ${generic} !important`;
}

function normalizeCategory(category?: string): string {
  const value = (category ?? '').toLowerCase().replace(/\s+/g, '-');
  return value === 'sans' ? 'sans-serif' : value;
}

@Injectable({
  providedIn: 'root',
})
export class TypographyService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** family → in-flight or settled load, so a family is never requested twice. */
  private readonly fontLoads = new Map<string, Promise<void>>();
  private catalog$?: Observable<GoogleFont[]>;

  // Typographies populaires pré-définies
  private readonly popularTypographies: TypographyPreview[] = [
    {
      id: 'modern-clean',
      name: 'Modern Clean',
      primaryFont: 'Inter',
      secondaryFont: 'Inter',
      category: 'sans-serif',
      isLoaded: false,
    },
    {
      id: 'elegant-serif',
      name: 'Elegant Serif',
      primaryFont: 'Playfair Display',
      secondaryFont: 'Source Sans 3',
      category: 'serif',
      isLoaded: false,
    },
    {
      id: 'tech-startup',
      name: 'Tech Startup',
      primaryFont: 'Poppins',
      secondaryFont: 'Roboto',
      category: 'sans-serif',
      isLoaded: false,
    },
    {
      id: 'creative-bold',
      name: 'Creative Bold',
      primaryFont: 'Montserrat',
      secondaryFont: 'Open Sans',
      category: 'sans-serif',
      isLoaded: false,
    },
    {
      id: 'classic-professional',
      name: 'Classic Professional',
      primaryFont: 'Merriweather',
      secondaryFont: 'Lato',
      category: 'serif',
      isLoaded: false,
    },
    {
      id: 'minimal-geometric',
      name: 'Minimal Geometric',
      primaryFont: 'Nunito Sans',
      secondaryFont: 'Nunito Sans',
      category: 'sans-serif',
      isLoaded: false,
    },
  ];

  /**
   * Charge une police Google Fonts dynamiquement et attend qu'elle soit réellement
   * disponible pour le rendu.
   */
  loadGoogleFont(fontFamily: string): Promise<void> {
    return this.loadGoogleFonts([fontFamily]);
  }

  /**
   * Charge plusieurs polices en une seule requête (une balise `<link>` peut
   * déclarer plusieurs familles), et résout lorsque toutes sont utilisables.
   */
  loadGoogleFonts(families: readonly (string | null | undefined)[]): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();

    const missing: string[] = [];
    const pending: Promise<void>[] = [];

    for (const family of new Set(families.map((f) => f?.trim()).filter(Boolean) as string[])) {
      const known = this.fontLoads.get(family);
      if (known) {
        pending.push(known);
      } else {
        missing.push(family);
      }
    }

    for (let i = 0; i < missing.length; i += FAMILIES_PER_REQUEST) {
      const batch = missing.slice(i, i + FAMILIES_PER_REQUEST);
      const stylesheet = this.injectStylesheet(batch);
      for (const family of batch) {
        const load = stylesheet.then(() => this.awaitFontFaces(family));
        this.fontLoads.set(family, load);
        pending.push(load);
      }
    }

    return Promise.all(pending).then(() => undefined);
  }

  /**
   * Recherche dans le catalogue Google Fonts complet (~1900 familles).
   * Une requête vide renvoie les familles les plus populaires, ce qui donne
   * quelque chose à parcourir avant même de taper.
   */
  searchGoogleFonts(
    query: string,
    category?: FontCategory | null,
    limit = 48,
  ): Observable<GoogleFont[]> {
    const needle = query.trim().toLowerCase();

    return this.getCatalog().pipe(
      map((fonts) => {
        const filtered = category
          ? fonts.filter((font) => normalizeCategory(font.category) === category)
          : fonts;

        if (!needle) {
          return [...filtered]
            .sort((a, b) => (a.popularity ?? 0) - (b.popularity ?? 0))
            .slice(0, limit);
        }

        return filtered
          .map((font) => ({ font, score: matchScore(font.family, needle) }))
          .filter((entry) => entry.score >= 0)
          .sort(
            (a, b) =>
              a.score - b.score ||
              (a.font.popularity ?? 0) - (b.font.popularity ?? 0) ||
              a.font.family.localeCompare(b.font.family),
          )
          .slice(0, limit)
          .map((entry) => entry.font);
      }),
    );
  }

  /**
   * Obtient les typographies populaires
   */
  getPopularTypographies(): TypographyPreview[] {
    return this.popularTypographies;
  }

  /**
   * Crée une typographie personnalisée
   */
  async createCustomTypography(
    primaryFont: string,
    secondaryFont: string,
  ): Promise<TypographyPreview> {
    await this.loadGoogleFonts([primaryFont, secondaryFont]);

    const id = `custom-${Date.now()}`;
    return {
      id,
      name: `${primaryFont} + ${secondaryFont}`,
      primaryFont,
      secondaryFont,
      category: 'custom',
      isLoaded: true,
    };
  }

  /**
   * Vérifie si une police a déjà été demandée au chargement
   */
  isFontLoaded(fontFamily: string): boolean {
    return this.fontLoads.has(fontFamily.trim());
  }

  /**
   * Obtient une liste de polices par catégorie
   */
  getFontsByCategory(category: FontCategory, limit = 48): Observable<GoogleFont[]> {
    return this.searchGoogleFonts('', category, limit);
  }

  /** Catalogue chargé une seule fois puis partagé par tous les abonnés. */
  private getCatalog(): Observable<GoogleFont[]> {
    this.catalog$ ??= this.fetchCatalog().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.catalog$;
  }

  private fetchCatalog(): Observable<GoogleFont[]> {
    const apiKey = environment.googleFonts?.apiKey;

    const request = apiKey
      ? this.http
          .get<GoogleFontsResponse>(GOOGLE_FONTS_API, {
            params: { key: apiKey, sort: 'popularity' },
            context: skipAuth(),
          })
          .pipe(map((response) => (response.items ?? []).map(fromGoogleApi)))
      : this.http
          .get<FontsourceFont[]>(FONTSOURCE_API, { context: skipAuth() })
          .pipe(
            map((fonts) =>
              (fonts ?? [])
                // `icons` covers Material Symbols & co — glyph sets, not typefaces.
                .filter((font) => font.type === 'google' && font.category !== 'icons')
                .map(fromFontsource),
            ),
          );

    return request.pipe(
      map((fonts) => (fonts.length > 0 ? fonts : buildFallbackCatalog())),
      catchError((error) => {
        console.warn('Google Fonts catalog unavailable, using built-in list:', error);
        return of(buildFallbackCatalog());
      }),
    );
  }

  /** Ajoute une feuille de style Google Fonts couvrant plusieurs familles. */
  private injectStylesheet(families: string[]): Promise<void> {
    return new Promise((resolve) => {
      const query = families
        .map(
          (family) =>
            `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${REQUESTED_WEIGHTS.join(';')}`,
        )
        .join('&');

      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
      // A failed stylesheet must not block the caller: the preview simply keeps
      // its generic fallback, so both outcomes resolve.
      link.onload = () => resolve();
      link.onerror = () => {
        console.warn('Failed to load Google Fonts stylesheet for:', families.join(', '));
        resolve();
      };

      this.document.head.appendChild(link);
    });
  }

  /**
   * `<link>` onload only means the CSS arrived — the font files are fetched
   * lazily. `document.fonts.load()` forces that fetch so the preview repaints
   * with the real typeface instead of the fallback.
   */
  private async awaitFontFaces(family: string): Promise<void> {
    const fonts = (this.document as Document).fonts;
    if (!fonts) return;

    try {
      await Promise.all([
        fonts.load(`400 16px "${family}"`),
        fonts.load(`700 16px "${family}"`),
      ]);
    } catch {
      // Font unavailable (renamed or removed upstream): keep the fallback.
    }
  }
}

/** -1 = no match; lower is a better match. */
function matchScore(family: string, needle: string): number {
  const value = family.toLowerCase();
  if (value === needle) return 0;
  if (value.startsWith(needle)) return 1;
  if (value.split(/\s+/).some((word) => word.startsWith(needle))) return 2;
  if (value.includes(needle)) return 3;
  return -1;
}

function popularityRank(family: string): number {
  const index = POPULAR_FAMILIES.indexOf(family);
  return index >= 0 ? index : POPULAR_FAMILIES.length;
}

function fromGoogleApi(font: GoogleFont, index: number): GoogleFont {
  return {
    ...font,
    category: normalizeCategory(font.category),
    weights: (font.variants ?? [])
      .map((variant) => Number.parseInt(variant, 10))
      .filter((weight) => !Number.isNaN(weight)),
    // The API is queried with `sort=popularity`, so the response order is the ranking.
    popularity: index,
  };
}

function fromFontsource(font: FontsourceFont): GoogleFont {
  return {
    family: font.family,
    variants: (font.weights ?? []).map(String),
    subsets: font.subsets ?? [],
    category: normalizeCategory(font.category),
    kind: 'webfont',
    weights: font.weights ?? [],
    variable: font.variable,
    popularity: popularityRank(font.family),
  };
}

function buildFallbackCatalog(): GoogleFont[] {
  return FALLBACK_FAMILIES.map(([family, category]) => ({
    family,
    variants: ['400', '700'],
    subsets: ['latin'],
    category,
    kind: 'webfont',
    weights: [400, 700],
    popularity: popularityRank(family),
  }));
}
