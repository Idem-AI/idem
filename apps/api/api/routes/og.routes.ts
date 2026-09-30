import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { ogImageService } from '../services/og/ogImage.service';

/**
 * Les images de partage, publiques et sans compte.
 *
 *   GET /og/:lang/:key.png    l'image (1200 × 630), celle des balises og:image
 *   GET /og/:lang/:key.html   le même document en HTML, pour le retoucher
 *
 * `lang` : `fr` ou `en` ; `key` : une clé de `OG_KEYS` (packages/shared-seo).
 */
const router = Router();

const FILE = /^([a-z][a-z-]{0,40})\.(png|html)$/;
const LANG = /^(fr|en)$/;

// Paramètres typés explicitement : depuis @types/express-serve-static-core 5.1.3,
// `req.params` non typé vaut `string | string[]` (paramètres génériques d'Express 5).
router.get('/:lang/:file', async (req: Request<{ lang: string; file: string }>, res: Response) => {
  const { lang, file } = req.params;
  const match = FILE.exec(file);
  if (!LANG.test(lang) || !match) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const [, key, format] = match;

  try {
    if (!ogImageService.has(lang, key)) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    if (format === 'html') {
      res
        .type('html')
        .set('X-Robots-Tag', 'noindex')
        .set('Cache-Control', 'no-store')
        // Le document n'a besoin que de lui-même : styles et script en ligne,
        // images et polices embarquées.
        .set(
          'Content-Security-Policy',
          "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
        )
        .send(ogImageService.renderHtml(lang, key));
      return;
    }

    const image = await ogImageService.renderPng(lang, key);
    res.set({
      'Content-Type': 'image/png',
      ETag: image.etag,
      // Un jour chez le client, une semaine sur les caches partagés ; l'ancienne
      // image reste servie le temps que la nouvelle se dessine.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800',
    });
    if (req.headers['if-none-match'] === image.etag) {
      res.status(304).end();
      return;
    }
    res.send(image.png);
  } catch (error) {
    logger.error(`[og] échec du rendu ${lang}/${key}`, error);
    res.status(500).json({ error: 'render_failed' });
  }
});

export default router;
