import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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
}

export interface TypographyPreview {
  id: string;
  name: string;
  primaryFont: string;
  secondaryFont: string;
  category: string;
  isLoaded: boolean;
}

/** Font summary as returned by our API (`GET /fonts`). */
interface FontSummaryDto {
  family: string;
  category: string;
  weights: number[];
  subsets: string[];
  popularity: number;
}

interface FontSearchResponse {
  success: boolean;
  data: { fonts: FontSummaryDto[]; total: number };
}

/**
 * Our own API proxies the Google Fonts catalog: the API key stays server-side
 * (Secret Manager) and the catalog is cached there for every user at once.
 */
const FONTS_ENDPOINT = `${environment.services.api.url}/fonts`;

/** Generic family appended to every font stack so text stays readable while loading. */
const GENERIC_FALLBACK: Record<string, string> = {
  serif: 'serif',
  'sans-serif': 'sans-serif',
  display: 'cursive',
  handwriting: 'cursive',
  monospace: 'monospace',
};

/**
 * Last-resort list used when `GET /fonts` is unreachable or the server has no
 * Google Fonts key configured. Ordered by popularity — the index doubles as the
 * ranking, so the search still behaves sensibly offline.
 */
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
   * Recherche dans le catalogue Google Fonts complet (~1900 familles), servi par
   * notre API. Une requête vide renvoie les familles les plus populaires, ce qui
   * donne quelque chose à parcourir avant même de taper.
   */
  searchGoogleFonts(
    query: string,
    category?: FontCategory | null,
    limit = 48,
  ): Observable<GoogleFont[]> {
    let params = new HttpParams().set('limit', limit);
    if (query.trim()) params = params.set('q', query.trim());
    if (category) params = params.set('category', category);

    return this.http.get<FontSearchResponse>(FONTS_ENDPOINT, { params }).pipe(
      map((response) => (response.data?.fonts ?? []).map(fromApi)),
      catchError((error) => {
        // 503 = clé Google Fonts non configurée côté serveur ; toute autre erreur
        // = API injoignable. Dans les deux cas la sélection reste utilisable.
        console.warn('Font catalog unavailable, using built-in list:', error);
        return of(searchFallback(query, category, limit));
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

function fromApi(font: FontSummaryDto): GoogleFont {
  return {
    family: font.family,
    variants: (font.weights ?? []).map(String),
    subsets: font.subsets ?? [],
    category: normalizeCategory(font.category),
    kind: 'webfont',
    weights: font.weights ?? [],
    popularity: font.popularity,
  };
}

/** Same ranking rules as the server, applied to the built-in list. */
function searchFallback(
  query: string,
  category: FontCategory | null | undefined,
  limit: number,
): GoogleFont[] {
  const needle = query.trim().toLowerCase();
  const scoped = FALLBACK_FAMILIES.map(([family, fontCategory], index) => ({
    family,
    variants: ['400', '700'],
    subsets: ['latin'],
    category: fontCategory,
    kind: 'webfont',
    weights: [400, 700],
    popularity: index,
  })).filter((font) => !category || font.category === category);

  if (!needle) return scoped.slice(0, limit);

  return scoped
    .map((font) => ({ font, score: matchScore(font.family, needle) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.font.popularity - b.font.popularity)
    .slice(0, limit)
    .map((entry) => entry.font);
}
