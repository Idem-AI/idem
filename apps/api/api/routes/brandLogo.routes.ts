import { Router, Request, Response } from 'express';
import logger from '../config/logger';
import { PROJECT_ID, readPublicLogo, verifyPublicLogoToken } from '../services/brand/publicLogo.service';

/**
 * Le logo d'un projet, à une adresse qui ne change jamais (cf. `services/brand/publicLogo.service.ts`).
 *
 *   GET /brand/:projectId/logo?t=<jeton>
 *
 * Public (une balise <img> d'un site en ligne ne porte pas de session) ; le jeton signé remplace l'authentification.
 */
const router = Router();

router.get('/:projectId/logo', async (req: Request<{ projectId: string }>, res: Response) => {
  const { projectId } = req.params;
  if (!PROJECT_ID.test(projectId) || !verifyPublicLogoToken(projectId, req.query.t)) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  try {
    const logo = await readPublicLogo(projectId);
    if (!logo) {
      res.status(404).set('Cache-Control', 'public, max-age=60').json({ error: 'no_logo' });
      return;
    }
    res.set({
      'Content-Type': logo.contentType,
      ETag: logo.etag,
      // Court : un nouveau logo doit paraître sur le site en quelques minutes. L'ancien reste servi le temps de
      // revalider, jamais une image cassée.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      // Un SVG servi seul ne doit rien exécuter.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    });
    if (req.headers['if-none-match'] === logo.etag) {
      res.status(304).end();
      return;
    }
    res.send(logo.body);
  } catch (error: any) {
    logger.warn('brand.public_logo_failed', { event: 'brand.public_logo_failed', projectId, error: error?.message });
    res.status(502).json({ error: 'logo_unavailable' });
  }
});

export default router;
