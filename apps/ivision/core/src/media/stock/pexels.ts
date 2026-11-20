/**
 * Le fournisseur Pexels : photos et vidéos, licence Pexels (gratuite, aucune attribution
 * obligatoire). Photothèque surtout — pas de filtre « illustration/vecteur » natif, à la
 * différence de Pixabay.
 */
import axios from 'axios';
import { Orientation, StockPhotoHit, StockProvider, StockRole, StockSearchOptions, StockVideoHit, StockVideoSearchOptions } from './types';

const PHOTO_ENDPOINT = 'https://api.pexels.com/v1/search';
const VIDEO_ENDPOINT = 'https://api.pexels.com/videos/search';
const TIMEOUT_MS = 8000;
const LICENSE_LABEL = 'Pexels License';

const orientationParam = (orientation?: Orientation): string => (orientation === 'portrait' ? 'portrait' : orientation === 'square' ? 'square' : 'landscape');

/** Le fichier vidéo le plus proche de 1280px de grand côté, jamais sous 720p. */
function bestVideoFile(files: any[]): any | null {
  const usable = (files || []).filter((file) => /mp4/i.test(file.file_type || '') && Math.max(file.width || 0, file.height || 0) >= 720);
  usable.sort((a, b) => Math.abs(Math.max(a.width, a.height) - 1280) - Math.abs(Math.max(b.width, b.height) - 1280));
  return usable[0] ?? null;
}

async function searchPhotos(query: string, _role: StockRole, options: StockSearchOptions): Promise<StockPhotoHit[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || !query.trim()) return [];
  const count = Math.max(1, Math.min(15, options.count ?? 1));
  const { data } = await axios.get(PHOTO_ENDPOINT, {
    headers: { Authorization: apiKey },
    params: {
      query: query.trim().slice(0, 80),
      per_page: Math.max(count * 3, 10),
      orientation: orientationParam(options.orientation),
      ...(options.locale ? { locale: options.locale } : {}),
    },
    timeout: TIMEOUT_MS,
  });
  const photos: any[] = data?.photos ?? [];
  return photos
    .map((photo) => {
      const url: string | undefined = photo.src?.large2x || photo.src?.large || photo.src?.original;
      if (!url) return null;
      const hit: StockPhotoHit = {
        provider: 'pexels',
        licenseLabel: LICENSE_LABEL,
        url,
        mediumUrl: photo.src?.medium || url,
        width: photo.width,
        height: photo.height,
        description: String(photo.alt ?? ''),
        author: photo.photographer,
        sourceUrl: photo.url,
      };
      return hit;
    })
    .filter((hit): hit is StockPhotoHit => !!hit)
    .slice(0, count);
}

async function searchVideos(query: string, options: StockVideoSearchOptions): Promise<StockVideoHit[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || !query.trim()) return [];
  const count = Math.max(1, Math.min(10, options.count ?? 1));
  const { data } = await axios.get(VIDEO_ENDPOINT, {
    headers: { Authorization: apiKey },
    params: {
      query: query.trim().slice(0, 80),
      per_page: 10,
      orientation: orientationParam(options.orientation),
      size: 'medium',
      ...(options.locale ? { locale: options.locale } : {}),
    },
    timeout: TIMEOUT_MS,
  });
  const minDuration = options.minDurationSec ?? 3;
  const maxDuration = options.maxDurationSec ?? 60;
  const videos: any[] = (data?.videos ?? []).filter((video: any) => video.duration >= minDuration && video.duration <= maxDuration);
  return videos
    .map((video) => {
      const file = bestVideoFile(video.video_files);
      if (!file) return null;
      const hit: StockVideoHit = {
        provider: 'pexels',
        licenseLabel: LICENSE_LABEL,
        url: file.link,
        posterUrl: video.image,
        width: file.width,
        height: file.height,
        durationSec: video.duration,
        // Une vidéo n'a pas de description : son adresse en tient lieu pour le filtre de pertinence.
        description: String(video.url ?? '').replace(/[-/]/g, ' '),
        author: video.user?.name,
        sourceUrl: video.url,
      };
      return hit;
    })
    .filter((hit): hit is StockVideoHit => !!hit)
    .slice(0, count);
}

export const pexelsProvider: StockProvider = {
  id: 'pexels',
  licenseLabel: LICENSE_LABEL,
  get configured() {
    return !!process.env.PEXELS_API_KEY;
  },
  searchPhotos,
  searchVideos,
};
