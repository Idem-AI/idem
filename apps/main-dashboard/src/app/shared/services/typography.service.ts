import { Injectable, inject, DOCUMENT } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface GoogleFont {
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
  kind: string;
  menu?: string;
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

@Injectable({
  providedIn: 'root',
})
export class TypographyService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  private readonly loadedFonts = new Set<string>();
  private readonly fontsSubject = new BehaviorSubject<GoogleFont[]>([]);

  // Google Fonts API Key - À remplacer par votre clé
  private readonly API_KEY = 'AIzaSyBqJ8XnbqZ7QgQgQgQgQgQgQgQgQgQgQgQ'; // Placeholder

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
      secondaryFont: 'Source Sans Pro',
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

  constructor() {
    // Pré-charger les typographies populaires
    this.preloadPopularFonts();
  }

  /**
   * Charge une police Google Fonts dynamiquement
   */
  loadGoogleFont(
    fontFamily: string,
    variants: string[] = ['400', '500', '600', '700'],
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.loadedFonts.has(fontFamily)) {
        resolve();
        return;
      }

      const link = this.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}:wght@${variants.join(';')}&display=swap`;

      link.onload = () => {
        this.loadedFonts.add(fontFamily);
        resolve();
      };

      link.onerror = () => {
        reject(new Error(`Failed to load font: ${fontFamily}`));
      };

      this.document.head.appendChild(link);
    });
  }

  /**
   * Recherche des polices Google Fonts
   */
  searchGoogleFonts(query: string): Observable<GoogleFont[]> {
    if (!query || query.length < 2) {
      return of([]);
    }

    // Simulation d'une recherche locale pour le moment
    // En production, utiliser l'API Google Fonts
    const mockFonts: GoogleFont[] = [
      {
        family: 'Roboto',
        variants: ['300', '400', '500', '700'],
        subsets: ['latin'],
        category: 'sans-serif',
        kind: 'webfont',
      },
      {
        family: 'Open Sans',
        variants: ['300', '400', '600', '700'],
        subsets: ['latin'],
        category: 'sans-serif',
        kind: 'webfont',
      },
      {
        family: 'Lato',
        variants: ['300', '400', '700'],
        subsets: ['latin'],
        category: 'sans-serif',
        kind: 'webfont',
      },
      {
        family: 'Montserrat',
        variants: ['300', '400', '500', '600', '700'],
        subsets: ['latin'],
        category: 'sans-serif',
        kind: 'webfont',
      },
      {
        family: 'Poppins',
        variants: ['300', '400', '500', '600', '700'],
        subsets: ['latin'],
        category: 'sans-serif',
        kind: 'webfont',
      },
      {
        family: 'Inter',
        variants: ['300', '400', '500', '600', '700'],
        subsets: ['latin'],
        category: 'sans-serif',
        kind: 'webfont',
      },
      {
        family: 'Playfair Display',
        variants: ['400', '500', '600', '700'],
        subsets: ['latin'],
        category: 'serif',
        kind: 'webfont',
      },
      {
        family: 'Merriweather',
        variants: ['300', '400', '700'],
        subsets: ['latin'],
        category: 'serif',
        kind: 'webfont',
      },
      {
        family: 'Source Sans Pro',
        variants: ['300', '400', '600', '700'],
        subsets: ['latin'],
        category: 'sans-serif',
        kind: 'webfont',
      },
      {
        family: 'Nunito Sans',
        variants: ['300', '400', '600', '700'],
        subsets: ['latin'],
        category: 'sans-serif',
        kind: 'webfont',
      },
    ];

    return of(mockFonts.filter((font) => font.family.toLowerCase().includes(query.toLowerCase())));
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
    // Charger les polices
    await Promise.all([this.loadGoogleFont(primaryFont), this.loadGoogleFont(secondaryFont)]);

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
   * Vérifie si une police est chargée
   */
  isFontLoaded(fontFamily: string): boolean {
    return this.loadedFonts.has(fontFamily);
  }

  /**
   * Pré-charge les polices populaires
   */
  private async preloadPopularFonts(): Promise<void> {
    const uniqueFonts = new Set<string>();

    this.popularTypographies.forEach((typo) => {
      uniqueFonts.add(typo.primaryFont);
      uniqueFonts.add(typo.secondaryFont);
    });

    try {
      await Promise.all(Array.from(uniqueFonts).map((font) => this.loadGoogleFont(font)));

      // Marquer toutes les typographies comme chargées
      this.popularTypographies.forEach((typo) => {
        typo.isLoaded = true;
      });
    } catch (error) {
      console.error('Error preloading fonts:', error);
    }
  }

  /**
   * Obtient une liste de polices par catégorie
   */
  getFontsByCategory(
    category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace',
  ): Observable<GoogleFont[]> {
    // Simulation - en production, utiliser l'API Google Fonts avec filtres
    const fontsByCategory: Record<string, GoogleFont[]> = {
      'sans-serif': [
        {
          family: 'Inter',
          variants: ['300', '400', '500', '600', '700'],
          subsets: ['latin'],
          category: 'sans-serif',
          kind: 'webfont',
        },
        {
          family: 'Roboto',
          variants: ['300', '400', '500', '700'],
          subsets: ['latin'],
          category: 'sans-serif',
          kind: 'webfont',
        },
        {
          family: 'Open Sans',
          variants: ['300', '400', '600', '700'],
          subsets: ['latin'],
          category: 'sans-serif',
          kind: 'webfont',
        },
        {
          family: 'Lato',
          variants: ['300', '400', '700'],
          subsets: ['latin'],
          category: 'sans-serif',
          kind: 'webfont',
        },
        {
          family: 'Montserrat',
          variants: ['300', '400', '500', '600', '700'],
          subsets: ['latin'],
          category: 'sans-serif',
          kind: 'webfont',
        },
        {
          family: 'Poppins',
          variants: ['300', '400', '500', '600', '700'],
          subsets: ['latin'],
          category: 'sans-serif',
          kind: 'webfont',
        },
      ],
      serif: [
        {
          family: 'Playfair Display',
          variants: ['400', '500', '600', '700'],
          subsets: ['latin'],
          category: 'serif',
          kind: 'webfont',
        },
        {
          family: 'Merriweather',
          variants: ['300', '400', '700'],
          subsets: ['latin'],
          category: 'serif',
          kind: 'webfont',
        },
        {
          family: 'Crimson Text',
          variants: ['400', '600', '700'],
          subsets: ['latin'],
          category: 'serif',
          kind: 'webfont',
        },
        {
          family: 'Libre Baskerville',
          variants: ['400', '700'],
          subsets: ['latin'],
          category: 'serif',
          kind: 'webfont',
        },
      ],
      display: [
        {
          family: 'Oswald',
          variants: ['300', '400', '500', '600', '700'],
          subsets: ['latin'],
          category: 'display',
          kind: 'webfont',
        },
        {
          family: 'Bebas Neue',
          variants: ['400'],
          subsets: ['latin'],
          category: 'display',
          kind: 'webfont',
        },
      ],
      handwriting: [
        {
          family: 'Dancing Script',
          variants: ['400', '500', '600', '700'],
          subsets: ['latin'],
          category: 'handwriting',
          kind: 'webfont',
        },
        {
          family: 'Pacifico',
          variants: ['400'],
          subsets: ['latin'],
          category: 'handwriting',
          kind: 'webfont',
        },
      ],
      monospace: [
        {
          family: 'Fira Code',
          variants: ['300', '400', '500', '600', '700'],
          subsets: ['latin'],
          category: 'monospace',
          kind: 'webfont',
        },
        {
          family: 'Source Code Pro',
          variants: ['300', '400', '500', '600', '700'],
          subsets: ['latin'],
          category: 'monospace',
          kind: 'webfont',
        },
      ],
    };

    return of(fontsByCategory[category] || []);
  }
}
