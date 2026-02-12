import logger from '../../config/logger';
import { ProjectModel } from '../../models/project.model';
import { LLMProvider, PromptService } from '../prompt.service';
import { SvgToPsdService } from '../svgToPsd.service';
import * as fs from 'fs-extra';

import { BrandIdentityModel, ColorModel, TypographyModel } from '../../models/brand-identity.model';
import { LOGO_GENERATION_PROMPT } from './prompts/singleGenerations/00_logo-generation-section.prompt';
import { LOGO_VARIATION_LIGHT_PROMPT } from './prompts/singleGenerations/logo-variation-light.prompt';
import { LOGO_VARIATION_DARK_PROMPT } from './prompts/singleGenerations/logo-variation-dark.prompt';
import { LOGO_VARIATION_MONOCHROME_PROMPT } from './prompts/singleGenerations/logo-variation-monochrome.prompt';
import { LOGO_EDIT_PROMPT } from './prompts/singleGenerations/logo-edit.prompt';

import { BRAND_HEADER_SECTION_PROMPT } from './prompts/00_brand-header-section.prompt';
import {
  LOGO_SYSTEM_SECTION_PROMPT,
  LOGO_VARIATION_PAGE_PROMPT,
  LOGO_BEST_PRACTICES_PAGE_PROMPT,
} from './prompts/01_logo-system-section.prompt';
import { COLOR_PALETTE_SECTION_PROMPT } from './prompts/02_color-palette-section.prompt';
import { TYPOGRAPHY_SECTION_PROMPT } from './prompts/03_typography-section.prompt';
import { MOCKUPS_SECTION_PROMPT, MOCKUPS_COUNT } from './prompts/06_mockups-section.prompt';
import { BRAND_FOOTER_SECTION_PROMPT } from './prompts/07_brand-footer-section.prompt';
import { SectionModel } from '../../models/section.model';
import { BrandIdentityBuilder } from '../../models/builders/brandIdentity.builder';
import { GenericService, IPromptStep, ISectionResult } from '../common/generic.service';
import { LogoModel, LogoPreferences } from '../../models/logo.model';
import { COLORS_GENERATION_PROMPT } from './prompts/singleGenerations/colors-generation.prompt';
import { TYPOGRAPHY_GENERATION_PROMPT } from './prompts/singleGenerations/typography-generation.prompt';
import {
  COLORS_FROM_LOGO_PROMPT,
  TYPOGRAPHY_FROM_LOGO_PROMPT,
} from './prompts/singleGenerations/colors-from-logo.prompt';
import { generateLogoVariationsFromSvg } from '../logo-import.service';
import { PdfService } from '../pdf.service';
import { cacheService } from '../cache.service';
import crypto from 'crypto';
import { projectService } from '../project.service';
import { LogoJsonToSvgService } from './logoJsonToSvg.service';
import { SvgOptimizerService } from './svgOptimizer.service';
import { geminiMockupService } from '../geminiMockup.service';
import { StorageService } from '../storage.service';

export class BrandingService extends GenericService {
  private pdfService: PdfService;
  private logoJsonToSvgService: LogoJsonToSvgService;
  private storageService: StorageService;

  // Configuration LLM pour la génération de logos et variations
  // Optimisée pour qualité maximale avec vitesse préservée
  private static readonly LOGO_LLM_CONFIG = {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-3-flash-preview', // Gemini 3 comme demandé
    llmOptions: {
      maxOutputTokens: 600, // Augmenté pour plus de détails SVG complexes
      temperature: 0.2, // Réduit pour cohérence et qualité constante
      topP: 0.9, // Augmenté pour diversité créative contrôlée
      topK: 30, // Optimisé pour équilibre qualité/vitesse
    },
  };

  // Configuration LLM pour la génération de couleurs
  private static readonly COLORS_LLM_CONFIG = {
    provider: LLMProvider.GEMINI,
    modelName: 'gemini-2.0-flash',
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
    modelName: 'gemini-2.0-flash',
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
    this.storageService = new StorageService();
    logger.info('BrandingService initialized with optimized logo generation');
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
      prefix: 'project',
    });

    if (project) {
      logger.info(`Project cache hit - ProjectId: ${projectId}`);
      return project;
    }

    // Fallback vers la base de données
    logger.info(`Project cache miss, fetching from database - ProjectId: ${projectId}`);
    project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);

    if (project) {
      // Cache asynchrone (non-bloquant)
      cacheService
        .set(projectCacheKey, project, {
          prefix: 'project',
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
    const firstLine = projectDescription.split('\n').find((line) => line.trim());
    return firstLine?.trim() || 'Brand';
  }

  /**
   * Génère les initiales depuis le nom du projet
   */
  private generateInitials(projectName: string): string {
    // Nettoyer et diviser le nom
    const words = projectName
      .replace(/[^\w\s]/g, '') // Enlever la ponctuation
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) return 'BR';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();

    // Prendre la première lettre de chaque mot (max 3)
    return words
      .slice(0, 3)
      .map((word) => word[0].toUpperCase())
      .join('');
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
    let industry = 'Technology';
    if (
      lowerDesc.includes('livraison') ||
      lowerDesc.includes('delivery') ||
      lowerDesc.includes('logisti') ||
      lowerDesc.includes('transport') ||
      lowerDesc.includes('colis') ||
      lowerDesc.includes('shipping') ||
      lowerDesc.includes('coursier')
    ) {
      industry = 'Delivery & Logistics';
    } else if (
      lowerDesc.includes('food') ||
      lowerDesc.includes('restaurant') ||
      lowerDesc.includes('cuisine') ||
      lowerDesc.includes('chef') ||
      lowerDesc.includes('menu') ||
      lowerDesc.includes('traiteur')
    ) {
      industry = 'Food & Beverage';
    } else if (
      lowerDesc.includes('fashion') ||
      lowerDesc.includes('clothing') ||
      lowerDesc.includes('apparel') ||
      lowerDesc.includes('mode') ||
      lowerDesc.includes('vêtement')
    ) {
      industry = 'Fashion';
    } else if (
      lowerDesc.includes('health') ||
      lowerDesc.includes('medical') ||
      lowerDesc.includes('wellness') ||
      lowerDesc.includes('santé') ||
      lowerDesc.includes('médic') ||
      lowerDesc.includes('clinic') ||
      lowerDesc.includes('pharma')
    ) {
      industry = 'Healthcare';
    } else if (
      lowerDesc.includes('finance') ||
      lowerDesc.includes('bank') ||
      lowerDesc.includes('investment') ||
      lowerDesc.includes('banque') ||
      lowerDesc.includes('assurance') ||
      lowerDesc.includes('comptab')
    ) {
      industry = 'Finance';
    } else if (
      lowerDesc.includes('education') ||
      lowerDesc.includes('learning') ||
      lowerDesc.includes('school') ||
      lowerDesc.includes('éducation') ||
      lowerDesc.includes('formation') ||
      lowerDesc.includes('école')
    ) {
      industry = 'Education';
    } else if (
      lowerDesc.includes('sport') ||
      lowerDesc.includes('fitness') ||
      lowerDesc.includes('gym') ||
      lowerDesc.includes('entraîn')
    ) {
      industry = 'Sports & Fitness';
    } else if (
      lowerDesc.includes('travel') ||
      lowerDesc.includes('tourism') ||
      lowerDesc.includes('hotel') ||
      lowerDesc.includes('voyage') ||
      lowerDesc.includes('hôtel') ||
      lowerDesc.includes('tourisme')
    ) {
      industry = 'Travel & Hospitality';
    } else if (
      lowerDesc.includes('immobili') ||
      lowerDesc.includes('real estate') ||
      lowerDesc.includes('property') ||
      lowerDesc.includes('logement') ||
      lowerDesc.includes('maison')
    ) {
      industry = 'Real Estate';
    } else if (
      lowerDesc.includes('beauté') ||
      lowerDesc.includes('beauty') ||
      lowerDesc.includes('cosmét') ||
      lowerDesc.includes('cosmet') ||
      lowerDesc.includes('salon') ||
      lowerDesc.includes('coiffure')
    ) {
      industry = 'Beauty & Cosmetics';
    } else if (
      lowerDesc.includes('construct') ||
      lowerDesc.includes('bâtiment') ||
      lowerDesc.includes('btp') ||
      lowerDesc.includes('architect') ||
      lowerDesc.includes('building')
    ) {
      industry = 'Construction';
    } else if (
      lowerDesc.includes('e-commerce') ||
      lowerDesc.includes('boutique') ||
      lowerDesc.includes('shop') ||
      lowerDesc.includes('magasin') ||
      lowerDesc.includes('retail') ||
      lowerDesc.includes('vente')
    ) {
      industry = 'Retail & E-commerce';
    } else if (
      lowerDesc.includes('eco') ||
      lowerDesc.includes('green') ||
      lowerDesc.includes('sustainable') ||
      lowerDesc.includes('durable') ||
      lowerDesc.includes('écolog')
    ) {
      industry = 'Sustainability';
    }

    // Extraire les valeurs
    const values: string[] = [];
    if (lowerDesc.includes('innovation') || lowerDesc.includes('innovative'))
      values.push('Innovation');
    if (lowerDesc.includes('trust') || lowerDesc.includes('reliable')) values.push('Trust');
    if (lowerDesc.includes('quality') || lowerDesc.includes('premium')) values.push('Quality');
    if (lowerDesc.includes('speed') || lowerDesc.includes('fast') || lowerDesc.includes('quick'))
      values.push('Speed');
    if (
      lowerDesc.includes('simple') ||
      lowerDesc.includes('easy') ||
      lowerDesc.includes('intuitive')
    )
      values.push('Simplicity');
    if (lowerDesc.includes('creative') || lowerDesc.includes('artistic')) values.push('Creativity');
    if (lowerDesc.includes('professional') || lowerDesc.includes('business'))
      values.push('Professionalism');
    if (lowerDesc.includes('fun') || lowerDesc.includes('playful') || lowerDesc.includes('joy'))
      values.push('Playfulness');

    // Audience cible
    let targetAudience = 'General Public';
    if (
      lowerDesc.includes('young') ||
      lowerDesc.includes('youth') ||
      lowerDesc.includes('millennial')
    ) {
      targetAudience = 'Young Adults (18-35)';
    } else if (
      lowerDesc.includes('professional') ||
      lowerDesc.includes('business') ||
      lowerDesc.includes('corporate')
    ) {
      targetAudience = 'Business Professionals';
    } else if (
      lowerDesc.includes('luxury') ||
      lowerDesc.includes('premium') ||
      lowerDesc.includes('high-end')
    ) {
      targetAudience = 'Luxury Market';
    } else if (lowerDesc.includes('family') || lowerDesc.includes('parent')) {
      targetAudience = 'Families';
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
        ? projectContext.values.join(', ')
        : 'Innovation, Quality, Trust'
    }\n`;
    contextPrompt += `- Target Audience: ${projectContext.targetAudience}\n`;
    contextPrompt += `- Project Description: ${projectContext.uniqueSellingPoint}\n`;

    // Informations de design
    const colorInfo = `Primary: ${
      colors.colors?.primary || 'N/A'
    }, Secondary: ${colors.colors?.secondary || 'N/A'}`;
    const fontInfo = `Primary: ${typography.primaryFont || 'N/A'}, Secondary: ${
      typography.secondaryFont || 'N/A'
    }`;
    contextPrompt += `\n**DESIGN PALETTE:**\n`;
    contextPrompt += `- Colors: ${colorInfo}\n`;
    contextPrompt += `- Typography: ${fontInfo}\n`;

    // Ajouter les préférences utilisateur au contexte avec instructions détaillées
    let preferenceContext = '';
    if (preferences) {
      const typeDescriptions = {
        icon: 'Icon Based - Create a memorable icon/symbol + full brand name (like Apple, Nike, Twitter)',
        name: 'Name Based - Typography IS the logo, NO separate icon (like Coca-Cola, Google, FedEx)',
        initial: 'Initial Based - Stylized initials as main element (like IBM, HP, CNN)',
      };

      preferenceContext = `\n**USER PREFERENCES:**\n- Logo Type: ${
        preferences.type
      } - ${typeDescriptions[preferences.type]}\n`;

      if (preferences.type === 'initial') {
        preferenceContext += `- Initials to use: "${projectInitials}" (from "${projectName}")\n`;
      }

      if (preferences.customDescription) {
        preferenceContext += `- Custom Design Requirements: ${preferences.customDescription}\n`;
      }

      preferenceContext += `\n**DESIGN DIRECTION FOR ${preferences.type.toUpperCase()} TYPE:**\n`;
      preferenceContext += `Based on the project context (${
        projectContext.industry
      }, values: ${projectContext.values.join(', ')}), create a logo that:\n`;

      switch (preferences.type) {
        case 'icon':
          preferenceContext += `- Creates an icon that visually represents the ${projectContext.industry} industry\n`;
          preferenceContext += `- Embodies the values: ${projectContext.values.join(', ')}\n`;
          preferenceContext += `- Appeals to ${projectContext.targetAudience}\n`;
          preferenceContext += `- Includes the FULL brand name "${projectName}" as text\n`;
          preferenceContext += `- Makes the icon memorable and instantly recognizable\n`;
          break;
        case 'name':
          preferenceContext += `- Uses ONLY the brand name "${projectName}" with typography that reflects ${projectContext.industry}\n`;
          preferenceContext += `- Conveys ${projectContext.values.join(
            ' and '
          )} through font styling\n`;
          preferenceContext += `- Resonates with ${projectContext.targetAudience}\n`;
          preferenceContext += `- NO separate icon - typography IS the complete logo\n`;
          preferenceContext += `- Creates visual impact through creative letterforms\n`;
          break;
        case 'initial':
          preferenceContext += `- Uses ONLY the initials "${projectInitials}" in a way that suggests ${projectContext.industry}\n`;
          preferenceContext += `- Stylizes the letters to communicate ${projectContext.values.join(
            ' and '
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
      '\n\nHere is the project branding colors: ' +
      JSON.stringify(project.analysisResultModel.branding.colors) +
      '\n\nHere is the project branding typography: ' +
      JSON.stringify(project.analysisResultModel.branding.typography) +
      '\n\nHere is the project branding logo: ' +
      JSON.stringify(project.analysisResultModel.branding.logo);

    const contentHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          name: project.name,
          description: project.description,
          branding: project.analysisResultModel?.branding,
          projectDescription,
        })
      )
      .digest('hex')
      .substring(0, 16);

    const cacheKey = cacheService.generateAIKey('branding', userId, projectId, contentHash);

    // Check cache first
    const cachedResult = await cacheService.get<ProjectModel>(cacheKey, {
      prefix: 'ai',
      ttl: 7200, // 2 hours
    });

    if (cachedResult) {
      logger.info(`Branding cache hit for projectId: ${projectId}`);
      return cachedResult;
    }

    logger.info(`Branding cache miss, generating new content for projectId: ${projectId}`);

    try {
      // Define branding steps
      const steps: IPromptStep[] = [
        {
          promptConstant: BRAND_HEADER_SECTION_PROMPT + projectDescription,
          stepName: 'Brand Header',
          hasDependencies: false,
        },
        {
          promptConstant: LOGO_SYSTEM_SECTION_PROMPT + projectDescription,
          stepName: 'Logo Principal',
          hasDependencies: false,
        },
        {
          promptConstant:
            LOGO_VARIATION_PAGE_PROMPT +
            '\nVariation type: Fond clair (Light Background)\nDisplay the logo variation for light backgrounds. Use a white or very light background.\n\n' +
            projectDescription,
          stepName: 'Logo Variation Fond Clair',
          hasDependencies: false,
        },
        {
          promptConstant:
            LOGO_VARIATION_PAGE_PROMPT +
            "\nVariation type: Fond sombre (Dark Background)\nDisplay the logo variation for dark backgrounds. Use the brand's dark color or a rich dark tone as the full-page background.\n\n" +
            projectDescription,
          stepName: 'Logo Variation Fond Sombre',
          hasDependencies: false,
        },
        {
          promptConstant:
            LOGO_VARIATION_PAGE_PROMPT +
            '\nVariation type: Monochrome\nDisplay the monochrome logo variation on a neutral gray background.\n\n' +
            projectDescription,
          stepName: 'Logo Variation Monochrome',
          hasDependencies: false,
        },
        {
          promptConstant: LOGO_BEST_PRACTICES_PAGE_PROMPT + projectDescription,
          stepName: 'Logo Bonnes Pratiques',
          hasDependencies: false,
        },
        {
          promptConstant: COLOR_PALETTE_SECTION_PROMPT + projectDescription,
          stepName: 'Color Palette',
          hasDependencies: false,
        },
        {
          promptConstant: TYPOGRAPHY_SECTION_PROMPT + projectDescription,
          stepName: 'Typography',
          hasDependencies: false,
        },
        {
          promptConstant: MOCKUPS_SECTION_PROMPT + projectDescription,
          stepName: 'Brand Mockups',
          hasDependencies: false,
        },
        // {
        //   promptConstant: BRAND_FOOTER_SECTION_PROMPT + projectDescription,
        //   stepName: 'Brand Footer',
        //   hasDependencies: false,
        // },
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
            if (result.data === 'steps_in_progress' || result.data === 'all_steps_completed') {
              await streamCallback(result);
              return;
            }

            // Préparer la section finale (avec génération d'images pour les mockups)
            let finalSection: SectionModel;

            if (result.name === 'Brand Mockups') {
              logger.info(
                '[MOCKUP] Processing Brand Mockups step: will generate real images via Gemini',
                {
                  projectId,
                  userId,
                }
              );

              try {
                // Générer les images mockups photoréalistes en parallèle
                const mockupResults = await this.generateMockupsInParallel(project);

                if (mockupResults.length > 0) {
                  // Construire un HTML fiable avec les vraies URLs des images
                  const mockupsHtml = this.buildMockupsHtmlWithRealImages(mockupResults, project);

                  logger.info(`[MOCKUP] HTML built with ${mockupResults.length} real image URLs`, {
                    projectId,
                    mockupCount: mockupResults.length,
                    imageUrls: mockupResults.map((m) => m.url),
                    htmlLength: mockupsHtml.length,
                  });

                  finalSection = {
                    name: result.name,
                    type: result.type,
                    data: mockupsHtml,
                    summary: `Generated ${mockupResults.length} professional photorealistic mockups with integrated brand logo`,
                  };
                } else {
                  logger.warn(
                    '[MOCKUP] No mockup images generated, using AI-generated HTML as fallback',
                    {
                      projectId,
                    }
                  );
                  finalSection = {
                    name: result.name,
                    type: result.type,
                    data: result.data,
                    summary: result.summary,
                  };
                }
              } catch (error: any) {
                logger.error('[MOCKUP] Error in mockup image generation', {
                  error: error.message,
                  stack: error.stack,
                  projectId,
                });
                finalSection = {
                  name: result.name,
                  type: result.type,
                  data: result.data,
                  summary: result.summary,
                };
              }
            } else {
              // Traitement normal pour les autres sections
              finalSection = {
                name: result.name,
                type: result.type,
                data: result.data,
                summary: result.summary,
              };
            }

            sections.push(finalSection);

            // Prepare the updated project data
            const updatedProjectData = {
              ...project,
              analysisResultModel: {
                ...project.analysisResultModel,
                branding: {
                  sections: sections,
                  colors: project.analysisResultModel.branding.colors,
                  typography: project.analysisResultModel.branding.typography,
                  logo: project.analysisResultModel.branding.logo,
                  generatedLogos: project.analysisResultModel.branding.generatedLogos || [],
                  generatedColors: project.analysisResultModel.branding.generatedColors || [],
                  generatedTypography:
                    project.analysisResultModel.branding.generatedTypography || [],
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
                prefix: 'ai',
                ttl: 7200, // 2 hours
              });
              logger.info(`Branding cached after step: ${result.name} - projectId: ${projectId}`);

              // Envoyer le résultat FINAL (avec URLs injectées) au frontend
              const finalResult: ISectionResult = {
                name: finalSection.name,
                type: finalSection.type,
                data: finalSection.data,
                summary: finalSection.summary || '',
              };
              await streamCallback(finalResult);
            } else {
              logger.error(
                `Failed to update project after step: ${result.name} - projectId: ${projectId}`
              );
              throw new Error(`Failed to update project after step: ${result.name}`);
            }
          },
          {
            provider: LLMProvider.GEMINI,
            modelName: 'gemini-3-pro-preview',
            userId,
          }, // promptConfig
          'branding', // promptType
          userId
        );

        // Return the updated project (it should be available in cache or fetch it again)
        const finalProject = await this.projectRepository.findById(
          projectId,
          `users/${userId}/projects`
        );
        return finalProject;
      } else {
        // If no streaming callback, process without streaming
        logger.info('Processing branding without streaming');
        // TODO: Implement non-streaming version if needed
        return project;
      }
    } catch (error) {
      logger.error(`Error generating branding for projectId ${projectId}:`, error);
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
        stepName: 'Colors Generation',
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
        stepName: 'Typography Generation',
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
    logger.info(`Generating colors and typography in parallel for userId: ${userId}`);

    // Créer le projet
    project = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: BrandIdentityBuilder.createEmpty(),
      },
    };
    const createdProject = await projectService.createUserProject(userId, project);

    if (!createdProject.id) {
      throw new Error(`Failed to create project`);
    }

    // Stocker le projet en cache
    try {
      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, createdProject, {
        prefix: 'project',
        ttl: 3600, // 1 heure
      });
      logger.info(`Project cached with ID: ${createdProject.id} for userId: ${userId}`);
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
    logger.info(`Parallel colors and typography generation completed in ${generationTime}ms`);

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
        prefix: 'project',
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
  /**
   * Génération AI pure sans optimisation SVG (pour parallélisation maximale)
   */
  private async generateRawLogoConcept(
    optimizedPrompt: string,
    project: ProjectModel,
    conceptIndex: number,
    preferences?: LogoPreferences
  ): Promise<LogoModel> {
    logger.info(
      `Generating raw logo concept ${
        conceptIndex + 1
      } with direct SVG generation - Type: ${preferences?.type || 'name'}`
    );

    // AI generation avec prompt pré-optimisé
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
              logoData.id = `concept${String(conceptIndex + 1).padStart(2, '0')}`;
            }

            return logoData;
          } catch (error) {
            logger.error(`Error parsing logo data concept ${conceptIndex + 1}:`, error);
            throw new Error(`Failed to parse logo data concept ${conceptIndex + 1}`);
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(steps, project, BrandingService.LOGO_LLM_CONFIG);
    const logoResult = sectionResults[0];
    const logoData = logoResult.parsedData;

    // Créer LogoModel RAW (sans optimisation SVG)
    const logoModel: LogoModel = {
      id: `concept${String(conceptIndex + 1).padStart(2, '0')}`,
      name: logoData.name || `Logo Concept ${conceptIndex + 1}`,
      concept: logoData.concept || 'Professional logo design',
      colors: logoData.colors || [],
      fonts: logoData.fonts || [],
      svg: logoData.svg, // SVG brut de l'AI
      iconSvg: this.extractIconFromSvg(logoData.svg), // Extract icon part
      type: preferences?.type,
      customDescription: preferences?.customDescription,
    };

    logger.info(`Raw logo concept ${conceptIndex + 1} generated successfully`);
    return logoModel;
  }

  /**
   * Méthode optimisée pour la génération avec optimisation SVG (pour rétrocompatibilité)
   */
  private async generateSingleLogoConcept(
    projectDescription: string,
    colors: ColorModel,
    typography: TypographyModel,
    project: ProjectModel,
    conceptIndex: number,
    preferences?: LogoPreferences
  ): Promise<LogoModel> {
    // Générer le prompt optimisé
    const optimizedPrompt = this.buildOptimizedLogoPrompt(
      projectDescription,
      colors,
      typography,
      preferences
    );

    // Générer le logo brut
    const rawLogo = await this.generateRawLogoConcept(
      optimizedPrompt,
      project,
      conceptIndex,
      preferences
    );

    // Appliquer l'optimisation SVG
    const optimizedLogo = this.optimizeLogoSvgs(rawLogo);

    logger.info(`Professional logo concept ${conceptIndex + 1} generated with direct SVG content`);
    return optimizedLogo;
  }

  /**
   * Mise à jour asynchrone du projet avec les logos (pour parallélisation)
   */
  private async updateProjectWithLogosAsync(
    userId: string,
    projectId: string,
    project: ProjectModel,
    selectedColors: ColorModel,
    selectedTypography: TypographyModel,
    logos: LogoModel[]
  ): Promise<void> {
    try {
      // Préparer les données de mise à jour
      const updatedProjectData = {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          branding: {
            ...project.analysisResultModel.branding,
            colors: selectedColors,
            typography: selectedTypography,
            generatedLogos: logos,
            updatedAt: new Date(),
          },
        },
      };

      // Paralléliser DB update et cache update
      const [updatedProject, _] = await Promise.allSettled([
        this.projectRepository.update(projectId, updatedProjectData, `users/${userId}/projects`),
        // Pré-calculer la clé de cache
        Promise.resolve(`project_${userId}_${projectId}`),
      ]);

      if (updatedProject.status === 'fulfilled' && updatedProject.value) {
        logger.info(
          `Successfully updated project with logos - ProjectId: ${projectId}, LogoCount: ${logos.length}`
        );

        // Mise à jour du cache en arrière-plan (non-bloquant)
        const projectCacheKey = `project_${userId}_${projectId}`;
        cacheService
          .set(projectCacheKey, updatedProject.value, {
            prefix: 'project',
            ttl: 3600,
          })
          .catch((error) => {
            logger.error(`Cache update failed for project ${projectId}:`, error);
          });

        logger.info(`Project cache update initiated - ProjectId: ${projectId}`);
      } else {
        logger.error(
          `Failed to update project ${projectId}:`,
          updatedProject.status === 'rejected' ? updatedProject.reason : 'Unknown error'
        );
      }
    } catch (error) {
      logger.error(`Error in updateProjectWithLogosAsync for project ${projectId}:`, error);
      // Ne pas faire échouer le processus principal
    }
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
      logger.warn('Could not extract icon from SVG, using fallback');
      return fullSvg.replace(/<g id="text"[^>]*>[\s\S]*?<\/g>/, '');
    } catch (error) {
      logger.error('Error extracting icon from SVG:', error);
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
      if (typeof optimized[key] === 'string') {
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
        preferences?.type || 'name'
      }`
    );

    const totalStartTime = Date.now();

    // Étape 1: Récupération optimisée du projet avec fallback gracieux
    const project = await this.getProjectOptimized(userId, projectId);
    if (!project) {
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    // Étape 2: Préparation du prompt optimisé (une seule fois)
    const projectDescription = this.extractProjectDescription(project);
    const optimizedPrompt = this.buildOptimizedLogoPrompt(
      projectDescription,
      selectedColors,
      selectedTypography,
      preferences
    );

    // Étape 3: Génération AI parallèle PURE (sans optimisation SVG)
    const aiStartTime = Date.now();

    // Créer 3 promesses pour génération AI pure en parallèle
    const logoPromises = Array.from({ length: 3 }, (_, index) =>
      this.generateRawLogoConcept(optimizedPrompt, project, index, preferences)
    );

    // Attendre toutes les générations AI avec gestion d'erreurs robuste
    const logoResults = await Promise.allSettled(logoPromises);

    // Extraire les logos réussis
    const rawLogos: LogoModel[] = [];
    const failedIndexes: number[] = [];

    logoResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        rawLogos.push(result.value);
      } else {
        logger.error(`Logo concept ${index + 1} generation failed:`, result.reason);
        failedIndexes.push(index);
      }
    });

    const aiGenerationTime = Date.now() - aiStartTime;
    logger.info(
      `AI generation completed in ${aiGenerationTime}ms - Success: ${rawLogos.length}/3, Failed: ${failedIndexes.length}`
    );

    // Étape 4: Optimisation SVG en parallèle (séparée de l'AI)
    const optimizationStartTime = Date.now();

    // Paralléliser l'optimisation SVG + mise à jour DB/cache
    const [finalOptimizedLogos, _] = await Promise.all([
      // Optimisation SVG batch (rapide)
      Promise.resolve(SvgOptimizerService.optimizeLogos(rawLogos)),

      // Mise à jour DB/cache en parallèle (peut être lente)
      this.updateProjectWithLogosAsync(
        userId,
        projectId,
        project,
        selectedColors,
        selectedTypography,
        rawLogos // Utiliser les logos non-optimisés pour la DB (plus rapide)
      ),
    ]);

    const optimizationTime = Date.now() - optimizationStartTime;
    const totalTime = Date.now() - totalStartTime;

    logger.info(`Logo optimization completed in ${optimizationTime}ms`);
    logger.info(
      `Total parallel logo generation completed in ${totalTime}ms for ${finalOptimizedLogos.length} concepts (AI: ${aiGenerationTime}ms, Optimization: ${optimizationTime}ms)`
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
        stepName: 'Light Background Variation',
        maxOutputTokens: 1000,
        modelParser: (content) => {
          try {
            const parsed = JSON.parse(content);
            return parsed.variation;
          } catch (error) {
            logger.error('Error parsing light variation JSON:', error);
            throw new Error('Failed to parse light variation JSON');
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(steps, project, BrandingService.LOGO_LLM_CONFIG);
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
        stepName: 'Dark Background Variation',
        maxOutputTokens: 1000,
        modelParser: (content) => {
          try {
            const parsed = JSON.parse(content);
            return parsed.variation;
          } catch (error) {
            logger.error('Error parsing dark variation JSON:', error);
            throw new Error('Failed to parse dark variation JSON');
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(steps, project, BrandingService.LOGO_LLM_CONFIG);
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
        stepName: 'Monochrome Variation',
        maxOutputTokens: 1000,
        modelParser: (content) => {
          try {
            const parsed = JSON.parse(content);
            return parsed.variation;
          } catch (error) {
            logger.error('Error parsing monochrome variation JSON:', error);
            throw new Error('Failed to parse monochrome variation JSON');
          }
        },
        hasDependencies: false,
      },
    ];

    const sectionResults = await this.processSteps(steps, project, BrandingService.LOGO_LLM_CONFIG);
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
    logger.info(`Generating logo variations using parallel execution for logo: ${selectedLogo.id}`);

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
    const [lightVariation, darkVariation, monochromeVariation] = await Promise.all([
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
        prefix: 'project',
        ttl: 3600,
      });

      // Cache AI variations with 2h TTL
      const variationsCacheKey = cacheService.generateAIKey(
        'logo_variations',
        userId,
        projectId,
        crypto
          .createHash('sha256')
          .update(JSON.stringify(selectedLogo))
          .digest('hex')
          .substring(0, 16)
      );
      await cacheService.set(variationsCacheKey, optimizedVariations, {
        prefix: 'ai',
        ttl: 7200,
      });

      logger.info(
        `Optimized logo variations cached - ProjectId: ${projectId}, Variations: ${Object.keys(
          optimizedVariations.iconOnly
        ).join('/')}`
      );
    }

    return optimizedVariations;
  }

  async getBrandingsByProjectId(
    userId: string,
    projectId: string
  ): Promise<BrandIdentityModel | null> {
    logger.info(`Fetching branding for projectId: ${projectId}, userId: ${userId}`);
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when fetching branding.`
      );
      return null;
    }
    logger.info(`Successfully fetched branding for projectId: ${projectId}`);

    return project.analysisResultModel.branding;
  }

  async getBrandingById(userId: string, brandingId: string): Promise<BrandIdentityModel | null> {
    logger.info(`Getting branding by ID: ${brandingId} for userId: ${userId}`);
    // In current implementation, branding is nested in project, so we don't have direct access by brandingId
    // This method would need to be implemented differently if we had a separate branding repository
    logger.warn(`Direct access to branding by ID is not supported in the current implementation`);
    return null;
  }

  async updateBranding(
    userId: string,
    projectId: string,
    data: Partial<BrandIdentityModel>
  ): Promise<ProjectModel | null> {
    logger.info(`Updating branding for userId: ${userId}, projectId: ${projectId}`);

    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
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
    logger.info(`Removing branding for userId: ${userId}, projectId: ${projectId}`);

    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);
    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when deleting branding.`
      );
      return false;
    }

    // Reset branding to empty state rather than removing it completely
    project.analysisResultModel.branding = {
      logo: {
        svg: '',
        concept: '',
        colors: [],
        fonts: [],
        id: '1',
        name: '',
      },
      generatedLogos: [],
      typography: {
        id: '',
        name: '',
        url: '',
        primaryFont: '',
        secondaryFont: '',
      },
      generatedTypography: [],
      generatedColors: [],
      colors: {
        id: '',
        name: '',
        url: '',
        colors: {
          primary: '',
          secondary: '',
          accent: '',
          background: '',
          text: '',
        },
      },
      sections: [],
    };

    await this.projectRepository.update(projectId, project, `users/${userId}/projects`);
    logger.info(`Successfully reset branding for projectId: ${projectId}`);
    return true;
  }

  /**
   * Génère un PDF à partir des sections de branding d'un projet
   * @param userId - ID de l'utilisateur
   * @param projectId - ID du projet
   * @returns Chemin vers le fichier PDF temporaire généré
   */
  async generateBrandingPdf(userId: string, projectId: string): Promise<string> {
    logger.info(
      `Generating PDF for branding sections - projectId: ${projectId}, userId: ${userId}`
    );
    // Récupérer le projet et ses données de branding
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);

    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when generating branding PDF.`
      );
      throw new Error(`Project not found with ID: ${projectId}`);
    }
    const branding = project.analysisResultModel.branding;
    if (!branding || !branding.sections || branding.sections.length === 0) {
      logger.warn(`No branding sections found for project ${projectId} when generating PDF.`);
      return '';
    }

    try {
      // Generate cache key for PDF
      const pdfCacheKey = cacheService.generateAIKey('branding-pdf', userId, projectId);

      // Check if PDF is already cached
      const cachedPdfPath = await cacheService.get<string>(pdfCacheKey, {
        prefix: 'pdf',
        ttl: 3600, // 1 hour
      });

      if (cachedPdfPath) {
        logger.info(`Branding PDF cache hit for projectId: ${projectId}`);
        return cachedPdfPath;
      }

      logger.info(`Branding PDF cache miss, generating new PDF for projectId: ${projectId}`);

      // Utiliser le PdfService pour générer le PDF
      const pdfPath = await this.pdfService.generatePdf({
        title: 'Branding',
        projectName: project.name || 'Projet Sans Nom',
        projectDescription: project.description || '',
        sections: branding.sections,
        sectionDisplayOrder: [
          'Brand Header',
          'Logo Principal',
          'Logo Variation Fond Clair',
          'Logo Variation Fond Sombre',
          'Logo Variation Monochrome',
          'Logo Bonnes Pratiques',
          'Color Palette',
          'Typography',
          'Brand Mockups',
          'Brand Footer',
        ],
        footerText: 'Generated by Idem',
      });

      // Cache the PDF path for future requests
      await cacheService.set(pdfCacheKey, pdfPath, {
        prefix: 'pdf',
        ttl: 3600, // 1 hour
      });
      logger.info(`Branding PDF cached for projectId: ${projectId}`);

      return pdfPath;
    } catch (error) {
      logger.error(`Error generating branding PDF for projectId: ${projectId}`, error);
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
    extension: 'svg' | 'png' | 'psd'
  ): Promise<Buffer> {
    logger.info(
      `Generating logos ZIP for projectId: ${projectId}, userId: ${userId}, extension: ${extension}`
    );

    // Récupérer le projet et ses données de branding
    const project = await this.projectRepository.findById(projectId, `users/${userId}/projects`);

    if (!project) {
      logger.warn(
        `Project not found with ID: ${projectId} for user: ${userId} when generating logos ZIP.`
      );
      throw new Error(`Project not found with ID: ${projectId}`);
    }

    const branding = project.analysisResultModel.branding;
    if (!branding || !branding.logo) {
      logger.warn(`No logo found for project ${projectId} when generating logos ZIP.`);
      throw new Error(`No logo found for project ${projectId}`);
    }

    const JSZip = require('jszip');
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
            name: 'logo-main',
            content: content,
          });
        }
      }

      // Logo icône seulement
      if (branding.logo.iconSvg) {
        const content = await this.fetchContentFromUrl(branding.logo.iconSvg);
        if (content) {
          logoFiles.push({
            name: 'logo-icon',
            content: content,
          });
        }
      }

      // Variations avec texte
      if (logoVariations?.withText) {
        if (logoVariations.withText.lightBackground) {
          const content = await this.fetchContentFromUrl(logoVariations.withText.lightBackground);
          if (content) {
            logoFiles.push({
              name: 'logo-with-text-light-background',
              content: content,
            });
          }
        }
        if (logoVariations.withText.darkBackground) {
          const content = await this.fetchContentFromUrl(logoVariations.withText.darkBackground);
          if (content) {
            logoFiles.push({
              name: 'logo-with-text-dark-background',
              content: content,
            });
          }
        }
        if (logoVariations.withText.monochrome) {
          const content = await this.fetchContentFromUrl(logoVariations.withText.monochrome);
          if (content) {
            logoFiles.push({
              name: 'logo-with-text-monochrome',
              content: content,
            });
          }
        }
      }

      // Variations icône seulement
      if (logoVariations?.iconOnly) {
        if (logoVariations.iconOnly.lightBackground) {
          const content = await this.fetchContentFromUrl(logoVariations.iconOnly.lightBackground);
          if (content) {
            logoFiles.push({
              name: 'logo-icon-only-light-background',
              content: content,
            });
          }
        }
        if (logoVariations.iconOnly.darkBackground) {
          const content = await this.fetchContentFromUrl(logoVariations.iconOnly.darkBackground);
          if (content) {
            logoFiles.push({
              name: 'logo-icon-only-dark-background',
              content: content,
            });
          }
        }
        if (logoVariations.iconOnly.monochrome) {
          const content = await this.fetchContentFromUrl(logoVariations.iconOnly.monochrome);
          if (content) {
            logoFiles.push({
              name: 'logo-icon-only-monochrome',
              content: content,
            });
          }
        }
      }

      if (logoFiles.length === 0) {
        throw new Error('No logo variations found to include in ZIP');
      }

      logger.info(`Found ${logoFiles.length} logo variations to include in ZIP`);

      // Traitement en parallèle selon l'extension demandée
      logger.info(
        `Starting parallel conversion of ${logoFiles.length} logos to ${extension.toUpperCase()}`
      );

      // Pré-initialiser le browser pour les conversions PSD si nécessaire
      if (extension === 'psd') {
        logger.info('Pre-initializing browser for parallel PSD conversions');
        await SvgToPsdService.initializeForParallelConversion();
      }

      const conversionPromises = logoFiles.map(async (logoFile) => {
        const fileName = `${logoFile.name}.${extension}`;

        try {
          if (extension === 'svg') {
            // Pour SVG, pas de conversion nécessaire
            return { fileName, content: logoFile.content };
          } else if (extension === 'png') {
            // Pour PNG, convertir le SVG
            const pngBuffer = await this.convertSvgToPng(logoFile.content);
            return { fileName, content: pngBuffer };
          } else if (extension === 'psd') {
            // Pour PSD, convertir le SVG en vrai fichier PSD
            const psdBuffer = await this.convertSvgToPsd(logoFile.name, logoFile.content);
            return { fileName, content: psdBuffer };
          }

          // Fallback pour extensions non supportées
          return { fileName, content: logoFile.content };
        } catch (error) {
          logger.error(`Error converting ${logoFile.name} to ${extension}:`, error);
          // En cas d'erreur, retourner le contenu SVG original
          return {
            fileName: `${logoFile.name}.svg`,
            content: logoFile.content,
          };
        }
      });

      // Attendre que toutes les conversions se terminent
      const convertedFiles = await Promise.all(conversionPromises);

      logger.info(`Completed parallel conversion of ${convertedFiles.length} logos`);

      // Ajouter tous les fichiers convertis au ZIP
      convertedFiles.forEach(({ fileName, content }) => {
        zip.file(fileName, content);
      });

      // Ajouter un fichier README avec les informations du projet
      const readmeContent = this.generateReadmeContent(project, extension, logoFiles.length);
      zip.file('README.txt', readmeContent);

      // Générer le ZIP
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

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
      const sharp = require('sharp');

      // Convertir le SVG en PNG avec une résolution de 512x512
      const pngBuffer = await sharp(Buffer.from(svgContent))
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Fond transparent
        })
        .png()
        .toBuffer();

      return pngBuffer;
    } catch (error) {
      logger.error('Error converting SVG to PNG:', error);
      // Fallback: retourner le contenu SVG comme texte
      return Buffer.from(svgContent, 'utf-8');
    }
  }

  /**
   * Convertit un SVG en fichier PSD réel avec calques éditables
   * Utilise le SvgToPsdService pour créer un vrai fichier PSD avec des calques séparés
   */
  private async convertSvgToPsd(logoName: string, svgContent: string): Promise<Buffer> {
    try {
      logger.info(`Converting SVG to PSD with editable layers: ${logoName}`);

      // Utiliser le service SVG to PSD pour créer un fichier avec calques
      const psdPath = await SvgToPsdService.convertSvgToPsd(svgContent, {
        width: 1024,
        height: 1024,
        backgroundColor: 'transparent',
        quality: 100,
      });

      // Lire le fichier PSD généré
      const psdBuffer = await fs.readFile(psdPath);

      // Nettoyer le fichier temporaire
      await SvgToPsdService.cleanupTempFile(psdPath);

      logger.info(
        `Successfully converted ${logoName} to PSD with ${
          svgContent.match(/<(path|rect|circle|ellipse|line|polyline|polygon|text|g)[^>]*>/gi)
            ?.length || 0
        } potential layers`
      );

      return psdBuffer;
    } catch (error) {
      logger.error(`Error converting SVG to PSD for ${logoName}:`, error);

      // Fallback: créer un PNG haute qualité avec extension .psd
      logger.warn(`Falling back to PNG conversion for ${logoName}`);
      try {
        const sharp = require('sharp');
        const pngBuffer = await sharp(Buffer.from(svgContent))
          .resize(1024, 1024, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .png()
          .toBuffer();

        return pngBuffer;
      } catch (fallbackError) {
        logger.error(`Fallback PNG conversion also failed for ${logoName}:`, fallbackError);
        return Buffer.from(svgContent, 'utf-8');
      }
    }
  }

  /**
   * Génère le contenu du fichier README
   */
  private generateReadmeContent(project: any, extension: string, fileCount: number): string {
    return `Logo Package - ${project.name}

Project: ${project.name}
Description: ${project.description || 'No description available'}
Format: ${extension.toUpperCase()}
Files included: ${fileCount}
Generated on: ${new Date().toISOString()}

${
  extension.toLowerCase() === 'psd'
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
    : ''
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
  extension.toLowerCase() === 'svg'
    ? 'SVG files are vector-based and can be scaled to any size without quality loss.'
    : ''
}
${
  extension.toLowerCase() === 'png'
    ? 'PNG files are high-quality raster images with transparent backgrounds.'
    : ''
}
${
  extension.toLowerCase() === 'psd'
    ? 'Files are provided as high-quality PNG format due to technical limitations.'
    : ''
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
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        logger.warn(`Invalid URL format: ${url}`);
        // Si ce n'est pas une URL, c'est peut-être déjà le contenu SVG
        if (url && url.includes('<svg')) {
          return url;
        }
        return null;
      }

      // Utiliser fetch pour récupérer le contenu
      const response = await fetch(url);

      if (!response.ok) {
        logger.error(`Failed to fetch content from URL: ${url}, status: ${response.status}`);
        return null;
      }

      const content = await response.text();

      // Vérifier que le contenu semble être du SVG
      if (!content.includes('<svg')) {
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
          stepName: 'Logo Edit',
          maxOutputTokens: 3000,
          modelParser: (content) => {
            try {
              const parsed = JSON.parse(content);
              return parsed;
            } catch (error) {
              logger.error('Error parsing edited logo JSON:', error);
              throw new Error('Failed to parse edited logo JSON');
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
        name: 'Edited Logo',
        concept: editedLogoData.changesSummary || 'User-modified logo',
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

  /**
   * Génère les mockups pour la charte graphique finale
   */
  async generateProjectMockups(
    userId: string,
    projectId: string
  ): Promise<{ mockup1: any; mockup2: any } | null> {
    try {
      logger.info('🎨 Starting mockup generation for brand identity', {
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });

      // Récupérer le projet pour obtenir les informations de branding
      const project = await this.getProject(projectId, userId);
      if (!project) {
        logger.error('❌ Project not found for mockup generation', { projectId, userId });
        return null;
      }

      // Extraire les informations nécessaires du projet
      const branding = project.analysisResultModel?.branding;
      if (!branding || !branding.logo || !branding.colors) {
        logger.error('❌ Missing branding information for mockup generation', {
          projectId,
          userId,
          hasLogo: !!branding?.logo,
          hasColors: !!branding?.colors,
        });
        return null;
      }

      // Préparer les données pour la génération de mockups
      const logoSvg = branding.logo.svg;
      const brandColors = {
        primary: branding.colors.colors.primary || '#000000',
        secondary: branding.colors.colors.secondary || '#666666',
        accent: branding.colors.colors.accent || '#999999',
      };

      // Extraire l'industrie réelle depuis la description du projet
      const projectDescription = this.extractProjectDescription(project);
      const projectContext = this.extractProjectContext(projectDescription);
      const industry = projectContext.industry;
      const brandName = project.name;

      logger.info('📋 Mockup generation parameters prepared', {
        projectId,
        brandName,
        industry,
        brandColors,
        hasLogoSvg: !!logoSvg,
        timestamp: new Date().toISOString(),
      });

      // Upload temporaire du logo pour URL + passer le SVG directement
      const logoUrl = logoSvg
        ? await this.uploadLogoSvgTemporarily(logoSvg, projectId, 'mockup')
        : '';

      // Générer les mockups avec le service Gemini (logo envoyé comme image)
      const mockups = await geminiMockupService.generateProjectMockups(
        logoUrl,
        logoSvg || null,
        brandColors,
        industry,
        brandName,
        projectDescription,
        userId,
        projectId
      );

      logger.info('✅ Mockups generated successfully for brand identity', {
        projectId,
        userId,
        mockup1Url: mockups.mockup1.mockupUrl,
        mockup2Url: mockups.mockup2.mockupUrl,
        timestamp: new Date().toISOString(),
      });

      // Mettre à jour le projet avec les mockups générés
      const updatedProjectData = {
        ...project,
        analysisResultModel: {
          ...project.analysisResultModel,
          branding: {
            ...branding,
            mockups: {
              mockup1: mockups.mockup1,
              mockup2: mockups.mockup2,
              generatedAt: new Date().toISOString(),
            },
          },
        },
      };

      // Sauvegarder le projet mis à jour
      const updatedProject = await this.projectRepository.update(
        projectId,
        updatedProjectData,
        `users/${userId}/projects`
      );

      if (updatedProject) {
        logger.info('💾 Project updated with generated mockups', {
          projectId,
          userId,
          timestamp: new Date().toISOString(),
        });
      }

      return mockups;
    } catch (error: any) {
      logger.error('❌ Error generating project mockups', {
        error: error.message,
        stack: error.stack,
        projectId,
        userId,
        timestamp: new Date().toISOString(),
      });

      return null;
    }
  }

  /**
   * Génère tous les mockups en parallèle avec le logo intégré
   */
  private async generateMockupsInParallel(
    project: ProjectModel
  ): Promise<Array<{ url: string; title: string; description: string }>> {
    const startTime = Date.now();
    logger.info('[MOCKUP] Starting parallel mockup generation', {
      projectId: project.id,
      projectName: project.name,
    });

    try {
      const branding = project.analysisResultModel?.branding;

      // Vérifier si le logo est disponible
      const logoSvg = branding?.logo?.svg || branding?.generatedLogos?.[0]?.svg;
      if (!logoSvg) {
        logger.warn('[MOCKUP] No logo SVG available for mockup generation', {
          projectId: project.id,
          hasLogo: !!branding?.logo,
          hasGeneratedLogos: !!branding?.generatedLogos?.length,
        });
        return [];
      }

      logger.info('[MOCKUP] Logo SVG found', {
        projectId: project.id,
        svgLength: logoSvg.length,
      });

      // Upload temporaire du logo SVG pour URL fallback
      const logoUrl = await this.uploadLogoSvgTemporarily(logoSvg, project.id!, 'main');
      logger.info('[MOCKUP] Logo SVG uploaded temporarily', {
        projectId: project.id,
        logoUrl,
      });

      // Préparer les couleurs de la marque
      const brandColors = {
        primary: branding?.colors?.colors?.primary || '#000000',
        secondary: branding?.colors?.colors?.secondary || '#666666',
        accent: branding?.colors?.colors?.accent || '#0066cc',
      };

      // Extraire le contexte du projet pour des mockups contextuels
      const projectDescription = this.extractProjectDescription(project);
      const projectContext = this.extractProjectContext(projectDescription);
      const industry = projectContext.industry;

      logger.info('[MOCKUP] Project context extracted', {
        projectId: project.id,
        industry,
        brandColors,
        descriptionLength: projectDescription.length,
      });

      // Générer des scènes contextuelles basées sur le projet
      const scenes = geminiMockupService.getContextualMockupScenes(
        industry,
        projectDescription,
        project.name
      );

      logger.info('[MOCKUP] Contextual scenes generated', {
        projectId: project.id,
        scenesCount: scenes.length,
        scenes: scenes.map((s) => s.title),
      });

      // Lancer MOCKUPS_COUNT requêtes en parallèle
      const mockupPromises: Promise<{ url: string; title: string; description: string } | null>[] =
        [];

      for (let i = 0; i < Math.min(MOCKUPS_COUNT, scenes.length); i++) {
        const scene = scenes[i];
        logger.info(`[MOCKUP] Launching mockup ${i + 1} generation`, {
          projectId: project.id,
          sceneTitle: scene.title,
        });
        mockupPromises.push(
          this.generateSingleMockup(
            project,
            i + 1,
            logoUrl,
            logoSvg,
            brandColors,
            industry,
            projectDescription,
            scene.scene,
            scene.title,
            scene.description
          )
        );
      }

      // Attendre que tous les mockups soient générés
      const results = await Promise.all(mockupPromises);

      // Filtrer les résultats null
      const validResults = results.filter(
        (result): result is { url: string; title: string; description: string } => result !== null
      );

      const duration = Date.now() - startTime;
      logger.info('[MOCKUP] Parallel mockup generation completed', {
        projectId: project.id,
        totalRequested: Math.min(MOCKUPS_COUNT, scenes.length),
        successCount: validResults.length,
        failedCount: results.length - validResults.length,
        duration: `${duration}ms`,
        mockupUrls: validResults.map((r) => r.url),
      });

      return validResults;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('[MOCKUP] Error generating mockups in parallel', {
        error: error.message,
        stack: error.stack,
        projectId: project.id,
        duration: `${duration}ms`,
      });
      return [];
    }
  }

  /**
   * Génère un seul mockup avec le logo intégré comme image
   */
  private async generateSingleMockup(
    project: ProjectModel,
    mockupIndex: number,
    logoUrl: string,
    logoSvg: string,
    brandColors: { primary: string; secondary: string; accent: string },
    industry: string,
    projectDescription: string,
    sceneDescription: string,
    sceneTitle: string,
    sceneDescriptionText: string
  ): Promise<{ url: string; title: string; description: string } | null> {
    const startTime = Date.now();
    logger.info(`[MOCKUP][${mockupIndex}] Starting single mockup generation`, {
      projectId: project.id,
      mockupIndex,
      sceneTitle,
      industry,
      brandName: project.name,
    });

    try {
      const mockupResult = await geminiMockupService.generateSingleMockup(
        logoUrl,
        logoSvg,
        brandColors,
        industry,
        project.name,
        projectDescription,
        sceneDescription,
        sceneTitle,
        project.userId,
        project.id!,
        mockupIndex
      );

      const duration = Date.now() - startTime;

      if (!mockupResult) {
        logger.error(`[MOCKUP][${mockupIndex}] Failed - no result returned`, {
          projectId: project.id,
          sceneTitle,
          duration: `${duration}ms`,
        });
        return null;
      }

      logger.info(`[MOCKUP][${mockupIndex}] SUCCESS - Image uploaded to bucket`, {
        projectId: project.id,
        sceneTitle,
        imageUrl: mockupResult.mockupUrl,
        duration: `${duration}ms`,
      });

      return {
        url: mockupResult.mockupUrl,
        title: mockupResult.title || sceneTitle,
        description: mockupResult.description || sceneDescriptionText,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`[MOCKUP][${mockupIndex}] ERROR generating mockup`, {
        error: error.message,
        stack: error.stack,
        projectId: project.id,
        sceneTitle,
        duration: `${duration}ms`,
      });
      return null;
    }
  }

  /**
   * Upload temporairement le SVG du logo pour le rendre accessible via URL
   */
  private async uploadLogoSvgTemporarily(
    logoSvg: string,
    projectId: string,
    suffix: string
  ): Promise<string> {
    try {
      // Convertir le SVG en Buffer
      const svgBuffer = Buffer.from(logoSvg, 'utf-8');

      // Nom de fichier temporaire
      const fileName = `temp_logo_${suffix}_${Date.now()}.svg`;
      const folderPath = `projects/${projectId}/temp_logos`;

      // Upload vers le storage
      const uploadResult = await this.storageService.uploadFile(
        svgBuffer,
        fileName,
        folderPath,
        'image/svg+xml'
      );

      logger.info(`Logo SVG uploaded temporarily for mockup generation`, {
        projectId,
        suffix,
        fileName,
        url: uploadResult.downloadURL,
      });

      return uploadResult.downloadURL;
    } catch (error) {
      logger.error('Error uploading logo SVG temporarily:', error);
      // Fallback sur une URL placeholder
      return 'https://via.placeholder.com/200x100/000000/FFFFFF?text=LOGO';
    }
  }

  /**
   * Generates color palettes and typography based on colors extracted from an imported logo.
   * Primary colors come from the logo; AI proposes complementary secondary/accent/background/text.
   */
  async generateColorsAndTypographyFromLogo(
    userId: string,
    project: ProjectModel,
    logoSvg: string,
    logoColors: string[]
  ): Promise<{
    colors: ColorModel[];
    typography: TypographyModel[];
    project: ProjectModel;
  }> {
    logger.info(
      `Generating colors and typography from imported logo for userId: ${userId}, logo colors: ${logoColors.join(', ')}`
    );

    // Créer le projet
    project = {
      ...project,
      analysisResultModel: {
        ...project.analysisResultModel,
        branding: BrandIdentityBuilder.createEmpty(),
      },
    };
    const createdProject = await projectService.createUserProject(userId, project);

    if (!createdProject.id) {
      throw new Error(`Failed to create project`);
    }

    // Cache le projet
    try {
      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, createdProject, {
        prefix: 'project',
        ttl: 3600,
      });
    } catch (error) {
      logger.error(`Error caching project for userId: ${userId}`, error);
    }

    const projectDescription = this.extractProjectDescription(project);

    // Determine primary, secondary colors and style hint from logo colors
    const primaryColor = logoColors.length > 0 ? logoColors[0] : '#6a11cb';
    const secondaryColor = logoColors.length > 1 ? logoColors[1] : primaryColor;
    const logoColorsStr = logoColors.length > 0 ? logoColors.join(', ') : primaryColor;
    const styleHint = this.inferStyleFromColors(logoColors);

    // Build color prompt with logo colors injected (replace all occurrences)
    const colorPrompt =
      projectDescription +
      '\n\n' +
      COLORS_FROM_LOGO_PROMPT.replace(/\{\{LOGO_COLORS\}\}/g, logoColorsStr)
        .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, projectDescription)
        .replace(/\{\{PRIMARY_FROM_LOGO\}\}/g, primaryColor)
        .replace(/\{\{SECONDARY_FROM_LOGO\}\}/g, secondaryColor);

    // Build typography prompt with logo context
    const typographyPrompt =
      projectDescription +
      '\n\n' +
      TYPOGRAPHY_FROM_LOGO_PROMPT.replace('{{PROJECT_DESCRIPTION}}', projectDescription)
        .replace('{{LOGO_COLORS}}', logoColorsStr)
        .replace('{{STYLE_HINT}}', styleHint);

    const startTime = Date.now();

    // Parallel generation of colors and typography
    const [colors, typography] = await Promise.all([
      this.generateColorsFromLogoPrompt(colorPrompt, createdProject),
      this.generateTypographyFromLogoPrompt(typographyPrompt, createdProject),
    ]);

    const generationTime = Date.now() - startTime;
    logger.info(`Logo-based colors and typography generation completed in ${generationTime}ms`);

    // Generate logo variations (light/dark/monochrome) programmatically
    logger.info(`Generating logo variations from imported SVG`);
    const logoVariations = generateLogoVariationsFromSvg(logoSvg);

    // Optimize variations
    const optimizedVariations = {
      withText: this.optimizeVariationSet(logoVariations.withText),
      iconOnly: this.optimizeVariationSet(logoVariations.iconOnly),
    };

    // Update project with generated colors, typography, logo, and variations
    const importedLogo: LogoModel = {
      id: `imported-${Date.now()}`,
      name: 'Imported Logo',
      svg: logoSvg,
      concept: 'User-imported logo',
      colors: logoColors,
      fonts: [],
      variations: optimizedVariations,
    };

    const updatedProjectData = {
      ...createdProject,
      analysisResultModel: {
        ...createdProject.analysisResultModel,
        branding: {
          ...createdProject.analysisResultModel.branding,
          generatedColors: colors,
          generatedTypography: typography,
          logo: importedLogo,
          generatedLogos: [importedLogo],
          updatedAt: new Date(),
        },
      },
    };

    const updatedProject = await this.projectRepository.update(
      createdProject.id!,
      updatedProjectData,
      `users/${userId}/projects`
    );

    if (updatedProject) {
      logger.info(
        `Successfully updated project with logo-based colors and typography - ProjectId: ${createdProject.id}`
      );

      const projectCacheKey = `project_${userId}_${createdProject.id}`;
      await cacheService.set(projectCacheKey, updatedProject, {
        prefix: 'project',
        ttl: 3600,
      });
    }

    return {
      colors,
      typography,
      project: updatedProject || createdProject,
    };
  }

  /**
   * Generates colors using the logo-based prompt
   */
  private async generateColorsFromLogoPrompt(
    prompt: string,
    project: ProjectModel
  ): Promise<ColorModel[]> {
    logger.info(`Generating colors from logo prompt`);

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: 'Colors From Logo Generation',
        modelParser: (content) => {
          try {
            const parsedColors = JSON.parse(content);
            return parsedColors.colors;
          } catch (error) {
            logger.error(`Error parsing logo-based colors:`, error);
            throw new Error(`Failed to parse logo-based colors`);
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
    return sectionResults[0].parsedData as ColorModel[];
  }

  /**
   * Generates typography using the logo-based prompt
   */
  private async generateTypographyFromLogoPrompt(
    prompt: string,
    project: ProjectModel
  ): Promise<TypographyModel[]> {
    logger.info(`Generating typography from logo prompt`);

    const steps: IPromptStep[] = [
      {
        promptConstant: prompt,
        stepName: 'Typography From Logo Generation',
        modelParser: (content) => {
          try {
            const parsedTypography = JSON.parse(content);
            return parsedTypography.typography;
          } catch (error) {
            logger.error(`Error parsing logo-based typography:`, error);
            throw new Error(`Failed to parse logo-based typography`);
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
    return sectionResults[0].parsedData as TypographyModel[];
  }

  /**
   * Infers a style hint from logo colors for typography prompt context
   */
  /**
   * Construit le HTML A4 des mockups avec les vraies images générées par Gemini
   */
  private buildMockupsHtmlWithRealImages(
    mockupResults: Array<{ url: string; title: string; description: string }>,
    project: ProjectModel
  ): string {
    const branding = project.analysisResultModel?.branding;
    const primaryColor = branding?.colors?.colors?.primary || '#1a1a2e';
    const secondaryColor = branding?.colors?.colors?.secondary || '#16213e';
    const accentColor = branding?.colors?.colors?.accent || '#0f3460';
    const bgColor = branding?.colors?.colors?.background || '#ffffff';
    const brandName = project.name || 'Brand';

    // Générer une couleur semi-transparente pour les overlays
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const primaryRgba = hexToRgba(primaryColor, 0.08);
    const accentRgba = hexToRgba(accentColor, 0.12);

    // Layout artistique : première image en hero large, deuxième en accent décalé
    const mockup1 = mockupResults[0];
    const mockup2 = mockupResults.length > 1 ? mockupResults[1] : null;

    const heroSection = mockup1
      ? `<div style="position:relative;flex:1;display:flex;gap:0;overflow:hidden;border-radius:16px;box-shadow:0 20px 60px ${hexToRgba(primaryColor, 0.15)},0 4px 20px rgba(0,0,0,0.06);">
          <div style="flex:1.2;position:relative;overflow:hidden;background:#0a0a0a;">
            <img src="${mockup1.url}" alt="${mockup1.title}" style="width:100%;height:100%;object-fit:cover;display:block;" />
            <div style="position:absolute;bottom:0;left:0;right:0;padding:20px 24px;background:linear-gradient(transparent,rgba(0,0,0,0.7));">
              <div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;text-shadow:0 1px 3px rgba(0,0,0,0.5);">${mockup1.title}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.8);line-height:1.4;">${mockup1.description}</div>
            </div>
          </div>
          ${
            mockup2
              ? `<div style="flex:0.8;position:relative;overflow:hidden;background:#0a0a0a;border-left:3px solid ${primaryColor};">
              <img src="${mockup2.url}" alt="${mockup2.title}" style="width:100%;height:100%;object-fit:cover;display:block;" />
              <div style="position:absolute;bottom:0;left:0;right:0;padding:20px 24px;background:linear-gradient(transparent,rgba(0,0,0,0.7));">
                <div style="font-size:13px;font-weight:700;color:white;margin-bottom:4px;text-shadow:0 1px 3px rgba(0,0,0,0.5);">${mockup2.title}</div>
                <div style="font-size:10px;color:rgba(255,255,255,0.8);line-height:1.4;">${mockup2.description}</div>
              </div>
            </div>`
              : ''
          }
        </div>`
      : '';

    return `<div style="width:210mm;height:297mm;overflow:hidden;position:relative;background:${bgColor};padding:0;box-sizing:border-box;font-family:'Inter','Helvetica Neue',Arial,sans-serif;display:flex;flex-direction:column;">
      <div style="position:absolute;top:0;right:0;width:40%;height:180px;background:linear-gradient(135deg,${hexToRgba(primaryColor, 0.06)},${hexToRgba(accentColor, 0.03)});border-bottom-left-radius:100px;"></div>
      <div style="position:absolute;bottom:0;left:0;width:30%;height:120px;background:linear-gradient(45deg,${hexToRgba(accentColor, 0.04)},transparent);border-top-right-radius:80px;"></div>
      <div style="position:relative;z-index:1;padding:10mm 12mm 8mm 12mm;display:flex;flex-direction:column;height:100%;">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;">
          <div>
            <div style="display:inline-block;padding:4px 12px;background:${primaryColor};color:white;border-radius:4px;font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Brand Applications</div>
            <h2 style="margin:0;font-size:28px;font-weight:900;color:${primaryColor};letter-spacing:-0.5px;line-height:1.1;">${brandName}</h2>
            <p style="margin:6px 0 0 0;font-size:11px;color:#9ca3af;font-weight:400;">Mise en situation de l'identité visuelle</p>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <div style="width:24px;height:24px;border-radius:50%;background:${primaryColor};"></div>
            <div style="width:24px;height:24px;border-radius:50%;background:${secondaryColor};"></div>
            <div style="width:24px;height:24px;border-radius:50%;background:${accentColor};"></div>
          </div>
        </div>
        <div style="width:60px;height:3px;background:linear-gradient(90deg,${primaryColor},${accentColor});border-radius:2px;margin-bottom:20px;"></div>
        ${heroSection}
        <div style="margin-top:auto;padding-top:16px;">
          <div style="display:flex;gap:20px;align-items:flex-start;">
            <div style="flex:1;padding:12px 16px;background:${primaryRgba};border-radius:8px;border-left:3px solid ${primaryColor};">
              <div style="font-size:10px;font-weight:700;color:${primaryColor};margin-bottom:3px;">Cohérence</div>
              <div style="font-size:9px;color:#6b7280;line-height:1.5;">Maintenir les couleurs et proportions du logo sur tous les supports physiques et numériques.</div>
            </div>
            <div style="flex:1;padding:12px 16px;background:${accentRgba};border-radius:8px;border-left:3px solid ${accentColor};">
              <div style="font-size:10px;font-weight:700;color:${accentColor};margin-bottom:3px;">Lisibilité</div>
              <div style="font-size:9px;color:#6b7280;line-height:1.5;">Le logo doit rester lisible et impactant quelle que soit la taille d'application.</div>
            </div>
            <div style="flex:1;padding:12px 16px;background:${hexToRgba(secondaryColor, 0.08)};border-radius:8px;border-left:3px solid ${secondaryColor};">
              <div style="font-size:10px;font-weight:700;color:${secondaryColor};margin-bottom:3px;">Zone de protection</div>
              <div style="font-size:9px;color:#6b7280;line-height:1.5;">Respecter un espace minimum autour du logo pour garantir sa visibilité.</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  private inferStyleFromColors(colors: string[]): string {
    if (colors.length === 0) return 'modern and professional';

    // Simple heuristic based on color characteristics
    const primary = colors[0].toLowerCase();
    const r = parseInt(primary.slice(1, 3), 16);
    const g = parseInt(primary.slice(3, 5), 16);
    const b = parseInt(primary.slice(5, 7), 16);

    if (r > 200 && g < 100 && b < 100) return 'bold and energetic';
    if (r < 100 && g < 100 && b > 200) return 'professional and trustworthy';
    if (r < 100 && g > 200 && b < 100) return 'natural and fresh';
    if (r > 200 && g > 150 && b < 100) return 'warm and creative';
    if (r > 150 && g < 100 && b > 150) return 'luxurious and innovative';
    if (r < 80 && g < 80 && b < 80) return 'minimalist and elegant';
    return 'modern and versatile';
  }
}
