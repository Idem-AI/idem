import logger from "../config/logger";
import { FinalizeProjectRequest } from "../models/policyAcceptance.model";
import { ProjectModel, ProjectPolicyAcceptance } from "../models/project.model";
import { projectService } from "./project.service";
import { storageService } from "./storage.service";

export class PolicyAcceptanceService {
  constructor() {
    // Utilise le ProjectService pour gérer les opérations sur les projets
  }
  /**
   * Finalise un projet en enregistrant l'acceptation des politiques
   */
  async finalizeProject(
    userId: string,
    projectId: string,
    acceptanceData: FinalizeProjectRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ProjectModel> {
    logger.info(
      `Finalizing project - UserId: ${userId}, ProjectId: ${projectId}`
    );

    // Validation des acceptations obligatoires
    if (!acceptanceData.privacyPolicyAccepted) {
      throw new Error("Privacy policy acceptance is required");
    }
    if (!acceptanceData.termsOfServiceAccepted) {
      throw new Error("Terms of service acceptance is required");
    }
    if (!acceptanceData.betaPolicyAccepted) {
      throw new Error("Beta policy acceptance is required");
    }

    // Récupérer le projet via ProjectService
    const project = await projectService.getUserProjectById(userId, projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Vérifier si le projet a déjà été finalisé
    if (project.policyAcceptance) {
      logger.warn(
        `Project already finalized - UserId: ${userId}, ProjectId: ${projectId}`
      );
      throw new Error("Project has already been finalized");
    }

    // Créer l'objet d'acceptation des politiques
    const policyAcceptance: ProjectPolicyAcceptance = {
      privacyPolicyAccepted: acceptanceData.privacyPolicyAccepted,
      termsOfServiceAccepted: acceptanceData.termsOfServiceAccepted,
      betaPolicyAccepted: acceptanceData.betaPolicyAccepted,
      marketingAccepted: acceptanceData.marketingAccepted || false,
      acceptedAt: new Date(),
      ipAddress,
      userAgent,
    };

    // Préparer les données de mise à jour du projet
    let projectUpdateData: Partial<ProjectModel> = {
      policyAcceptance,
    };

    // Vérifier et uploader les variations de logo si elles existent
    const logoVariations =
      project.analysisResultModel?.branding?.logo?.variations;
    const primaryLogo = project.analysisResultModel?.branding?.logo?.svg;

    if (
      logoVariations &&
      (logoVariations.iconOnly?.lightBackground ||
        logoVariations.iconOnly?.darkBackground ||
        logoVariations.iconOnly?.monochrome ||
        logoVariations.withText?.lightBackground ||
        logoVariations.withText?.darkBackground ||
        logoVariations.withText?.monochrome ||
        primaryLogo)
    ) {
      logger.info(`Uploading logo variations to Firebase Storage`, {
        userId,
        projectId,
        variations: Object.keys(logoVariations),
      });

      try {
        // Upload logo variations to Firebase Storage
        const iconSvg = project.analysisResultModel?.branding?.logo?.iconSvg;
        const uploadResults = await storageService.uploadLogoVariations(
          primaryLogo,
          iconSvg,
          logoVariations,
          userId,
          projectId
        );

        // Replace SVG content with download URLs
        const updatedVariations = {
          withText: {
            lightBackground:
              uploadResults.withText?.lightBackground?.downloadURL,
            darkBackground: uploadResults.withText?.darkBackground?.downloadURL,
            monochrome: uploadResults.withText?.monochrome?.downloadURL,
          },
          iconOnly: {
            lightBackground:
              uploadResults.iconOnly?.lightBackground?.downloadURL,
            darkBackground: uploadResults.iconOnly?.darkBackground?.downloadURL,
            monochrome: uploadResults.iconOnly?.monochrome?.downloadURL,
          },
        };

        // Update the project data with the URLs
        projectUpdateData = {
          ...projectUpdateData,
          analysisResultModel: {
            ...project.analysisResultModel,
            branding: {
              ...project.analysisResultModel?.branding,
              logo: {
                ...project.analysisResultModel?.branding?.logo,
                svg: uploadResults.primaryLogo!.downloadURL,
                iconSvg: uploadResults.iconSvg?.downloadURL,
                variations: updatedVariations,
              },
            },
          },
        };

        logger.info(`Logo variations uploaded and URLs updated successfully`, {
          userId,
          projectId,
          primaryLogoUrl: uploadResults.primaryLogo?.downloadURL,
          iconSvgUrl: uploadResults.iconSvg?.downloadURL,
        });
      } catch (error: any) {
        logger.error(
          `Error uploading logo variations during project finalization`,
          {
            userId,
            projectId,
            error: error.message,
            stack: error.stack,
          }
        );
        // Continue with project finalization even if logo upload fails
        logger.warn(`Continuing project finalization without logo upload`, {
          userId,
          projectId,
        });
      }
    }

    // Mettre à jour le projet via ProjectService
    await projectService.editUserProject(userId, projectId, projectUpdateData);

    // Récupérer le projet mis à jour
    const savedProject = await projectService.getUserProjectById(
      userId,
      projectId
    );
    if (!savedProject) {
      throw new Error("Failed to retrieve updated project");
    }

    logger.info(
      `Project finalized successfully - UserId: ${userId}, ProjectId: ${projectId}`
    );
    return savedProject;
  }

  /**
   * Vérifie si un utilisateur a accepté les politiques pour un projet
   */
  async isPolicyAccepted(userId: string, projectId: string): Promise<boolean> {
    try {
      const project = await projectService.getUserProjectById(
        userId,
        projectId
      );
      return project?.policyAcceptance !== undefined;
    } catch (error) {
      logger.error(
        `Error checking policy acceptance - UserId: ${userId}, ProjectId: ${projectId}`,
        error
      );
      return false;
    }
  }

  /**
   * Récupère l'acceptation des politiques pour un utilisateur et un projet
   */
  async getPolicyAcceptance(
    userId: string,
    projectId: string
  ): Promise<ProjectPolicyAcceptance | null> {
    try {
      const project = await projectService.getUserProjectById(
        userId,
        projectId
      );
      return project?.policyAcceptance || null;
    } catch (error) {
      logger.error(
        `Error fetching policy acceptance - UserId: ${userId}, ProjectId: ${projectId}`,
        error
      );
      return null;
    }
  }

  /**
   * Récupère toutes les acceptations de politiques pour un utilisateur
   */
  async getUserPolicyAcceptances(
    userId: string
  ): Promise<ProjectPolicyAcceptance[]> {
    try {
      logger.info(`Fetching all policy acceptances for userId: ${userId}`);
      const projects = await projectService.getAllUserProjects(userId);
      const acceptances = projects
        .filter((project) => project.policyAcceptance)
        .map((project) => project.policyAcceptance!);
      return acceptances;
    } catch (error) {
      logger.error(
        `Error fetching user policy acceptances - UserId: ${userId}`,
        error
      );
      return [];
    }
  }
}

// Export singleton instance
export const policyAcceptanceService = new PolicyAcceptanceService();
