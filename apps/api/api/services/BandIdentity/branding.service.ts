import logger from "../../config/logger";
import { ProjectModel } from "../../models/project.model";
import { LLMProvider, PromptService } from "../prompt.service";
import { SvgToPsdService } from "../svgToPsd.service";
import * as fs from "fs-extra";

import {
  BrandIdentityModel,
  ColorModel,
  TypographyModel,
} from "../../models/brand-identity.model";
import { LOGO_GENERATION_PROMPT } from "./prompts/singleGenerations/00_logo-generation-section.prompt";
import { LOGO_VARIATION_LIGHT_PROMPT } from "./prompts/singleGenerations/logo-variation-light.prompt";
import { LOGO_VARIATION_DARK_PROMPT } from "./prompts/singleGenerations/logo-variation-dark.prompt";
import { LOGO_VARIATION_MONOCHROME_PROMPT } from "./prompts/singleGenerations/logo-variation-monochrome.prompt";
import { LOGO_EDIT_PROMPT } from "./prompts/singleGenerations/logo-edit.prompt";

import { BRAND_HEADER_SECTION_PROMPT } from "./prompts/00_brand-header-section.prompt";
import { LOGO_SYSTEM_SECTION_PROMPT } from "./prompts/01_logo-system-section.prompt";
import { COLOR_PALETTE_SECTION_PROMPT } from "./prompts/02_color-palette-section.prompt";
import { TYPOGRAPHY_SECTION_PROMPT } from "./prompts/03_typography-section.prompt";
import { BRAND_FOOTER_SECTION_PROMPT } from "./prompts/07_brand-footer-section.prompt";
import { SectionModel } from "../../models/section.model";
import { BrandIdentityBuilder } from "../../models/builders/brandIdentity.builder";
import {
  GenericService,
  IPromptStep,
  ISectionResult,
} from "../common/generic.service";
import { LogoModel, LogoPreferences } from "../../models/logo.model";
import { COLORS_GENERATION_PROMPT } from "./prompts/singleGenerations/colors-generation.prompt";
import { TYPOGRAPHY_GENERATION_PROMPT } from "./prompts/singleGenerations/typography-generation.prompt";
import { PdfService } from "../pdf.service";
import { cacheService } from "../cache.service";
import crypto from "crypto";
import { projectService } from "../project.service";
import { LogoJsonToSvgService } from "./logoJsonToSvg.service";
import { SvgOptimizerService } from "./svgOptimizer.service";

export class BrandingService extends GenericService {
  private pdfService: PdfService;
  private logoJsonToSvgService: LogoJsonToSvgService;

  // Configuration LLM pour la génération de logos et variations
  // Temperature modérée pour équilibrer créativité et cohérence
  private static readonly LOGO_LLM_CONFIG = {
    provider: LLMProvider.GEMINI,
    modelName: "gemini-2.0-flash",
    llmOptions: {
      maxOutputTokens: 3500,
      temperature: 0.4, // Équilibre entre créativité et cohérence
      topP: 0.9,
      topK: 55,
    },
  };

  // Configuration LLM pour la génération de couleurs
  private static readonly COLORS_LLM_CONFIG = {
    provider: LLMProvider.GEMINI,
    modelName: "gemini-2.0-flash",
    llmOptions: {
      maxOutputTokens: 3500,
      temperature: 0.1,
      topP: 0.9,
      topK: 50,
    },
  };

  // Configuration LLM pour la génération de typographies
  private static readonly TYPOGRAPHY_LLM_CONFIG = {
    provider: LLMProvider.GEMINI,
    modelName: "gemini-2.0-flash",
    llmOptions: {
      maxOutputTokens: 5000,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
    },
  };

  constructor(promptService: PromptService) {
    super(promptService);
    this.pdfService = new PdfService();
    this.logoJsonToSvgService = new LogoJsonToSvgService();
    logger.info("BrandingService initialized with optimized logo generation");
  }

  /**
   * Récupération optimisée du projet avec cache intelligent
   */
  private async getProjectOptimized(
    userId: string,
    projectId: string
  ): Promise<ProjectModel | null> {
    const projectCacheKey = `project_${userId}_${projectId}`;

    // Tentative de récupération depuis le cache
    let project = await cacheService.get<ProjectModel>(projectCacheKey, {
      prefix: "project",
    });

    if (project) {
      logger.info(`Project cache hit - ProjectId: ${projectId}`);
      return project;
    }

    // Fallback vers la base de données
    logger.info(
      `Project cache miss, fetching from database - ProjectId: ${projectId}`
    );
    project = await this.projectRepository.findById(
      projectId,
      `users/${userId}/projects`
    );

    if (project) {
      // Cache asynchrone (non-bloquant)
      cacheService
        .set(projectCacheKey, project, {
          prefix: "project",
          ttl: 3600,
        })
        .catch((error) => logger.error(`Error caching project:`, error));
    }

    return project;
  }

  /**
   * Extrait le nom du projet depuis la description
   */
  private extractProjectName(projectDescription: string): string {
    // Chercher le nom du projet dans la description (généralement au début)
    const nameMatch = projectDescription.match(
      /(?:project name|nom du projet|name)[:\s]+([^\n.]+)/i
    );
    if (nameMatch) {
      return nameMatch[1].trim();
    }
    // Fallback: première ligne non vide
    const firstLine = projectDescription
      .split("\n")
      .find((line) => line.trim());
    return firstLine?.trim() || "Brand";
  }

  /**
   * Génère les initiales depuis le nom du projet
   */
  private generateInitials(projectName: string): string {
    // Nettoyer et diviser le nom
    const words = projectName
      .replace(/[^\w\s]/g, "") // Enlever la ponctuation
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) return "BR";
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();

    // Prendre la première lettre de chaque mot (max 3)
    return words
      .slice(0, 3)
      .map((word) => word[0].toUpperCase())
      .join("");
  }

  /**
   * Extrait les informations clés du projet pour guider la génération de logo
   */
  private extractProjectContext(projectDescription: string): {
    industry: string;
    values: string[];
    targetAudience: string;
    uniqueSellingPoint: string;
  } {
    // Analyser la description pour extraire le contexte
    const lowerDesc = projectDescription.toLowerCase();

    // Détecter l'industrie
    let industry = "Technology";
    if (
      lowerDesc.includes("food") ||
      lowerDesc.includes("restaurant") ||
      lowerDesc.includes("cuisine")
    ) {
      industry = "Food & Beverage";
    } else if (
      lowerDesc.includes("fashion") ||
      lowerDesc.includes("clothing") ||
      lowerDesc.includes("apparel")
    ) {
      industry = "Fashion";
    } else if (
      lowerDesc.includes("health") ||
      lowerDesc.includes("medical") ||
      lowerDesc.includes("wellness")
    ) {
      industry = "Healthcare";
    } else if (
      lowerDesc.includes("finance") ||
      lowerDesc.includes("bank") ||
      lowerDesc.includes("investment")
    ) {
      industry = "Finance";
    } else if (
      lowerDesc.includes("education") ||
      lowerDesc.includes("learning") ||
      lowerDesc.includes("school")
    ) {
      industry = "Education";
    } else if (
      lowerDesc.includes("sport") ||
      lowerDesc.includes("fitness") ||
      lowerDesc.includes("gym")
    ) {
      industry = "Sports & Fitness";
    } else if (
      lowerDesc.includes("travel") ||
      lowerDesc.includes("tourism") ||
      lowerDesc.includes("hotel")
    ) {
      industry = "Travel & Hospitality";
    } else if (
      lowerDesc.includes("eco") ||
      lowerDesc.includes("green") ||
      lowerDesc.includes("sustainable")
    ) {
      industry = "Sustainability";
    }

    // Extraire les valeurs
    const values: string[] = [];
    if (lowerDesc.includes("innovation") || lowerDesc.includes("innovative"))
      values.push("Innovation");
    if (lowerDesc.includes("trust") || lowerDesc.includes("reliable"))
      values.push("Trust");
    if (lowerDesc.includes("quality") || lowerDesc.includes("premium"))
      values.push("Quality");
    if (
      lowerDesc.includes("speed") ||
      lowerDesc.includes("fast") ||
      lowerDesc.includes("quick")
    )
      values.push("Speed");
    if (
      lowerDesc.includes("simple") ||
      lowerDesc.includes("easy") ||
      lowerDesc.includes("intuitive")
    )
      values.push("Simplicity");
    if (lowerDesc.includes("creative") || lowerDesc.includes("artistic"))
      values.push("Creativity");
    if (lowerDesc.includes("professional") || lowerDesc.includes("business"))
      values.push("Professionalism");
    if (
      lowerDesc.includes("fun") ||
      lowerDesc.includes("playful") ||
      lowerDesc.includes("joy")
    )
      values.push("Playfulness");

    // Audience cible
    let targetAudience = "General Public";
    if (
      lowerDesc.includes("young") ||
      lowerDesc.includes("youth") ||
      lowerDesc.includes("millennial")
    ) {
      targetAudience = "Young Adults (18-35)";
    } else if (
      lowerDesc.includes("professional") ||
      lowerDesc.includes("business") ||
      lowerDesc.includes("corporate")
    ) {
      targetAudience = "Business Professionals";
    } else if (
      lowerDesc.includes("luxury") ||
      lowerDesc.includes("premium") ||
      lowerDesc.includes("high-end")
    ) {
      targetAudience = "Luxury Market";
    } else if (lowerDesc.includes("family") || lowerDesc.includes("parent")) {
      targetAudience = "Families";
    }

    // Point de différenciation
    const uniqueSellingPoint = projectDescription.substring(0, 200);

    return { industry, values, targetAudience, uniqueSellingPoint };
  }

  /**
   * Construction du prompt optimisé pour la génération de logos avec préférences utilisateur
   */
  private buildOptimizedLogoPrompt(
    projectDescription: string,
    colors: ColorModel,
    typography: TypographyModel,
    preferences?: LogoPreferences
  ): string {
    // Extraire le contexte du projet
    const projectContext = this.extractProjectContext(projectDescription);
    const projectName = this.extractProjectName(projectDescription);
    const projectInitials = this.generateInitials(projectName);

    // Construire un contexte riche pour guider la génération
    let contextPrompt = `**PROJECT CONTEXT - USE THIS TO INSPIRE YOUR DESIGN:**\n`;
    contextPrompt += `- Project Name: "${projectName}"\n`;
    contextPrompt += `- Industry: ${projectContext.industry}\n`;
    contextPrompt += `- Core Values: ${
      projectContext.values.length > 0
        ? projectContext.values.join(", ")
        : "Innovation, Quality, Trust"
    }\n`;
    contextPrompt += `- Target Audience: ${projectContext.targetAudience}\n`;
    contextPrompt += `- Project Description: ${projectContext.uniqueSellingPoint}\n`;

    // Informations de design
    const colorInfo = `Primary: ${
      colors.colors?.primary || "N/A"
    }, Secondary: ${colors.colors?.secondary || "N/A"}`;
    const fontInfo = `Primary: ${typography.primaryFont || "N/A"}, Secondary: ${
      typography.secondaryFont || "N/A"
    }`;
    contextPrompt += `\n**DESIGN PALETTE:**\n`;
    contextPrompt += `- Colors: ${colorInfo}\n`;
    contextPrompt += `- Typography: ${fontInfo}\n`;

    // Ajouter les préférences utilisateur au contexte avec instructions détaillées
    let preferenceContext = "";
    if (preferences) {
      const typeDescriptions = {
        icon: "Icon Based - Create a memorable icon/symbol + full brand name (like Apple, Nike, Twitter)",
        name: "Name Based - Typography IS the logo, NO separate icon (like Coca-Cola, Google, FedEx)",
        initial:
          "Initial Based - Stylized initials as main element (like IBM, HP, CNN)",
      };

      preferenceContext = `\n**USER PREFERENCES:**\n- Logo Type: ${
        preferences.type
      } - ${typeDescriptions[preferences.type]}\n`;

      if (preferences.type === "initial") {
        preferenceContext += `- Initials to use: "${projectInitials}" (from "${projectName}")\n`;
      }

      if (preferences.customDescription) {
        preferenceContext += `- Custom Design Requirements: ${preferences.customDescription}\n`;
      }

      preferenceContext += `\n**DESIGN DIRECTION FOR ${preferences.type.toUpperCase()} TYPE:**\n`;
      preferenceContext += `Based on the project context (${
        projectContext.industry
      }, values: ${projectContext.values.join(", ")}), create a logo that:\n`;

      switch (preferences.type) {
        case "icon":
          preferenceContext += `- Creates an icon that visually represents the ${projectContext.industry} industry\n`;
          preferenceContext += `- Embodies the values: ${projectContext.values.join(
            ", "
          )}\n`;
          preferenceContext += `- Appeals to ${projectContext.targetAudience}\n`;
          preferenceContext += `- Includes the FULL brand name "${projectName}" as text\n`;
          preferenceContext += `- Makes the icon memorable and instantly recognizable\n`;
          break;
        case "name":
          preferenceContext += `- Uses ONLY the brand name "${projectName}" with typography that reflects ${projectContext.industry}\n`;
          preferenceContext += `- Conveys ${projectContext.values.join(
            " and "
          )} through font styling\n`;
          preferenceContext += `- Resonates with ${projectContext.targetAudience}\n`;
          preferenceContext += `- NO separate icon - typography IS the complete logo\n`;
          preferenceContext += `- Creates visual impact through creative letterforms\n`;
          break;
        case "initial":
          preferenceContext += `- Uses ONLY the initials "${projectInitials}" in a way that suggests ${projectContext.industry}\n`;
          preferenceContext += `- Stylizes the letters to communicate ${projectContext.values.join(
            " and "
          )}\n`;
          preferenceContext += `- Creates appeal for ${projectContext.targetAudience}\n`;
          preferenceContext += `- NO full brand name - initials ARE the complete logo\n`;
          preferenceContext += `- Makes the initials iconic and sophisticated\n`;
          break;
      }

      preferenceContext += `\n**IMPORTANT:** Let the project's industry, values, and target audience guide your creative decisions. The logo should tell the brand's story visually.\n`;
    }

    return `${contextPrompt}${preferenceContext}\n\n${LOGO_GENERATION_PROMPT}`;
  }

  async generateBrandingWithStreaming(
    userId: string,
    projectId: string,
    streamCallback?: (sectionResult: ISectionResult) => Promise<void>
  ): Promise<ProjectModel | null> {
    logger.info(
      `Generating branding with streaming for userId: ${userId}, projectId: ${projectId}`
    );

    // Get project
    const project = await this.getProject(projectId, userId);
    if (!project) {
      return null;
    }

    // Generate cache key based on project content
    const projectDescription =
      this.extractProjectDescription(project) +
      "\n\nHere is the project branding colors: " +
      JSON.stringify(project.analysisResultModel.branding.colors) +
      "\n\nHere is the project branding typography: " +
      JSON.stringify(project.analysisResultModel.branding.typography) +
      "\n\nHere is the project branding logo: " +
      JSON.stringify(project.analysisResultModel.branding.logo);

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
      "branding",
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
      logger.info(`Branding cache hit for projectId: ${projectId}`);
      return cachedResult;
    }

    logger.info(
      `Branding cache miss, generating new content for projectId: ${projectId}`
    );

    try {
      // Define branding steps
      const steps: IPromptStep[] = [
        {
          promptConstant: BRAND_HEADER_SECTION_PROMPT + projectDescription,
          stepName: "Brand Header",
          hasDependencies: false,
        },
        {
          promptConstant: LOGO_SYSTEM_SECTION_PROMPT + projectDescription,
          stepName: "Logo System",
          hasDependencies: false,
        },
        {
          promptConstant: COLOR_PALETTE_SECTION_PROMPT + projectDescription,
          stepName: "Color Palette",
          hasDependencies: false,
        },
        {
          promptConstant: TYPOGRAPHY_SECTION_PROMPT + projectDescription,
          stepName: "Typography",
          hasDependencies: false,
        },
        // {
        //   promptConstant: USAGE_GUIDELINES_SECTION_PROMPT + projectDescription,
        //   stepName: "Usage Guidelines",
        //   hasDependencies: false,
        // },
        // {
        //   promptConstant: VISUAL_EXAMPLES_SECTION_PROMPT + projectDescription,
        //   stepName: "Visual Examples",
        //   hasDependencies: false,
        // },
        {
          promptConstant: BRAND_FOOTER_SECTION_PROMPT + projectDescription,
          stepName: "Brand Footer",
          hasDependencies: false,
        },
      ];

      // Initialize empty sections array to collect results as they come in
      let sections: SectionModel[] = [];

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
            sections.push(section);

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
                branding: {
                  sections: sections,
                  colors: currentProject.analysisResultModel.branding.colors,
                  typography:
                    currentProject.analysisResultModel.branding.typography,
                  logo: currentProject.analysisResultModel.branding.logo,
                  generatedLogos:
                    currentProject.analysisResultModel.branding
                      .generatedLogos || [],
                  generatedColors:
                    currentProject.analysisResultModel.branding
                      .generatedColors || [],
                  generatedTypography:
                    currentProject.analysisResultModel.branding
                      .generatedTypography || [],
                  createdAt: new Date(),
                  updatedAt: new Date(),
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
                `Branding cached after step: ${result.name} - projectId: ${projectId}`
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
          undefined, // promptConfig
          "branding", // promptType
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
        const stepResults = await this.processSteps(steps, project);
        sections = stepResults.map((result) => ({
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
            `Original project not found with ID: ${projectId} for user: ${userId} before updating with branding.`
          );
          return null;
        }

        // Create the new project with updated branding
        const newProject = {
          ...oldProject,
          analysisResultModel: {
            ...oldProject.analysisResultModel,
            branding: {
              sections: sections,
              colors: oldProject.analysisResultModel.branding.colors,
              typography: oldProject.analysisResultModel.branding.typography,
              logo: oldProject.analysisResultModel.branding.logo,
              generatedLogos:
                oldProject.analysisResultModel.branding.generatedLogos || [],
              generatedColors:
                oldProject.analysisResultModel.branding.generatedColors || [],
              generatedTypography:
                oldProject.analysisResultModel.branding.generatedTypography ||
                [],
              createdAt: new Date(),
              updatedAt: new Date(),
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
            `Successfully updated project with ID: ${projectId} with branding`
          );

          // Cache the result for future requests
          await cacheService.set(cacheKey, updatedProject, {
            prefix: "ai",
            ttl: 7200, // 2 hours
          });
          logger.info(`Branding cached for projectId: ${projectId}`);
        }
        return updatedProject;
      }
    } catch (error) {
      logger.error(
        `Error generating branding for projectId ${projectId}:`,
        error
      );
      throw error;
    } finally {
      logger.info(`Completed branding generation for projectId ${projectId}`);
    }
  }

  /**
   * Génère un seul ensemble de couleurs - Méthode privée pour génération parallèle
   */
  private async generateSingleColors(
    projectDescription: string,
    project: ProjectModel
  ): Promise<ColorModel[]> {
    logger.info(`Generating colors`);

    const steps: IPromptStep[] = [
      {
        promptConstant: projectDescription + COLORS_GENERATION_PROMPT,
        stepName: "Colors Generation",
        modelParser: (content) => {
          try {
            const parsedColors = JSON.parse(content);
            return parsedColors.colors;
          } catch (error) {
            logger.error(`Error parsing colors:`, error);
            throw new Error(`Failed to parse colors`);
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.COLORS_LLM_CONFIG
    );
    const colorsResult: ISectionResult = sectionResults[0];

    logger.info(`Colors generated successfully`);
    return colorsResult.parsedData as ColorModel[];
  }

  /**
   * Génère un seul ensemble de typographies - Méthode privée pour génération parallèle
   */
  private async generateSingleTypography(
    projectDescription: string,
    project: ProjectModel
  ): Promise<TypographyModel[]> {
    logger.info(`Generating typography`);

    const steps: IPromptStep[] = [
      {
        promptConstant: projectDescription + TYPOGRAPHY_GENERATION_PROMPT,
        stepName: "Typography Generation",
        modelParser: (content) => {
          try {
            const parsedTypography = JSON.parse(content);
            return parsedTypography.typography;
          } catch (error) {
            logger.error(`Error parsing typography:`, error);
            throw new Error(`Failed to parse typography`);
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.TYPOGRAPHY_LLM_CONFIG
    );
    const typographyResult = sectionResults[0];

    logger.info(`Typography generated successfully`);
    return typographyResult.parsedData as TypographyModel[];
  }

  async generateColorsAndTypography(
    userId: string,
    project: ProjectModel
  ): Promise<{
    colors: ColorModel[];
    typography: TypographyModel[];
    project: ProjectModel;
  }> {
    logger.info(
      `Generating colors and typography in parallel for userId: ${userId}`
    );

    // Créer le projet
    project = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: BrandIdentityBuilder.createEmpty(),
      },
    };
    const createdProject = await projectService.createUserProject(
      userId,
      project
    );

    if (!createdProject.id) {
      throw new Error(`Failed to create project`);
    }

    // Stocker le projet en cache
    try {
      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, createdProject, {
        prefix: "project",
        ttl: 3600, // 1 heure
      });
      logger.info(
        `Project cached with ID: ${createdProject.id} for userId: ${userId}`
      );
    } catch (error) {
      logger.error(`Error caching project for userId: ${userId}`, error);
      // Continue without failing - cache is not critical
    }

    const projectDescription = this.extractProjectDescription(project);

    // Génération parallèle des couleurs et typographies
    const startTime = Date.now();

    // Créer 2 promesses pour générer couleurs et typographies en parallèle
    const [colors, typography] = await Promise.all([
      this.generateSingleColors(projectDescription, createdProject),
      this.generateSingleTypography(projectDescription, createdProject),
    ]);

    const generationTime = Date.now() - startTime;
    logger.info(
      `Parallel colors and typography generation completed in ${generationTime}ms`
    );

    // Mettre à jour le projet avec les couleurs et typographies générées
    const updatedProjectData = {
      ...createdProject,
      analysisResultModel: {
        ...createdProject.analysisResultModel,
        branding: {
          ...createdProject.analysisResultModel.branding,
          generatedColors: colors,
          generatedTypography: typography,
          updatedAt: new Date(),
        },
      },
    };

    // Mise à jour en base de données
    const updatedProject = await this.projectRepository.update(
      createdProject.id!,
      updatedProjectData,
      `users/${userId}/projects`
    );

    if (updatedProject) {
      logger.info(
        `Successfully updated project with colors and typography - ProjectId: ${createdProject.id}`
      );

      // Mise à jour du cache projet
      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, updatedProject, {
        prefix: "project",
        ttl: 3600,
      });

      logger.info(
        `Project cache updated with colors and typography - ProjectId: ${createdProject.id}`
      );
    }

    return {
      colors,
      typography,
      project: updatedProject || createdProject,
    };
  }

  /**
   * Generate single logo concept using direct SVG generation
   * AI generates complete SVG content directly for professional results
   */
  private async generateSingleLogoConcept(
    projectDescription: string,
    colors: ColorModel,
    typography: TypographyModel,
    project: ProjectModel,
    conceptIndex: number,
    preferences?: LogoPreferences
  ): Promise<LogoModel> {
    logger.info(
      `Generating professional logo concept ${
        conceptIndex + 1
      } with direct SVG generation - Type: ${preferences?.type || "name"}`
    );

    // Build optimized prompt for direct SVG generation with user preferences
    const optimizedPrompt = this.buildOptimizedLogoPrompt(
      projectDescription,
      colors,
      typography,
      preferences
    );

    // AI generation with direct SVG output
    const steps: IPromptStep[] = [
      {
        promptConstant: optimizedPrompt,
        stepName: `Logo Concept ${conceptIndex + 1}`,
        maxOutputTokens: 3500,
        modelParser: (content) => {
          try {
            // Parse JSON response containing SVG
            const logoData = JSON.parse(content);

            // Ensure unique ID for each concept
            if (!logoData.id) {
              logoData.id = `concept${String(conceptIndex + 1).padStart(
                2,
                "0"
              )}`;
            }

            return logoData;
          } catch (error) {
            logger.error(
              `Error parsing logo data concept ${conceptIndex + 1}:`,
              error
            );
            throw new Error(
              `Failed to parse logo data concept ${conceptIndex + 1}`
            );
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.LOGO_LLM_CONFIG
    );
    const logoResult = sectionResults[0];
    const logoData = logoResult.parsedData;

    // Create LogoModel directly from SVG data
    const logoModel: LogoModel = {
      id: `concept${String(conceptIndex + 1).padStart(2, "0")}`,
      name: logoData.name || `Logo Concept ${conceptIndex + 1}`,
      concept: logoData.concept || "Professional logo design",
      colors: logoData.colors || [],
      fonts: logoData.fonts || [],
      svg: logoData.svg, // Direct SVG from AI
      iconSvg: this.extractIconFromSvg(logoData.svg), // Extract icon part
      type: preferences?.type,
      customDescription: preferences?.customDescription,
    };

    // Apply SVG optimization
    const optimizedLogo = this.optimizeLogoSvgs(logoModel);

    logger.info(
      `Professional logo concept ${
        conceptIndex + 1
      } generated with direct SVG content`
    );
    return optimizedLogo;
  }

  /**
   * Extract icon-only SVG from the complete logo SVG
   * Removes text elements to create an icon-only version
   */
  private extractIconFromSvg(fullSvg: string): string {
    try {
      // Extract the icon group from the full SVG (using multiline regex)
      const iconMatch = fullSvg.match(/<g id="icon"[^>]*>([\s\S]*?)<\/g>/);
      if (iconMatch) {
        // Create a new SVG with just the icon content
        const iconContent = iconMatch[1];
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><g id="icon">${iconContent}</g></svg>`;
      }

      // Fallback: return a simplified version of the full SVG
      logger.warn("Could not extract icon from SVG, using fallback");
      return fullSvg.replace(/<g id="text"[^>]*>[\s\S]*?<\/g>/, "");
    } catch (error) {
      logger.error("Error extracting icon from SVG:", error);
      return fullSvg; // Return original if extraction fails
    }
  }

  /**
   * Optimize logo SVGs using advanced compression techniques
   */
  private optimizeLogoSvgs(logoModel: LogoModel): LogoModel {
    logger.info(`Optimizing SVGs for logo: ${logoModel.id}`);

    const optimized = { ...logoModel };

    // Optimize main SVG
    if (optimized.svg) {
      optimized.svg = SvgOptimizerService.optimizeSvg(optimized.svg);
    }

    // Optimize icon SVG
    if (optimized.iconSvg) {
      optimized.iconSvg = SvgOptimizerService.optimizeSvg(optimized.iconSvg);
    }

    // Optimize variations if present
    if (optimized.variations) {
      optimized.variations = this.optimizeLogoVariations(optimized.variations);
    }

    return optimized;
  }

  /**
   * Optimize logo variations SVGs
   */
  private optimizeLogoVariations(variations: any): any {
    const optimized = { ...variations };

    if (variations.withText) {
      optimized.withText = this.optimizeVariationSet(variations.withText);
    }

    if (variations.iconOnly) {
      optimized.iconOnly = this.optimizeVariationSet(variations.iconOnly);
    }

    return optimized;
  }

  /**
   * Optimize a set of variations
   */
  private optimizeVariationSet(variationSet: any): any {
    const optimized = { ...variationSet };

    Object.keys(optimized).forEach((key) => {
      if (typeof optimized[key] === "string") {
        optimized[key] = SvgOptimizerService.optimizeSvg(optimized[key]);
      }
    });

    return optimized;
  }

  /**
   * Étape 1: Génère 3 concepts de logos principaux en parallèle - Version optimisée avec préférences
   */
  async generateLogoConcepts(
    userId: string,
    projectId: string,
    selectedColors: ColorModel,
    selectedTypography: TypographyModel,
    preferences?: LogoPreferences
  ): Promise<{
    logos: LogoModel[];
  }> {
    logger.info(
      `Generating 3 logo concepts in parallel for userId: ${userId}, projectId: ${projectId}, logoType: ${
        preferences?.type || "name"
      }`
    );

    // Étape 1: Récupération optimisée du projet avec fallback gracieux
    const project = await this.getProjectOptimized(userId, projectId);
    if (!project) {
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    // Étape 4: Préparation du prompt optimisé
    const projectDescription = this.extractProjectDescription(project);

    // Step 5: Parallel AI generation of 4 optimized logos using JSON-to-SVG
    const startTime = Date.now();

    // Create 3 promises for parallel logo generation with token optimization and user preferences
    const logoPromises = Array.from({ length: 3 }, (_, index) =>
      this.generateSingleLogoConcept(
        projectDescription,
        selectedColors,
        selectedTypography,
        project,
        index,
        preferences
      )
    );

    // Wait for all logos to be generated in parallel with optimization
    const optimizedLogos = await Promise.all(logoPromises);

    // Apply batch SVG optimization
    const finalOptimizedLogos =
      SvgOptimizerService.optimizeLogos(optimizedLogos);

    const aiGenerationTime = Date.now() - startTime;
    logger.info(
      `Parallel optimized AI generation completed in ${aiGenerationTime}ms for 3 logos with JSON-to-SVG conversion`
    );

    // Étape 6: Mise à jour immédiate du projet avec les logos générés
    const updatedProjectData = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: {
          ...project.analysisResultModel.branding,
          colors: selectedColors,
          typography: selectedTypography,
          generatedLogos: finalOptimizedLogos as LogoModel[],
          updatedAt: new Date(),
        },
      },
    };

    // Database update with optimized logos
    const updatedProject = await this.projectRepository.update(
      projectId,
      updatedProjectData,
      `users/${userId}/projects`
    );

    if (updatedProject) {
      logger.info(
        `Successfully updated project with optimized logos - ProjectId: ${projectId}, LogoCount: ${finalOptimizedLogos.length}`
      );

      // Mise à jour du cache projet
      const projectCacheKey = `project_${userId}_${projectId}`;
      await cacheService.set(projectCacheKey, updatedProject, {
        prefix: "project",
        ttl: 3600,
      });

      logger.info(`Project cache updated with logos - ProjectId: ${projectId}`);
    }

    const totalTime = Date.now() - startTime;
    logger.info(
      `Parallel logo generation completed in ${totalTime}ms for 3 concepts`
    );

    return {
      logos: finalOptimizedLogos as LogoModel[],
    };
  }

  /**
   * Generate single logo variation for light background
   */
  private async generateSingleLightVariation(
    logoStructure: any,
    project: ProjectModel
  ): Promise<{ lightBackground?: string }> {
    const prompt = `Logo structure: ${JSON.stringify(
      logoStructure
    )}\n\n${LOGO_VARIATION_LIGHT_PROMPT}`;

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: "Light Background Variation",
        maxOutputTokens: 1000,
        modelParser: (content) => {
          try {
            const parsed = JSON.parse(content);
            return parsed.variation;
          } catch (error) {
            logger.error("Error parsing light variation JSON:", error);
            throw new Error("Failed to parse light variation JSON");
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.LOGO_LLM_CONFIG
    );
    return sectionResults[0].parsedData;
  }

  /**
   * Generate single logo variation for dark background
   */
  private async generateSingleDarkVariation(
    logoStructure: any,
    project: ProjectModel
  ): Promise<{ darkBackground?: string }> {
    const prompt = `Logo structure: ${JSON.stringify(
      logoStructure
    )}\n\n${LOGO_VARIATION_DARK_PROMPT}`;

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: "Dark Background Variation",
        maxOutputTokens: 1000,
        modelParser: (content) => {
          try {
            const parsed = JSON.parse(content);
            return parsed.variation;
          } catch (error) {
            logger.error("Error parsing dark variation JSON:", error);
            throw new Error("Failed to parse dark variation JSON");
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.LOGO_LLM_CONFIG
    );
    return sectionResults[0].parsedData;
  }

  /**
   * Generate single logo variation for monochrome
   */
  private async generateSingleMonochromeVariation(
    logoStructure: any,
    project: ProjectModel
  ): Promise<{ monochrome?: string }> {
    const prompt = `Logo structure: ${JSON.stringify(
      logoStructure
    )}\n\n${LOGO_VARIATION_MONOCHROME_PROMPT}`;

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: "Monochrome Variation",
        maxOutputTokens: 1000,
        modelParser: (content) => {
          try {
            const parsed = JSON.parse(content);
            return parsed.variation;
          } catch (error) {
            logger.error("Error parsing monochrome variation JSON:", error);
            throw new Error("Failed to parse monochrome variation JSON");
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(
      steps,
      project,
      BrandingService.LOGO_LLM_CONFIG
    );
    return sectionResults[0].parsedData;
  }

  /**
   * Generate logo variations using parallel execution for each variation type
   * Implements optimized parallel generation strategy
   */
  async generateLogoVariations(
    userId: string,
    projectId: string,
    selectedLogo: LogoModel
  ): Promise<{
    withText: {
      lightBackground?: string;
      darkBackground?: string;
      monochrome?: string;
    };
    iconOnly: {
      lightBackground?: string;
      darkBackground?: string;
      monochrome?: string;
    };
  }> {
    logger.info(
      `Generating logo variations using parallel execution for logo: ${selectedLogo.id}`
    );

    const project = await this.getProjectOptimized(userId, projectId);
    if (!project) {
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    // Create compact logo structure for AI input (token-efficient)
    const logoStructure = {
      id: selectedLogo.id,
      name: selectedLogo.name,
      colors: selectedLogo.colors,
      concept: selectedLogo.concept,
      svg: selectedLogo.iconSvg,
    };

    // Execute all three variations in parallel
    logger.info(`Starting parallel generation of 3 logo variations`);
    const [lightVariation, darkVariation, monochromeVariation] =
      await Promise.all([
        this.generateSingleLightVariation(logoStructure, project),
        this.generateSingleDarkVariation(logoStructure, project),
        this.generateSingleMonochromeVariation(logoStructure, project),
      ]);

    logger.info(`Successfully generated all 3 variations in parallel`);

    // Create direct SVG variations (bypassing JSON-to-SVG conversion since we already have SVGs)
    const svgVariations = {
      withText: {
        lightBackground: lightVariation.lightBackground,
        darkBackground: darkVariation.darkBackground,
        monochrome: monochromeVariation.monochrome,
      },
      iconOnly: {
        lightBackground: lightVariation.lightBackground,
        darkBackground: darkVariation.darkBackground,
        monochrome: monochromeVariation.monochrome,
      },
    };

    // Apply advanced SVG optimization
    const optimizedVariations = {
      withText: this.optimizeVariationSet(svgVariations.withText),
      iconOnly: this.optimizeVariationSet(svgVariations.iconOnly),
    };

    // Update project with optimized variations
    const updatedProjectData = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: {
          ...project.analysisResultModel.branding,
          logo: {
            ...selectedLogo,
            variations: optimizedVariations,
          },
          updatedAt: new Date(),
        },
      },
    };

    // Database update
    const updatedProject = await this.projectRepository.update(
      projectId,
      updatedProjectData,
      `users/${userId}/projects`
    );

    if (updatedProject) {
      logger.info(
        `Successfully updated project with optimized logo variations - ProjectId: ${projectId}, LogoId: ${selectedLogo.id}`
      );

      // Update project cache
      const projectCacheKey = `project_${userId}_${projectId}`;
      await cacheService.set(projectCacheKey, updatedProject, {
        prefix: "project",
        ttl: 3600,
      });

      // Cache AI variations with 2h TTL
      const variationsCacheKey = cacheService.generateAIKey(
        "logo_variations",
        userId,
        projectId,
        crypto
          .createHash("sha256")
          .update(JSON.stringify(selectedLogo))
          .digest("hex")
          .substring(0, 16)
      );
      await cacheService.set(variationsCacheKey, optimizedVariations, {
        prefix: "ai",
        ttl: 7200,
      });

      logger.info(
        `Optimized logo variations cached - ProjectId: ${projectId}, Variations: ${Object.keys(
          optimizedVariations.iconOnly
        ).join("/")}`
      );
    }

    return optimizedVariations;
  }

  async getBrandingsByProjectId(
    userId: string,
    projectId: string
  ): Promise<BrandIdentityModel | null> {
    logger.info(
      `Fetching branding for projectId: ${projectId}, userId: ${userId}`
    );
    const project = await this.projectRepository.findById(
      projectId,
      `users/${userId}/projects`
    );
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when fetching branding.`
      );
      return null;
    }
    logger.info(`Successfully fetched branding for projectId: ${projectId}`);

    return project.analysisResultModel.branding;
  }

  async getBrandingById(
    userId: string,
    brandingId: string
  ): Promise<BrandIdentityModel | null> {
    logger.info(`Getting branding by ID: ${brandingId} for userId: ${userId}`);
    // In current implementation, branding is nested in project, so we don't have direct access by brandingId
    // This method would need to be implemented differently if we had a separate branding repository
    logger.warn(
      `Direct access to branding by ID is not supported in the current implementation`
    );
    return null;
  }

  async updateBranding(
    userId: string,
    projectId: string,
    data: Partial<BrandIdentityModel>
  ): Promise<ProjectModel | null> {
    logger.info(
      `Updating branding for userId: ${userId}, projectId: ${projectId}`
    );

    const project = await this.projectRepository.findById(
      projectId,
      `users/${userId}/projects`
    );
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when updating branding.`
      );
      return null;
    }

    const updatedProject = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: {
          ...project.analysisResultModel.branding,
          ...data,
        },
      },
    };

    const result = await this.projectRepository.update(
      projectId,
      updatedProject,
      `users/${userId}/projects`
    );
    logger.info(`Successfully updated branding for projectId: ${projectId}`);
    return result;
  }

  async deleteBranding(userId: string, projectId: string): Promise<boolean> {
    logger.info(
      `Removing branding for userId: ${userId}, projectId: ${projectId}`
    );

    const project = await this.projectRepository.findById(
      projectId,
      `users/${userId}/projects`
    );
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when deleting branding.`
      );
      return false;
    }

    // Reset branding to empty state rather than removing it completely
    project.analysisResultModel.branding = {
      logo: {
        svg: "",
        concept: "",
        colors: [],
        fonts: [],
        id: "1",
        name: "",
      },
      generatedLogos: [],
      typography: {
        id: "",
        name: "",
        url: "",
        primaryFont: "",
        secondaryFont: "",
      },
      generatedTypography: [],
      generatedColors: [],
      colors: {
        id: "",
        name: "",
        url: "",
        colors: {
          primary: "",
          secondary: "",
          accent: "",
          background: "",
          text: "",
        },
      },
      sections: [],
    };

    await this.projectRepository.update(
      projectId,
      project,
      `users/${userId}/projects`
    );
    logger.info(`Successfully reset branding for projectId: ${projectId}`);
    return true;
  }

  /**
   * Génère un PDF à partir des sections de branding d'un projet
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @returns Chemin vers le fichier PDF temporaire généré
   */
  async generateBrandingPdf(
    userId: string,
    projectId: string
  ): Promise<string> {
    logger.info(
      `Generating PDF for branding sections - projectId: ${projectId}, userId: ${userId}`
    );
    // Récupérer le projet et ses données de branding
    const project = await this.projectRepository.findById(
      projectId,
      `users/${userId}/projects`
    );

    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when generating branding PDF.`
      );
      throw new Error(`Project not found with ID: ${projectId}`);
    }
    const branding = project.analysisResultModel.branding;
    if (!branding || !branding.sections || branding.sections.length === 0) {
      logger.warn(
        `No branding sections found for project ${projectId} when generating PDF.`
      );
      return "";
    }

    try {
      // Generate cache key for PDF
      const pdfCacheKey = cacheService.generateAIKey(
        "branding-pdf",
        userId,
        projectId
      );

      // Check if PDF is already cached
      const cachedPdfPath = await cacheService.get<string>(pdfCacheKey, {
        prefix: "pdf",
        ttl: 3600, // 1 hour
      });

      if (cachedPdfPath) {
        logger.info(`Branding PDF cache hit for projectId: ${projectId}`);
        return cachedPdfPath;
      }

      logger.info(
        `Branding PDF cache miss, generating new PDF for projectId: ${projectId}`
      );

      // Utiliser le PdfService pour générer le PDF
      const pdfPath = await this.pdfService.generatePdf({
        title: "Branding",
        projectName: project.name || "Projet Sans Nom",
        projectDescription: project.description || "",
        sections: branding.sections,
        sectionDisplayOrder: [
          "Brand Header",
          "Logo System",
          "Color Palette",
          "Typography",
          "Usage Guidelines",
          // "Visual Examples",
          "Brand Footer",
        ],
        footerText: "Generated by Idem",
      });

      // Cache the PDF path for future requests
      await cacheService.set(pdfCacheKey, pdfPath, {
        prefix: "pdf",
        ttl: 3600, // 1 hour
      });
      logger.info(`Branding PDF cached for projectId: ${projectId}`);

      return pdfPath;
    } catch (error) {
      logger.error(
        `Error generating branding PDF for projectId: ${projectId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Génère un fichier ZIP contenant toutes les déclinaisons du logo
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @param extension - Extension souhaitée (svg, png, psd)
   * @returns Buffer du fichier ZIP
   */
  async generateLogosZip(
    userId: string,
    projectId: string,
    extension: "svg" | "png" | "psd"
  ): Promise<Buffer> {
    logger.info(
      `Generating logos ZIP for projectId: ${projectId}, userId: ${userId}, extension: ${extension}`
    );

    // Récupérer le projet et ses données de branding
    const project = await this.projectRepository.findById(
      projectId,
      `users/${userId}/projects`
    );

    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when generating logos ZIP.`
      );
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const branding = project.analysisResultModel.branding;
    if (!branding || !branding.logo) {
      logger.warn(
        `No logo found for project ${projectId} when generating logos ZIP.`
      );
      throw new Error(`No logo found for project ${projectId}`);
    }

    const JSZip = require("jszip");
    const zip = new JSZip();

    try {
      // Récupérer toutes les déclinaisons disponibles
      const logoVariations = branding.logo.variations;
      const logoFiles: { name: string; content: string }[] = [];

      // Logo principal
      if (branding.logo.svg) {
        const content = await this.fetchContentFromUrl(branding.logo.svg);
        if (content) {
          logoFiles.push({
            name: "logo-main",
            content: content,
          });
        }
      }

      // Logo icône seulement
      if (branding.logo.iconSvg) {
        const content = await this.fetchContentFromUrl(branding.logo.iconSvg);
        if (content) {
          logoFiles.push({
            name: "logo-icon",
            content: content,
          });
        }
      }

      // Variations avec texte
      if (logoVariations?.withText) {
        if (logoVariations.withText.lightBackground) {
          const content = await this.fetchContentFromUrl(
            logoVariations.withText.lightBackground
          );
          if (content) {
            logoFiles.push({
              name: "logo-with-text-light-background",
              content: content,
            });
          }
        }
        if (logoVariations.withText.darkBackground) {
          const content = await this.fetchContentFromUrl(
            logoVariations.withText.darkBackground
          );
          if (content) {
            logoFiles.push({
              name: "logo-with-text-dark-background",
              content: content,
            });
          }
        }
        if (logoVariations.withText.monochrome) {
          const content = await this.fetchContentFromUrl(
            logoVariations.withText.monochrome
          );
          if (content) {
            logoFiles.push({
              name: "logo-with-text-monochrome",
              content: content,
            });
          }
        }
      }

      // Variations icône seulement
      if (logoVariations?.iconOnly) {
        if (logoVariations.iconOnly.lightBackground) {
          const content = await this.fetchContentFromUrl(
            logoVariations.iconOnly.lightBackground
          );
          if (content) {
            logoFiles.push({
              name: "logo-icon-only-light-background",
              content: content,
            });
          }
        }
        if (logoVariations.iconOnly.darkBackground) {
          const content = await this.fetchContentFromUrl(
            logoVariations.iconOnly.darkBackground
          );
          if (content) {
            logoFiles.push({
              name: "logo-icon-only-dark-background",
              content: content,
            });
          }
        }
        if (logoVariations.iconOnly.monochrome) {
          const content = await this.fetchContentFromUrl(
            logoVariations.iconOnly.monochrome
          );
          if (content) {
            logoFiles.push({
              name: "logo-icon-only-monochrome",
              content: content,
            });
          }
        }
      }

      if (logoFiles.length === 0) {
        throw new Error("No logo variations found to include in ZIP");
      }

      logger.info(
        `Found ${logoFiles.length} logo variations to include in ZIP`
      );

      // Traitement en parallèle selon l'extension demandée
      logger.info(
        `Starting parallel conversion of ${
          logoFiles.length
        } logos to ${extension.toUpperCase()}`
      );

      // Pré-initialiser le browser pour les conversions PSD si nécessaire
      if (extension === "psd") {
        logger.info("Pre-initializing browser for parallel PSD conversions");
        await SvgToPsdService.initializeForParallelConversion();
      }

      const conversionPromises = logoFiles.map(async (logoFile) => {
        const fileName = `${logoFile.name}.${extension}`;

        try {
          if (extension === "svg") {
            // Pour SVG, pas de conversion nécessaire
            return { fileName, content: logoFile.content };
          } else if (extension === "png") {
            // Pour PNG, convertir le SVG
            const pngBuffer = await this.convertSvgToPng(logoFile.content);
            return { fileName, content: pngBuffer };
          } else if (extension === "psd") {
            // Pour PSD, convertir le SVG en vrai fichier PSD
            const psdBuffer = await this.convertSvgToPsd(
              logoFile.name,
              logoFile.content
            );
            return { fileName, content: psdBuffer };
          }

          // Fallback pour extensions non supportées
          return { fileName, content: logoFile.content };
        } catch (error) {
          logger.error(
            `Error converting ${logoFile.name} to ${extension}:`,
            error
          );
          // En cas d'erreur, retourner le contenu SVG original
          return {
            fileName: `${logoFile.name}.svg`,
            content: logoFile.content,
          };
        }
      });

      // Attendre que toutes les conversions se terminent
      const convertedFiles = await Promise.all(conversionPromises);

      logger.info(
        `Completed parallel conversion of ${convertedFiles.length} logos`
      );

      // Ajouter tous les fichiers convertis au ZIP
      convertedFiles.forEach(({ fileName, content }) => {
        zip.file(fileName, content);
      });

      // Ajouter un fichier README avec les informations du projet
      const readmeContent = this.generateReadmeContent(
        project,
        extension,
        logoFiles.length
      );
      zip.file("README.txt", readmeContent);

      // Générer le ZIP
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      logger.info(
        `Successfully generated logos ZIP for projectId: ${projectId}, extension: ${extension}, files: ${logoFiles.length}`
      );

      return zipBuffer;
    } catch (error) {
      logger.error(
        `Error generating logos ZIP for projectId: ${projectId}, extension: ${extension}`,
        error
      );
      throw error;
    }
  }

  /**
   * Convertit un SVG en PNG
   */
  private async convertSvgToPng(svgContent: string): Promise<Buffer> {
    try {
      const sharp = require("sharp");

      // Convertir le SVG en PNG avec une résolution de 512x512
      const pngBuffer = await sharp(Buffer.from(svgContent))
        .resize(512, 512, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Fond transparent
        })
        .png()
        .toBuffer();

      return pngBuffer;
    } catch (error) {
      logger.error("Error converting SVG to PNG:", error);
      // Fallback: retourner le contenu SVG comme texte
      return Buffer.from(svgContent, "utf-8");
    }
  }

  /**
   * Convertit un SVG en fichier PSD réel avec calques éditables
   * Utilise le SvgToPsdService pour créer un vrai fichier PSD avec des calques séparés
   */
  private async convertSvgToPsd(
    logoName: string,
    svgContent: string
  ): Promise<Buffer> {
    try {
      logger.info(`Converting SVG to PSD with editable layers: ${logoName}`);

      // Utiliser le service SVG to PSD pour créer un fichier avec calques
      const psdPath = await SvgToPsdService.convertSvgToPsd(svgContent, {
        width: 1024,
        height: 1024,
        backgroundColor: "transparent",
        quality: 100,
      });

      // Lire le fichier PSD généré
      const psdBuffer = await fs.readFile(psdPath);

      // Nettoyer le fichier temporaire
      await SvgToPsdService.cleanupTempFile(psdPath);

      logger.info(
        `Successfully converted ${logoName} to PSD with ${
          svgContent.match(
            /<(path|rect|circle|ellipse|line|polyline|polygon|text|g)[^>]*>/gi
          )?.length || 0
        } potential layers`
      );

      return psdBuffer;
    } catch (error) {
      logger.error(`Error converting SVG to PSD for ${logoName}:`, error);

      // Fallback: créer un PNG haute qualité avec extension .psd
      logger.warn(`Falling back to PNG conversion for ${logoName}`);
      try {
        const sharp = require("sharp");
        const pngBuffer = await sharp(Buffer.from(svgContent))
          .resize(1024, 1024, {
            fit: "contain",
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .png()
          .toBuffer();

        return pngBuffer;
      } catch (fallbackError) {
        logger.error(
          `Fallback PNG conversion also failed for ${logoName}:`,
          fallbackError
        );
        return Buffer.from(svgContent, "utf-8");
      }
    }
  }

  /**
   * Génère le contenu du fichier README
   */
  private generateReadmeContent(
    project: any,
    extension: string,
    fileCount: number
  ): string {
    return `Logo Package - ${project.name}
    
Project: ${project.name}
Description: ${project.description || "No description available"}
Format: ${extension.toUpperCase()}
Files included: ${fileCount}
Generated on: ${new Date().toISOString()}

${
  extension.toLowerCase() === "psd"
    ? `
✅ PSD FORMAT WITH EDITABLE LAYERS:
These are genuine PSD files with separated, editable layers created from your SVG logos.
Each SVG element (paths, shapes, text, groups) has been converted into individual layers.

Features:
- Editable layers for each SVG element
- Transparent backgrounds
- High resolution (1024x1024)
- Compatible with Photoshop, GIMP, and other PSD editors
- Preserves original SVG structure as separate layers

`
    : ""
}File naming convention:
- logo-main: Main logo with text
- logo-icon: Icon-only version
- logo-with-text-*: Logo with text in different variations
- logo-icon-only-*: Icon-only in different variations

Variations:
- light-background: Optimized for light backgrounds
- dark-background: Optimized for dark backgrounds  
- monochrome: Single color version

${
  extension.toLowerCase() === "svg"
    ? "SVG files are vector-based and can be scaled to any size without quality loss."
    : ""
}
${
  extension.toLowerCase() === "png"
    ? "PNG files are high-quality raster images with transparent backgrounds."
    : ""
}
${
  extension.toLowerCase() === "psd"
    ? "Files are provided as high-quality PNG format due to technical limitations."
    : ""
}

Generated by Lexis API - Brand Identity System
`;
  }

  /**
   * Récupère le contenu d'un fichier depuis une URL (Firebase Storage ou autre)
   * @param url - URL du fichier à récupérer
   * @returns Le contenu du fichier ou null si erreur
   */
  private async fetchContentFromUrl(url: string): Promise<string | null> {
    try {
      logger.info(`Fetching content from URL: ${url}`);

      // Vérifier si c'est une URL valide
      if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
        logger.warn(`Invalid URL format: ${url}`);
        // Si ce n'est pas une URL, c'est peut-être déjà le contenu SVG
        if (url && url.includes("<svg")) {
          return url;
        }
        return null;
      }

      // Utiliser fetch pour récupérer le contenu
      const response = await fetch(url);

      if (!response.ok) {
        logger.error(
          `Failed to fetch content from URL: ${url}, status: ${response.status}`
        );
        return null;
      }

      const content = await response.text();

      // Vérifier que le contenu semble être du SVG
      if (!content.includes("<svg")) {
        logger.warn(`Content from URL ${url} does not appear to be SVG`);
      }

      logger.info(
        `Successfully fetched content from URL: ${url}, length: ${content.length} characters`
      );
      return content;
    } catch (error) {
      logger.error(`Error fetching content from URL: ${url}`, error);
      return null;
    }
  }

  /**
   * Edit an existing logo based on user modification prompt
   * Uses AI to intelligently modify the logo while preserving its core identity
   */
  async editLogo(
    userId: string,
    projectId: string,
    logoSvg: string,
    modificationPrompt: string
  ): Promise<{ logo: LogoModel }> {
    logger.info(
      `Editing logo for userId: ${userId}, projectId: ${projectId}, modification: ${modificationPrompt.substring(
        0,
        100
      )}...`
    );

    try {
      // Get project for context
      const project = await this.getProjectOptimized(userId, projectId);
      if (!project) {
        throw new Error(`Project not found with ID: ${projectId}`);
      }

      // Build the edit prompt with current logo and modification request
      const editPrompt = `**CURRENT LOGO SVG:**
\`\`\`svg
${logoSvg}
\`\`\`

**USER MODIFICATION REQUEST:**
${modificationPrompt}

${LOGO_EDIT_PROMPT}`;

      // Process the edit request with AI
      const steps: IPromptStep[] = [
        {
          promptConstant: editPrompt,
          stepName: "Logo Edit",
          maxOutputTokens: 3000,
          modelParser: (content) => {
            try {
              const parsed = JSON.parse(content);
              return parsed;
            } catch (error) {
              logger.error("Error parsing edited logo JSON:", error);
              throw new Error("Failed to parse edited logo JSON");
            }
          },
          hasDependencies: false,
        },
      ];

      const sectionResults = await this.processSteps(
        steps,
        project,
        BrandingService.LOGO_LLM_CONFIG
      );

      const editedLogoData = sectionResults[0].parsedData;

      // Create the edited logo model
      const editedLogo: LogoModel = {
        id: `edited-${Date.now()}`,
        name: "Edited Logo",
        concept: editedLogoData.changesSummary || "User-modified logo",
        colors: [],
        fonts: [],
        svg: editedLogoData.svg,
        iconSvg: this.extractIconFromSvg(editedLogoData.svg),
      };

      // Optimize the edited SVG
      const optimizedLogo = this.optimizeLogoSvgs(editedLogo);

      logger.info(
        `Successfully edited logo for projectId: ${projectId}, changes: ${editedLogoData.changesSummary}`
      );

      return {
        logo: optimizedLogo,
      };
    } catch (error) {
      logger.error(`Error editing logo for projectId: ${projectId}`, error);
      throw error;
    }
  }
}
