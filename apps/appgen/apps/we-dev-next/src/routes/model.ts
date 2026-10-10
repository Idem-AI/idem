import { timingSafeEqual } from 'node:crypto';
import { Router, Request, Response } from 'express';
import {
  MODEL_PROVIDERS,
  getActiveProvider,
  getDefaultModelKey,
  getPublicModelConfig,
  setActiveProvider,
} from '../config/modelConfig.js';

const router = Router();

// Le catalogue est relu à chaque requête : il suit le fournisseur actif.
router.get('/', (req: Request, res: Response) => {
  return res.json(getPublicModelConfig());
});

router.get('/config', (req: Request, res: Response) => {
  return res.json(getPublicModelConfig());
});

router.get('/default', (req: Request, res: Response) => {
  return res.json({
    modelKey: getDefaultModelKey(),
    provider: getActiveProvider(),
  });
});

/** Comparaison à temps constant : la clé d'administration ne se devine pas à la latence. */
function isAdmin(req: Request): boolean {
  const expected = process.env.MODEL_ADMIN_KEY?.trim();
  const given = String(req.header('x-admin-key') ?? '');
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Bascule le fournisseur de modèles À CHAUD, sans redémarrage.
 *
 *   curl -X POST $APPGEN/api/model/switch -H "x-admin-key: …" \
 *        -H 'content-type: application/json' -d '{"provider":"openrouter"}'
 *
 * `{"provider": null}` rétablit `APPGEN_MODEL_PROVIDER`. Sans `MODEL_ADMIN_KEY`
 * configurée, la route est fermée (404 déguisé) plutôt qu'ouverte à tous.
 */
router.post('/switch', (req: Request, res: Response) => {
  if (!process.env.MODEL_ADMIN_KEY?.trim()) return res.status(404).json({ error: 'not_found' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'unauthorized' });

  const { provider } = req.body ?? {};
  if (provider === null) {
    setActiveProvider(undefined);
  } else if ((MODEL_PROVIDERS as readonly string[]).includes(String(provider))) {
    setActiveProvider(String(provider) as (typeof MODEL_PROVIDERS)[number]);
  } else {
    return res.status(400).json({ error: 'invalid_provider', allowed: MODEL_PROVIDERS });
  }
  return res.json({ provider: getActiveProvider(), modelKey: getDefaultModelKey() });
});

export default router;
