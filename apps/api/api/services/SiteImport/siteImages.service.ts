/**
 * LA NETTETÉ DES IMAGES D'UNE REFONTE — après la génération, jamais avant.
 *
 * Le site refait s'affiche d'abord avec les images telles qu'elles ont été recopiées. L'aperçu d'iCode relève
 * ensuite la place de chaque image (largeur × hauteur affichées) et demande :
 *
 *   assess    lesquelles paraîtront floues À LEUR PLACE : défauts du fichier (flou, blocs JPEG) ou trop peu de
 *             pixels pour leur cadre. Mesure par le code (`@idem/design-tools/image-quality`), aucun modèle ;
 *   enhance   sur accord de l'utilisateur, ces images-là et elles seules sont améliorées (`enhanceImage` : sharp, ou
 *             le modèle local Real-ESRGAN compact pour une photo sans visage au défaut fort). Chaque nouvelle image
 *             est déposée À CÔTÉ de l'originale (`…-hd-<stamp>.webp`), qui n'est jamais supprimée : « Revenir aux
 *             originales » ne fait que reprendre l'ancienne adresse.
 *
 * Gratuit pour l'utilisateur : aucun jeton, aucun appel à un fournisseur. Seules les images du projet (dossier
 * `users/<uid>/projects/<projectId>/site-assets/`) sont lues : jamais une adresse arbitraire.
 */
import logger from '../../config/logger';
import { storageService } from '../storage.service';
import { measureImageQuality, needsEnhancement, targetWidthFor, type ImageIssue, type ImageQuality } from '../../../../../packages/design-tools/src/image-quality';
import { enhanceImage, type EnhanceMethod } from '../../../../../packages/design-tools/src/upscale';

export interface SiteImageSlot {
  url: string;
  /** Taille affichée dans l'aperçu, en pixels CSS (la plus grande relevée si l'image est utilisée plusieurs fois). */
  displayWidth: number;
  displayHeight: number;
}

export interface AssessedImage {
  url: string;
  width: number;
  height: number;
  issues: ImageIssue[];
  /** Largeur à atteindre pour être nette à sa place (écran Retina). */
  targetWidth: number;
}

export type EnhanceEvent =
  | { type: 'start'; total: number }
  | { type: 'image'; url: string; status: 'done'; enhancedUrl: string; method: EnhanceMethod; width: number; height: number; ms: number }
  | { type: 'image'; url: string; status: 'skipped'; reason: 'unreadable' | 'no_gain' | 'failed' }
  | { type: 'done'; improved: number; skipped: number };

export const MAX_ASSESS = 80;
export const MAX_ENHANCE = 24;

/** Le dossier des images recopiées d'un projet : seule source acceptée. */
const assetFolder = (userId: string, projectId: string) => `users/${userId}/projects/${projectId}/site-assets/`;

/** Les mesures déjà faites, par fichier (un fichier recopié ne change jamais) — l'aperçu relit souvent. */
const cache = new Map<string, ImageQuality | null>();
const CACHE_MAX = 2000;

async function qualityOf(objectPath: string): Promise<ImageQuality | null> {
  if (cache.has(objectPath)) return cache.get(objectPath)!;
  const buffer = await storageService.readObjectBuffer(objectPath).catch(() => null);
  const quality = buffer ? await measureImageQuality(buffer) : null;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(objectPath, quality);
  return quality;
}

/** Les emplacements valides : images du projet seulement, une entrée par fichier (la plus grande place). */
export function ownSlots(userId: string, projectId: string, raw: unknown, max: number): (SiteImageSlot & { objectPath: string })[] {
  if (!Array.isArray(raw)) return [];
  const folder = assetFolder(userId, projectId);
  const byPath = new Map<string, SiteImageSlot & { objectPath: string }>();
  for (const item of raw.slice(0, max * 3)) {
    if (!item || typeof item !== 'object') continue;
    const { url, displayWidth, displayHeight } = item as Record<string, unknown>;
    if (typeof url !== 'string' || url.length > 2000) continue;
    const objectPath = storageService.objectPathOf(url);
    if (!objectPath || !objectPath.startsWith(folder)) continue;
    const w = Math.max(0, Math.min(4000, Number(displayWidth) || 0));
    const h = Math.max(0, Math.min(4000, Number(displayHeight) || 0));
    const known = byPath.get(objectPath);
    if (!known || w * h > known.displayWidth * known.displayHeight) byPath.set(objectPath, { url, displayWidth: w, displayHeight: h, objectPath });
  }
  return [...byPath.values()].slice(0, max);
}

/** Les images qui paraîtront floues à leur place ; les autres ne sont pas citées. */
export async function assessSiteImages(userId: string, projectId: string, slots: (SiteImageSlot & { objectPath: string })[]): Promise<AssessedImage[]> {
  const out: AssessedImage[] = [];
  let index = 0;
  const worker = async () => {
    while (index < slots.length) {
      const slot = slots[index++];
      const quality = await qualityOf(slot.objectPath);
      if (!quality) continue;
      const place = { displayWidth: slot.displayWidth, displayHeight: slot.displayHeight };
      const issues = needsEnhancement(quality, slot.displayWidth > 0 ? place : undefined);
      // Une image trop petite pour une place minuscule (< 64 px) n'en vaut pas la peine.
      if (!issues.length || Math.max(slot.displayWidth, slot.displayHeight) < 64) continue;
      out.push({ url: slot.url, width: quality.width, height: quality.height, issues, targetWidth: Math.max(quality.width, targetWidthFor(quality, place)) });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  logger.info('site_images.assessed', { event: 'site_images.assessed', userId, projectId, images: slots.length, flagged: out.length });
  return out;
}

/** Une amélioration à la fois par utilisateur : un second clic ne double pas le travail. */
const running = new Set<string>();

export function isEnhancing(userId: string): boolean {
  return running.has(userId);
}

/**
 * Améliore les images signalées, une à une (le modèle local ne calcule qu'une image à la fois), et rapporte chaque
 * résultat dès qu'il est prêt : l'aperçu remplace l'image sans attendre les suivantes. `stopped()` : le client est
 * parti, on s'arrête après l'image en cours.
 */
export async function enhanceSiteImages(
  userId: string,
  projectId: string,
  slots: (SiteImageSlot & { objectPath: string })[],
  emit: (event: EnhanceEvent) => void,
  stopped: () => boolean
): Promise<void> {
  running.add(userId);
  let improved = 0;
  let skipped = 0;
  const stamp = Date.now().toString(36);
  try {
    emit({ type: 'start', total: slots.length });
    for (const slot of slots) {
      if (stopped()) break;
      try {
        const buffer = await storageService.readObjectBuffer(slot.objectPath);
        const quality = buffer ? await measureImageQuality(buffer) : null;
        if (!buffer || !quality) {
          skipped++;
          emit({ type: 'image', url: slot.url, status: 'skipped', reason: 'unreadable' });
          continue;
        }
        const place = { displayWidth: slot.displayWidth, displayHeight: slot.displayHeight };
        const result = await enhanceImage(buffer, { targetWidth: Math.max(quality.width, targetWidthFor(quality, place)) });
        if (!result) {
          skipped++;
          emit({ type: 'image', url: slot.url, status: 'skipped', reason: 'no_gain' });
          continue;
        }
        const name = slot.objectPath.slice(slot.objectPath.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/i, '');
        const upload = await storageService.uploadFile(result.buffer, `${name}-hd-${stamp}.webp`, assetFolder(userId, projectId).replace(/\/$/, ''), result.mimeType);
        improved++;
        emit({ type: 'image', url: slot.url, status: 'done', enhancedUrl: upload.downloadURL, method: result.method, width: result.width, height: result.height, ms: result.ms });
        logger.info('site_images.enhanced', {
          event: 'site_images.enhanced',
          userId,
          projectId,
          method: result.method,
          issues: needsEnhancement(quality, place),
          from: `${quality.width}x${quality.height}`,
          to: `${result.width}x${result.height}`,
          sharpness: result.sharpness,
          ms: result.ms,
        });
      } catch (error: any) {
        skipped++;
        emit({ type: 'image', url: slot.url, status: 'skipped', reason: 'failed' });
        logger.warn('site_images.enhance_failed', { event: 'site_images.enhance_failed', userId, projectId, error: error?.message });
      }
    }
    emit({ type: 'done', improved, skipped });
  } finally {
    running.delete(userId);
  }
}
