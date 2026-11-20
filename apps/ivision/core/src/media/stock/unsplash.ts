/**
 * Le fournisseur Unsplash : PHOTOS seulement (pas de vidéo, pas de filtre illustration/vecteur
 * natif — Pixabay reste le premier choix pour ce rôle). Licence Unsplash : gratuite, aucune
 * attribution obligatoire (appréciée, jamais exigée) — même régime que Pexels et Pixabay. En
 * quota démo (50 requêtes/heure) tant que l'app n'est pas validée en production par Unsplash :
 * un repli de plus, pas la source principale.
 */
import axios from 'axios';
import { Orientation, StockPhotoHit, StockProvider, StockRole, StockSearchOptions, StockVideoHit, StockVideoSearchOptions } from './types';

const PHOTO_ENDPOINT = 'https://api.unsplash.com/search/photos';
const TIMEOUT_MS = 8000;
const LICENSE_LABEL = 'Unsplash License';

const orientationParam = (orientation?: Orientation): string => (orientation === 'portrait' ? 'portrait' : orientation === 'square' ? 'squarish' : 'landscape');

async function searchPhotos(query: string, _role: StockRole, options: StockSearchOptions): Promise<StockPhotoHit[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !query.trim()) return [];
  const count = Math.max(1, Math.min(15, options.count ?? 1));
  const { data } = await axios.get(PHOTO_ENDPOINT, {
    headers: { Authorization: `Client-ID ${accessKey}` },
    params: {
      query: query.trim().slice(0, 80),
      per_page: Math.max(count * 3, 10),
      orientation: orientationParam(options.orientation),
      ...(options.locale ? { lang: options.locale.slice(0, 2) } : {}),
    },
    timeout: TIMEOUT_MS,
  });
  const results: any[] = data?.results ?? [];
  return results
    .map((photo) => {
      const url: string | undefined = photo.urls?.regular || photo.urls?.full;
      if (!url) return null;
      const hit: StockPhotoHit = {
        provider: 'unsplash',
        licenseLabel: LICENSE_LABEL,
        url,
        mediumUrl: photo.urls?.small || url,
        width: photo.width,
        height: photo.height,
        description: String(photo.alt_description || photo.description || ''),
        author: photo.user?.name,
        sourceUrl: photo.links?.html,
      };
      return hit;
    })
    .filter((hit): hit is StockPhotoHit => !!hit)
    .slice(0, count);
}

/** Unsplash ne propose pas de vidéos. */
async function searchVideos(_query: string, _options: StockVideoSearchOptions): Promise<StockVideoHit[]> {
  return [];
}

export const unsplashProvider: StockProvider = {
  id: 'unsplash',
  licenseLabel: LICENSE_LABEL,
  get configured() {
    return !!process.env.UNSPLASH_ACCESS_KEY;
  },
  searchPhotos,
  searchVideos,
};
