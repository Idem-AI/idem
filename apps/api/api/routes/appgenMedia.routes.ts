/**
 * MÉDIAS DES SITES GÉNÉRÉS — `/appgen/media/*`.
 *
 * Le générateur de sites (appgen) décide, section par section, s'il faut une photo, une
 * illustration 3D ou une vidéo. Il n'a ni clés de modèles d'image, ni stockage, ni
 * portefeuille : il les emprunte ici, au nom de l'utilisateur dont il relaie la session
 * (même authentification que `/billing/consume`).
 *
 *   image   Gemini 3.1 Flash Image (OpenRouter), déposée dans le stockage d'IDEM ;
 *   video   Veo 3.1 Fast (OpenRouter), un clip court déposé de même ;
 *   stock   une photo, une illustration ou une vidéo d'une bibliothèque libre de droit
 *           (Pexels, Pixabay, Unsplash — `media/stock`, qui choisit et ordonne), sans frais.
 *
 * Une génération est facturée au barème iCode (`site_image`, `site_video`) AVANT l'appel, et
 * restituée si le modèle échoue : le générateur se replie alors sur la banque. Un refus de
 * crédits (402) n'est pas une erreur pour lui — c'est le même repli.
 */
import { Response, Router } from 'express';
import { createHash } from 'crypto';
import multer from 'multer';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { authenticate } from '../services/auth.service';
import { chargeForService } from '../middleware/billing.middleware';
import { walletService } from '../services/billing/wallet.service';
import { sendQuotaRefusal } from '../middleware/usage-quota.middleware';
import { usageQuotaService } from '../services/billing/usage-quota.service';
import { creditLedgerService } from '../services/billing/credit-ledger.service';
import { entitlementsService } from '../services/billing/entitlements.service';
import { generateImage, generateVideo } from '../services/media.service';
import { StorageService } from '../services/storage.service';
import { runWithAiUsageContext } from '../utils/ai-usage-context.util';
import { searchStockPhotos, searchStockVideos } from '../../../ivision/core/src/media/stock';

const router = Router();
const storage = new StorageService();

/** Les modèles des sites : Gemini pour l'image, Veo pour la vidéo, réglables sans redéploiement. */
const IMAGE_MODEL = () => process.env.APPGEN_MEDIA_IMAGE_MODEL?.trim() || 'google/gemini-3.1-flash-image';
const IMAGE_FALLBACK_MODEL = () => process.env.APPGEN_MEDIA_IMAGE_FALLBACK_MODEL?.trim() || 'black-forest-labs/flux.2-pro';
const VIDEO_MODEL = () => process.env.APPGEN_MEDIA_VIDEO_MODEL?.trim() || 'google/veo-3.1-fast';
/** Un clip de site attend moins qu'un plan de vidéo : au-delà, Pexels fait mieux qu'une page qui attend. */
const VIDEO_TIMEOUT_MS = () => Number(process.env.APPGEN_MEDIA_VIDEO_TIMEOUT_MS ?? 3 * 60 * 1000);

/** Taille demandée au modèle pour chaque ratio : le ratio est ce que lit OpenRouter. */
const IMAGE_SIZES: Record<string, string> = {
  '16:9': '1600x900',
  '4:3': '1440x1080',
  '1:1': '1200x1200',
  '3:4': '1080x1440',
};

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const safeSegment = (value: unknown): string => text(value, 64).replace(/[^a-zA-Z0-9_-]/g, '') || 'site';

/** Les médias d'un site vivent avec le projet, à une adresse publique et durable (pas signée). */
function folderOf(userId: string, projectId: string): string {
  return `users/${userId}/projects/${safeSegment(projectId)}/site-media`;
}

type Charge = Awaited<ReturnType<typeof chargeForService>>;

async function charge(req: CustomRequest, res: Response, action: 'site_image' | 'site_video'): Promise<Charge | null> {
  const userId = req.user!.uid;
  const result = await chargeForService(
    userId,
    'appgen',
    // Le prix est celui de la table d'IDEM (une modification par image, 1 000 F par clip).
    { action, cost: 0 },
    { projectId: text(req.body?.projectId, 128) || undefined, feature: 'appgen', element: text(req.body?.tag, 64) || undefined }
  );
  if (result.status === 'refused') {
    res.status(402).json(result.body);
    return null;
  }
  if (result.status === 'quota_exceeded') {
    sendQuotaRefusal(res, result.body);
    return null;
  }
  return result;
}

async function refund(userId: string, charged: Charge, action: string): Promise<void> {
  // La place dans le quota est rendue même quand rien n'a été débité (mode observation).
  if (charged.status === 'charged' || charged.status === 'free') await usageQuotaService.release(charged.reservation);
  try {
    if (charged.status === 'free' && charged.units) {
      await creditLedgerService.refundDebit(userId, 'appgen', charged.units, { action, note: 'Média de site non généré — modification restituée' });
    } else if (charged.status === 'charged') {
      await walletService.refund(userId, charged.cost, { action, note: 'Média de site non généré — montant restitué' });
    } else {
      return;
    }
    await entitlementsService.invalidate(userId);
  } catch (error) {
    logger.error('appgen_media.refund_failed', { event: 'appgen_media.refund_failed', userId, action, error });
  }
}

/** Une image générée pour une section de site. */
router.post('/image', authenticate, async (req: CustomRequest, res: Response) => {
  const userId = req.user!.uid;
  const prompt = text(req.body?.prompt, 4000);
  if (!prompt) {
    res.status(400).json({ error: 'prompt_required' });
    return;
  }
  const aspect = IMAGE_SIZES[text(req.body?.aspect, 8)] ? text(req.body?.aspect, 8) : '4:3';

  const charged = await charge(req, res, 'site_image');
  if (!charged) return;

  try {
    const image = await runWithAiUsageContext(
      { userId, feature: 'appgen', operation: 'generate', source: 'appgen site media image' },
      () =>
        generateImage(prompt, {
          tag: `site-${safeSegment(req.body?.tag)}`,
          model: IMAGE_MODEL(),
          fallbackModel: IMAGE_FALLBACK_MODEL(),
          size: IMAGE_SIZES[aspect],
        })
    );
    const extension = image.mimeType.includes('jpeg') ? 'jpg' : image.mimeType.includes('webp') ? 'webp' : 'png';
    const upload = await storage.uploadFile(
      image.buffer,
      `${safeSegment(req.body?.tag)}-${Date.now()}.${extension}`,
      folderOf(userId, req.body?.projectId),
      image.mimeType
    );
    res.json({ url: upload.downloadURL, model: image.model, mimeType: image.mimeType });
  } catch (error) {
    await refund(userId, charged, 'site_image');
    logger.warn('appgen_media.image_failed', { event: 'appgen_media.image_failed', error: (error as Error).message });
    res.status(502).json({ error: 'generation_failed', message: (error as Error).message });
  }
});

/** Un clip court (Veo) pour une section de site : en fond de hero, ou en vitrine. */
router.post('/video', authenticate, async (req: CustomRequest, res: Response) => {
  const userId = req.user!.uid;
  const prompt = text(req.body?.prompt, 1500);
  if (!prompt) {
    res.status(400).json({ error: 'prompt_required' });
    return;
  }
  const portrait = text(req.body?.aspect, 8) === '9:16';

  const charged = await charge(req, res, 'site_video');
  if (!charged) return;

  try {
    const clip = await runWithAiUsageContext(
      { userId, feature: 'appgen', operation: 'generate', source: 'appgen site media video' },
      () =>
        generateVideo({
          prompt,
          size: portrait ? '720x1280' : '1280x720',
          // Veo refuse 5 s (« Supported durations: 4, 6, 8s ») : 6 s pour lui.
          durationSec: /veo/i.test(VIDEO_MODEL()) ? 6 : 5,
          quality: 'speed',
          tag: `site-${safeSegment(req.body?.tag)}`,
          model: VIDEO_MODEL(),
          timeoutMs: VIDEO_TIMEOUT_MS(),
        })
    );
    const match = clip.url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('unexpected_video_payload');
    const upload = await storage.uploadFile(
      Buffer.from(match[2], 'base64'),
      `${safeSegment(req.body?.tag)}-${Date.now()}.mp4`,
      folderOf(userId, req.body?.projectId),
      match[1]
    );
    res.json({ url: upload.downloadURL, model: clip.model, mimeType: match[1] });
  } catch (error) {
    await refund(userId, charged, 'site_video');
    logger.warn('appgen_media.video_failed', { event: 'appgen_media.video_failed', error: (error as Error).message });
    res.status(502).json({ error: 'generation_failed', message: (error as Error).message });
  }
});

/**
 * Une photo, une illustration ou une vidéo d'une bibliothèque libre de droit (le routeur
 * `media/stock` choisit et ordonne Pexels/Pixabay selon `kind`). Gratuit : c'est le repli de
 * toutes les générations, et le premier choix pour une scène de la vie réelle (un marché, une
 * cuisine, une rue).
 */
router.post('/stock', authenticate, async (req: CustomRequest, res: Response) => {
  const query = text(req.body?.query, 120);
  if (!query) {
    res.status(400).json({ error: 'query_required' });
    return;
  }
  const kind = req.body?.kind === 'video' ? 'video' : req.body?.kind === 'illustration' ? 'illustration' : 'photo';
  const orientation = ['landscape', 'portrait', 'square'].includes(req.body?.orientation) ? req.body.orientation : 'landscape';
  const count = Math.min(5, Math.max(1, Number(req.body?.count) || 1));
  // Les bibliothèques cherchent aussi dans d'autres langues : une requête en français trouve des photos.
  const locale = /^[a-z]{2}-[A-Z]{2}$/.test(String(req.body?.locale ?? '')) ? req.body.locale : undefined;

  try {
    if (kind === 'video') {
      const hits = await searchStockVideos(query, { orientation, count, locale });
      if (!hits.length) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({
        items: hits.map((hit) => ({
          url: hit.url,
          poster: hit.posterUrl,
          width: hit.width,
          height: hit.height,
          duration: hit.durationSec,
          author: hit.author,
          sourceUrl: hit.sourceUrl,
          provider: hit.provider,
          license: hit.licenseLabel,
        })),
      });
      return;
    }

    const hits = await searchStockPhotos(query, kind, { orientation, count, locale });
    if (!hits.length) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({
      items: hits.map((hit) => ({
        url: hit.url,
        width: hit.width,
        height: hit.height,
        alt: text(hit.description, 200),
        author: hit.author,
        sourceUrl: hit.sourceUrl,
        provider: hit.provider,
        license: hit.licenseLabel,
      })),
    });
  } catch (error) {
    logger.warn('appgen_media.stock_failed', { event: 'appgen_media.stock_failed', error: (error as Error).message });
    res.status(502).json({ error: 'stock_failed' });
  }
});

// ── Image envoyée depuis l'éditeur d'iCode ─────────────────────────────────────────────────
//
// Remplacer une image dans le mode Édition écrivait le fichier dans le code en `data:…;base64` :
// une photo de 3 Mo devenait 4 Mo de texte dans un composant, relue par le modèle à chaque tour,
// renvoyée à chaque sauvegarde et à chaque mise en ligne. Elle part maintenant dans le stockage
// d'IDEM et le code ne garde que son adresse.
//
// Le nom est l'empreinte du contenu : renvoyer la même image ne crée pas de doublon. Rien n'est
// jamais écrasé ni supprimé au remplacement : l'image d'avant reste à son adresse, l'annulation de
// l'éditeur (ou une version antérieure du projet) la retrouve. Elle part avec le projet, quand il est
// effacé (`minio:users/<uid>/projects/`, registre de gouvernance des données).

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 } });

/**
 * Le type réel, lu dans les premiers octets — jamais celui que le navigateur annonce. Le SVG est
 * refusé : servi depuis le stockage public, un script qu'il contiendrait s'exécuterait.
 */
function sniffImage(buffer: Buffer): { mime: string; ext: string } | null {
  const at = (offset: number, bytes: number[]) => bytes.every((b, i) => buffer[offset + i] === b);
  if (at(0, [0x89, 0x50, 0x4e, 0x47])) return { mime: 'image/png', ext: 'png' };
  if (at(0, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (at(0, [0x47, 0x49, 0x46, 0x38])) return { mime: 'image/gif', ext: 'gif' };
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) return { mime: 'image/webp', ext: 'webp' };
  if (at(4, [0x66, 0x74, 0x79, 0x70]) && /^(avif|avis)$/.test(buffer.subarray(8, 12).toString('ascii'))) {
    return { mime: 'image/avif', ext: 'avif' };
  }
  return null;
}

/** Côté le plus long d'une image de site : au-delà, aucun écran ne voit la différence, tous les visiteurs la paient. */
const MAX_IMAGE_SIDE = 2400;

/**
 * Prête pour le web : orientation de l'appareil photo appliquée, taille bornée, WebP. Aucun filtre,
 * aucune retouche des couleurs (les photos ne sont jamais filtrées). Un GIF garde son animation ; une
 * version qui ne serait pas plus légère laisse l'original.
 */
async function optimiseForWeb(buffer: Buffer, kind: { mime: string; ext: string }): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  if (kind.mime === 'image/gif') return { buffer, ...kind };
  try {
    const sharp = (await import('sharp')).default;
    const output = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return output.length < buffer.length ? { buffer: output, mime: 'image/webp', ext: 'webp' } : { buffer, ...kind };
  } catch {
    return { buffer, ...kind };
  }
}

router.post('/upload', authenticate, (req: CustomRequest, res: Response) => {
  imageUpload.single('file')(req, res, async (uploadError: unknown) => {
    if (uploadError) {
      const tooLarge = (uploadError as { code?: string }).code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'file_too_large' : 'invalid_upload', maxBytes: UPLOAD_MAX_BYTES });
      return;
    }
    const file = (req as CustomRequest & { file?: { buffer: Buffer } }).file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'file_required' });
      return;
    }
    const kind = sniffImage(file.buffer);
    if (!kind) {
      res.status(415).json({ error: 'unsupported_image', accepted: ['png', 'jpeg', 'webp', 'gif', 'avif'] });
      return;
    }

    const userId = req.user!.uid;
    try {
      const ready = await optimiseForWeb(file.buffer, kind);
      const digest = createHash('sha256').update(ready.buffer).digest('hex').slice(0, 24);
      const folder = `users/${userId}/projects/${safeSegment(req.body?.projectId)}/site-images`;
      const upload = await storage.uploadFile(ready.buffer, `${digest}.${ready.ext}`, folder, ready.mime);
      logger.info('appgen_media.image_uploaded', {
        event: 'appgen_media.image_uploaded',
        userId,
        bytesIn: file.buffer.length,
        bytesOut: ready.buffer.length,
        mime: ready.mime,
      });
      res.json({ url: upload.downloadURL, mimeType: ready.mime, bytes: ready.buffer.length });
    } catch (error) {
      logger.warn('appgen_media.upload_failed', { event: 'appgen_media.upload_failed', error: (error as Error).message });
      res.status(502).json({ error: 'upload_failed' });
    }
  });
});

export const appgenMediaRoutes = router;
