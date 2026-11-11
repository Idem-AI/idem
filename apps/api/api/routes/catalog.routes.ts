/**
 * LE CATALOGUE DE GABARITS — exploitation sans rebuild ni redéploiement.
 *
 *   GET  /catalog              état des deux catalogues (images, vidéos)               administrateurs
 *   POST /catalog/refresh      relire les catalogues publiés tout de suite              webhook de publication
 *   PUT  /catalog/overrides    retirer des nœuds, régler leurs poids (effet en 15 s)    administrateurs
 *
 * Le webhook est appelé par la CI du dépôt `idem-templates` après chaque publication, avec l'en-tête
 * `x-idem-templates-token` (= `IDEM_TEMPLATES_WEBHOOK_TOKEN`). Les surcharges vivent dans `platform_settings/catalog`.
 */
import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import { catalog, refreshCatalog } from '@idem/graphic-engine';
import { refreshVideoCatalog, videoCatalog } from '../../../ivision/core/src/video/catalog/registry';
import logger from '../config/logger';
import { requireAdminAccess } from '../middleware/super-user.middleware';

const router = Router();
export const CATALOG_SETTINGS_ID = 'catalog';

const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

router.get('/', requireAdminAccess, async (_req: Request, res: Response) => {
  const cat = await catalog();
  const counts = [...cat.nodes.values()].reduce<Record<string, number>>((acc, n) => ((acc[n.kind] = (acc[n.kind] ?? 0) + 1), acc), {});
  const videos = await videoCatalog();
  const videoCounts = [...videos.nodes.values()].filter((n) => !n.id.startsWith('builtin.')).reduce<Record<string, number>>((acc, n) => ((acc[n.kind] = (acc[n.kind] ?? 0) + 1), acc), {});
  res.json({ version: cat.version, source: cat.source, counts, rejected: cat.rejected, videos: { version: videos.version, source: videos.source, counts: videoCounts, rejected: videos.rejected } });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const expected = process.env.IDEM_TEMPLATES_WEBHOOK_TOKEN?.trim();
  const given = String(req.header('x-idem-templates-token') ?? '');
  if (!expected || !given || !sameSecret(given, expected)) return res.status(401).json({ error: 'unauthorized' });
  const out = await refreshCatalog();
  const videos = await refreshVideoCatalog();
  logger.info('catalog.refreshed', { version: out.version, source: out.source, nodes: out.nodes, rejected: out.rejected.length, videoVersion: videos.version, videoSource: videos.source, videoRejected: videos.rejected.length });
  return res.json({ ...out, videos: { version: videos.version, source: videos.source, nodes: videos.nodes.size, rejected: videos.rejected.length } });
});

router.put('/overrides', requireAdminAccess, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { disabled?: unknown; weights?: unknown };
  const disabled = Array.isArray(body.disabled) ? body.disabled.map(String).filter((id) => /^[a-z0-9][a-z0-9._-]{1,79}$/.test(id)).slice(0, 2000) : [];
  const weights: Record<string, number> = {};
  if (body.weights && typeof body.weights === 'object') {
    for (const [id, w] of Object.entries(body.weights as Record<string, unknown>)) {
      const n = Number(w);
      if (/^[a-z0-9][a-z0-9._-]{1,79}$/.test(id) && Number.isFinite(n)) weights[id] = Math.min(3, Math.max(0, n));
    }
  }
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'database unavailable' });
  await mongoose.connection.collection('platform_settings').updateOne({ _id: CATALOG_SETTINGS_ID } as any, { $set: { disabled, weights, updatedAt: new Date() } }, { upsert: true });
  logger.info('catalog.overrides', { disabled: disabled.length, weights: Object.keys(weights).length });
  return res.json({ disabled, weights });
});

export default router;
