import { Router, Request, Response } from 'express';
import { resolveBuildTarget } from '../config/buildTarget.js';
import { buildScaffold } from '../scaffold/index.js';
import { ProjectModel } from '../types/project.js';
import { ChatLogger } from '../utils/logger.js';

const router = Router();

/**
 * Le starter préconfiguré, servi à l'espace de travail.
 *
 * Le client appelle cette route à l'ouverture d'un projet neuf, monte les
 * fichiers reçus dans WebContainer, puis parle au modèle. La génération
 * commence donc sur un projet qui démarre déjà, avec la charte en place : le
 * modèle n'a plus qu'à écrire le produit.
 *
 * Aucun appel de modèle ici — le starter est du calcul pur, donc gratuit.
 */
router.post('/', (req: Request, res: Response) => {
  const { projectData, product, platform, language } = req.body as {
    projectData?: ProjectModel;
    product?: unknown;
    platform?: unknown;
    language?: string;
  };

  try {
    const target = resolveBuildTarget(product, platform, projectData);
    const scaffold = buildScaffold({ target, projectData, language });

    ChatLogger.setContext('ScaffoldRoute');
    ChatLogger.info('SCAFFOLD', 'Starter served', {
      target,
      version: scaffold.version,
      files: Object.keys(scaffold.files).length,
      locked: scaffold.locked.length,
      project: projectData?.name,
    });

    return res.json(scaffold);
  } catch (error) {
    ChatLogger.setContext('ScaffoldRoute');
    ChatLogger.error('SCAFFOLD_FAILED', 'Could not build the starter', {
      message: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Could not build the starter.' });
  }
});

export default router;
