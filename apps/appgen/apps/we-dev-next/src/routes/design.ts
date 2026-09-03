import { Router, Request, Response } from 'express';
import { ART_DIRECTIONS, FONT_PAIRINGS } from '../design/artDirections.js';
import { forgeDesignSystem, renderDesignBrief, type ForgeOverrides } from '../design/tokenForge.js';
import { ProjectModel } from '../types/project.js';
import { ChatLogger } from '../utils/logger.js';

const router = Router();

/**
 * Le système de design forgé, exposé à l'interface.
 *
 * La forge tournait déjà à chaque génération, mais son résultat n'existait que
 * dans le prompt : l'utilisateur héritait d'une palette vérifiée, d'une échelle
 * typographique et d'une direction artistique sans jamais pouvoir les voir ni
 * les ajuster. Cette route rend le calcul consultable, et surtout rejouable
 * avec une décision remplacée.
 *
 * Rien ici n'appelle de modèle : forger est du calcul pur, donc gratuit et
 * instantané. L'aperçu peut donc se rafraîchir à chaque mouvement du sélecteur
 * de couleur.
 */
router.post('/forge', (req: Request, res: Response) => {
  const { projectData, overrides } = req.body as {
    projectData?: ProjectModel;
    overrides?: ForgeOverrides;
  };

  try {
    const system = forgeDesignSystem(projectData, overrides);

    ChatLogger.setContext('DesignRoute');
    ChatLogger.info('FORGE', 'Design system forged', {
      direction: system.direction.id,
      brandDriven: system.brandDriven,
      overrides: overrides ? Object.keys(overrides) : [],
    });

    return res.json({
      system,
      /** Le brief textuel envoyé au modèle, pour que l'utilisateur voie
       *  exactement ce que la génération recevra. */
      brief: renderDesignBrief(system),
      /** Catalogues, pour peupler les sélecteurs sans les dupliquer côté client. */
      catalog: {
        directions: ART_DIRECTIONS.map((direction) => ({
          id: direction.id,
          name: direction.name,
          registers: direction.registers,
          surface: direction.surface,
          colorStrategy: direction.colorStrategy,
          radius: direction.radius,
          signature: direction.signature,
        })),
        fontPairings: FONT_PAIRINGS,
      },
    });
  } catch (error) {
    ChatLogger.setContext('DesignRoute');
    ChatLogger.error('FORGE_FAILED', 'Could not forge design system', {
      message: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Could not forge the design system.' });
  }
});

export default router;
