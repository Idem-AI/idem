import { LLMProvider, PromptConfig, PromptService } from "../prompt.service";
import { ProjectModel } from "../../models/project.model";
import logger from "../../config/logger";
import { BusinessPlanModel } from "../../models/businessPlan.model";
import {
  GenericService,
  IPromptStep,
  ISectionResult,
} from "../common/generic.service";
import { SectionModel } from "../../models/section.model";
import { PdfService } from "../pdf.service";
import { cacheService, CacheOptions } from "../cache.service";
import crypto from "crypto";
import { AGENT_COVER_PROMPT } from "./prompts/agent-cover.prompt";
import { AGENT_COMPANY_SUMMARY_PROMPT } from "./prompts/agent-company-summary.prompt";
import { AGENT_OPPORTUNITY_PROMPT } from "./prompts/agent-opportunity.prompt";
import { AGENT_TARGET_AUDIENCE_PROMPT } from "./prompts/agent-target-audience.prompt";
import { AGENT_PRODUCTS_SERVICES_PROMPT } from "./prompts/agent-products-services.prompt";
import { AGENT_MARKETING_SALES_PROMPT } from "./prompts/agent-marketing-sales.prompt";
import { AGENT_FINANCIAL_PLAN_PROMPT } from "./prompts/agent-financial-plan.prompt";
import { AGENT_GOAL_PLANNING_PROMPT } from "./prompts/agent-goal-planning.prompt";
import { AGENT_APPENDIX_PROMPT } from "./prompts/agent-appendix.prompt";
import { TeamMember } from "../../models/project.model";
import { storageService } from "../storage.service";

export class BusinessPlanService extends GenericService {
  private pdfService: PdfService;

  constructor(promptService: PromptService) {
    super(promptService);
    this.pdfService = new PdfService();
    logger.info("BusinessPlanService initialized.");
  }

  async generateBusinessPlanWithStreaming(
    userId: string,
    projectId: string,
    streamCallback?: (sectionResult: ISectionResult) => Promise<void>
  ): Promise<ProjectModel | null> {
    logger.info(
      `Generating business plan with streaming for userId: ${userId}, projectId: ${projectId}`
    );

    // Generate cache key based on project content
    const project = await this.getProject(projectId, userId);
    if (!project) {
      return null;
    }

    const projectDescription =
      this.extractProjectDescription(project) +
      "\n" +
      "Additional infos: " +
      JSON.stringify(project.additionalInfos);
    const contentHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          name: project.name,
          description: project.description,
          branding: project.analysisResultModel?.branding,
          projectDescription,
        })
      )
      .digest("hex")
      .substring(0, 16);

    const cacheKey = cacheService.generateAIKey(
      "business-plan",
      userId,
      projectId,
      contentHash
    );

    // Check cache first
    const cachedResult = await cacheService.get<ProjectModel>(cacheKey, {
      prefix: "ai",
      ttl: 7200, // 2 hours
    });

    if (cachedResult) {
      logger.info(`Business plan cache hit for projectId: ${projectId}`);
      return cachedResult;
    }

    logger.info(
      `Business plan cache miss, generating new content for projectId: ${projectId}`
    );

    // Extract branding information
    const brandName = project.name || "Startup";
    const logoSvg = project.analysisResultModel?.branding?.logo?.svg || "";
    const brandColors = project.analysisResultModel?.branding?.colors || {
      primary: "#007bff",
      secondary: "#6c757d",
    };
    const typography = project.analysisResultModel?.branding?.typography || {
      primary: "Arial, sans-serif",
    };
    const language = "fr";

    // Create brand context for all agents
    const brandContext = `Brand: ${brandName}\nLogo SVG: ${logoSvg}\nBrand Colors: ${JSON.stringify(
      brandColors
    )}\nTypography: ${JSON.stringify(typography)}\nLanguage: ${language}`;
    try {
      // Define business plan steps with specialized agents
      const steps: IPromptStep[] = [
        {
          promptConstant: `${projectDescription}\n${AGENT_COVER_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Cover Page",
          hasDependencies: false,
        },
        {
          promptConstant: `${projectDescription}\n${AGENT_COMPANY_SUMMARY_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Company Summary",
          hasDependencies: false,
        },
        {
          promptConstant: `${projectDescription}\n${AGENT_OPPORTUNITY_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Opportunity",
          hasDependencies: false,
        },
        {
          promptConstant: `${projectDescription}\n${AGENT_TARGET_AUDIENCE_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Target Audience",
          hasDependencies: false,
        },
        {
          promptConstant: `${projectDescription}\n${AGENT_PRODUCTS_SERVICES_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Products & Services",
          hasDependencies: false,
        },
        {
          promptConstant: `${projectDescription}\n${AGENT_MARKETING_SALES_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Marketing & Sales",
          hasDependencies: false,
        },
        {
          promptConstant: `${projectDescription}\n${AGENT_FINANCIAL_PLAN_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Financial Plan",
          hasDependencies: false,
        },
        {
          promptConstant: `${projectDescription}\n${AGENT_GOAL_PLANNING_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Goal Planning",
          hasDependencies: false,
        },
        {
          promptConstant: `${projectDescription}\n${AGENT_APPENDIX_PROMPT}\n\nBRAND CONTEXT:\n${brandContext}`,
          stepName: "Appendix",
          hasDependencies: false,
        },
      ];
      const promptConfig: PromptConfig = {
        provider: LLMProvider.GEMINI,
        modelName: "gemini-2.5-flash",
      };

      // Initialize empty sections array to collect results as they come in
      let sectionResults: SectionModel[] = [];

      // Process steps one by one with streaming if callback provided
      if (streamCallback) {
        await this.processStepsWithStreaming(
          steps,
          project,
          async (result: ISectionResult) => {
            logger.info(`Received streamed result for step: ${result.name}`);

            // Skip progress and completion events - handle only actual step results
            if (
              result.data === "steps_in_progress" ||
              result.data === "all_steps_completed"
            ) {
              await streamCallback(result);
              return;
            }

            // Convert result to section model
            const section: SectionModel = {
              name: result.name,
              type: result.type,
              data: result.data,
              summary: result.summary,
            };

            // Add to sections array
            sectionResults.push(section);

            // Update project immediately after each step
            logger.info(
              `Updating project after step: ${result.name} - projectId: ${projectId}`
            );

            // Get the current project
            const currentProject = await this.projectRepository.findById(
              projectId,
              `users/${userId}/projects`
            );
            if (!currentProject) {
              logger.warn(
                `Project not found with ID: ${projectId} for user: ${userId} during step update.`
              );
              throw new Error(`Project not found: ${projectId}`);
            }

            // Create the updated project with current sections
            const updatedProjectData = {
              ...currentProject,
              analysisResultModel: {
                ...currentProject.analysisResultModel,
                businessPlan: {
                  sections: sectionResults,
                },
              },
            };

            // Update the project in the database
            const updatedProject = await this.projectRepository.update(
              projectId,
              updatedProjectData,
              `users/${userId}/projects`
            );

            if (updatedProject) {
              logger.info(
                `Successfully updated project with step: ${result.name} - projectId: ${projectId}`
              );

              // Update cache with latest project state
              await cacheService.set(cacheKey, updatedProject, {
                prefix: "ai",
                ttl: 7200, // 2 hours
              });
              logger.info(
                `Business plan cached after step: ${result.name} - projectId: ${projectId}`
              );

              // Only send to frontend after successful database update
              await streamCallback(result);
            } else {
              logger.error(
                `Failed to update project after step: ${result.name} - projectId: ${projectId}`
              );
              throw new Error(
                `Failed to update project after step: ${result.name}`
              );
            }
          },
          promptConfig,
          "business_plan",
          userId
        );

        // Return the updated project (it should be available in cache or fetch it again)
        const finalProject = await this.projectRepository.findById(
          projectId,
          `users/${userId}/projects`
        );
        return finalProject;
      } else {
        // Fallback to non-streaming processing
        const stepResults = await this.processSteps(
          steps,
          project,
          promptConfig
        );
        sectionResults = stepResults.map((result) => ({
          name: result.name,
          type: result.type,
          data: result.data,
          summary: result.summary,
        }));

        // Get the existing project to prepare for update
        const oldProject = await this.projectRepository.findById(
          projectId,
          `users/${userId}/projects`
        );
        if (!oldProject) {
          logger.warn(
            `Original project not found with ID: ${projectId} for user: ${userId} before updating with business plan.`
          );
          return null;
        }

        // Create the new project with updated business plan
        const newProject = {
          ...oldProject,
          analysisResultModel: {
            ...oldProject.analysisResultModel,
            businessPlan: {
              sections: sectionResults,
            },
          },
        };

        // Update the project in the database
        const updatedProject = await this.projectRepository.update(
          projectId,
          newProject,
          `users/${userId}/projects`
        );

        if (updatedProject) {
          logger.info(
            `Successfully updated project with ID: ${projectId} with business plan`
          );

          // Cache the result for future requests
          await cacheService.set(cacheKey, updatedProject, {
            prefix: "ai",
            ttl: 7200, // 2 hours
          });
          logger.info(`Business plan cached for projectId: ${projectId}`);
        }
        return updatedProject;
      }
    } catch (error) {
      logger.error(
        `Error generating business plan for projectId ${projectId}:`,
        error
      );
      throw error;
    } finally {
      logger.info(
        `Completed business plan generation for projectId ${projectId}`
      );
    }
  }

  async getBusinessPlansByProjectId(
    userId: string,
    projectId: string
  ): Promise<BusinessPlanModel | null> {
    logger.info(
      `Fetching business plan for projectId: ${projectId}, userId: ${userId}`
    );
    const project = await this.projectRepository.findById(
      projectId,
      `users/${userId}/projects`
    );
    console.log("project", project);
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when fetching business plan.`
      );
      return null;
    }
    logger.info(
      `Successfully fetched business plan for projectId: ${projectId}`
    );

    return project.analysisResultModel.businessPlan!;
  }

  async updateBusinessPlan(
    userId: string,
    itemId: string,
    data: Partial<
      Omit<ProjectModel, "id" | "projectId" | "createdAt" | "updatedAt">
    >
  ): Promise<BusinessPlanModel | null> {
    logger.info(
      `Attempting to update business plan for itemId: ${itemId}, userId: ${userId}`
    );
    try {
      const project = await this.projectRepository.findById(
        itemId,
        `users/${userId}/projects`
      );
      if (!project) {
        logger.warn(
          `Project not found with ID: ${itemId} for user: ${userId} when attempting to update business plan.`
        );
        return null;
      }

      const updatedProject = await this.projectRepository.update(
        itemId,
        data,
        userId
      );
      if (!updatedProject) {
        logger.warn(
          `Failed to update project or extract business plan for itemId: ${itemId}`
        );
        return null;
      }
      logger.info(`Successfully updated business plan for itemId: ${itemId}`);
      return updatedProject.analysisResultModel.businessPlan!;
    } catch (error: any) {
      logger.error(
        `Error updating business plan for itemId ${itemId}: ${error.message}`,
        { stack: error.stack, userId }
      );
      throw error; // Or return null depending on desired error handling
    }
  }

  async deleteBusinessPlan(userId: string, itemId: string): Promise<void> {
    logger.info(
      `Attempting to delete business plan for itemId: ${itemId}, userId: ${userId}`
    );
    try {
      const project = await this.projectRepository.findById(
        itemId,
        `users/${userId}/projects`
      );
      if (!project) {
        logger.warn(
          `Project not found with ID: ${itemId} for user: ${userId} when attempting to delete business plan.`
        );
        return;
      }
      project.analysisResultModel.businessPlan = undefined;
      await this.projectRepository.update(itemId, project, userId);
      logger.info(`Successfully deleted business plan for itemId: ${itemId}`);
    } catch (error: any) {
      logger.error(
        `Error deleting business plan for itemId ${itemId}: ${error.message}`,
        { stack: error.stack, userId }
      );
      throw error; // Or return depending on desired error handling
    }
  }

  /**
   * Génère un PDF à partir des sections de business plan d'un projet
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @returns Chemin vers le fichier PDF temporaire généré
   */
  async generateBusinessPlanPdf(
    userId: string,
    projectId: string
  ): Promise<string> {
    logger.info(
      `Generating PDF for business plan sections - projectId: ${projectId}, userId: ${userId}`
    );
    // Récupérer le projet et ses données de business plan
    const project = await this.projectRepository.findById(
      projectId,
      `users/${userId}/projects`
    );

    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when generating business plan PDF.`
      );
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const businessPlan = project.analysisResultModel.businessPlan;
    if (
      !businessPlan ||
      !businessPlan.sections ||
      businessPlan.sections.length === 0
    ) {
      logger.warn(
        `No business plan sections found for project ${projectId} when generating PDF.`
      );
      return "";
    }

    // Generate cache key for PDF
    const pdfCacheKey = cacheService.generateAIKey(
      "business-plan-pdf",
      userId,
      projectId
    );

    // Check if PDF is already cached
    const cachedPdfPath = await cacheService.get<string>(pdfCacheKey, {
      prefix: "pdf",
      ttl: 3600, // 1 hour
    });

    if (cachedPdfPath) {
      logger.info(`Business plan PDF cache hit for projectId: ${projectId}`);
      return cachedPdfPath;
    }

    logger.info(
      `Business plan PDF cache miss, generating new PDF for projectId: ${projectId}`
    );

    // Utiliser le PdfService pour générer le PDF
    const pdfPath = await this.pdfService.generatePdf({
      title: "Business Plan",
      projectName: project.name || "Projet Sans Nom",
      projectDescription: project.description || "",
      sections: businessPlan.sections,
      sectionDisplayOrder: [
        "Cover Page",
        "Company Summary",
        "Opportunity",
        "Target Audience",
        "Products Services",
        "Marketing Sales",
        "Financial Plan",
        "Goal Planning",
        "Appendix",
      ],
      footerText: "Generated by Idem",
    });

    // Cache the PDF path for future requests
    await cacheService.set(pdfCacheKey, pdfPath, {
      prefix: "pdf",
      ttl: 3600, // 1 hour
    });
    logger.info(`Business plan PDF cached for projectId: ${projectId}`);

    return pdfPath;
  }

  /**
   * Met à jour les informations additionnelles d'un projet avec upload des images des team members
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @param additionalInfos - Informations additionnelles de l'entreprise
   * @param teamMemberImages - Images des team members uploadées
   * @returns Projet mis à jour avec les informations additionnelles
   */
  async setAdditionalInfos(
    userId: string,
    projectId: string,
    additionalInfos: {
      email: string;
      phone?: string;
      address?: string;
      city?: string;
      country?: string;
      zipCode?: string;
      teamMembers: TeamMember[];
    },
    teamMemberImages?: Express.Multer.File[]
  ): Promise<{
    project: ProjectModel | null;
    uploadedImages?: { [memberIndex: number]: any };
  }> {
    logger.info(
      `Setting additional infos for userId: ${userId}, projectId: ${projectId}`,
      {
        additionalInfos: {
          email: additionalInfos.email,
          teamMembersCount: additionalInfos.teamMembers.length,
          hasImages: !!teamMemberImages && teamMemberImages.length > 0,
        },
      }
    );

    // Upload team member images if provided
    let uploadedImages: { [memberIndex: number]: any } = {};
    if (teamMemberImages && teamMemberImages.length > 0) {
      try {
        uploadedImages = await storageService.uploadTeamMemberImages(
          teamMemberImages,
          userId,
          projectId
        );
        logger.info(
          `Uploaded ${Object.keys(uploadedImages).length} team member images`
        );
      } catch (error: any) {
        logger.error(`Error uploading team member images: ${error.message}`, {
          stack: error.stack,
        });
        // Continue without images rather than fail completely
      }
    }

    // Update team members with uploaded image URLs
    const updatedTeamMembers = additionalInfos.teamMembers.map(
      (member, index) => ({
        ...member,
        pictureUrl: uploadedImages[index]?.downloadURL || member.pictureUrl,
      })
    );

    // Get current project to update with additional infos
    const project = await this.getProject(projectId, userId);
    if (!project) {
      logger.warn(`Project not found: ${projectId} for user: ${userId}`);
      return { project: null };
    }

    // Update project with additional informations only
    const updatedProject = {
      ...project,
      additionalInfos: {
        email: additionalInfos.email,
        phone: additionalInfos.phone || "",
        address: additionalInfos.address || "",
        city: additionalInfos.city || "",
        country: additionalInfos.country || "",
        zipCode: additionalInfos.zipCode || "",
        teamMembers: updatedTeamMembers,
      },
      updatedAt: new Date(), // Update timestamp
    };

    // Save updated project with additional infos
    const savedProject = await this.projectRepository.update(
      projectId,
      updatedProject,
      `users/${userId}/projects`
    );

    if (!savedProject) {
      logger.error(
        `Failed to update project with additional infos: ${projectId}`
      );
      return { project: null };
    }

    logger.info(
      `Additional infos updated successfully for project: ${projectId}`
    );

    return {
      project: savedProject,
      uploadedImages:
        Object.keys(uploadedImages).length > 0 ? uploadedImages : undefined,
    };
  }
}
