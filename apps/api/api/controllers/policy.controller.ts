import { Response } from "express";
import { CustomRequest } from "../interfaces/express.interface";
import { policyAcceptanceService } from "../services/policyAcceptance.service";
import {
  FinalizeProjectRequest,
  FinalizeProjectResponse,
} from "../models/policyAcceptance.model";
import logger from "../config/logger";

/**
 * Finalise un projet en enregistrant l'acceptation des politiques
 */
export const finalizeProjectController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const acceptanceData: FinalizeProjectRequest = req.body;
  const userId = req.user?.uid;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent");

  logger.info(
    `finalizeProjectController called - UserId: ${userId}, ProjectId: ${projectId}`,
    { body: req.body }
  );

  try {
    if (!userId) {
      logger.warn("User not authenticated for finalizeProjectController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn("Project ID is required for finalizeProjectController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    // Validation des données d'acceptation
    if (typeof acceptanceData.privacyPolicyAccepted !== "boolean") {
      logger.warn("Privacy policy acceptance is required");
      res
        .status(400)
        .json({ message: "Privacy policy acceptance is required" });
      return;
    }

    if (typeof acceptanceData.termsOfServiceAccepted !== "boolean") {
      logger.warn("Terms of service acceptance is required");
      res
        .status(400)
        .json({ message: "Terms of service acceptance is required" });
      return;
    }

    if (typeof acceptanceData.betaPolicyAccepted !== "boolean") {
      logger.warn("Beta policy acceptance is required");
      res.status(400).json({ message: "Beta policy acceptance is required" });
      return;
    }

    // Finaliser le projet
    const project = await policyAcceptanceService.finalizeProject(
      userId,
      projectId,
      acceptanceData,
      ipAddress,
      userAgent
    );

    const response: FinalizeProjectResponse = {
      success: true,
      message: "Project finalized successfully",
      projectId,
      acceptedAt: project.policyAcceptance!.acceptedAt,
    };

    logger.info(
      `Project finalized successfully - UserId: ${userId}, ProjectId: ${projectId}`
    );

    res.status(200).json(response);
  } catch (error) {
    logger.error(
      `Error in finalizeProjectController - UserId: ${userId}, ProjectId: ${projectId}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body,
      }
    );

    // Gestion des erreurs spécifiques
    if (error instanceof Error) {
      if (error.message.includes("already been finalized")) {
        res.status(409).json({ message: error.message });
        return;
      }
      if (error.message.includes("acceptance is required")) {
        res.status(400).json({ message: error.message });
        return;
      }
    }

    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Vérifie le statut d'acceptation des politiques pour un projet
 */
export const checkPolicyStatusController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const { projectId } = req.params;
  const userId = req.user?.uid;

  logger.info(
    `checkPolicyStatusController called - UserId: ${userId}, ProjectId: ${projectId}`
  );

  try {
    if (!userId) {
      logger.warn("User not authenticated for checkPolicyStatusController");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!projectId) {
      logger.warn("Project ID is required for checkPolicyStatusController");
      res.status(400).json({ message: "Project ID is required" });
      return;
    }

    const isAccepted = await policyAcceptanceService.isPolicyAccepted(
      userId,
      projectId
    );
    const policyAcceptance = await policyAcceptanceService.getPolicyAcceptance(
      userId,
      projectId
    );

    res.status(200).json({
      projectId,
      isFinalized: isAccepted,
      acceptance: policyAcceptance,
    });

    logger.info(
      `Policy status checked - UserId: ${userId}, ProjectId: ${projectId}, IsFinalized: ${isAccepted}`
    );
  } catch (error) {
    logger.error(
      `Error in checkPolicyStatusController - UserId: ${userId}, ProjectId: ${projectId}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      }
    );

    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Récupère toutes les acceptations de politiques pour un utilisateur
 */
export const getUserPolicyAcceptancesController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.uid;

  logger.info(`getUserPolicyAcceptancesController called - UserId: ${userId}`);

  try {
    if (!userId) {
      logger.warn(
        "User not authenticated for getUserPolicyAcceptancesController"
      );
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const acceptances = await policyAcceptanceService.getUserPolicyAcceptances(
      userId
    );

    res.status(200).json({
      userId,
      acceptances,
      count: acceptances.length,
    });

    logger.info(
      `User policy acceptances retrieved - UserId: ${userId}, Count: ${acceptances.length}`
    );
  } catch (error) {
    logger.error(
      `Error in getUserPolicyAcceptancesController - UserId: ${userId}`,
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      }
    );

    res.status(500).json({
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
