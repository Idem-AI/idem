/**
 * Les BIBLIOTHÈQUES d'images et de vidéos libres de droit : un fournisseur par bibliothèque
 * (Pexels, Pixabay, Unsplash…), choisi par `router.ts` selon le rôle demandé (photo, illustration,
 * vidéo). Toutes gratuites, sans attribution obligatoire — la même garantie qu'avant, étendue à
 * plusieurs sources plutôt qu'une seule.
 */

export type StockRole = 'photo' | 'illustration' | 'video';
export type StockProviderId = 'pexels' | 'pixabay' | 'unsplash';
export type Orientation = 'landscape' | 'portrait' | 'square';

export interface StockPhotoHit {
  provider: StockProviderId;
  licenseLabel: string;
  /** Pleine résolution, pour l'usage final. */
  url: string;
  /** Résolution réduite (~1200px), pour une analyse ou un aperçu. */
  mediumUrl: string;
  width?: number;
  height?: number;
  /** Texte qui décrit la photo (alt, tags…) — sert au filtre de pertinence. */
  description: string;
  author?: string;
  sourceUrl?: string;
}

export interface StockVideoHit {
  provider: StockProviderId;
  licenseLabel: string;
  /** Fichier MP4 directement téléchargeable. */
  url: string;
  posterUrl?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  description: string;
  author?: string;
  sourceUrl?: string;
}

export interface StockSearchOptions {
  orientation?: Orientation;
  count?: number;
  /** Langue de la requête (ex. `fr-FR`), quand la bibliothèque la lit. */
  locale?: string;
}

export interface StockVideoSearchOptions extends StockSearchOptions {
  minDurationSec?: number;
  maxDurationSec?: number;
}

export interface StockProvider {
  id: StockProviderId;
  licenseLabel: string;
  /** `false` sans clé configurée — le fournisseur est alors ignoré, pas en échec. */
  readonly configured: boolean;
  searchPhotos(query: string, role: StockRole, options: StockSearchOptions): Promise<StockPhotoHit[]>;
  searchVideos(query: string, options: StockVideoSearchOptions): Promise<StockVideoHit[]>;
}
