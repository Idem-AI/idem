import { DOCUMENT, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  BrandFont,
  BrandFontFile,
  FontSourceId,
  TypographyModel,
} from '../../modules/dashboard/models/brand-identity.model';

export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

export type { FontSourceId, BrandFont } from '../../modules/dashboard/models/brand-identity.model';

/**
 * Une famille du catalogue, quelle que soit sa provenance.
 *
 * `cssUrl` est ce qui la rend affichable : le service injecte cette feuille et
 * n'a plus besoin de savoir si la police vient de Google, de Fontshare, de
 * Fontsource ou du bucket de l'utilisateur.
 */
export interface CatalogFont {
  family: string;
  source: FontSourceId;
  /** Identifiant de la famille dans sa source (slug). */
  sourceId: string;
  category: string;
  weights: number[];
  subsets: string[];
  cssUrl: string;
  /** Rang au sein de la source (0 = la plus populaire). */
  popularity: number;
  license?: string;
}

/** Une police importée par l'utilisateur, telle que l'API la renvoie. */
export interface CustomFont {
  id: string;
  family: string;
  category: string;
  weights: number[];
  cssUrl: string;
  files: BrandFontFile[];
  createdAt?: string;
}

export interface FontSourceOption {
  id: FontSourceId;
  label: string;
  url: string;
}

export interface TypographyPreview {
  id: string;
  name: string;
  primaryFont: string;
  secondaryFont: string;
  category: string;
  isLoaded: boolean;
}

interface FontSearchResponse {
  success: boolean;
  data: { fonts: CatalogFont[]; total: number; sources: FontSourceId[] };
}

interface CustomFontListResponse {
  success: boolean;
  data: { fonts: CustomFont[] };
}

interface CustomFontResponse {
  success: boolean;
  data: CustomFont;
}

interface FontSourcesResponse {
  success: boolean;
  data: { sources: FontSourceOption[] };
}

/**
 * Notre API agrège les catalogues : la clé Google reste côté serveur, les
 * catalogues sont mis en cache une fois pour tous les utilisateurs, et les
 * polices importées ne sortent jamais du compte qui les a envoyées.
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
 * Last-resort list used when `GET /fonts` is unreachable or every catalog is
 * down. Ordered by popularity — the index doubles as the ranking, so the search
 * still behaves sensibly offline.
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

/** Weights requested when falling back to a Google stylesheet built from a name alone. */
const REQUESTED_WEIGHTS = [400, 500, 600, 700];

/** Google rejects over-long URLs, so name-only stylesheet requests are batched. */
const FAMILIES_PER_REQUEST = 10;

/**
 * Builds a CSS `font-family` value for a font preview.
 *
 * Two non-obvious requirements:
 * - The family name is always quoted: a bare identifier is invalid when a word
 *   starts with a digit (`Exo 2`, `Source Sans 3` — both produced by our own
 *   typography prompt), and the browser then drops the whole declaration.
 * - The value is `!important`, because `styles.css` forces `* { font-family:
 *   'Vilevile' !important }` app-wide. An important declaration from a stylesheet
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

/** Google stylesheet for a family we only know by name. */
function googleStylesheetUrl(families: string[]): string {
  const query = families
    .map(
      (family) =>
        `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${REQUESTED_WEIGHTS.join(';')}`,
    )
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
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

  /**
   * family → feuille qui la charge, apprise des résultats de recherche et des
   * typographies déjà choisies.
   *
   * Sans ce registre, une famille connue seulement par son nom (une carte de
   * typographie, un aperçu) serait redemandée à Google — donc jamais chargée si
   * elle vient de Fontshare, de Fontsource ou du bucket de l'utilisateur.
   */
  private readonly familyStylesheets = new Map<string, string>();

  /** Les feuilles déjà insérées dans le document, pour ne pas les redoubler. */
  private readonly injectedStylesheets = new Map<string, Promise<void>>();

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
   * Charge des polices dont on connaît la source, et résout lorsqu'elles sont
   * réellement utilisables pour le rendu.
   */
  loadFonts(fonts: readonly (BrandFont | CatalogFont | null | undefined)[]): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();

    const pending: Promise<void>[] = [];
    const nameOnly: string[] = [];

    for (const font of fonts) {
      const family = font?.family?.trim();
      if (!family) continue;

      this.remember(font!);
      const href = font!.cssUrl || this.familyStylesheets.get(family.toLowerCase());
      if (href) {
        pending.push(this.loadFromStylesheet(family, href));
      } else {
        nameOnly.push(family);
      }
    }

    if (nameOnly.length) pending.push(this.loadGoogleFonts(nameOnly));
    return Promise.all(pending).then(() => undefined);
  }

  /** Charge les deux familles d'une typographie, en honorant leur source. */
  loadTypography(typography?: Partial<TypographyModel> | null): Promise<void> {
    if (!typography) return Promise.resolve();

    const primary: BrandFont | null = typography.primary
      ? typography.primary
      : typography.primaryFont
        ? { family: typography.primaryFont, source: 'google' as const, cssUrl: undefined }
        : null;
    const secondary: BrandFont | null = typography.secondary
      ? typography.secondary
      : typography.secondaryFont
        ? { family: typography.secondaryFont, source: 'google' as const, cssUrl: undefined }
        : null;

    return this.loadFonts([primary, secondary]);
  }

  /**
   * Charge une police connue seulement par son NOM.
   *
   * Le registre est consulté d'abord : une famille déjà rencontrée dans la
   * recherche est chargée depuis sa vraie source. À défaut, on retombe sur
   * Google — le seul catalogue adressable par nom de famille.
   */
  loadGoogleFont(fontFamily: string): Promise<void> {
    return this.loadGoogleFonts([fontFamily]);
  }

  loadGoogleFonts(families: readonly (string | null | undefined)[]): Promise<void> {
    if (!this.isBrowser) return Promise.resolve();

    const missing: string[] = [];
    const pending: Promise<void>[] = [];

    for (const family of new Set(families.map((f) => f?.trim()).filter(Boolean) as string[])) {
      const known = this.fontLoads.get(family);
      if (known) {
        pending.push(known);
        continue;
      }

      const href = this.familyStylesheets.get(family.toLowerCase());
      if (href) {
        pending.push(this.loadFromStylesheet(family, href));
      } else {
        missing.push(family);
      }
    }

    for (let i = 0; i < missing.length; i += FAMILIES_PER_REQUEST) {
      const batch = missing.slice(i, i + FAMILIES_PER_REQUEST);
      const stylesheet = this.injectStylesheet(googleStylesheetUrl(batch));
      for (const family of batch) {
        const load = stylesheet.then(() => this.awaitFontFaces(family));
        this.fontLoads.set(family, load);
        pending.push(load);
      }
    }

    return Promise.all(pending).then(() => undefined);
  }

  /**
   * Recherche dans le catalogue agrégé — Google Fonts, Fontshare, Fontsource et
   * les polices importées par l'utilisateur. Une requête vide renvoie les
   * familles les plus en vue de chaque source, en alternance, pour qu'aucune
   * source ne soit noyée par le nombre.
   */
  searchFonts(
    query: string,
    category?: FontCategory | null,
    sources?: readonly FontSourceId[] | null,
    limit = 48,
  ): Observable<CatalogFont[]> {
    let params = new HttpParams().set('limit', limit);
    if (query.trim()) params = params.set('q', query.trim());
    if (category) params = params.set('category', category);
    if (sources?.length) params = params.set('source', sources.join(','));

    return this.http.get<FontSearchResponse>(FONTS_ENDPOINT, { params }).pipe(
      map((response) => response.data?.fonts ?? []),
      tap((fonts) => fonts.forEach((font) => this.remember(font))),
      catchError((error) => {
        // API injoignable : la sélection reste utilisable sur la liste intégrée.
        console.warn('Font catalog unavailable, using built-in list:', error);
        return of(searchFallback(query, category, limit));
      }),
    );
  }

  /** Les catalogues proposés dans le filtre de source. */
  getFontSources(): Observable<FontSourceOption[]> {
    return this.http.get<FontSourcesResponse>(`${FONTS_ENDPOINT}/sources`).pipe(
      map((response) => response.data?.sources ?? []),
      catchError(() => of([])),
    );
  }

  /** Les polices que l'utilisateur a déjà importées. */
  listCustomFonts(): Observable<CustomFont[]> {
    return this.http.get<CustomFontListResponse>(`${FONTS_ENDPOINT}/custom`).pipe(
      map((response) => response.data?.fonts ?? []),
      tap((fonts) =>
        fonts.forEach((font) =>
          this.remember({ family: font.family, source: 'custom', cssUrl: font.cssUrl }),
        ),
      ),
      catchError((error) => {
        console.warn('Could not list imported fonts:', error);
        return of([]);
      }),
    );
  }

  /**
   * Téléverse une famille de l'utilisateur.
   *
   * Les fichiers partent dans notre bucket et l'API renvoie la feuille
   * `@font-face` qu'elle a fabriquée : c'est cette URL qui sera stockée sur le
   * projet, à la place d'un lien Google.
   */
  uploadCustomFont(family: string, files: readonly File[], category = 'sans-serif'): Observable<CustomFont> {
    const form = new FormData();
    form.append('family', family);
    form.append('category', category);
    for (const file of files) form.append('files', file, file.name);

    return this.http.post<CustomFontResponse>(`${FONTS_ENDPOINT}/custom`, form).pipe(
      map((response) => response.data),
      tap((font) =>
        this.remember({ family: font.family, source: 'custom', cssUrl: font.cssUrl }),
      ),
    );
  }

  deleteCustomFont(fontId: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${FONTS_ENDPOINT}/custom/${fontId}`)
      .pipe(map(() => undefined));
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
  getFontsByCategory(category: FontCategory, limit = 48): Observable<CatalogFont[]> {
    return this.searchFonts('', category, null, limit);
  }

  /** Mémorise la feuille d'une famille pour tous les appels par nom qui suivront. */
  private remember(font: { family?: string; cssUrl?: string; source?: FontSourceId }): void {
    const family = font.family?.trim();
    if (!family || !font.cssUrl) return;
    this.familyStylesheets.set(family.toLowerCase(), font.cssUrl);
  }

  private loadFromStylesheet(family: string, href: string): Promise<void> {
    const known = this.fontLoads.get(family);
    if (known) return known;

    const load = this.injectStylesheet(href).then(() => this.awaitFontFaces(family));
    this.fontLoads.set(family, load);
    return load;
  }

  /** Insère une feuille de style, une seule fois par URL. */
  private injectStylesheet(href: string): Promise<void> {
    const existing = this.injectedStylesheets.get(href);
    if (existing) return existing;

    const load = new Promise<void>((resolve) => {
      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      // A failed stylesheet must not block the caller: the preview simply keeps
      // its generic fallback, so both outcomes resolve.
      link.onload = () => resolve();
      link.onerror = () => {
        console.warn('Failed to load font stylesheet:', href);
        resolve();
      };
      this.document.head.appendChild(link);
    });

    this.injectedStylesheets.set(href, load);
    return load;
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

/** Same ranking rules as the server, applied to the built-in list. */
function searchFallback(
  query: string,
  category: FontCategory | null | undefined,
  limit: number,
): CatalogFont[] {
  const needle = query.trim().toLowerCase();
  const scoped: CatalogFont[] = FALLBACK_FAMILIES.map(([family, fontCategory], index) => ({
    family,
    source: 'google' as const,
    sourceId: family,
    subsets: ['latin'],
    category: fontCategory,
    weights: [400, 700],
    cssUrl: googleStylesheetUrl([family]),
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
