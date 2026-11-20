/**
 * Le ROUTEUR des bibliothèques d'images et de vidéos libres de droit.
 *
 * Pour chaque rôle demandé, un ordre de fournisseurs à essayer — pas « le premier qui répond »,
 * mais « le premier qui répond PERTINEMMENT » (`relevant`) : un résultat sans rapport avec la
 * requête (une scène hors sujet) ne doit pas faire manquer une bibliothèque qui, elle, a la bonne
 * image. Un fournisseur sans clé configurée, en panne ou trop lent est ignoré sans faire échouer
 * la recherche — l'appelant passe au fournisseur suivant, puis à son propre repli (génération,
 * motif…) si aucune bibliothèque n'a de résultat.
 */
import logger from '../../runtime/logger';
import { pexelsProvider } from './pexels';
import { pixabayProvider } from './pixabay';
import { unsplashProvider } from './unsplash';
import { StockPhotoHit, StockProvider, StockRole, StockSearchOptions, StockVideoHit, StockVideoSearchOptions } from './types';

const PROVIDERS: Record<string, StockProvider> = {
  pexels: pexelsProvider,
  pixabay: pixabayProvider,
  unsplash: unsplashProvider,
};

/**
 * L'ordre des bibliothèques par rôle : Pexels d'abord pour une scène réelle (sa photothèque est la
 * plus riche), Pixabay d'abord pour une illustration/vecteur (filtre `image_type` natif, absent de
 * Pexels et d'Unsplash). Unsplash n'a pas de vidéos et pas de filtre illustration : un repli
 * photo de plus, jamais le premier choix (quota démo tant que l'app n'est pas validée en
 * production par Unsplash).
 */
const ORDER: Record<StockRole, StockProvider[]> = {
  photo: [pexelsProvider, pixabayProvider, unsplashProvider],
  illustration: [pixabayProvider, pexelsProvider, unsplashProvider],
  video: [pexelsProvider, pixabayProvider],
};

/**
 * Les résultats qui parlent vraiment de la requête, les plus proches d'abord. Un résultat dont la
 * description ne reprend aucun mot de la requête est écarté : une bibliothèque qui n'a « rien » de
 * pertinent ne doit pas faire manquer celle d'après avec le bon sujet.
 */
export function relevant<T>(items: T[], describe: (item: T) => string, query: string): T[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  if (!words.length) return items;
  return items
    .map((item, rank) => ({ item, rank, score: words.filter((word) => describe(item).toLowerCase().includes(word)).length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.rank - b.rank)
    .map((entry) => entry.item);
}

const TIMEOUT_MS = 9000;
async function withTimeout<T>(task: Promise<T>, provider: string, step: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${provider} ${step} timeout`)), TIMEOUT_MS);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Une photo ou une illustration, dans l'ordre de bibliothèques du rôle demandé. */
export async function searchStockPhotos(query: string, role: StockRole, options: StockSearchOptions = {}): Promise<StockPhotoHit[]> {
  if (!query.trim()) return [];
  const count = options.count ?? 1;
  for (const provider of ORDER[role]) {
    if (!provider.configured) continue;
    try {
      const hits = await withTimeout(provider.searchPhotos(query, role, options), provider.id, 'photo');
      const matched = relevant(hits, (hit) => hit.description, query);
      if (matched.length >= count) return matched.slice(0, count);
      if (matched.length) return matched;
    } catch (error: any) {
      logger.warn('stock.provider_photo_failed', { provider: provider.id, role, query, error: error?.message });
    }
  }
  return [];
}

/** Une vidéo, dans l'ordre de bibliothèques du rôle vidéo. */
export async function searchStockVideos(query: string, options: StockVideoSearchOptions = {}): Promise<StockVideoHit[]> {
  if (!query.trim()) return [];
  const count = options.count ?? 1;
  for (const provider of ORDER.video) {
    if (!provider.configured) continue;
    try {
      const hits = await withTimeout(provider.searchVideos(query, options), provider.id, 'video');
      const matched = relevant(hits, (hit) => hit.description, query);
      if (matched.length >= count) return matched.slice(0, count);
      if (matched.length) return matched;
    } catch (error: any) {
      logger.warn('stock.provider_video_failed', { provider: provider.id, query, error: error?.message });
    }
  }
  return [];
}

/** Le libellé de licence d'un fournisseur, pour une attribution exacte quelle que soit la bibliothèque. */
export function licenseLabelOf(provider: string): string {
  return PROVIDERS[provider]?.licenseLabel ?? 'Licence libre de droit';
}
