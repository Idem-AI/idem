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
 *   stock   une photo ou une vidéo Pexels, sans frais.
 *
 * Une génération est facturée au barème iCode (`site_image`, `site_video`) AVANT l'appel, et
 * restituée si le modèle échoue : le générateur se replie alors sur Pexels. Un refus de
 * crédits (402) n'est pas une erreur pour lui — c'est le même repli.
 */
import axios from 'axios';
import { Response, Router } from 'express';
import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { authenticate } from '../services/auth.service';
import { chargeForService, creditCost } from '../middleware/billing.middleware';
import { creditLedgerService } from '../services/billing/credit-ledger.service';
import { entitlementsService } from '../services/billing/entitlements.service';
import { generateImage, generateVideo } from '../services/media.service';
import { StorageService } from '../services/storage.service';
import { runWithAiUsageContext } from '../utils/ai-usage-context.util';

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
    { action, cost: creditCost('appgen', action) },
    { projectId: text(req.body?.projectId, 128) || undefined, feature: 'appgen', element: text(req.body?.tag, 64) || undefined }
  );
  if (result.status === 'refused') {
    res.status(402).json(result.body);
    return null;
  }
  return result;
}

async function refund(userId: string, charged: Charge, action: string): Promise<void> {
  if (charged.status !== 'charged') return;
  try {
    await creditLedgerService.refundDebit(userId, 'appgen', charged.cost, {
      action,
      note: 'Média de site non généré — crédits restitués',
    });
    await entitlementsService.invalidate(userId);
  } catch (error) {
    logger.error('appgen_media.refund_failed', { event: 'appgen_media.refund_failed', userId, action, error });
  }
}

/**
 * Les résultats qui parlent vraiment de la requête, les plus proches d'abord.
 *
 * Le premier résultat de Pexels n'est pas toujours le bon, et pour une scène
 * rare (un plat ivoirien, un atelier de Douala) il peut être sans rapport : une
 * cuisse de poulet « asiatique » pour un restaurant d'Abidjan. Un résultat dont
 * la description ne reprend aucun mot de la requête est écarté ; sans résultat,
 * le générateur passe à son repli suivant plutôt que de montrer un hors-sujet.
 */
function relevant<T>(items: T[], describe: (item: T) => string, query: string): T[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  return items
    .map((item, rank) => {
      const text = describe(item).toLowerCase();
      return { item, rank, score: words.filter((word) => text.includes(word)).length };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.rank - b.rank)
    .map((entry) => entry.item);
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
 * Une photo ou une vidéo Pexels. Gratuit : c'est le repli de toutes les générations, et le
 * premier choix pour une scène de la vie réelle (un marché, une cuisine, une rue).
 */
router.post('/stock', authenticate, async (req: CustomRequest, res: Response) => {
  const apiKey = process.env.PEXELS_API_KEY;
  const query = text(req.body?.query, 120);
  if (!apiKey) {
    res.status(503).json({ error: 'stock_unconfigured' });
    return;
  }
  if (!query) {
    res.status(400).json({ error: 'query_required' });
    return;
  }
  const kind = req.body?.kind === 'video' ? 'video' : 'photo';
  const orientation = ['landscape', 'portrait', 'square'].includes(req.body?.orientation) ? req.body.orientation : 'landscape';
  const count = Math.min(5, Math.max(1, Number(req.body?.count) || 1));
  // Pexels cherche aussi dans d'autres langues : une requête en français trouve des photos.
  const locale = /^[a-z]{2}-[A-Z]{2}$/.test(String(req.body?.locale ?? '')) ? req.body.locale : undefined;

  try {
    if (kind === 'photo') {
      const { data } = await axios.get('https://api.pexels.com/v1/search', {
        headers: { Authorization: apiKey },
        params: { query, per_page: Math.max(count * 3, 10), orientation, ...(locale ? { locale } : {}) },
        timeout: 8000,
      });
      const ranked = relevant(data?.photos ?? [], (photo: any) => String(photo.alt ?? ''), query);
      const items = ranked.slice(0, count).map((photo: any) => ({
        url: photo.src?.large2x || photo.src?.large || photo.src?.original,
        width: photo.width,
        height: photo.height,
        alt: text(photo.alt, 200),
        author: photo.photographer,
        sourceUrl: photo.url,
      }));
      if (!items.length || !items[0].url) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.json({ items });
      return;
    }

    const { data } = await axios.get('https://api.pexels.com/videos/search', {
      headers: { Authorization: apiKey },
      params: { query, per_page: 5, orientation, size: 'medium', ...(locale ? { locale } : {}) },
      timeout: 8000,
    });
    // Une vidéo n'a pas de description : son adresse (« …/video/femme-qui-cuisine-… ») en tient lieu.
    const items = relevant(data?.videos ?? [], (video: any) => String(video.url ?? '').replace(/[-/]/g, ' '), query)
      .map((video: any) => {
        // Le fichier HD le plus léger qui couvre 1280 px : assez net en fond, pas 40 Mo.
        const files = (video.video_files ?? [])
          .filter((file: any) => file.file_type === 'video/mp4' && file.width >= 1000)
          .sort((a: any, b: any) => a.width - b.width);
        const file = files.find((candidate: any) => candidate.width >= 1280) ?? files[files.length - 1];
        return file
          ? { url: file.link, poster: video.image, width: file.width, height: file.height, author: video.user?.name, sourceUrl: video.url, duration: video.duration }
          : null;
      })
      .filter(Boolean)
      .slice(0, count);
    if (!items.length) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ items });
  } catch (error) {
    logger.warn('appgen_media.stock_failed', { event: 'appgen_media.stock_failed', error: (error as Error).message });
    res.status(502).json({ error: 'stock_failed' });
  }
});

export const appgenMediaRoutes = router;
