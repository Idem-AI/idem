import { Router } from 'express';
import { COMMANDS } from '../commands/registry.js';

/**
 * La liste des commandes « / » d'iCode, pour le menu de la barre de saisie : une seule définition
 * (`commands/registry.ts`), lue par l'atelier et par le serveur.
 */
const router = Router();

router.get('/', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ commands: COMMANDS });
});

export default router;
