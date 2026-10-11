import { timingSafeEqual } from 'node:crypto';
import { Router, Request, Response } from 'express';
import {
  getCatalogKeys,
  getDefaultModelKey,
  getPublicModelConfig,
  setDefaultModelKey,
} from '../config/modelConfig.js';

const router = Router();

// Le catalogue est relu à chaque requête : il suit le modèle choisi à chaud.
router.get('/', (req: Request, res: Response) => {
  return res.json(getPublicModelConfig());
});

router.get('/config', (req: Request, res: Response) => {
  return res.json(getPublicModelConfig());
});

router.get('/default', (req: Request, res: Response) => {
  return res.json({ modelKey: getDefaultModelKey() });
});

/** Comparaison à temps constant : la clé d'administration ne se devine pas à la latence. */
function isAdmin(req: Request): boolean {
  const expected = process.env.MODEL_ADMIN_KEY?.trim();
  const given = String(req.header('x-admin-key') ?? '');
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Change le modèle par défaut À CHAUD, sans redémarrage.
 *
 *   curl -X POST $APPGEN/api/model/default -H "x-admin-key: …" \
 *        -H 'content-type: application/json' -d '{"modelKey":"deepseek/deepseek-v4-flash"}'
 *
 * `{"modelKey": null}` rétablit `APPGEN_DEFAULT_MODEL`. Sans `MODEL_ADMIN_KEY`
 * configurée, la route est fermée (404 déguisé) plutôt qu'ouverte à tous.
 */
router.post('/default', (req: Request, res: Response) => {
  if (!process.env.MODEL_ADMIN_KEY?.trim()) return res.status(404).json({ error: 'not_found' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });

  const { modelKey } = req.body ?? {};
  const accepted = setDefaultModelKey(modelKey === null ? undefined : String(modelKey));
  if (!accepted) return res.status(400).json({ error: 'unknown_model', allowed: getCatalogKeys() });
  return res.json({ modelKey: getDefaultModelKey() });
});

export default router;
