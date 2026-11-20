/**
 * Le fournisseur Pixabay : photos, ILLUSTRATIONS/VECTEURS et vidéos, licence Pixabay (gratuite,
 * aucune attribution obligatoire — même régime que Pexels). Son filtre `image_type` natif en fait
 * le premier choix pour le rôle `illustration` (Pexels n'a que des photos).
 */
import axios from 'axios';
import { Orientation, StockPhotoHit, StockProvider, StockRole, StockSearchOptions, StockVideoHit, StockVideoSearchOptions } from './types';

const PHOTO_ENDPOINT = 'https://pixabay.com/api/';
const VIDEO_ENDPOINT = 'https://pixabay.com/api/videos/';
const TIMEOUT_MS = 8000;
const LICENSE_LABEL = 'Pixabay Content License';
// Pixabay refuse per_page < 3.
const perPageFor = (count: number): number => Math.max(3, Math.min(50, count * 3));

const orientationParam = (orientation?: Orientation): string => (orientation === 'portrait' ? 'vertical' : orientation === 'square' ? 'all' : 'horizontal');
const imageTypeFor = (role: StockRole): 'photo' | 'illustration' => (role === 'illustration' ? 'illustration' : 'photo');

async function searchPhotos(query: string, role: StockRole, options: StockSearchOptions): Promise<StockPhotoHit[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey || !query.trim()) return [];
  const count = Math.max(1, Math.min(15, options.count ?? 1));
  const { data } = await axios.get(PHOTO_ENDPOINT, {
    params: {
      key: apiKey,
      q: query.trim().slice(0, 100),
      image_type: imageTypeFor(role),
      orientation: orientationParam(options.orientation),
      per_page: perPageFor(count),
      safesearch: true,
      ...(options.locale ? { lang: options.locale.slice(0, 2) } : {}),
    },
    timeout: TIMEOUT_MS,
  });
  const hits: any[] = data?.hits ?? [];
  return hits
    .map((hit) => {
      const url: string | undefined = hit.largeImageURL || hit.webformatURL;
      if (!url) return null;
      const photo: StockPhotoHit = {
        provider: 'pixabay',
        licenseLabel: LICENSE_LABEL,
        url,
        mediumUrl: hit.webformatURL || url,
        width: hit.imageWidth,
        height: hit.imageHeight,
        description: String(hit.tags ?? ''),
        author: hit.user,
        sourceUrl: hit.pageURL,
      };
      return photo;
    })
    .filter((hit): hit is StockPhotoHit => !!hit)
    .slice(0, count);
}

/** Le fichier le plus proche de 1280px de grand côté, parmi les variantes offertes par Pixabay. */
function bestVideoFile(videos: Record<string, { url: string; width: number; height: number }> | undefined): { url: string; width: number; height: number } | null {
  const candidates = Object.values(videos || {}).filter((file) => file?.url && Math.max(file.width, file.height) >= 720);
  candidates.sort((a, b) => Math.abs(Math.max(a.width, a.height) - 1280) - Math.abs(Math.max(b.width, b.height) - 1280));
  return candidates[0] ?? null;
}

async function searchVideos(query: string, options: StockVideoSearchOptions): Promise<StockVideoHit[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey || !query.trim()) return [];
  const count = Math.max(1, Math.min(10, options.count ?? 1));
  const { data } = await axios.get(VIDEO_ENDPOINT, {
    params: {
      key: apiKey,
      q: query.trim().slice(0, 100),
      orientation: orientationParam(options.orientation),
      per_page: perPageFor(count),
      safesearch: true,
    },
    timeout: TIMEOUT_MS,
  });
  const minDuration = options.minDurationSec ?? 3;
  const maxDuration = options.maxDurationSec ?? 60;
  const hits: any[] = (data?.hits ?? []).filter((hit: any) => hit.duration >= minDuration && hit.duration <= maxDuration);
  return hits
    .map((hit) => {
      const file = bestVideoFile(hit.videos);
      if (!file) return null;
      const video: StockVideoHit = {
        provider: 'pixabay',
        licenseLabel: LICENSE_LABEL,
        url: file.url,
        width: file.width,
        height: file.height,
        durationSec: hit.duration,
        description: String(hit.tags ?? ''),
        author: hit.user,
        sourceUrl: hit.pageURL,
      };
      return video;
    })
    .filter((hit): hit is StockVideoHit => !!hit)
    .slice(0, count);
}

export const pixabayProvider: StockProvider = {
  id: 'pixabay',
  licenseLabel: LICENSE_LABEL,
  get configured() {
    return !!process.env.PIXABAY_API_KEY;
  },
  searchPhotos,
  searchVideos,
};
