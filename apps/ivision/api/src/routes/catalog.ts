/**
 * LA RELECTURE DES CATALOGUES — `POST /catalog/refresh`, appelée par la CI du dépôt `idem-templates` après chaque
 * publication (variable `IDEM_API_URLS` du dépôt : y mettre l'API IDEM ET l'API iVision). Elle relit tout de suite le
 * catalogue des images (moteur graphique : visuels, chartes) et celui des vidéos (films) ; sans elle, chacun est relu
 * à l'expiration de son cache (`IDEM_TEMPLATES_TTL_S`, 300 s).
 *
 * Protégée par l'en-tête `x-idem-templates-token` (= `IDEM_TEMPLATES_WEBHOOK_TOKEN`), comparé en temps constant.
 */
import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { refreshCatalog } from '@idem/graphic-engine';
import { refreshVideoCatalog } from '../../../core/src/video/catalog/registry';
import logger from '../config/logger';

export const catalogRoutes = Router();

const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

catalogRoutes.post('/refresh', async (req: Request, res: Response) => {
  const expected = process.env.IDEM_TEMPLATES_WEBHOOK_TOKEN?.trim();
  const given = String(req.header('x-idem-templates-token') ?? '');
  if (!expected || !given || !sameSecret(given, expected)) return res.status(401).json({ error: 'unauthorized' });
  const images = await refreshCatalog();
  const videos = await refreshVideoCatalog();
  logger.info('catalog.refreshed', { event: 'catalog.refreshed', version: images.version, source: images.source, rejected: images.rejected.length, videoVersion: videos.version, videoSource: videos.source, videoRejected: videos.rejected.length });
  return res.json({ ...images, videos: { version: videos.version, source: videos.source, nodes: videos.nodes.size, rejected: videos.rejected.length } });
});
