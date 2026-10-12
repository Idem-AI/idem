/**
 * Accès à la direction artistique d'un projet, depuis n'importe quel module.
 *
 * La direction est DÉCIDÉE dans `BandIdentity/branding.service` — c'est sa
 * place, elle appartient à la charte. Mais tous les livrables en dépendent, et
 * chacun peut être le premier généré : un utilisateur qui produit un visuel
 * social avant d'avoir généré sa charte doit obtenir un visuel dirigé, pas un
 * visuel « moyen ». Ce module provisionne donc la direction à la demande, et la
 * persiste : le premier livrable la fait naître, les suivants la relisent.
 *
 * L'import de `branding.service` est DIFFÉRÉ. C'est un module lourd (prompts de
 * logo, moteur de déclinaisons, PDF) : le charger au démarrage pour une
 * dépendance sollicitée une fois par projet alourdirait le bootstrap de l'API
 * sans contrepartie, et exposerait à un cycle d'imports le jour où la charte
 * consommera un autre livrable.
 */

import logger from '../../config/logger';
import { ArtDirectionModel } from '../../models/art-direction.model';
import { ProjectModel } from '../../models/project.model';
import { PromptService } from '../prompt.service';

export async function ensureProjectArtDirection(
  promptService: PromptService,
  userId: string,
  projectId: string,
  project: ProjectModel
): Promise<ArtDirectionModel | undefined> {
  const existing = project.analysisResultModel?.branding?.artDirection;
  if (existing?.styleId) return existing;
  // Sans charte (pas de palette, pas de logo), il n'y a rien sur quoi asseoir un
  // parti pris : mieux vaut aucun bloc de direction qu'une direction inventée.
  if (!project.analysisResultModel?.branding) return undefined;

  try {
    const { BrandingService } = await import('../BandIdentity/branding.service');
    const branding = new BrandingService(promptService);
    const direction = await branding.ensureArtDirection(userId, projectId, project);
    return direction ?? undefined;
  } catch (error: any) {
    // Un livrable sans direction artistique reste un livrable : on ne perd pas
    // la génération pour autant.
    logger.warn('[ArtDirection] indisponible pour ce livrable', {
      projectId,
      error: error?.message,
    });
    return undefined;
  }
}
