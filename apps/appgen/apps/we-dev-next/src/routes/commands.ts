import { Router } from 'express';
import { COMMANDS } from '../commands/registry.js';
import { analyzeBuildKind } from '../commands/buildKind.js';
import { requireIdemUser } from '../middleware/auth.js';

/**
 * La liste des commandes « / » d'iCode, pour le menu de la barre de saisie : une seule définition
 * (`commands/registry.ts`), lue par l'atelier et par le serveur.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ commands: COMMANDS });
});

/**
 * Site ou application, pour une demande de la page d'accueil sans produit dans l'adresse (voir `commands/buildKind.ts`).
 * Réponse rapide (4 s au plus) ; `product: null` laisse le chemin habituel décider.
 */
router.post('/kind', requireIdemUser, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  res.json(await analyzeBuildKind({ text, userId: req.idemUser?.uid ?? null }));
});

export default router;
