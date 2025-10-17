import { Response, NextFunction } from "express";
import { CustomRequest } from "../interfaces/express.interface";
import { policyAcceptanceService } from "../services/policyAcceptance.service";
import logger from "../config/logger";

/**
 * Middleware pour vérifier que l'utilisateur a accepté les politiques pour un projet
 * Utilisé sur les routes de génération qui nécessitent une finalisation préalable
 */
export const checkPolicyAcceptance = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId || req.body.projectId;

  logger.info(
    `Checking policy acceptance - UserId: ${userId}, ProjectId: ${projectId}`,
    { route: req.route?.path, method: req.method }
  );

  try {
    if (!userId) {
      logger.warn("User not authenticated for policy check");
      res.status(401).json({
        message: "User not authenticated",
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    if (!projectId) {
      logger.warn("Project ID not found for policy check");
      res.status(400).json({
        message: "Project ID is required",
        code: "PROJECT_ID_REQUIRED",
      });
      return;
    }

    // Vérifier si l'utilisateur a accepté les politiques pour ce projet
    const isPolicyAccepted = await policyAcceptanceService.isPolicyAccepted(
      userId,
      projectId
    );

    if (!isPolicyAccepted) {
      logger.warn(
        `Policy not accepted - UserId: ${userId}, ProjectId: ${projectId}`
      );
      res.status(403).json({
        message:
          "Project must be finalized before performing this action. Please accept the privacy policy, terms of service, and beta policy first.",
        code: "POLICY_ACCEPTANCE_REQUIRED",
        projectId,
        requiresFinalization: true,
        finalizeEndpoint: `/projects/${projectId}/finalize`,
      });
      return;
    }

    logger.info(
      `Policy acceptance verified - UserId: ${userId}, ProjectId: ${projectId}`
    );

    // Politiques acceptées, continuer vers le contrôleur suivant
    next();
  } catch (error) {
    logger.error(
      `Error checking policy acceptance - UserId: ${userId}, ProjectId: ${projectId}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        route: req.route?.path,
        method: req.method,
      }
    );

    res.status(500).json({
      message: "Internal server error during policy verification",
      code: "POLICY_CHECK_ERROR",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Middleware optionnel pour vérifier les politiques avec un avertissement seulement
 * Utilisé pour les routes où l'acceptation est recommandée mais pas obligatoire
 */
export const checkPolicyAcceptanceOptional = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.uid;
  const projectId = req.params.projectId || req.body.projectId;

  try {
    if (userId && projectId) {
      const isPolicyAccepted = await policyAcceptanceService.isPolicyAccepted(
        userId,
        projectId
      );

      if (!isPolicyAccepted) {
        logger.info(
          `Policy not accepted (optional check) - UserId: ${userId}, ProjectId: ${projectId}`
        );
        // Ajouter une propriété à la requête pour informer le contrôleur
        req.policyWarning = {
          requiresFinalization: true,
          finalizeEndpoint: `/projects/${projectId}/finalize`,
        };
      }
    }
  } catch (error) {
    logger.error("Error in optional policy check", error);
    // En cas d'erreur, continuer sans bloquer
  }

  next();
};
