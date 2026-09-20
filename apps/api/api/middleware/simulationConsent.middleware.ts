import { NextFunction, Response } from 'express';

import logger from '../config/logger';
import { CustomRequest } from '../interfaces/express.interface';
import { SimulationConsent } from '../models/simulation.model';

/**
 * Recueille l'accord qui autorise une exécution de simulation.
 *
 * La vérification par projet (`checkPolicyAcceptance`) ne convient pas ici,
 * pour deux raisons :
 *
 *  1. Un business plan importé n'a pas encore de projet — c'est l'exécution
 *     qui le crée. Exiger un identifiant de projet renvoyait un 400 sur une
 *     requête pourtant valide, et le parcours d'import était bloqué net.
 *  2. Une simulation lit un document, en tire un projet et le confie à
 *     plusieurs modèles. Ce n'est pas une opération couverte une fois pour
 *     toutes à la création d'un compte : l'accord est redemandé à chaque
 *     lancement, y compris depuis un projet IDEM déjà finalisé.
 *
 * L'accord validé est déposé sur la requête, horodaté et accompagné de son
 * origine, pour que le service l'enregistre avec l'exécution.
 */

/**
 * Bêta produit. Tant qu'elle dure, la politique bêta est exigée au même titre
 * que les deux autres : l'utilisateur doit savoir qu'il travaille sur un
 * moteur en cours de mise au point. La sortie de bêta est un redéploiement
 * (`IS_BETA=false`), pas une modification de code — comme côté client.
 */
const IS_BETA = process.env.IS_BETA !== 'false';

/** Ce qui doit être accepté pour qu'une exécution démarre. */
function requiredDocuments(): string[] {
  return IS_BETA
    ? ['privacyPolicy', 'simulationTerms', 'betaPolicy']
    : ['privacyPolicy', 'simulationTerms'];
}

export const requireSimulationConsent = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ message: 'User not authenticated', code: 'AUTHENTICATION_REQUIRED' });
    return;
  }

  const supplied = (req.body?.consent ?? {}) as Partial<SimulationConsent>;
  const accepted: Record<string, boolean> = {
    privacyPolicy: supplied.privacyPolicyAccepted === true,
    simulationTerms: supplied.simulationTermsAccepted === true,
    betaPolicy: supplied.betaPolicyAccepted === true,
  };
  const missing = requiredDocuments().filter((document) => !accepted[document]);

  if (missing.length > 0) {
    logger.warn(`Simulation consent refused — user ${userId}, missing: ${missing.join(', ')}`);
    res.status(403).json({
      message: IS_BETA
        ? "Vous devez accepter la politique de confidentialité, les conditions d'utilisation de la simulation et la politique bêta avant de lancer une exécution."
        : "Vous devez accepter la politique de confidentialité et les conditions d'utilisation de la simulation avant de lancer une exécution.",
      code: 'SIMULATION_CONSENT_REQUIRED',
      missing,
    });
    return;
  }

  req.simulationConsent = {
    privacyPolicyAccepted: true,
    simulationTermsAccepted: true,
    // Conservé tel qu'il a été donné : hors bêta la case n'est plus affichée,
    // et l'accord enregistré doit refléter ce que l'utilisateur a vu.
    betaPolicyAccepted: accepted['betaPolicy'],
    acceptedAt: new Date(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };

  logger.info(
    `Simulation consent recorded — user ${userId}, beta: ${req.simulationConsent.betaPolicyAccepted}`
  );
  next();
};
